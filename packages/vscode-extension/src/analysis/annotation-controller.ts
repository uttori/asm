/** Hash-gated inline source annotations derived from native analysis projects. */
import * as path from "node:path";

import {
  type AnalysisProjectManifest,
  type InstructionAnalysisAnnotation,
} from "@uttori/asm-disassembler";
import {
  DecorationRangeBehavior,
  ConfigurationTarget,
  MarkdownString,
  Range,
  ThemeColor,
  window,
  workspace,
  type Disposable,
  type TextDocument,
  type TextEditor,
  type TextEditorDecorationType,
} from "vscode";

import {
  formatInstructionAnnotationDetails,
  formatInstructionAnnotationSummary,
} from "./annotation-format.js";
import {
  annotationOverlayColumn,
  annotationOverlayColor,
  annotationSourceColumns,
} from "./annotation-layout.js";
import { findAnalysisProjectDirectories } from "./coverage-tree.js";
import {
  currentAnalysisSourcePath,
  findAnalysisDebugMapCandidates,
  type AnalysisDebugMapIdentity,
} from "./debug-maps.js";
import { analysisWorker } from "./worker-client.js";

/** Editor toolbar command for showing or hiding project-state overlays. */
export const TOGGLE_ANALYSIS_ANNOTATIONS_COMMAND = "asm.analysis.toggleAnnotations";

/** Instruction evidence paired with its project directory for editor hover attribution. */
interface MappedAnnotation {
  readonly project: string;
  readonly annotation: InstructionAnalysisAnnotation;
}

/**
 * Project directory and verified target/ROM identity used to match source maps before decorating
 * an editor.
 */
interface LoadedAnnotations {
  readonly directory: string;
  readonly identity: AnalysisDebugMapIdentity;
}

/**
 * Append to the existing per-key bucket, allocating a bucket only for the first value; mutates
 * the supplied map.
 * @param {Map<Key, Value[]>} map Mutable buckets retaining insertion order.
 * @param {Key} key Bucket identity.
 * @param {Value} value Entry appended without replacing existing values.
 */
const append = <Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void => {
  const entries = map.get(key);
  if (entries) {
    entries.push(value);
  } else {
    map.set(key, [value]);
  }
};

/**
 * Maintains analysis suffixes on the active, byte-current mapped source editor.
 * @see https://code.visualstudio.com/api/references/vscode-api#TextEditorDecorationType
 * @see https://code.visualstudio.com/api/references/vscode-api#DecorationOptions.hoverMessage
 */
export class AnalysisAnnotationController implements Disposable {
  readonly #decoration: TextEditorDecorationType;
  #generation = 0;

