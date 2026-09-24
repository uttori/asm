/** Configurable, snapshot-backed source information using native editor decorations and hovers. */
import * as path from "node:path";

import type { AnalysisProjectManifest } from "@uttori/asm-disassembler";
import {
  commands,
  ConfigurationTarget,
  DecorationRangeBehavior,
  Hover,
  MarkdownString,
  Range,
  ThemeColor,
  window,
  workspace,
  type CancellationToken,
  type Disposable,
  type Position,
  type TextDocument,
  type TextEditor,
  type TextEditorDecorationType,
  type Uri,
} from "vscode";

import {
  readEditorInformationConfiguration,
  INFORMATION_PRESETS,
  type EditorInformationConfiguration,
} from "../editor-info/configuration.js";
import {
  INFORMATION_FIELDS,
  compileTemplate,
  renderInformation,
  renderTemplate,
  templateRequirements,
} from "../editor-info/format.js";
import { EditorInformationProvider } from "../editor-info/provider.js";
import { formatInstructionAnnotationDetails } from "./annotation-format.js";
import { annotationOverlayColumn, annotationSourceColumns } from "./annotation-layout.js";
import { findAnalysisProjectDirectories } from "./coverage-tree.js";
import { discoverAnalysisDebugMapFiles } from "./debug-maps.js";
import { analysisWorker } from "./worker-client.js";

/** Existing toolbar command ID remains stable for saved keybindings. */
export const TOGGLE_ANALYSIS_ANNOTATIONS_COMMAND = "asm.analysis.toggleAnnotations";

/**
 * Use each resource's folder scope, falling back to personal settings outside a workspace.
 * @param {Uri | undefined} uri Active resource, when available.
 * @returns {ConfigurationTarget} Scope for explicit user actions.
 */
const configurationTarget = (uri: Uri | undefined): ConfigurationTarget =>
  uri && workspace.getWorkspaceFolder(uri)
    ? ConfigurationTarget.WorkspaceFolder
    : ConfigurationTarget.Global;

/** Independent per-editor generations prevent late viewport work from repainting another editor. */
export class AnalysisAnnotationController implements Disposable {
  readonly #decoration: TextEditorDecorationType;
  readonly #disposables: Disposable[] = [];
  readonly #timers = new Map<TextEditor, ReturnType<typeof setTimeout>>();
  readonly #generations = new WeakMap<TextEditor, number>();
  readonly #reportedIssues = new Set<string>();
  #disposed = false;

