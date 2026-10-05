import fs from "node:fs/promises";
import path from "node:path";

import type {
  AssetFileOperation,
  AssetImportReview,
  AssetOperation,
} from "@uttori/asm-cli/asset-interchange";
import { readAssetOperation } from "@uttori/asm-cli/asset-interchange/operation-records";
import { readAssetImportReview } from "@uttori/asm-cli/asset-interchange/public-records";
import type { SourceAction, SourceResearchRequest } from "@uttori/asm-cli/source";
import {
  sourceGit,
  sourceContentHash,
  parseSourceProject,
  type SourceMergePreview,
  type SourceMergeStatus,
  type SourceProjectConfiguration,
  type ResearchAnalysisChange,
} from "@uttori/asm-disassembler";
import type { SnesSourceBuild } from "@uttori/asm-plugin-snes";
import { SNES_MAPPERS } from "@uttori/asm-plugin-snes";
import {
  commands,
  CustomExecution,
  Diagnostic,
  DiagnosticSeverity,
  EventEmitter,
  languages,
  ProgressLocation,
  Range,
  RelativePattern,
  TabInputCustom,
  Task,
  TaskGroup,
  tasks,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
  type Disposable,
  type ExtensionContext,
  type LogOutputChannel,
  type Pseudoterminal,
  type TreeDataProvider,
  type WorkspaceFolder,
} from "vscode";

import type { AnalysisCoverageEditTarget } from "../analysis/coverage-tree.js";
import { BinaryDrafts } from "../assets/binary-drafts.js";
import { onDidChangeRuntimeCapture, runtimeCapturePhase } from "../runtime/capture-state.js";
import { editAnalysisResearch } from "./analysis-editor.js";
import { assertAssetEditorVersions, type AssetEditorVersion } from "./asset-drafts.js";
import { captureBuildControls, changedBuildInputs, type SavedBuildInput } from "./build-inputs.js";
import { registerSourceCodeActions } from "./code-actions.js";
import { SourceGitFiles } from "./git-files.js";
import { SourceProcessClient } from "./process-client.js";
import { findEvidenceSourceRoot, findSourceRoot } from "./project-path.js";
import { editSourceResearch } from "./research-editor.js";
import { sourceWorkflow } from "./workflow.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSnesMapper(value: string): value is (typeof SNES_MAPPERS)[number] {
  return (
    value === "lorom" ||
    value === "hirom" ||
    value === "exlorom" ||
    value === "exhirom" ||
    value === "sfxrom" ||
    value === "sa1rom" ||
    value === "bigsa1rom" ||
    value === "norom"
  );
}

function isLayoutObject(value: unknown): value is { readonly id: string; readonly kind: string } {
  return isRecord(value) && typeof value.id === "string" && typeof value.kind === "string";
}

function isSnesSourceBuild(value: unknown): value is SnesSourceBuild {
  return (
    isRecord(value) &&
    typeof value.outputFile === "string" &&
    typeof value.debugMapFile === "string" &&
    typeof value.inputSha256 === "string" &&
    Array.isArray(value.inputs) &&
    value.inputs.every(
      (input) =>
        isRecord(input) && typeof input.path === "string" && typeof input.sha256 === "string",
    ) &&
    typeof value.outputSize === "number" &&
    typeof value.debugMapFingerprint === "string" &&
    isRecord(value.verification) &&
    typeof value.verification.outputSha256 === "string" &&
    typeof value.verification.debugMapSha256 === "string" &&
    typeof value.verification.toolchainSha256 === "string" &&
    Array.isArray(value.verification.checks) &&
    value.verification.checks.every((check) => typeof check === "string") &&
    isRecord(value.contracts) &&
    typeof value.contracts.cpuStates === "number" &&
    typeof value.contracts.fixedExtents === "number" &&
    (value.cacheWarnings === undefined ||
      (Array.isArray(value.cacheWarnings) &&
        value.cacheWarnings.every((warning) => typeof warning === "string")))
  );
}

function isSourceMergePreview(value: unknown): value is SourceMergePreview {
  return (
    isRecord(value) &&
    typeof value.head === "string" &&
    typeof value.sourceTree === "string" &&
    typeof value.candidate === "string" &&
    typeof value.base === "string" &&
    typeof value.resultTree === "string" &&
    typeof value.messages === "string" &&
    Array.isArray(value.conflicts) &&
    value.conflicts.every((conflict) => typeof conflict === "string") &&
    (value.ref === undefined || typeof value.ref === "string")
  );
}

function isGenerationCommit(
  value: unknown,
): value is { readonly generation: { readonly commit: string } } {
  return (
    isRecord(value) &&
    isRecord(value.generation) &&
    typeof value.generation.commit === "string" &&
    value.generation.commit.length > 0
  );
}

function isRelocationEdit(value: unknown): value is {
  readonly path: string;
  readonly beforeSha256: string;
  readonly before: string;
  readonly after: string;
} {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    typeof value.beforeSha256 === "string" &&
    typeof value.before === "string" &&
    typeof value.after === "string"
  );
}

function relocationEdits(value: unknown): readonly {
  readonly path: string;
  readonly beforeSha256: string;
  readonly before: string;
  readonly after: string;
}[] {
  if (!isRecord(value) || !Array.isArray(value.edits) || !value.edits.every(isRelocationEdit)) {
    throw new Error("Invalid source relocation.");
  }
  return value.edits;
}

/** Cached native tree rows keep rendering independent of database and filesystem scans. */
class SourceRow extends TreeItem {
  constructor(
    label: string,
    readonly children: SourceRow[] = [],
    command?: string,
    args?: unknown[],
  ) {
    super(
      label,
      children.length ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None,
    );
    if (command) {
      this.command = { command, title: label, arguments: args };
    }
  }
}

/** A cancelled file picker leaves the asset operation untouched. */
const chooseAssetFile = async (title: string, extensions: string[]): Promise<string | undefined> =>
  (
    await window.showOpenDialog({ title, canSelectMany: false, filters: { Files: extensions } })
  )?.[0]?.fsPath;