  constructor() {
    this.#decoration = window.createTextEditorDecorationType({
      after: {
        color: new ThemeColor("editorCodeLens.foreground"),
      },
      rangeBehavior: DecorationRangeBehavior.ClosedClosed,
    });
  }

  /**
   * Recomputes decorations for the active editor from hash-current project/map inputs.
   * @param {TextEditor | undefined} editor Active or explicitly selected editor.
   */
  refresh(editor: TextEditor | undefined = window.activeTextEditor): void {
    const generation = ++this.#generation;
    for (const visible of window.visibleTextEditors) {
      if (
        !workspace
          .getConfiguration("asm", visible.document.uri)
          .get("analysis.showAnnotations", true)
      ) {
        visible.setDecorations(this.#decoration, []);
      }
    }
    if (!editor || editor.document.uri.scheme !== "file") {
      return;
    }
    editor.setDecorations(this.#decoration, []);
    if (
      !workspace.getConfiguration("asm", editor.document.uri).get("analysis.showAnnotations", true)
    ) {
      return;
    }
    void this.#decorations(editor, generation).catch(() => {
      if (generation === this.#generation) {
        editor.setDecorations(this.#decoration, []);
      }
    });
  }

  /** Toggle the active project's overlays, immediately invalidating pending decoration work. */
  async toggle(): Promise<void> {
    ++this.#generation;
    const resource = window.activeTextEditor?.document.uri;
    const configuration = workspace.getConfiguration("asm", resource);
    const enabled = configuration.get("analysis.showAnnotations", true);
    if (enabled) {
      for (const editor of window.visibleTextEditors) {
        editor.setDecorations(this.#decoration, []);
      }
    }
    await configuration.update(
      "analysis.showAnnotations",
      !enabled,
      resource && workspace.getWorkspaceFolder(resource)
        ? ConfigurationTarget.WorkspaceFolder
        : ConfigurationTarget.Global,
    );
    this.refresh();
  }

  /**
   * Clears annotations immediately when source bytes change. Save triggers a fresh hash check.
   * @param {TextDocument} document Changed editor document.
   */
  documentChanged(document: TextDocument): void {
    const editor = window.activeTextEditor;
    if (!editor || editor.document !== document) {
      return;
    }
    ++this.#generation;
    editor.setDecorations(this.#decoration, []);
  }

  dispose(): void {
    ++this.#generation;
    this.#decoration.dispose();
  }

  async #decorations(editor: TextEditor, generation: number): Promise<void> {
    const currentFile = path.resolve(editor.document.uri.fsPath);
    const byLine = new Map<number, MappedAnnotation[]>();
    const loaded: LoadedAnnotations[] = [];
    for (const directory of await findAnalysisProjectDirectories()) {
      let manifest: AnalysisProjectManifest;
      try {
        manifest = await analysisWorker().request<AnalysisProjectManifest>(directory, "manifest");
      } catch {
        continue;
      }
      const identity = {
        target: manifest.target,
        romContentSha256: manifest.rom.contentSha256,
        romContentSize: manifest.rom.contentSize,
      };
      loaded.push({ directory, identity });
    }
    if (loaded.length === 0 || generation !== this.#generation) {
      return;
    }
    const candidates = await findAnalysisDebugMapCandidates(loaded.map(({ identity }) => identity));
    for (const { directory, identity } of loaded) {
      for (const candidate of candidates) {
        if (
          candidate.map.target !== identity.target ||
          candidate.map.output.sha256 !== identity.romContentSha256 ||
          candidate.map.output.size !== identity.romContentSize
        ) {
          continue;
        }
        const sourceIds = new Set(
          candidate.map.sources
            .filter((source) => {
              const resolved = currentAnalysisSourcePath(source, candidate, currentFile);
              return resolved !== undefined && path.resolve(resolved) === currentFile;
            })
            .map(({ id }) => id),
        );
        if (sourceIds.size === 0) {
          continue;
        }
        if (generation !== this.#generation) {
          return;
        }
        const ranges = candidate.map.ranges
          .filter(
            (range) =>
              sourceIds.has(range.sourceId) &&
              editor.visibleRanges.some(
                (visible) =>
                  range.line >= visible.start.line + 1 && range.line <= visible.end.line + 1,
              ),
          )
          .slice(0, 2000);
        if (ranges.length === 0) {
          continue;
        }
        const rows = await analysisWorker().request<
          { line: number; annotation: InstructionAnalysisAnnotation }[]
        >(directory, "annotations", { ranges });
        for (const { line, annotation } of rows) {
          append(byLine, line, { project: path.basename(directory), annotation });
        }
      }
    }
    if (generation !== this.#generation || window.activeTextEditor !== editor) {
      return;
    }
    const lines = [...byLine]
      .filter(([line]) => line >= 1 && line <= editor.document.lineCount)
      .sort(([left], [right]) => left - right);
    const tabSize = typeof editor.options.tabSize === "number" ? editor.options.tabSize : 4;
    const preferredColumn = workspace
      .getConfiguration("asm", editor.document.uri)
      .get<number>("analysis.annotationColumn", 80);
    const column = annotationOverlayColumn(
      lines.map(([line]) => editor.document.lineAt(line - 1).text),
      tabSize,
      Number.isSafeInteger(preferredColumn) && preferredColumn >= 0 ? preferredColumn : 80,
    );
    const decorations = lines
      .map(([line, entries]) => {
        const unique = new Map(
          entries.map((entry) => [`${entry.project}:${entry.annotation.id}`, entry]),
        );
        const values = [...unique.values()];
        const summaries = [
          ...new Set(
            values
              .map(({ annotation }) => formatInstructionAnnotationSummary(annotation, 160))
              .filter(Boolean),
          ),
        ];
        const summaryText = summaries.join(" | ");
        const hover = new MarkdownString();
        hover.appendMarkdown("**Uttori analysis**\n\n");
        hover.appendMarkdown(
          "Overlay colors: blue = project state, green = runtime observations, amber = state changes.\n\n",
        );
        for (const { project, annotation } of values) {
          hover.appendText(project);
          hover.appendMarkdown("\n\n");
          hover.appendCodeblock(formatInstructionAnnotationDetails(annotation), "text");
        }
        const targetLine = editor.document.lineAt(line - 1);
        return {
          range: new Range(line - 1, targetLine.text.length, line - 1, targetLine.text.length),
          hoverMessage: hover,
          renderOptions: {
            after: {
              margin: `0 0 0 ${column - annotationSourceColumns(targetLine.text, tabSize)}ch`,
              color: new ThemeColor(
                annotationOverlayColor(values.map(({ annotation }) => annotation)),
              ),
              contentText:
                summaries.length > 0
                  ? `│ ${summaryText.slice(0, 319)}${summaryText.length > 319 ? "…" : ""}`
                  : "",
            },
          },
        };
      })
      .filter(({ renderOptions }) => renderOptions.after.contentText !== "");
    editor.setDecorations(this.#decoration, decorations);
  }
}