  constructor(
    readonly provider = new EditorInformationProvider({
      discoverMaps: discoverAnalysisDebugMapFiles,
      projects: async () => {
        const projects: { directory: string; manifest: AnalysisProjectManifest }[] = [];
        for (const directory of await findAnalysisProjectDirectories()) {
          try {
            projects.push({
              directory,
              manifest: await analysisWorker().request<AnalysisProjectManifest>(
                directory,
                "manifest",
              ),
            });
          } catch {
            /* One unavailable analysis project must not hide valid build information. */
          }
        }
        return projects;
      },
      request: (directory, operation, options) =>
        analysisWorker().request(directory, operation, options),
    }),
  ) {
    this.#decoration = window.createTextEditorDecorationType({
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
    });
    this.#disposables.push(
      commands.registerCommand("asm.editorInfo.choosePreset", () => this.choosePreset()),
      commands.registerCommand("asm.editorInfo.configureInline", () => this.configureInline()),
      commands.registerCommand("asm.editorInfo.inspectLine", () => this.inspectLine()),
    );
    const watcher = workspace.createFileSystemWatcher("**/*");
    const changed = (uri: Uri): void => {
      if (this.provider.tracks(uri.fsPath)) {
        this.invalidate();
      }
    };
    this.#disposables.push(
      watcher,
      watcher.onDidChange(changed),
      watcher.onDidCreate(changed),
      watcher.onDidDelete(changed),
    );
  }

  #configuration(uri: Uri): EditorInformationConfiguration {
    const result = readEditorInformationConfiguration(workspace.getConfiguration("asm", uri));
    for (const issue of result.issues) {
      if (!this.#reportedIssues.has(issue)) {
        this.#reportedIssues.add(issue);
        void window.showWarningMessage(issue);
      }
    }
    return result;
  }

  #dirtyFiles(): ReadonlySet<string> {
    return new Set(
      workspace.textDocuments
        .filter((document) => document.isDirty && document.uri.scheme === "file")
        .map((document) => path.resolve(document.uri.fsPath)),
    );
  }

  /** Invalidate data only when inputs change; display-only refreshes reuse the same cached facts. */
  invalidate(): void {
    this.provider.invalidate();
    for (const editor of window.visibleTextEditors) {
      this.#generations.set(editor, (this.#generations.get(editor) ?? 0) + 1);
      editor.setDecorations(this.#decoration, []);
    }
    this.refresh();
  }

  /** A changed target or include configuration cannot reuse the previous interpretation of source. */
  configurationChanged(): void {
    this.provider.configurationChanged();
    this.invalidate();
  }

  /**
   * Remember a successful build even if automatic discovery has reached its map-file limit.
   * @param {string} debugMapPath Newly published map filename.
   * @param {string} sourceRoot Owning workspace/include resolution root.
   */
  buildCompleted(debugMapPath: string, sourceRoot: string): void {
    this.provider.buildCompleted(debugMapPath, sourceRoot);
    this.refresh();
  }

  /**
   * Coalesce scrolling; both disabled surfaces produce no provider work.
   * @param {TextEditor | undefined} editor Optional editor; omission refreshes all visible editors.
   */
  refresh(editor?: TextEditor): void {
    if (this.#disposed) {
      return;
    }
    const editors = editor ? [editor] : window.visibleTextEditors;
    for (const current of editors) {
      const generation = (this.#generations.get(current) ?? 0) + 1;
      this.#generations.set(current, generation);
      clearTimeout(this.#timers.get(current));
      this.#timers.delete(current);
      const config = this.#configuration(current.document.uri);
      if (current === window.activeTextEditor) {
        void commands.executeCommand(
          "setContext",
          "asm.editorInfo.inlineEnabled",
          config.inlineEnabled,
        );
      }
      if (
        !config.inlineEnabled ||
        !config.parts.length ||
        current.document.isDirty ||
        current.document.uri.scheme !== "file" ||
        !["uttori-snes", "uttori-65xx"].includes(current.document.languageId)
      ) {
        current.setDecorations(this.#decoration, []);
        continue;
      }
      this.#timers.set(
        current,
        setTimeout(() => {
          this.#timers.delete(current);
          void this.#decorate(current, generation, config).catch(() => {
            if (this.#generations.get(current) === generation) {
              current.setDecorations(this.#decoration, []);
            }
          });
        }, 75),
      );
    }
  }

  /** Toggle only inline information, preserving independently configured hover behavior. */
  async toggle(): Promise<void> {
    const resource = window.activeTextEditor?.document.uri;
    const config = workspace.getConfiguration("asm", resource);
    const enabled = readEditorInformationConfiguration(config).inlineEnabled;
    if (enabled) {
      for (const editor of window.visibleTextEditors) {
        this.#generations.set(editor, (this.#generations.get(editor) ?? 0) + 1);
        editor.setDecorations(this.#decoration, []);
      }
    }
    await config.update("editorInfo.inline.enabled", !enabled, configurationTarget(resource));
    this.refresh();
  }

  /**
   * Includes can change another open file's layout; clear all affected work immediately.
   * @param {TextDocument} document Changed document, including unsaved buffers.
   */
  documentChanged(document: TextDocument): void {
    if (document.uri.scheme === "file") {
      this.invalidate();
    }
  }

  async #decorate(
    editor: TextEditor,
    generation: number,
    config: EditorInformationConfiguration,
  ): Promise<void> {
    const version = editor.document.version;
    const facts = await this.provider.lines(
      editor.document.uri.fsPath,
      editor.visibleRanges.map((range) => ({
        start: range.start.line + 1,
        end: range.end.line + 1,
      })),
      templateRequirements(config.parts),
      this.#dirtyFiles(),
    );
    if (
      this.#disposed ||
      this.#generations.get(editor) !== generation ||
      editor.document.version !== version ||
      editor.document.isDirty
    ) {
      return;
    }
    const rows = [...facts].filter(([line]) => line >= 1 && line <= editor.document.lineCount);
    const tabSize = typeof editor.options.tabSize === "number" ? editor.options.tabSize : 4;
    const column = annotationOverlayColumn(
      rows.map(([line]) => editor.document.lineAt(line - 1).text),
      tabSize,
      config.column,
    );
    // Instance options preserve folder-specific colors while sharing one native decoration type.
    const color = config.color.startsWith("#") ? config.color : new ThemeColor(config.color);
    const decorations = rows.flatMap(([line, infos]) => {
      const text = renderInformation(infos, config.parts, config.separator, config.maximum);
      if (!text) {
        return [];
      }
      const source = editor.document.lineAt(line - 1).text;
      const gap =
        config.placement === "aligned" ? column - annotationSourceColumns(source, tabSize) : 3;
      return [
        {
          range: new Range(line - 1, source.length, line - 1, source.length),
          renderOptions: { after: { margin: `0 0 0 ${gap}ch`, contentText: text, color } },
        },
      ];
    });
    // The suffix owns no hover payload; the client hover middleware formats only the requested line.
    editor.setDecorations(this.#decoration, decorations);
  }

  /**
   * Append compact analysis independently of the language server's instruction documentation.
   * @param {TextDocument} document Source snapshot requested by VS Code.
   * @param {Position} position Hovered zero-based source position.
   * @param {CancellationToken} token Host cancellation; stale replies are discarded.
   * @returns {Promise<Hover | undefined>} Compact additional hover, or nothing when unavailable.
   */
  async provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken,
  ): Promise<Hover | undefined> {
    const config = this.#configuration(document.uri);
    if (
      !config.hoverEnabled ||
      !config.rows.length ||
      document.isDirty ||
      token.isCancellationRequested
    ) {
      return undefined;
    }
    const version = document.version;
    try {
      const facts = await this.provider.lines(
        document.uri.fsPath,
        [{ start: position.line + 1, end: position.line + 1 }],
        templateRequirements(config.rows),
        this.#dirtyFiles(),
      );
      const currentConfiguration = this.#configuration(document.uri);
      if (
        this.#disposed ||
        token.isCancellationRequested ||
        version !== document.version ||
        document.isDirty ||
        !currentConfiguration.hoverEnabled ||
        JSON.stringify(currentConfiguration.rows) !== JSON.stringify(config.rows)
      ) {
        return undefined;
      }
      const infos = facts.get(position.line + 1) ?? [];
      const text = renderInformation(infos, config.rows, "\n", 1600);
      if (!text) {
        return undefined;
      }
      const markdown = new MarkdownString();
      markdown.appendMarkdown("**Uttori analysis**\n\n");
      markdown.appendText(text);
      return new Hover(markdown, document.lineAt(position.line).range);
    } catch {
      return undefined;
    }
  }

  /** Preset selection intentionally resets field overrides; other display preferences remain. */
  async choosePreset(): Promise<void> {
    const selected = await window.showQuickPick(
      Object.keys(INFORMATION_PRESETS).map((label) => ({
        label,
        description: "Use these inline and hover fields",
      })),
      { title: "Choose Editor Information Preset" },
    );
    if (!selected) {
      return;
    }
    const uri = window.activeTextEditor?.document.uri;
    const config = workspace.getConfiguration("asm", uri);
    const target = configurationTarget(uri);
    await config.update("editorInfo.preset", selected.label, target);
    const preset = INFORMATION_PRESETS[selected.label as keyof typeof INFORMATION_PRESETS];
    // Explicit lists override inherited custom templates as well as local ones.
    await config.update("editorInfo.inline.parts", [...preset.parts], target);
    await config.update("editorInfo.hover.rows", [...preset.rows], target);
    this.refresh();
  }

  /** Quick Pick covers common fields; settings templates remain available for custom labels/order. */
  async configureInline(): Promise<void> {
    const uri = window.activeTextEditor?.document.uri;
    if (!uri) {
      return;
    }
    const config = this.#configuration(uri);
    const fields = new Set(
      config.parts.flatMap((template) =>
        template.flatMap((part) => ("field" in part ? [part.field] : [])),
      ),
    );
    const selected = await window.showQuickPick(
      Object.entries(INFORMATION_FIELDS).map(([field, description]) => ({
        label: field,
        description,
        picked: fields.has(field),
      })),
      { title: "Configure Inline Fields", canPickMany: true },
    );
    if (!selected) {
      return;
    }
    await workspace.getConfiguration("asm", uri).update(
      "editorInfo.inline.parts",
      selected.map(({ label }) => "${" + label + "}"),
      configurationTarget(uri),
    );
    this.refresh();
  }

  /** Explicit inspection loads rich evidence only for detail sections, then presents bounded pages. */
  async inspectLine(): Promise<void> {
    const editor = window.activeTextEditor;
    if (!editor) {
      return;
    }
    if (editor.document.isDirty) {
      void window.showInformationMessage("Build saved source to inspect current line information.");
      return;
    }
    const line = editor.selection.active.line + 1;
    const sections = [
      "Summary",
      "Project state",
      "Runtime state",
      "State transitions",
      "Memory and effective addresses",
      "Evidence and control flow",
    ];
    const section = await window.showQuickPick(sections, { title: "Inspect Line Information" });
    if (!section) {
      return;
    }
    // Cancelling the picker does no I/O; summary inspection does not load evidence/state previews.
    const facts = await this.provider.lines(
      editor.document.uri.fsPath,
      [{ start: line, end: line }],
      { counts: true, bytes: section === "Summary", state: section !== "Summary" },
      this.#dirtyFiles(),
    );
    const infos = facts.get(line) ?? [];
    if (!infos.length) {
      void window.showInformationMessage(
        "No current build map matches this line. Build the project to refresh its information.",
      );
      return;
    }
    const lines: string[] = [];
    for (const info of infos) {
      lines.push(info.label, "");
      if (section === "Summary") {
        for (const field of Object.keys(INFORMATION_FIELDS)) {
          const value = renderTemplate(compileTemplate(`${field}: \${${field}}`), info);
          if (value) {
            lines.push(value);
          }
        }
      } else {
        for (const annotation of info.annotations ?? []) {
          const selected = {
            ...annotation,
            stateObservations: [],
            stateTransitions: [],
            memoryAccesses: [],
            effectiveAddresses: [],
            nodeIds: [],
            evidence: [],
            runtimeCoverage: [],
            comments: [],
          } as typeof annotation;
          let detail = selected;
          if (section === "Project state") {
            detail = {
              ...selected,
              stateObservations: annotation.stateObservations.filter(
                (value) => value.source === "project",
              ),
            };
          }
          if (section === "Runtime state") {
            detail = {
              ...selected,
              stateObservations: annotation.stateObservations.filter(
                (value) => value.source === "runtime",
              ),
            };
          }
          if (section === "State transitions") {
            detail = { ...selected, stateTransitions: annotation.stateTransitions };
          }
          if (section === "Memory and effective addresses") {
            detail = {
              ...selected,
              memoryAccesses: annotation.memoryAccesses,
              effectiveAddresses: annotation.effectiveAddresses,
            };
          }
          if (section === "Evidence and control flow") {
            detail = { ...selected, nodeIds: annotation.nodeIds, evidence: annotation.evidence };
          }
          lines.push(formatInstructionAnnotationDetails(detail), "");
        }
      }
    }
    const content = lines.join("\n").split("\n");
    let start = 0;
    if (content.length > 120) {
      const pages = Array.from({ length: Math.ceil(content.length / 120) }, (_, index) => ({
        label: `Page ${index + 1}`,
        start: index * 120,
      }));
      const selected = await window.showQuickPick(pages, { title: `${section} — choose a page` });
      if (!selected) {
        return;
      }
      start = selected.start;
    }
    const limited = infos.some((info) => info.limited)
      ? "Some detail records are omitted from this preview; stored evidence and execution totals are unchanged.\n"
      : "";
    const document = await workspace.openTextDocument({
      language: "plaintext",
      content: `${editor.document.uri.fsPath}:${line} — ${section}\n${limited}\n${content.slice(start, start + 120).join("\n")}`,
    });
    await window.showTextDocument(document, { preview: true, viewColumn: editor.viewColumn });
  }

  dispose(): void {
    this.#disposed = true;
    for (const timer of this.#timers.values()) {
      clearTimeout(timer);
    }
    this.#timers.clear();
    this.provider.invalidate();
    for (const disposable of this.#disposables) {
      disposable.dispose();
    }
    this.#decoration.dispose();
  }
}
