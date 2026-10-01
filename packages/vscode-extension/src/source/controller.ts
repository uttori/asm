import fs from "node:fs/promises";
import path from "node:path";

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
import type {
  PreparedSnesGeneration,
  SnesSourceBuild,
  SnesSourceRelocation,
} from "@uttori/asm-plugin-snes";
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
import { editAnalysisResearch } from "./analysis-editor.js";
import { registerSourceCodeActions } from "./code-actions.js";
import { SourceGitFiles } from "./git-files.js";
import { SourceProcessClient } from "./process-client.js";
import { findEvidenceSourceRoot, findSourceRoot } from "./project-path.js";
import { editSourceResearch } from "./research-editor.js";

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
  #status?: SourceMergeStatus & { dirty: boolean };
  #branch = "";
  #candidate?: string;
  #preview?: SourceMergePreview;
  #incoming: SourceRow[] = [];
  #build?: SnesSourceBuild;
  #buildStale = true;
  #busy?: string;
  #refreshTimer?: NodeJS.Timeout;
  #watcher?: Disposable;
  #epoch = 0;

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
        if (event.contentChanges.length > 0 && this.authoringFile(event.document.uri.fsPath)) {
          this.#epoch++;
          this.#buildStale = true;
          this.#changed.fire(undefined);
        }
      }),
      binaryDrafts.onDidChange((uri) => {
        if (this.authoringFile(uri.fsPath)) {
          this.#epoch++;
          this.#buildStale = true;
          this.#changed.fire(undefined);
        }
      }),
      window.tabGroups.onDidChangeTabs((event) => {
        // Other custom editors own opaque drafts. Their native dirty transitions
        // still invalidate build status even though this extension cannot encode them.
        if (
          [...event.changed, ...event.closed].some(
            (tab) =>
              tab.input instanceof TabInputCustom && this.authoringFile(tab.input.uri.fsPath),
          )
        ) {
          this.#epoch++;
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
    const regeneration = new SourceRow(
      `Regeneration · ${this.#busy ?? this.#status?.phase ?? "loading"}`,
      [
        new SourceRow("Prepare Regeneration", [], "asm.source.prepare"),
        ...(this.#candidate
          ? [
              new SourceRow(`Incoming Generation · ${this.#incoming.length} files`, this.#incoming),
              new SourceRow("Preview with Current Edits", [], "asm.source.preview"),
              new SourceRow("Apply after Git Checkpoint", [], "asm.source.apply"),
              new SourceRow("Discard Candidate", [], "asm.source.discard"),
            ]
          : []),
        ...(this.#status?.phase === "merging"
          ? [
              new SourceRow(
                `Resolve ${this.#status.conflicts.length} Conflicts in Source Control`,
                [],
                "workbench.view.scm",
              ),
              new SourceRow("Validate and Finish Merge", [], "asm.source.finish"),
              new SourceRow("Abort Regeneration", [], "asm.source.abort"),
            ]
          : []),
        ...(this.#status?.phase === "committed"
          ? [new SourceRow("Validate Committed Regeneration", [], "asm.source.finish")]
          : []),
      ],
    );
    let buildLabel = "Build and Check";
    if (this.#build) {
      buildLabel = this.#buildStale ? "Build · source changed" : "Build · verified";
    }
    const build = new SourceRow(buildLabel, [], "asm.source.build");
    return [
      source,
      regeneration,
      build,
      new SourceRow("Research", [
        new SourceRow("Open Declarations", [], "asm.source.research"),
        new SourceRow("Edit Symbol Research", [], "asm.source.editResearch"),
        new SourceRow("Edit Analysis Research", [], "asm.source.editAnalysis"),
      ]),
      new SourceRow("Placement", [
        new SourceRow("Relocate Object", [], "asm.source.relocate"),
        new SourceRow("Expand ROM Capacity", [], "asm.source.expand"),
      ]),
      new SourceRow("Import Capture", [], "asm.source.importCapture"),
      new SourceRow("Analyze Evidence", [], "asm.source.analyze"),
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
    if (!mapper) {
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
                mapper:
                  mapper === "Detect automatically"
                    ? undefined
                    : (mapper as (typeof SNES_MAPPERS)[number]),
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
    this.#watcher?.dispose();
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(resolved, "**/*"));
    const changed = (uri: Uri): void => {
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
        this.#buildStale = true;
      }
      if (authoring) {
        this.#savedInput.fire();
      }
      const researchRoots = this.#configuration?.researchRoots ?? [];
      if (
        relative.startsWith(".uttori/") ||
        relative.startsWith(".git/") ||
        researchRoots.some((root) => relative === root || relative.startsWith(root + "/"))
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
    const build = result as SnesSourceBuild;
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
    const status = await this.#worker.run<SourceMergeStatus & { dirty: boolean }>(
      { directory: root, action: "status" },
      { maxMemoryMiB: 512 },
    );
    if (root !== this.#root) {
      return;
    }
    this.#status = status;
    this.#configuration = configuration;
    this.#branch =
      (await sourceGit(root, ["branch", "--show-current"])).stdout.toString().trim() ||
      "detached HEAD";
    if (this.#candidate) {
      await this.incoming();
    }
    this.#changed.fire(undefined);
  }

  /** Source snapshots include only tracked-authoring roots, never private ROMs/captures or SQL files. */
  private binaryBuffers() {
    return [...this.binaryDrafts.documents].filter(
      (document) => document.dirty && this.authoringFile(document.uri.fsPath),
    );
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
    const epoch = this.#epoch;
    const buffers = this.buffers();
    const binaryBuffers = this.binaryBuffers();
    if (
      ["preview", "apply", "finish", "build", "analyze", "import", "relocate", "expand"].includes(
        action,
      ) &&
      this.opaqueBinaryBuffers().length
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
      const layout = JSON.parse(
        await fs.readFile(path.join(root, this.#configuration!.layout), "utf8"),
      ) as { size: number };
      const capacities = [0x10000, 0x20000, 0x40000, 0x80000, 0x100000, 0x200000, 0x400000]
        .filter((size) => size > layout.size)
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
      const layout = JSON.parse(await fs.readFile(file, "utf8")) as {
        objects?: { id: string; kind: string }[];
      };
      const choices = (layout.objects ?? []).map((object) => ({
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
    try {
      const overlays = buffers.map(({ path, bytes }) => ({ path, bytes }));
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
        this.#candidate = (result as PreparedSnesGeneration).generation.commit;
        await this.context.workspaceState.update(`source.candidate:${root}`, this.#candidate);
        this.#preview = undefined;
      } else if (action === "preview") {
        this.#preview = result as SourceMergePreview;
        void window.showInformationMessage(
          `Preview: ${this.#preview.conflicts.length} conflicting files. Commit the reviewed source snapshot before applying.`,
        );
      } else if (action === "build") {
        if (
          this.#epoch !== epoch ||
          this.buffers().length ||
          this.binaryBuffers().length ||
          this.opaqueBinaryBuffers().length
        ) {
          throw new Error("Source changed during the build. Rebuild before running or debugging.");
        }
        this.#build = result as SnesSourceBuild;
        this.#buildStale = false;
        this.#diagnostics.clear();
        this.#built.fire({ root, build: this.#build });
      } else if (action === "relocate" || action === "expand") {
        const relocation = result as SnesSourceRelocation;
        const documents = await Promise.all(
          relocation.edits.map((edit) =>
            workspace.openTextDocument(Uri.file(path.join(root, edit.path))),
          ),
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
        for (const [index, change] of relocation.edits.entries()) {
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
      } else if (action === "discard") {
        this.#candidate = undefined;
        this.#preview = undefined;
        this.#incoming = [];
        await this.context.workspaceState.update(`source.candidate:${root}`, undefined);
      } else if (action === "clean") {
        this.output.info(JSON.stringify(result, null, 2));
        this.output.show(true);
      }
      return result;
    } catch (error) {
      if (action === "build" || action === "finish") {
        this.publishDiagnostics(error);
      }
      throw error;
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
  /** Commands return successful service results to other extensions/tasks while reporting failures in the UI. */
  private async guard<T>(operation: () => Promise<T>): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.error(message);
      void window.showErrorMessage(`Source: ${message}`);
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