/** A selected ROM project, native Git review, and shared background operations; source edits stay in editors. */
export class SourceController implements TreeDataProvider<SourceRow>, Disposable {
  readonly #changed = new EventEmitter<SourceRow | undefined>();
  readonly #built = new EventEmitter<{ readonly root: string; readonly build: SnesSourceBuild }>();
  /** All source build entry points publish the same matching map to navigation and inline information. */
  readonly onDidBuild = this.#built.event;
  readonly #researchChanged = new EventEmitter<void>();
  /** Saved research and branch changes invalidate names cached by the evidence views. */
  readonly onDidChangeResearch = this.#researchChanged.event;
  readonly #savedInput = new EventEmitter<void>();
  /** Saved text, binary assets and external writes all enter the same debounced watch build. */
  readonly onDidChangeSavedInput = this.#savedInput.event;
  readonly #selected = new EventEmitter<void>();
  /** A target change cancels watch work before another project's artifacts can be launched. */
  readonly onDidSelectProject = this.#selected.event;
  readonly onDidChangeTreeData = this.#changed.event;
  readonly #disposables: Disposable[] = [];
  readonly #worker: SourceProcessClient;
  readonly #files = new SourceGitFiles();
  readonly #diagnostics = languages.createDiagnosticCollection("uttori-source");
  #root?: string;
  #configuration?: SourceProjectConfiguration;
  #status?: SourceMergeStatus & {
    dirty: boolean;
    unstaged?: boolean;
    analysisReady?: boolean;
    analysisReason?: string;
    catalogReady?: boolean;
    catalogReason?: string;
  };
  #branch = "";
  #candidate?: string;
  #preview?: SourceMergePreview;
  #incoming: SourceRow[] = [];
  #build?: SnesSourceBuild;
  /** Controls plus consumed dependencies for checking delayed saved-file notifications. */
  #buildInputs: readonly SavedBuildInput[] = [];
  #buildStale = true;
  #busy?: string;
  /** Watcher changes during coordinated publication are delivered once, including interrupted partial publication. */
  #assetSavedInputPending = false;
  #refreshTimer?: NodeJS.Timeout;
  #watcher?: Disposable;
  #epoch = 0;
  /** Last authoring input notification, retained to explain conservative publication invalidation. */
  #epochInput?: string;
  /** Notification origin distinguishes actual saved-file events from editor draft changes. */
  #epochEvent?: "text" | "binary" | "opaque" | "saved";
  /** UI review state never owns native bytes; the worker's durable plan remains authoritative. */
  #assetReview?: {
    readonly root: string;
    readonly manifest: string;
    readonly document: string;
    readonly summary: AssetImportReview;
    readonly epoch: number;
    readonly versions: readonly AssetEditorVersion[];
  };

  constructor(
    readonly context: ExtensionContext,
    readonly output: LogOutputChannel,
    readonly binaryDrafts = new BinaryDrafts(),
  ) {
    this.#worker = new SourceProcessClient(
      context.asAbsolutePath("out/source-process.mjs"),
      (message) => output.info(message),
    );
    this.#disposables.push(
      this.#worker,
      this.#files,
      this.#changed,
      this.#built,
      this.#researchChanged,
      this.#savedInput,
      this.#selected,
      this.#diagnostics,
      onDidChangeRuntimeCapture(() => this.#changed.fire(undefined)),
      registerSourceCodeActions(() =>
        this.#root && this.#configuration
          ? { root: this.#root, layout: this.#configuration.layout }
          : undefined,
      ),
      window.registerTreeDataProvider("uttori-asm.sourceProject", this),
      workspace.registerFileSystemProvider("uttori-source", this.#files, {
        isReadonly: true,
        isCaseSensitive: true,
      }),
      commands.registerCommand("asm.source.select", (folder?: Uri | string) =>
        this.guard(() => this.select(typeof folder === "string" ? folder : folder?.fsPath)),
      ),
      // F5 must select and build atomically: a rejected selection cannot launch another project.
      commands.registerCommand("asm.source.buildProject", (folder: Uri) =>
        this.guard(async () => {
          await this.select(folder.fsPath);
          return this.perform("build");
        }),
      ),
      commands.registerCommand("asm.source.init", () => this.guard(() => this.create())),
      commands.registerCommand("asm.source.initDiz", () => this.guard(() => this.create(true))),
      commands.registerCommand("asm.source.refresh", () => this.guard(() => this.refresh())),
      commands.registerCommand("asm.asset.export", (request?: unknown) =>
        this.guard(() => this.assetFile("export", request)),
      ),
      commands.registerCommand("asm.asset.review", (request?: unknown) =>
        this.guard(() => this.assetFile("review", request)),
      ),
      commands.registerCommand("asm.asset.apply", (request?: unknown) =>
        this.guard(() => this.assetFile("apply", request)),
      ),
      commands.registerCommand("asm.asset.recover", () => this.guard(() => this.assetRecovery())),
      commands.registerCommand("asm.source.diff", (left: Uri, right: Uri, title: string) =>
        commands.executeCommand("vscode.diff", left, right, title),
      ),
      commands.registerCommand("asm.source.research", () => this.openResearch()),
      commands.registerCommand("asm.source.editResearch", (request?: SourceResearchRequest) =>
        this.guard(() =>
          editSourceResearch(
            this.#worker,
            () => {
              if (!this.#root) {
                return undefined;
              }
              return { root: this.#root, buffers: this.buffers() };
            },
            request,
          ),
        ),
      ),
      commands.registerCommand("asm.source.editAnalysis", (change?: ResearchAnalysisChange) =>
        this.guard(() =>
          editAnalysisResearch(
            this.#worker,
            () => {
              if (!this.#root) {
                return undefined;
              }
              return { root: this.#root, buffers: this.buffers() };
            },
            change,
          ),
        ),
      ),
      workspace.onDidChangeTextDocument((event) => {
        // Save/dirty-state notifications may arrive after a build begins without changing bytes.
        // Only content edits invalidate the captured input; disk reloads carry content changes too.
        // Read-only Git/preview providers may reuse a source-looking fsPath. Their
        // display refreshes never change the saved source consumed by the worker.
        if (
          event.document.uri.scheme === "file" &&
          event.contentChanges.length > 0 &&
          this.authoringFile(event.document.uri.fsPath)
        ) {
          this.#epoch++;
          this.#epochInput = event.document.uri.fsPath;
          this.#epochEvent = "text";
          this.#buildStale = true;
          this.#preview = undefined;
          this.#changed.fire(undefined);
        }
      }),
      binaryDrafts.onDidChange((uri) => {
        if (uri.scheme === "file" && this.authoringFile(uri.fsPath)) {
          this.#epoch++;
          this.#epochInput = uri.fsPath;
          this.#epochEvent = "binary";
          this.#buildStale = true;
          this.#preview = undefined;
          this.#changed.fire(undefined);
        }
      }),
      window.tabGroups.onDidChangeTabs((event) => {
        // Other custom editors own opaque drafts. Their native dirty transitions
        // still invalidate build status even though this extension cannot encode them.
        // Owned PNG versions already invalidate synchronously; delayed tab notifications
        // must not invalidate a review of the reverted, clean document a second time.
        const known = new Set(
          [...binaryDrafts.documents].map((document) => document.uri.toString()),
        );
        const dirtyTab = [...event.changed, ...event.closed].find(
          (tab) =>
            tab.isDirty &&
            tab.input instanceof TabInputCustom &&
            tab.input.uri.scheme === "file" &&
            !known.has(tab.input.uri.toString()) &&
            this.authoringFile(tab.input.uri.fsPath),
        );
        if (dirtyTab && dirtyTab.input instanceof TabInputCustom) {
          this.#epoch++;
          this.#epochInput = dirtyTab.input.uri.fsPath;
          this.#epochEvent = "opaque";
          this.#buildStale = true;
          this.#changed.fire(undefined);
        }
      }),
      tasks.registerTaskProvider("uttori-source", {
        provideTasks: () => (this.#root ? [this.buildTask(this.#root)] : []),
        resolveTask: (task) => {
          const root: unknown = task.definition.project;
          if (typeof root !== "string" || task.definition.action !== "build") {
            return undefined;
          }
          const folder = typeof task.scope === "object" ? task.scope : undefined;
          const resolved = root === "${workspaceFolder}" ? folder?.uri.fsPath : root;
          return resolved ? this.buildTask(resolved, folder) : undefined;
        },
      }),
    );
    for (const action of [
      "prepare",
      "preview",
      "apply",
      "finish",
      "abort",
      "discard",
      "clean",
      "build",
      "import",
      "analyze",
      "catalog",
      "relocate",
      "expand",
    ] as const) {
      this.#disposables.push(
        commands.registerCommand(
          `asm.source.${action === "import" ? "importCapture" : action}`,
          (capture?: Uri) => this.guard(() => this.perform(action, undefined, undefined, capture)),
        ),
      );
    }
    void this.restore();
  }

  get root(): string | undefined {
    return this.#root;
  }

  /** The selected build contract also identifies Watch when no source editor is open. */
  get buildUri(): string | undefined {
    return this.#root && this.#configuration
      ? Uri.file(path.join(this.#root, this.#configuration.buildConfig)).toString()
      : undefined;
  }

  /** Route an evidence action only after proving which worktree owns that evidence store. */
  async editEvidence(
    action: "classification" | "state" | "targets" | "symbols",
    target?: AnalysisCoverageEditTarget,
  ): Promise<boolean> {
    const handled = await this.guard(async () => {
      const root = target
        ? await findEvidenceSourceRoot(target.projectDirectory, this.#root)
        : this.#root;
      if (!root) {
        return false;
      }
      if (root !== this.#root) {
        await this.select(root);
      }
      const context = () => (this.#root === root ? { root, buffers: this.buffers() } : undefined);
      if (action === "symbols") {
        await editSourceResearch(this.#worker, context);
      } else {
        await editAnalysisResearch(this.#worker, context, undefined, {
          action,
          ids: action === "targets" ? (target?.analysisIds ?? []) : (target?.annotationIds ?? []),
          range:
            target && action !== "targets" ? { start: target.start, end: target.end } : undefined,
        });
      }
      return true;
    });
    // A rejected project identity was already reported by guard. It must not
    // fall through into another editing path against that unverified target.
    return handled ?? true;
  }
  getTreeItem(row: SourceRow): TreeItem {
    return row;
  }
  getChildren(row?: SourceRow): SourceRow[] {
    if (row) {
      return row.children;
    }
    if (!this.#root) {
      return [
        new SourceRow("Select Source Project", [], "asm.source.select"),
        new SourceRow("Create Git Source Project", [], "asm.source.init"),
      ];
    }
    const source = new SourceRow(
      `Source · ${this.#branch || path.basename(this.#root)}`,
      [],
      "workbench.view.scm",
    );
    source.description = "checking status";
    if (this.#status) {
      source.description = this.#status.dirty ? "uncommitted changes" : "checkpoint saved";
    }
    source.iconPath = new ThemeIcon("git-branch");
    const unsaved =
      this.buffers().length > 0 ||
      this.binaryBuffers().length > 0 ||
      this.opaqueBinaryBuffers().length > 0;
    const workflow = sourceWorkflow({
      ...this.#status,
      busy: this.#busy,
      conflicts: this.#status?.conflicts.length,
      candidate: Boolean(this.#candidate),
      previewed: this.#preview?.candidate === this.#candidate && Boolean(this.#candidate),
      dirty: (this.#status?.dirty ?? false) || unsaved,
      unsaved,
    });
    const steps = workflow.map((step) => {
      const item = new SourceRow(step.label, [], step.command);
      item.tooltip = step.description;
      return item;
    });
    const current = workflow.find((step) => step.current);
    const next = new SourceRow(
      `Next · ${current?.label ?? "Refresh Source Status"}`,
      [],
      current?.command,
    );
    next.tooltip = current?.description;
    // A reviewed candidate resumes at Preview/Checkpoint/Apply; an active merge owns Finish.
    if (
      this.#candidate &&
      !["merging", "committed", "diverged"].includes(this.#status?.phase ?? "")
    ) {
      const incoming = new SourceRow(
        `Incoming Generation · ${this.#incoming.length} files`,
        this.#incoming,
      );
      // Full games can have thousands of incoming files. Keep review available without burying
      // the workflow actions below an automatically expanded diff list.
      incoming.collapsibleState = TreeItemCollapsibleState.Collapsed;
      steps.unshift(incoming);
    }
    const regeneration = new SourceRow("Update Source from Evidence", steps);
    regeneration.tooltip =
      "Analyze → Prepare → Preview → save/commit checkpoint → Apply → resolve/stage → Finish. Finish builds and creates the merge commit.";
    const build = new SourceRow("Build Current Source", [], "asm.source.build");
    if (this.#build) {
      build.description = this.#buildStale ? "source changed" : "verified";
    }
    build.tooltip =
      "Assemble saved source for Run/Debug. No Git commit is required. This does not import evidence or apply a regeneration; Finish builds and commits the staged merge.";
    const capturePhase = runtimeCapturePhase();
    const captureRows: SourceRow[] = [];
    if (capturePhase === "idle") {
      const start = new SourceRow("Start Capture", [], "asm.trace.start");
      start.iconPath = new ThemeIcon("record");
      start.tooltip =
        "Launch an ares debug session first. Choose a capture file, then Continue (F5) to record execution.";
      captureRows.push(start);
    } else if (capturePhase === "recording") {
      const stop = new SourceRow("Stop Capture", [], "asm.trace.stop");
      stop.iconPath = new ThemeIcon("debug-stop");
      const stopImport = new SourceRow(
        "Stop Capture and Import Evidence",
        [],
        "asm.trace.stopAnalyze",
      );
      stopImport.iconPath = new ThemeIcon("database");
      captureRows.push(stop, stopImport);
    }
    captureRows.push(new SourceRow("Import Capture", [], "asm.source.importCapture"));
    return [
      source,
      build,
      next,
      regeneration,
      new SourceRow("Research", [
        new SourceRow("Open Declarations", [], "asm.source.research"),
        new SourceRow("Edit Symbol Research", [], "asm.source.editResearch"),
        new SourceRow("Edit Analysis Research", [], "asm.source.editAnalysis"),
      ]),
      new SourceRow("Placement", [
        new SourceRow("Relocate Object", [], "asm.source.relocate"),
        new SourceRow("Expand ROM Capacity", [], "asm.source.expand"),
      ]),
      new SourceRow("Edit Assets in a Saved File", [
        new SourceRow("Export Asset", [], "asm.asset.export"),
        new SourceRow("Review Saved Asset", [], "asm.asset.review"),
        new SourceRow("Apply Reviewed Asset", [], "asm.asset.apply"),
        new SourceRow("Recover Interrupted Asset Edit", [], "asm.asset.recover"),
      ]),
      new SourceRow(`Capture · ${capturePhase}`, captureRows),
    ];
  }

  /** Create in a worker and select only a completely verified new repository. */
  private async create(importDiz = false): Promise<void> {
    if (!workspace.isTrusted) {
      throw new Error("Trust this workspace before creating a source project.");
    }
    if (this.#busy) {
      throw new Error("Wait for the current source operation before creating a project.");
    }
    const rom = (
      await window.showOpenDialog({
        canSelectMany: false,
        title: "Original SNES ROM",
        filters: { "SNES ROM": ["sfc", "smc"] },
      })
    )?.[0];
    if (!rom) {
      return;
    }
    let dizRawFile: string | undefined;
    if (importDiz) {
      dizRawFile = (
        await window.showOpenDialog({
          canSelectMany: false,
          title: "DiztinGUIsh research",
          filters: { "Uncompressed DiztinGUIsh XML": ["dizraw"] },
        })
      )?.[0]?.fsPath;
      if (!dizRawFile) {
        return;
      }
    }
    const destination = await window.showSaveDialog({
      title: "New Git source project folder",
      saveLabel: "Create Project",
      defaultUri: Uri.file(
        path.join(path.dirname(rom.fsPath), `${path.parse(rom.fsPath).name}-source`),
      ),
    });
    if (!destination) {
      return;
    }
    const mapper = await window.showQuickPick(["Detect automatically", ...SNES_MAPPERS], {
      title: "SNES cartridge mapping",
    });
    if (!mapper || (mapper !== "Detect automatically" && !isSnesMapper(mapper))) {
      return;
    }
    this.#busy = "init";
    this.#changed.fire(undefined);
    try {
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: "Create Git Source Project",
          cancellable: true,
        },
        async (reporter, token) => {
          const abort = new AbortController();
          const listener = token.onCancellationRequested(() => abort.abort());
          try {
            await this.#worker.run(
              {
                action: "init",
                directory: destination.fsPath,
                rom: rom.fsPath,
                dizRawFile,
                mapper: mapper === "Detect automatically" ? undefined : mapper,
              },
              {
                signal: abort.signal,
                onProgress: (message) => reporter.report({ message }),
                maxMemoryMiB: workspace
                  .getConfiguration("asm")
                  .get<number>("analysis.maxMemoryMiB", 4096),
              },
            );
          } finally {
            listener.dispose();
          }
        },
      );
    } finally {
      this.#busy = undefined;
      this.#changed.fire(undefined);
    }
    await this.select(destination.fsPath);
    await commands.executeCommand(
      "revealInExplorer",
      Uri.file(path.join(destination.fsPath, "source/main.asm")),
    );
  }

  /** Selected context persists across active-editor changes; multi-root workspaces select explicitly. */
  async select(root?: string): Promise<void> {
    if (this.#busy) {
      throw new Error("Wait for the current source operation before changing projects.");
    }
    let selected = root;
    if (!selected) {
      const options = [
        ...new Set(
          (
            await Promise.all(
              (workspace.workspaceFolders ?? []).map((folder) => findSourceRoot(folder.uri.fsPath)),
            )
          ).filter((value): value is string => !!value),
        ),
      ];
      const choices = options.map((value) => ({
        label: path.basename(value),
        description: value,
        root: value,
      }));
      const choice = await window.showQuickPick(
        [...choices, { label: "Choose Project Folder…", description: "", root: "" }],
        { title: "Select Git Source Project" },
      );
      if (!choice) {
        return;
      }
      selected = choice.root;
      if (!selected) {
        selected = (
          await window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: "Source project folder",
          })
        )?.[0]?.fsPath;
      }
    }
    if (!selected) {
      return;
    }
    const resolved = await findSourceRoot(selected);
    if (!resolved) {
      throw new Error("This folder has no .uttori/project.json source project.");
    }
    const configuration = parseSourceProject(
      JSON.parse(await fs.readFile(path.join(resolved, ".uttori/project.json"), "utf8")),
    );
    if (this.#root !== resolved) {
      this.#selected.fire();
    }
    this.#root = resolved;
    this.#files.roots.add(resolved);
    this.#configuration = configuration;
    this.#candidate = this.context.workspaceState.get<string>(`source.candidate:${resolved}`);
    this.#preview = undefined;
    this.#incoming = [];
    this.#build = undefined;
    this.#buildInputs = [];
    this.#watcher?.dispose();
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(resolved, "**/*"));
    const changed = (uri: Uri): void => {
      // Providers can broadcast virtual original-file refreshes to glob watchers.
      // Only file-backed changes can alter this saved source checkout.
      if (uri.scheme !== "file") {
        return;
      }
      const relative = path.relative(resolved, uri.fsPath).split(path.sep).join("/");
      const gitEvent = relative === ".git" || relative.startsWith(".git/");
      const authoring = this.authoringFile(uri.fsPath);
      if (!authoring && !gitEvent) {
        return;
      }
      // Git object/ref activity also comes from other branches and linked worktrees. Refresh SCM
      // state for those events, but only authoring input changes can invalidate this source build.
      // Open text documents already invalidate synchronously through their change
      // events. A delayed filesystem notification for Save must not invalidate a
      // build that consumed that saved version. External reloads also emit text changes.
      const openDocument = workspace.textDocuments.some(
        (document) =>
          document.uri.scheme === "file" &&
          document.uri.fsPath === uri.fsPath &&
          !document.isClosed,
      );
      const openBinary = [...this.binaryDrafts.documents].some(
        (document) => document.uri.fsPath === uri.fsPath,
      );
      if (authoring && !openDocument && !openBinary) {
        this.#epoch++;
        this.#epochInput = uri.fsPath;
        this.#epochEvent = "saved";
        const build = this.#build;
        const inputs = this.#buildInputs.filter((input) => input.path === relative);
        if (!build) {
          this.#buildStale = true;
        } else if (inputs.length) {
          // Saved notifications can arrive after publication or describe identical replacement
          // bytes. Only a changed consumed input makes the displayed build stale.
          void changedBuildInputs(resolved, inputs).then(
            (differences) => {
              if (this.#build === build && differences.length) {
                this.#buildStale = true;
                this.#changed.fire(undefined);
              }
              return undefined;
            },
            (error: unknown) => {
              if (this.#build === build) {
                this.#buildStale = true;
                this.output.warn(`Unable to check saved build input ${relative}: ${String(error)}`);
                this.#changed.fire(undefined);
              }
              return undefined;
            },
          );
        }
      }
      if (authoring) {
        if (this.#busy === "asset-apply" || this.#busy === "asset-recover") {
          this.#assetSavedInputPending = true;
        } else {
          this.#savedInput.fire();
        }
      }
      const researchRoots = this.#configuration?.researchRoots ?? [];
      if (
        relative.startsWith(".uttori/") ||
        relative.startsWith(".git/") ||
        researchRoots.some(
          (researchRoot) => relative === researchRoot || relative.startsWith(`${researchRoot}/`),
        )
      ) {
        this.#researchChanged.fire();
      }
      clearTimeout(this.#refreshTimer);
      this.#refreshTimer = setTimeout(() => {
        if (!this.#busy) {
          void this.guard(() => this.refresh());
        }
      }, 400);
    };
    const subscriptions = [
      watcher,
      watcher.onDidChange(changed),
      watcher.onDidCreate(changed),
      watcher.onDidDelete(changed),
    ];
    this.#watcher = {
      dispose: () => {
        for (const item of subscriptions) {
          item.dispose();
        }
      },
    };
    await this.context.workspaceState.update("source.selected", resolved);
    await this.refresh();
    this.#researchChanged.fire();
  }

  /** Build/Run/Debug/Watch call this same selected target, independent of which include is focused. */
  async build(): Promise<SnesSourceBuild & { outputChanged: boolean; debugMapChanged: boolean }> {
    const previous = this.#build;
    const result = await this.perform("build");
    if (!result) {
      throw new Error("Select a source project before building or launching.");
    }
    if (!isSnesSourceBuild(result)) {
      throw new Error("Invalid source build.");
    }
    const build = result;
    return {
      ...build,
      outputChanged: previous?.verification.outputSha256 !== build.verification.outputSha256,
      debugMapChanged: previous?.debugMapFingerprint !== build.debugMapFingerprint,
    };
  }

  async refresh(): Promise<void> {
    if (!this.#root || this.#busy || !workspace.isTrusted) {
      return;
    }
    const root = this.#root;
    // Terminal branch switches may select a different research layout or build configuration.
    const configuration = parseSourceProject(
      JSON.parse(await fs.readFile(path.join(root, ".uttori/project.json"), "utf8")),
    );
    const status = await this.#worker.run<
      SourceMergeStatus & {
        dirty: boolean;
        candidateAccepted: boolean;
        unstaged?: boolean;
        analysisReady?: boolean;
        analysisReason?: string;
        catalogReady?: boolean;
        catalogReason?: string;
      }
    >({ directory: root, action: "status", candidate: this.#candidate }, { maxMemoryMiB: 512 });
    if (root !== this.#root) {
      return;
    }
    this.#status = status;
    this.#configuration = configuration;
    // Persisted editor state can outlive Finish or an integration completed in a terminal.
    // Keep an unvalidated committed merge available for Finish, but retire completed candidates.
    if (status.candidateAccepted && ["idle", "verified"].includes(status.phase)) {
      await this.clearCandidate(root);
    }
    this.#branch =
      (await sourceGit(root, ["branch", "--show-current"])).stdout.toString().trim() ||
      "detached HEAD";
    if (this.#candidate) {
      await this.incoming();
    }
    this.#changed.fire(undefined);
  }

  /** Release only the editor selection; the source service owns Git pin and preview lifetimes. */
  private async clearCandidate(root: string): Promise<void> {
    this.#candidate = undefined;
    this.#preview = undefined;
    this.#incoming = [];
    await this.context.workspaceState.update(`source.candidate:${root}`, undefined);
  }

  /** Source snapshots include only tracked-authoring roots, never private ROMs/captures or SQL files. */
  private binaryBuffers() {
    return [...this.binaryDrafts.documents].filter(
      (document) => document.dirty && this.authoringFile(document.uri.fsPath),
    );
  }

  /** Capture lightweight versions, including interchange documents saved outside the selected source root. */
  private assetEditorVersions(): AssetEditorVersion[] {
    const binary = [...this.binaryDrafts.documents],
      known = new Set(binary.map((document) => document.uri.toString()));
    return [
      ...workspace.textDocuments
        .filter((document) => document.uri.scheme === "file" && !document.isClosed)
        .map((document) => ({
          path: document.uri.fsPath,
          version: document.version,
          dirty: document.isDirty,
          opaque: false,
        })),
      ...binary.map((document) => ({
        path: document.uri.fsPath,
        version: document.version,
        dirty: document.dirty,
        opaque: false,
      })),
      ...window.tabGroups.all.flatMap((group) =>
        group.tabs.flatMap((tab) => {
          if (
            !(tab.input instanceof TabInputCustom) ||
            tab.input.uri.scheme !== "file" ||
            known.has(tab.input.uri.toString())
          ) {
            return [];
          }
          return [{ path: tab.input.uri.fsPath, version: 0, dirty: tab.isDirty, opaque: true }];
        }),
      ),
    ];
  }

  /** Saved-source export/review/apply share the existing source worker, busy state and live editor-version checks. */
  private async assetFile(
    action: "export" | "review" | "apply",
    request?: unknown,
  ): Promise<unknown> {
    if (!workspace.isTrusted) {
      throw new Error("Trust this workspace before editing source assets.");
    }
    if (this.#busy) {
      throw new Error(`Source operation already running: ${this.#busy}.`);
    }
    if (!this.#root) {
      await this.select();
    }
    const root = this.#root;
    if (!root) {
      return undefined;
    }
    let operation: AssetFileOperation;
    if (request !== undefined) {
      const selected = readAssetOperation(request);
      if (
        selected.action !== `asset-${action}` ||
        path.resolve(selected.directory) !== root ||
        selected.action === "asset-cleanup" ||
        selected.action === "asset-recover"
      ) {
        throw new Error(
          "Asset command request does not match the selected source project and action.",
        );
      }
      operation = selected;
      if (
        selected.action === "asset-apply" &&
        (!this.#assetReview ||
          selected.review !== this.#assetReview.summary.id ||
          path.resolve(selected.document) !== path.resolve(this.#assetReview.document) ||
          path.resolve(selected.manifest) !== path.resolve(this.#assetReview.manifest))
      ) {
        throw new Error("Apply the saved asset review shown in this editor.");
      }
    } else if (action === "export") {
      const adapter = await window.showQuickPick(
        [
          { label: "Secret of Mana sprite", id: "som.sprite.native" },
          { label: "Secret of Mana room", id: "som.room.native" },
        ],
        { title: "Export asset" },
      );
      if (!adapter) {
        return undefined;
      }
      const selection = await chooseAssetFile("Select the source asset selection declaration", [
        "json",
      ]);
      if (!selection) {
        return undefined;
      }
      const presentation = await window.showQuickPick(
        [
          {
            label: "Aseprite tilemaps",
            description: "Shared tile inventory, compositions and known previews",
            id: "tilemap" as const,
          },
          {
            label: "Raster Aseprite",
            description: "Fixed native view inventory",
            id: "raster" as const,
          },
          {
            label: "Indexed PNG",
            description: "Fixed native view inventory with an explicit sidecar manifest",
            id: "indexed-png" as const,
          },
        ],
        { title: "Asset presentation" },
      );
      if (!presentation) {
        return undefined;
      }
      const filters: Record<string, string[]> =
        presentation.id === "indexed-png" ? { PNG: ["png"] } : { Aseprite: ["aseprite"] };
      const document = (await window.showSaveDialog({ title: "Export editable asset", filters }))
        ?.fsPath;
      if (!document) {
        return undefined;
      }
      operation = {
        action: "asset-export",
        directory: root,
        adapter: adapter.id,
        selection,
        document,
        manifest: document + ".json",
        presentation: presentation.id,
      };
    } else if (action === "review") {
      const manifest = await chooseAssetFile("Select the asset export manifest", ["json"]);
      if (!manifest) {
        return undefined;
      }
      const document = await chooseAssetFile("Select the saved edited asset", [
        "aseprite",
        "ase",
        "png",
      ]);
      if (!document) {
        return undefined;
      }
      operation = { action: "asset-review", directory: root, manifest, document };
    } else {
      const review = this.#assetReview;
      if (!review || review.root !== root) {
        throw new Error("Review a saved asset in the selected project before applying it.");
      }
      if (review.epoch !== this.#epoch) {
        throw new Error("Source changed after asset review. Review again.");
      }
      operation = {
        action: "asset-apply",
        directory: root,
        document: review.document,
        manifest: review.manifest,
        review: review.summary.id,
      };
    }
    if (this.#root !== root || this.#busy) {
      throw new Error("Selected source project changed. Start the asset operation again.");
    }
    if (action === "apply" && this.#assetReview?.epoch !== this.#epoch) {
      throw new Error("Source changed after asset review. Review again.");
    }
    const epoch = this.#epoch,
      versions = this.assetEditorVersions(),
      reviewed = this.#assetReview;
    operation = {
      ...operation,
      drafts: versions
        .filter((entry) => entry.dirty)
        .map(({ path: file, version, opaque }) => ({ path: file, version, opaque })),
    };
    this.#busy = operation.action;
    this.#assetSavedInputPending = false;
    this.#changed.fire(undefined);
    let published = false;
    try {
      const result = await this.runAssetOperation(operation, epoch, versions, reviewed?.versions);
      if (action === "review") {
        if (this.#root !== root || this.#epoch !== epoch) {
          throw new Error("Source changed during asset review. Review again.");
        }
        const summary = readAssetImportReview(result);
        assertAssetEditorVersions(versions, this.assetEditorVersions(), [
          ...summary.files.map((file) => path.resolve(root, file.path)),
          operation.document,
        ]);
        this.#assetReview = {
          root,
          manifest: operation.manifest,
          document: operation.document,
          summary,
          epoch,
          versions,
        };
        const reviewDocument = await workspace.openTextDocument({
          language: "json",
          content: JSON.stringify(summary, null, 2),
        });
        await window.showTextDocument(reviewDocument, { preview: true });
        void window.showInformationMessage(
          `Asset review: ${summary.files.length} source files. Apply Reviewed Asset uses this exact plan.`,
        );
      } else if (action === "apply") {
        if (!isRecord(result) || !isRecord(result.review)) {
          throw new Error("Invalid asset publication result.");
        }
        readAssetImportReview(result.review);
        published = typeof result.transaction === "string";
        this.#assetReview = undefined;
        void window.showInformationMessage(
          published
            ? "Asset edits applied. Re-export for the next editing round."
            : "No asset changes; source files are unchanged.",
        );
      } else {
        const instruction =
          operation.action === "asset-export" && (operation.presentation ?? "tilemap") === "tilemap"
            ? "Select the Tiles layer, use Draw Pixels and Manual in Aseprite's toolbar (hold Space and press 1), paint and save."
            : "Edit pixels or palette colors in the fixed inventory and save.";
        void window.showInformationMessage(
          `Asset exported. ${instruction} Then Review Saved Asset.`,
        );
      }
      return result;
    } finally {
      this.#busy = undefined;
      this.#changed.fire(undefined);
      // Saved-input callbacks can set this flag across awaits; publication and external changes both invalidate the build.
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      if (published || this.#assetSavedInputPending) {
        this.#buildStale = true;
        this.#savedInput.fire();
      }
      this.#assetSavedInputPending = false;
      await this.refresh();
    }
  }

  /** All asset workers use the same cancellation and final live-buffer gate, including explicit journal recovery. */
  private async runAssetOperation(
    operation: AssetOperation,
    epoch: number,
    versions: readonly AssetEditorVersion[],
    reviewedVersions = versions,
  ): Promise<unknown> {
    const root = operation.directory;
    return window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `Asset: ${operation.action.slice(6)}`,
        cancellable: true,
      },
      async (reporter, token) => {
        const abort = new AbortController(),
          listener = token.onCancellationRequested(() => abort.abort());
        try {
          return await this.#worker.run(operation, {
            signal: abort.signal,
            maxMemoryMiB: workspace
              .getConfiguration("asm", Uri.file(root))
              .get<number>("analysis.maxMemoryMiB", 4096),
            onProgress: (message) => reporter.report({ message }),
            onBeforePublish: (paths) => {
              if (this.#root !== root || this.#epoch !== epoch) {
                const input = this.#epochInput
                  ? ` (${path.relative(root, this.#epochInput)}; ${this.#epochEvent} event)`
                  : "";
                throw new Error(
                  `Source/editor state changed during asset validation${input}. Review again.`,
                );
              }
              assertAssetEditorVersions(reviewedVersions, this.assetEditorVersions(), paths);
            },
          });
        } finally {
          listener.dispose();
        }
      },
    );
  }

  /** Recovery is an explicit journal direction; unknown external bytes and relevant drafts remain protected by the worker. */
  private async assetRecovery(): Promise<void> {
    if (!workspace.isTrusted) {
      throw new Error("Trust this workspace before recovering asset edits.");
    }
    if (this.#busy) {
      throw new Error(`Source operation already running: ${this.#busy}.`);
    }
    if (!this.#root) {
      await this.select();
    }
    const root = this.#root;
    if (!root) {
      return;
    }
    const direction = await window.showQuickPick(
      [
        { label: "Complete staged asset edit", id: "after" as const },
        { label: "Restore bytes from before the asset edit", id: "before" as const },
      ],
      { title: "Recover interrupted asset edit" },
    );
    if (!direction) {
      return;
    }
    if (this.#root !== root || this.#busy) {
      throw new Error("Selected source project changed; start recovery again.");
    }
    const epoch = this.#epoch,
      versions = this.assetEditorVersions();
    this.#busy = "asset-recover";
    this.#assetSavedInputPending = false;
    this.#changed.fire(undefined);
    let recovered = false;
    try {
      const result = await this.runAssetOperation(
        {
          action: "asset-recover",
          directory: root,
          direction: direction.id,
          drafts: versions
            .filter((entry) => entry.dirty)
            .map((entry) => ({ path: entry.path, version: entry.version, opaque: entry.opaque })),
        },
        epoch,
        versions,
      );
      recovered = isRecord(result) && result.state === "completed";
      this.#assetReview = undefined;
      void window.showInformationMessage(
        recovered
          ? "Asset publication recovered. Re-export before editing again."
          : "No interrupted asset publication to recover.",
      );
    } finally {
      this.#busy = undefined;
      this.#changed.fire(undefined);
      // Recovery awaits can receive saved-input events; emit one invalidation after releasing the busy state.
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      if (recovered || this.#assetSavedInputPending) {
        this.#buildStale = true;
        this.#savedInput.fire();
      }
      this.#assetSavedInputPending = false;
      await this.refresh();
    }
  }

  /** A draft owned by another extension cannot be represented by its older saved file. */
  private opaqueBinaryBuffers(): string[] {
    const known = new Set(
      [...this.binaryDrafts.documents].map((document) => document.uri.toString()),
    );
    return window.tabGroups.all.flatMap((group) =>
      group.tabs.flatMap((tab) => {
        if (
          !tab.isDirty ||
          !(tab.input instanceof TabInputCustom) ||
          !this.authoringFile(tab.input.uri.fsPath) ||
          (tab.input.viewType === "uttori.indexedPng" && known.has(tab.input.uri.toString()))
        ) {
          return [];
        }
        return [tab.input.uri.fsPath];
      }),
    );
  }

  /** Native text buffers are also the source of research edits; binary overlays are encoded only for preview. */
  private buffers() {
    const roots = [
      ...(this.#configuration?.sourceRoots ?? []),
      ...(this.#configuration?.researchRoots ?? []),
      ".uttori",
    ];
    return workspace.textDocuments
      .filter(
        (document) =>
          document.isDirty && document.uri.scheme === "file" && this.contains(document.uri.fsPath),
      )
      .flatMap((document) => {
        const relative = path.relative(this.#root!, document.uri.fsPath).split(path.sep).join("/");
        if (!this.authoringFile(document.uri.fsPath)) {
          return [];
        }
        if (!roots.some((root) => relative === root || relative.startsWith(`${root}/`))) {
          return [];
        }
        return [
          {
            path: relative,
            bytes: Buffer.from(document.getText()),
            version: document.version,
            uri: document.uri,
          },
        ];
      });
  }

  private async perform(
    action: SourceAction,
    cancellation?: AbortSignal,
    progress?: (message: string) => void,
    captureUri?: Uri,
  ): Promise<unknown> {
    if (!workspace.isTrusted) {
      throw new Error("Trust this workspace before running source tools or plugins.");
    }
    if (!this.#root) {
      await this.select();
    }
    if (!this.#root) {
      return undefined;
    }
    if (this.#busy) {
      throw new Error(`Source operation already running: ${this.#busy}.`);
    }
    const root = this.#root;
    if (["apply", "preview", "discard"].includes(action) && !this.#candidate) {
      this.output.info("No pending regeneration. Prepare a generation first.");
      void window.showInformationMessage("No pending regeneration. Prepare a generation first.");
      return undefined;
    }
    const epoch = this.#epoch;
    const buffers = this.buffers();
    const binaryBuffers = this.binaryBuffers();
    const opaqueBuffers = this.opaqueBinaryBuffers();
    // Builds consume saved inputs. Name drafts up front and use the same recovery action as a
    // mid-build edit, instead of making users guess which editor is blocking Run/Debug.
    if (action === "build" && (buffers.length || binaryBuffers.length || opaqueBuffers.length)) {
      const files = [
        ...buffers.map((buffer) => buffer.path),
        ...binaryBuffers.map((document) => path.relative(root, document.uri.fsPath)),
        ...opaqueBuffers.map((file) => path.relative(root, file)),
      ];
      throw this.changedBuildError(files);
    }
    if (
      ["preview", "apply", "finish", "build", "analyze", "import", "relocate", "expand"].includes(
        action,
      ) &&
      opaqueBuffers.length
    ) {
      throw new Error(
        "Save assets open in other custom editors before this operation; their unsaved bytes are not available for preview.",
      );
    }
    if (
      ["apply", "finish", "build", "analyze", "import", "relocate", "expand"].includes(action) &&
      (buffers.length || binaryBuffers.length)
    ) {
      throw new Error(
        "Save the source, asset and research buffers before this operation. Generation preview can include unsaved edits.",
      );
    }
    let capture: string | undefined;
    let objectId: string | undefined;
    let expansionSize: number | undefined;
    if (action === "expand") {
      const layoutText = await fs.readFile(path.join(root, this.#configuration!.layout), "utf8");
      const layoutValue: unknown = JSON.parse(layoutText);
      if (!isRecord(layoutValue)) {
        throw new Error("Layout contract is missing a numeric ROM size.");
      }
      const romSize = layoutValue.size;
      if (typeof romSize !== "number") {
        throw new Error("Layout contract is missing a numeric ROM size.");
      }
      const capacities = [0x10000, 0x20000, 0x40000, 0x80000, 0x100000, 0x200000, 0x400000]
        .filter((size) => size > romSize)
        .map((size) => ({
          label: `${size / 1024} KiB`,
          size,
          description: "Keep mapper; add $FF storage and update header/checksum",
        }));
      if (!capacities.length) {
        throw new Error("This ROM has no supported larger LoROM/HiROM capacity (maximum 4 MiB).");
      }
      expansionSize = (
        await window.showQuickPick(capacities, {
          title: "Expand ROM capacity",
          placeHolder: "Apply reviewable source, layout and build configuration edits",
        })
      )?.size;
      if (expansionSize === undefined) {
        return undefined;
      }
    }
    if (action === "relocate") {
      const file = path.join(root, this.#configuration!.layout);
      if ((await fs.stat(file)).size > 8 * 1024 * 1024) {
        throw new Error("Layout contract exceeds its size budget.");
      }
      const layoutText = await fs.readFile(file, "utf8");
      const layoutValue: unknown = JSON.parse(layoutText);
      const objects =
        isRecord(layoutValue) && Array.isArray(layoutValue.objects)
          ? layoutValue.objects.filter(isLayoutObject)
          : [];
      const choices = objects.map((object) => ({
        label: object.id,
        description: object.kind,
      }));
      if (!choices.length) {
        throw new Error(
          "Declare a movable object and proven free-space block in the project layout first.",
        );
      }
      objectId = (
        await window.showQuickPick(choices, {
          title: "Relocate a source object",
          placeHolder:
            "Compute placement, validate references, and apply ordinary undoable source edits",
        })
      )?.label;
      if (!objectId) {
        return undefined;
      }
    }
    if (action === "import") {
      if (captureUri && (!(captureUri instanceof Uri) || captureUri.scheme !== "file")) {
        throw new Error("Capture import requires a local file URI.");
      }
      capture =
        captureUri?.fsPath ??
        (
          await window.showOpenDialog({
            canSelectMany: false,
            filters: { "Capture archives": ["act2", "json"] },
          })
        )?.[0]?.fsPath;
      if (!capture) {
        return undefined;
      }
    }
    this.#busy = action;
    this.#changed.fire(undefined);
    this.output.info(`Source ${action}: ${root}`);
    try {
      const buildControls = action === "build" ? await captureBuildControls(root) : [];
      const overlays = buffers.map(({ path: overlayPath, bytes }) => ({
        path: overlayPath,
        bytes,
      }));
      if (action === "preview") {
        for (const document of binaryBuffers) {
          overlays.push({
            path: path.relative(root, document.uri.fsPath).split(path.sep).join("/"),
            bytes: Buffer.from(await document.snapshot()),
          });
        }
        if (this.#epoch !== epoch || this.#root !== root) {
          throw new Error("Source changed while capturing unsaved assets. Preview again.");
        }
      }
      const run = (signal: AbortSignal | undefined, onProgress: (message: string) => void) =>
        this.#worker.run(
          {
            action,
            directory: root,
            candidate: this.#candidate,
            capture,
            objectId,
            expansionSize,
            overlays: action === "preview" ? overlays : undefined,
          },
          {
            signal,
            onProgress,
            maxMemoryMiB: workspace
              .getConfiguration("asm", Uri.file(root))
              .get<number>("analysis.maxMemoryMiB", 4096),
          },
        );
      const result = cancellation
        ? await run(cancellation, progress ?? (() => {}))
        : await window.withProgress(
            {
              location: ProgressLocation.Notification,
              title: `Source: ${action}`,
              cancellable: true,
            },
            async (reporter, token) => {
              const controller = new AbortController();
              const listener = token.onCancellationRequested(() => controller.abort());
              try {
                return await run(controller.signal, (message) => reporter.report({ message }));
              } finally {
                listener.dispose();
              }
            },
          );
      if (action === "prepare") {
        if (!isGenerationCommit(result)) {
          throw new Error("Invalid source generation.");
        }
        this.#candidate = result.generation.commit;
        await this.context.workspaceState.update(`source.candidate:${root}`, this.#candidate);
        this.#preview = undefined;
      } else if (action === "preview") {
        if (!isSourceMergePreview(result)) {
          throw new Error("Invalid source preview.");
        }
        this.#preview = result;
        void window.showInformationMessage(
          `Preview: ${this.#preview.conflicts.length} conflicting files. Next: save and commit your reviewed checkpoint in Source Control, then Apply Previewed Generation. After applying, resolve/stage changes and Finish; Finish builds and commits the merge.`,
        );
      } else if (action === "build") {
        if (!isSnesSourceBuild(result)) {
          throw new Error("Invalid source build.");
        }
        // Watcher delivery can lag Save or report an unchanged custom tab. Verify consumed bytes
        // rather than rejecting a successful worker build on an unrelated event counter.
        const changed = await changedBuildInputs(root, [...buildControls, ...result.inputs]);
        const unsaved = [
          ...this.buffers().map((buffer) => buffer.path),
          ...this.binaryBuffers().map((document) => path.relative(root, document.uri.fsPath)),
          ...this.opaqueBinaryBuffers().map((file) => path.relative(root, file)),
        ];
        if (this.#root !== root) {
          throw new Error(
            "Selected project changed during the build. Select the intended source project and Build Current Source again.",
          );
        }
        if (changed.length || unsaved.length) {
          throw this.changedBuildError([...changed, ...unsaved]);
        }
        this.#build = result;
        this.#buildInputs = [...buildControls, ...result.inputs];
        this.#buildStale = false;
        this.#diagnostics.clear();
        this.#built.fire({ root, build: this.#build });
      } else if (action === "relocate" || action === "expand") {
        const edits = relocationEdits(result);
        const documents = await Promise.all(
          edits.map((edit) => workspace.openTextDocument(Uri.file(path.join(root, edit.path)))),
        );
        if (
          this.#root !== root ||
          this.#epoch !== epoch ||
          this.buffers().length ||
          this.binaryBuffers().length
        ) {
          throw new Error(
            "Source changed during placement inspection. Prepare it again before applying edits.",
          );
        }
        const edit = new WorkspaceEdit();
        for (const [index, change] of edits.entries()) {
          const document = documents[index];
          if (sourceContentHash(document.getText()) !== change.beforeSha256) {
            throw new Error(`Placement source changed: ${change.path}`);
          }
          edit.replace(
            document.uri,
            new Range(document.positionAt(0), document.positionAt(document.getText().length)),
            change.after,
          );
        }
        // One native workspace edit preserves undo/redo. It stays unsaved and uncommitted so the
        // normal editor and Git diffs are the review surface, including the paired layout update.
        if (!(await workspace.applyEdit(edit))) {
          throw new Error("The editor rejected stale placement edits. Prepare them again.");
        }
        this.#buildStale = true;
        await commands.executeCommand("workbench.view.scm");
      } else if (action === "apply") {
        await commands.executeCommand("workbench.view.scm");
        void window.showInformationMessage(
          "Generation applied. Resolve conflicts and stage the intended changes in Source Control, then Validate and Finish Regeneration. Finish builds and creates the merge commit.",
        );
      } else if (action === "import" || action === "analyze") {
        let message =
          "Capture imported. Next: Analyze Evidence, then Prepare Regeneration. Current source has not changed.";
        let button = "Analyze Evidence";
        let command = "asm.source.analyze";
        if (action === "analyze") {
          message =
            "Analysis complete. Next: Prepare Regeneration, then Preview with Current Edits. Building alone does not update source.";
          button = "Prepare Regeneration";
          command = "asm.source.prepare";
        }
        // Keep navigation ranges in the generated report; Output needs their totals rather than every link.
        let loggedResult = result;
        if (isRecord(result) && Array.isArray(result.addedCode)) {
          const addedBytes = result.addedCode.reduce((total: number, range: unknown) => {
            if (
              !isRecord(range) ||
              typeof range.start !== "number" ||
              typeof range.end !== "number"
            ) {
              return total;
            }
            return total + range.end - range.start;
          }, 0);
          loggedResult = {
            ...result,
            addedCode: { ranges: result.addedCode.length, bytes: addedBytes },
          };
        }
        this.output.info(JSON.stringify(loggedResult, null, 2));
        // Notifications do not hold the operation busy; only an explicit click starts the next step.
        void window.showInformationMessage(message, button).then((choice) => {
          if (choice === button) {
            void commands.executeCommand(command);
          }
          return undefined;
        });
      } else if (action === "catalog") {
        this.output.info(JSON.stringify(result, null, 2));
        void window.showInformationMessage(
          "Capture catalog refreshed. Follow Next in Source Project to analyze or prepare regeneration. Review the catalog change with your checkpoint.",
        );
      } else if (action === "abort") {
        this.#preview = undefined;
      } else if (action === "discard" || action === "finish") {
        await this.clearCandidate(root);
      } else if (action === "clean") {
        this.output.info(JSON.stringify(result, null, 2));
        this.output.show(true);
      }
      this.output.info(`Source ${action} completed.`);
      return result;
    } catch (error) {
      let failure = error;
      const changedPrefix = "Source dependency changed during assembly: ";
      if (action === "build" && error instanceof Error && error.message.startsWith(changedPrefix)) {
        // The assembler can detect a race before a receipt exists. Give that failure the same
        // named-file recovery as edits detected during controller acceptance.
        const file = error.message.slice(changedPrefix.length);
        failure = this.changedBuildError([path.relative(root, file)]);
      }
      if (action === "build" || action === "finish") {
        this.publishDiagnostics(failure);
      }
      throw failure;
    } finally {
      this.#busy = undefined;
      // A status refresh cannot undo a completed operation or hide its original error.
      try {
        await this.refresh();
      } catch (error) {
        this.output.warn(`Source status refresh failed: ${String(error)}`);
        this.#changed.fire(undefined);
      }
    }
  }

  private async incoming(): Promise<void> {
    if (!this.#candidate || !this.#root) {
      return;
    }
    const root = this.#root,
      candidate = this.#candidate;
    const base = (await sourceGit(root, ["rev-parse", `${candidate}^`])).stdout.toString().trim();
    const result = await sourceGit(root, [
      "diff",
      "--no-renames",
      "--name-status",
      "-z",
      base,
      candidate,
    ]);
    const parts = result.stdout.toString("utf8").split("\0");
    const rows: SourceRow[] = [];
    for (let index = 0; index + 1 < parts.length; index += 2) {
      const status = parts[index],
        file = parts[index + 1];
      const left = this.#files.uri(root, status === "A" ? null : base, file);
      const right = this.#files.uri(root, status === "D" ? null : candidate, file);
      const row = new SourceRow(file, [], "asm.source.diff", [
        left,
        right,
        `${file} · Generated ${base.slice(0, 7)} → ${candidate.slice(0, 7)}`,
      ]);
      row.description = status;
      rows.push(row);
    }
    this.#incoming = rows;
  }

  private buildTask(root: string, folder?: WorkspaceFolder): Task {
    const definition = { type: "uttori-source", action: "build", project: root };
    const scope =
      folder ?? workspace.getWorkspaceFolder(Uri.file(root)) ?? workspace.workspaceFolders?.[0];
    const execution = new CustomExecution(() => {
      const write = new EventEmitter<string>(),
        close = new EventEmitter<number>();
      const abort = new AbortController();
      const terminal: Pseudoterminal = {
        onDidWrite: write.event,
        onDidClose: close.event,
        open: () => {
          void (async () => {
            try {
              if (this.#root !== root) {
                await this.select(root);
              }
              await this.perform("build", abort.signal, (message) => write.fire(`${message}\r\n`));
              close.fire(0);
            } catch (error) {
              write.fire(`${String(error)}\r\n`);
              close.fire(1);
            } finally {
              write.dispose();
              close.dispose();
            }
          })();
        },
        close: () => abort.abort(),
      };
      return Promise.resolve(terminal);
    });
    const task = new Task(
      definition,
      scope ?? 2,
      "Build and Check",
      "Uttori Source",
      execution,
      [],
    );
    task.group = TaskGroup.Build;
    return task;
  }

  private publishDiagnostics(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostics = new Map<string, Diagnostic[]>();
    for (const line of message.split("\n").slice(0, 30)) {
      const match = /^(.*):(\d+): ([\w-]+): (.*)$/.exec(line);
      const file = match?.[1] ?? path.join(this.#root!, this.#configuration!.buildConfig);
      const row = Math.max(0, Number(match?.[2] ?? 1) - 1);
      const diagnostic = new Diagnostic(
        new Range(row, 0, row, 1),
        match?.[4] ?? line,
        DiagnosticSeverity.Error,
      );
      diagnostic.source = "Uttori source";
      diagnostic.code = match?.[3];
      const items = diagnostics.get(file) ?? [];
      items.push(diagnostic);
      diagnostics.set(file, items);
    }
    this.#diagnostics.clear();
    this.#diagnostics.set([...diagnostics].map(([file, values]) => [Uri.file(file), values]));
  }
  private contains(file: string): boolean {
    if (!this.#root) {
      return false;
    }
    const relative = path.relative(this.#root, file);
    return (
      relative === "" ||
      (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
    );
  }
  /** Ignore local evidence, verification reports and caches even when they share the repository root. */
  private authoringFile(file: string): boolean {
    if (!this.#root || !this.#configuration || !this.contains(file)) {
      return false;
    }
    const relative = path.relative(this.#root, file).split(path.sep).join("/");
    if (
      // Finder metadata may change when browsing assets; it never contributes build bytes.
      path.basename(relative) === ".DS_Store" ||
      // These conventional subdirectories hold analysis/capture evidence or golden outputs,
      // not editable source. Consumed files are still checked by the build receipt.
      this.#configuration.sourceRoots.some((root) =>
        ["analysis", "build", "captures"].some(
          (directory) =>
            relative === `${root}/${directory}` || relative.startsWith(`${root}/${directory}/`),
        ),
      ) ||
      relative.includes("analysis.sqlite") ||
      relative
        .split("/")
        .some((part) => [".uttori-local", ".uttori-asm", "node_modules"].includes(part))
    ) {
      return false;
    }
    const roots = [
      ...this.#configuration.sourceRoots,
      ...this.#configuration.researchRoots,
      ".uttori",
    ];
    return roots.some((root) => relative === root || relative.startsWith(`${root}/`));
  }
  private async openResearch(): Promise<void> {
    if (!this.#root || !this.#configuration) {
      return;
    }
    await commands.executeCommand(
      "revealInExplorer",
      Uri.file(path.join(this.#root, this.#configuration.researchRoots[0])),
    );
  }
  private async restore(): Promise<void> {
    const saved = this.context.workspaceState.get<string>("source.selected");
    if (saved) {
      await this.guard(() => this.select(saved));
      return;
    }
    const roots = [
      ...new Set(
        (
          await Promise.all(
            (workspace.workspaceFolders ?? []).map((folder) => findSourceRoot(folder.uri.fsPath)),
          )
        ).filter((value): value is string => !!value),
      ),
    ];
    if (roots.length === 1) {
      await this.guard(() => this.select(roots[0]));
    }
  }
  /** Keep notifications compact while retaining every blocking input in the analysis log. */
  private changedBuildError(files: readonly string[]): Error {
    const names = [...new Set(files)];
    this.output.warn(`Build inputs changed: ${names.join(", ")}`);
    return new Error(
      `Build inputs changed: ${names.slice(0, 5).join(", ")}. Save these files, then run Build Current Source again. Check Output → Uttori Analysis for the complete list.`,
    );
  }

  /** Commands return successful service results to other extensions/tasks while reporting failures in the UI. */
  private async guard<T>(operation: () => Promise<T>): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.error(message);
      this.output.show(true);
      const buildChanged = message.startsWith("Build inputs changed:");
      const buttons = ["Show Analysis Output"];
      if (buildChanged) {
        buttons.unshift("Save All and Rebuild");
      }
      void window.showErrorMessage(`Source: ${message}`, ...buttons).then(async (choice) => {
        if (choice === "Show Analysis Output") {
          this.output.show(true);
        }
        if (choice === "Save All and Rebuild") {
          await this.guard(async () => {
            await commands.executeCommand("workbench.action.files.saveAll");
            return this.perform("build");
          });
        }
        return undefined;
      });
      return undefined;
    }
  }
  dispose(): void {
    clearTimeout(this.#refreshTimer);
    this.#watcher?.dispose();
    for (const item of this.#disposables) {
      item.dispose();
    }
  }
}
