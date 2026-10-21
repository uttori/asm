import fs from "node:fs/promises";
import path from "node:path";

import { type ResearchAnalysisChange } from "@uttori/asm-disassembler";
import { sourceGit, parseSourceProject } from "@uttori/asm-disassembler/source-project";
import type { SnesSourceBuild } from "@uttori/asm-plugin-snes/disassembler";
import { SNES_MAPPERS } from "@uttori/asm-plugin-snes/disassembler";
import type { AssetOperation } from "@uttori/asm-workflows/asset-interchange";
import type { AssetSourceOperation } from "@uttori/asm-workflows/asset-source";
import type { SourceAction, SourceResearchRequest } from "@uttori/asm-workflows/source";
import {
  commands,
  Diagnostic,
  DiagnosticSeverity,
  ProgressLocation,
  Range,
  RelativePattern,
  TabInputCustom,
  Task,
  tasks,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
  workspace,
  type Disposable,
  type ExtensionContext,
  type LogOutputChannel,
  type TreeDataProvider,
  type WorkspaceFolder,
} from "vscode";

import type { AnalysisCoverageEditTarget } from "../analysis/coverage-tree.js";
import { BinaryDrafts } from "../assets/binary-drafts.js";
import { onDidChangeRuntimeCapture, runtimeCapturePhase } from "../runtime/capture-state.js";
import { editAnalysisResearch } from "./analysis-editor.js";
import { SourceAssetCoordinator } from "./asset-coordinator.js";
import { type AssetEditorVersion } from "./asset-drafts.js";
import { SourceBuildCoordinator } from "./build-coordinator.js";
import { changedBuildInputs } from "./build-inputs.js";
import { registerSourceCodeActions } from "./code-actions.js";
import { type SourceGenerationReview } from "./generation-review.js";
import { SourceProcessClient } from "./process-client.js";
import { findEvidenceSourceRoot, findSourceRoot } from "./project-path.js";
import { editSourceResearch } from "./research-editor.js";
import { readGraphicsSelection, readSourceStatus } from "./result-readers.js";
import { SourceProjectSession } from "./session.js";
import { isSnesMapper, SourceRow } from "./ui-contracts.js";
import { shouldClearSourceCandidate, sourceWorkflow } from "./workflow.js";

/** A selected ROM project, native Git review, and shared background operations; source edits stay in editors. */
export class SourceController implements TreeDataProvider<SourceRow>, Disposable {
  readonly session = new SourceProjectSession();
  readonly assets = new SourceAssetCoordinator(this.session, this);
  readonly builds = new SourceBuildCoordinator(this.session, this);

  /** All source build entry points publish the same matching map to navigation and inline information. */
  readonly onDidBuild = this.session.built.event;
  /** Saved research and branch changes invalidate names cached by the evidence views. */
  readonly onDidChangeResearch = this.session.researchChanged.event;
  /** Saved text, binary assets and external writes all enter the same debounced watch build. */
  readonly onDidChangeSavedInput = this.session.savedInput.event;
  /** A target change cancels watch work before another project's artifacts can be launched. */
  readonly onDidSelectProject = this.session.selected.event;
  readonly onDidChangeTreeData = this.session.changed.event;
  readonly #disposables: Disposable[] = [];

  constructor(
    readonly context: ExtensionContext,
    readonly output: LogOutputChannel,
    readonly binaryDrafts = new BinaryDrafts(),
  ) {
    this.session.worker = new SourceProcessClient(
      context.asAbsolutePath("out/source-process.mjs"),
      (message) => output.info(message),
    );
    this.#disposables.push(
      this.session.worker,
      this.session.files,
      this.session.changed,
      this.session.built,
      this.session.researchChanged,
      this.session.savedInput,
      this.session.selected,
      this.session.diagnostics,
      // Foreground builds/publications retire menu probes immediately; ordinary
      // tree refreshes share the same key and do not restart background work.
      this.session.changed.event(() => this.scheduleAssetContext()),
      onDidChangeRuntimeCapture(() => this.session.changed.fire(undefined)),
      registerSourceCodeActions(() =>
        this.session.root && this.session.configuration
          ? { root: this.session.root, layout: this.session.configuration.layout }
          : undefined,
      ),
      window.registerTreeDataProvider("uttori-asm.sourceProject", this),
      workspace.registerFileSystemProvider("uttori-source", this.session.files, {
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
      commands.registerCommand("asm.asset.convertToAseprite", (request?: unknown) =>
        this.guard(() => this.assetConvert("aseprite", request)),
      ),
      commands.registerCommand("asm.asset.convertToPng", (request?: unknown) =>
        this.guard(() => this.assetConvert("indexed-png", request)),
      ),
      window.onDidChangeActiveTextEditor(() => this.scheduleAssetContext()),
      window.onDidChangeTextEditorSelection((event) => {
        if (event.textEditor === window.activeTextEditor) {
          this.scheduleAssetContext();
        }
      }),
      workspace.onDidChangeTextDocument((event) => {
        // Output and virtual-document updates must never reschedule the probe that logged them.
        if (
          event.document.uri.scheme === "file" &&
          (event.document === window.activeTextEditor?.document ||
            this.authoringFile(event.document.uri.fsPath))
        ) {
          this.scheduleAssetContext();
        }
      }),
      workspace.onDidSaveTextDocument((document) => {
        if (
          document.uri.scheme === "file" &&
          (document === window.activeTextEditor?.document ||
            this.authoringFile(document.uri.fsPath))
        ) {
          this.scheduleAssetContext();
        }
      }),
      commands.registerCommand("asm.source.diff", (left: Uri, right: Uri, title: string) =>
        commands.executeCommand("vscode.diff", left, right, title),
      ),
      commands.registerCommand("asm.source.research", () => this.openResearch()),
      commands.registerCommand("asm.source.editResearch", (request?: SourceResearchRequest) =>
        this.guard(() =>
          editSourceResearch(
            this.session.worker,
            () => {
              if (!this.session.root) {
                return undefined;
              }
              return { root: this.session.root, buffers: this.buffers() };
            },
            request,
          ),
        ),
      ),
      commands.registerCommand("asm.source.editAnalysis", (change?: ResearchAnalysisChange) =>
        this.guard(() =>
          editAnalysisResearch(
            this.session.worker,
            () => {
              if (!this.session.root) {
                return undefined;
              }
              return { root: this.session.root, buffers: this.buffers() };
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
          this.session.epoch++;
          this.session.epochInput = event.document.uri.fsPath;
          this.session.epochEvent = "text";
          // Recompute after the input epoch changes, including edits to an inactive dependency.
          this.scheduleAssetContext();
          this.session.buildStale = true;
          this.session.preview = undefined;
          this.session.changed.fire(undefined);
        }
      }),
      binaryDrafts.onDidChange((uri) => {
        if (uri.scheme === "file" && this.authoringFile(uri.fsPath)) {
          this.session.epoch++;
          this.session.epochInput = uri.fsPath;
          this.session.epochEvent = "binary";
          this.scheduleAssetContext();
          this.session.buildStale = true;
          this.session.preview = undefined;
          this.session.changed.fire(undefined);
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
          this.session.epoch++;
          this.session.epochInput = dirtyTab.input.uri.fsPath;
          this.session.epochEvent = "opaque";
          this.scheduleAssetContext();
          this.session.buildStale = true;
          this.session.changed.fire(undefined);
        }
      }),
      tasks.registerTaskProvider("uttori-source", {
        provideTasks: () => (this.session.root ? [this.buildTask(this.session.root)] : []),
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
          (capture?: Uri | readonly Uri[]) =>
            this.guard(() => this.perform(action, undefined, undefined, capture)),
        ),
      );
    }
    this.#disposables.push(
      commands.registerCommand("asm.source.graphics", (captureSha256?: string) =>
        this.guard(async () => {
          const root = this.session.root;
          if (!root || !workspace.isTrusted) {
            throw new Error("Select a trusted NES source project first.");
          }
          const selection = await this.session.worker.run(
            { action: "graphics", directory: root },
            { maxMemoryMiB: 512, readResult: readGraphicsSelection },
          );
          if (!selection.captures.length) {
            await window.showInformationMessage(
              "Import NES graphics captures to inspect their CPU evidence links.",
            );
            return;
          }
          const choices = selection.captures.map((capture) => ({
            label: capture.sourceName,
            description: `${capture.observedEvents.toLocaleString()} events`,
            detail: capture.sha256,
            capture,
          }));
          let selected;
          if (captureSha256 !== undefined) {
            selected = choices.find((choice) => choice.capture.sha256 === captureSha256);
            if (!selected) {
              throw new Error("Select an imported graphics capture identity.");
            }
          } else {
            selected = await window.showQuickPick(choices, {
              title: "NES Graphics Evidence",
              matchOnDetail: true,
            });
          }
          if (!selected) {
            return;
          }
          if (root !== this.session.root) {
            throw new Error("The selected source project changed.");
          }
          const report = await this.session.worker.run(
            {
              action: "graphics",
              directory: root,
              graphicsQuery: { captureSha256: selected.capture.sha256 },
            },
            { maxMemoryMiB: 512 },
          );
          await window.showTextDocument(
            await workspace.openTextDocument({
              language: "json",
              content: JSON.stringify(report, null, 2) + "\n",
            }),
          );
        }),
      ),
    );
    void this.restore();
  }

  get root(): string | undefined {
    return this.session.root;
  }

  /** The selected build contract also identifies Watch when no source editor is open. */
  get buildUri(): string | undefined {
    return this.session.root && this.session.configuration
      ? Uri.file(path.join(this.session.root, this.session.configuration.buildConfig)).toString()
      : undefined;
  }

  /** Route an evidence action only after proving which worktree owns that evidence store. */
  async editEvidence(
    action: "classification" | "state" | "targets" | "symbols",
    target?: AnalysisCoverageEditTarget,
  ): Promise<boolean> {
    const handled = await this.guard(async () => {
      const root = target
        ? await findEvidenceSourceRoot(target.projectDirectory, this.session.root)
        : this.session.root;
      if (!root) {
        return false;
      }
      if (root !== this.session.root) {
        await this.select(root);
      }
      const context = () =>
        this.session.root === root ? { root, buffers: this.buffers() } : undefined;
      if (action === "symbols") {
        await editSourceResearch(this.session.worker, context);
      } else {
        await editAnalysisResearch(this.session.worker, context, undefined, {
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
    if (!this.session.root) {
      return [
        new SourceRow("Select Source Project", [], "asm.source.select"),
        new SourceRow("Create Git Source Project", [], "asm.source.init"),
      ];
    }
    const source = new SourceRow(
      `Source · ${this.session.branch || path.basename(this.session.root)}`,
      [],
      "workbench.view.scm",
    );
    source.description = "checking status";
    if (this.session.status) {
      source.description = this.session.status.dirty ? "uncommitted changes" : "clean";
    }
    source.iconPath = new ThemeIcon("git-branch");
    const unsaved =
      this.buffers().length > 0 ||
      this.binaryBuffers().length > 0 ||
      this.opaqueBinaryBuffers().length > 0;
    const workflow = sourceWorkflow({
      ...this.session.status,
      busy: this.session.busy,
      conflicts: this.session.status?.conflicts.length,
      candidate: Boolean(this.session.candidate),
      previewed:
        this.session.preview?.candidate === this.session.candidate &&
        Boolean(this.session.candidate),
      dirty: (this.session.status?.dirty ?? false) || unsaved,
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
    // A pending candidate remains reviewable before Apply; an active merge owns Finish.
    if (
      this.session.candidate &&
      !["merging", "committed", "diverged"].includes(this.session.status?.phase ?? "")
    ) {
      const previewed = this.session.preview?.candidate === this.session.candidate;
      const reviewLabel = previewed ? "Generation Preview" : "Incoming Generation";
      const incoming = new SourceRow(
        `${reviewLabel} · ${this.session.incoming.length} files`,
        this.session.incoming,
      );
      // Pure exports can have thousands of files; expand the proposed merge only after Preview
      // so its changes are visible before the user applies or commits them.
      incoming.collapsibleState = previewed
        ? TreeItemCollapsibleState.Expanded
        : TreeItemCollapsibleState.Collapsed;
      incoming.tooltip = "Click a file to review its diff. Preview leaves working files unchanged.";
      steps.unshift(incoming);
    }
    const regeneration = new SourceRow("Update Source from Evidence", steps);
    regeneration.tooltip =
      "Analyze → Prepare → Preview diffs → Apply to a clean checkout → review/resolve/stage → Finish. Finish builds and creates the merge commit.";
    const build = new SourceRow("Build Current Source", [], "asm.source.build");
    if (this.session.build) {
      build.description = this.session.buildStale ? "source changed" : "verified";
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
    captureRows.push(new SourceRow("Import Captures", [], "asm.source.importCapture"));
    if (this.session.configuration?.target === "65xx.nes") {
      captureRows.push(new SourceRow("Inspect Graphics Evidence", [], "asm.source.graphics"));
    }
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
    if (this.session.busy) {
      throw new Error("Wait for the current source operation before creating a project.");
    }
    const rom = (
      await window.showOpenDialog({
        canSelectMany: false,
        title: "Original SNES or NES ROM",
        filters: { "Cartridge ROM": ["sfc", "smc", "nes"] },
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
    const nes = path.extname(rom.fsPath).toLowerCase() === ".nes";
    const mapper = nes
      ? "Detect automatically"
      : await window.showQuickPick(["Detect automatically", ...SNES_MAPPERS], {
          title: "SNES cartridge mapping",
        });
    if (!mapper || (mapper !== "Detect automatically" && !isSnesMapper(mapper))) {
      return;
    }
    this.session.busy = "init";
    this.session.changed.fire(undefined);
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
            await this.session.worker.run(
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
      this.session.busy = undefined;
      this.session.changed.fire(undefined);
    }
    await this.select(destination.fsPath);
    await commands.executeCommand(
      "revealInExplorer",
      Uri.file(path.join(destination.fsPath, "source/main.asm")),
    );
  }

  /** Selected context persists across active-editor changes; multi-root workspaces select explicitly. */
  async select(root?: string): Promise<void> {
    if (this.session.busy) {
      throw new Error("Wait for the current source operation before changing projects.");
    }
    const selectionRevision = ++this.session.selectionRevision;
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
    if (selectionRevision !== this.session.selectionRevision) {
      return;
    }
    if (this.session.root !== resolved) {
      this.session.assetContextAbort?.abort();
      this.session.selected.fire();
    }
    this.session.root = resolved;
    this.session.files.roots.add(resolved);
    this.session.configuration = configuration;
    this.session.candidate = this.context.workspaceState.get<string>(
      `source.candidate:${resolved}`,
    );
    this.session.preview = undefined;
    this.session.incoming = [];
    this.session.build = undefined;
    this.session.buildInputs = [];
    this.session.watcher?.dispose();
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
        this.session.epoch++;
        this.session.epochInput = uri.fsPath;
        this.session.epochEvent = "saved";
        const build = this.session.build;
        const inputs = this.session.buildInputs.filter((input) => input.path === relative);
        if (!build) {
          this.session.buildStale = true;
        } else if (inputs.length) {
          // Saved notifications can arrive after publication or describe identical replacement
          // bytes. Only a changed consumed input makes the displayed build stale.
          void changedBuildInputs(resolved, inputs).then(
            (differences) => {
              if (this.session.build === build && differences.length) {
                this.session.buildStale = true;
                this.session.changed.fire(undefined);
              }
              return undefined;
            },
            (error: unknown) => {
              if (this.session.build === build) {
                this.session.buildStale = true;
                this.output.warn(`Unable to check saved build input ${relative}: ${String(error)}`);
                this.session.changed.fire(undefined);
              }
              return undefined;
            },
          );
        }
      }
      if (authoring) {
        this.scheduleAssetContext();
        if (
          this.session.busy === "asset-apply" ||
          this.session.busy === "asset-recover" ||
          this.session.busy === "asset-convert"
        ) {
          this.session.assetSavedInputPending = true;
        } else {
          this.session.savedInput.fire();
        }
      }
      const researchRoots = this.session.configuration?.researchRoots ?? [];
      if (
        relative.startsWith(".uttori/") ||
        relative.startsWith(".git/") ||
        researchRoots.some(
          (researchRoot) => relative === researchRoot || relative.startsWith(`${researchRoot}/`),
        )
      ) {
        this.session.researchChanged.fire();
      }
      clearTimeout(this.session.refreshTimer);
      this.session.refreshTimer = setTimeout(() => {
        if (!this.session.busy) {
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
    this.session.watcher = {
      dispose: () => {
        for (const item of subscriptions) {
          item.dispose();
        }
      },
    };
    await this.context.workspaceState.update("source.selected", resolved);
    await this.refresh();
    this.session.researchChanged.fire();
    this.scheduleAssetContext();
  }

  /** Build/Run/Debug/Watch call this same selected target, independent of which include is focused. */
  async build(): Promise<SnesSourceBuild & { outputChanged: boolean; debugMapChanged: boolean }> {
    return this.builds.build();
  }

  async refresh(): Promise<void> {
    if (!this.session.root || this.session.busy || !workspace.isTrusted) {
      return;
    }
    const root = this.session.root;
    // Terminal branch switches may select a different research layout or build configuration.
    const configuration = parseSourceProject(
      JSON.parse(await fs.readFile(path.join(root, ".uttori/project.json"), "utf8")),
    );
    const status = await this.session.worker.run(
      { directory: root, action: "status", candidate: this.session.candidate },
      { maxMemoryMiB: 512, readResult: readSourceStatus },
    );
    const branch =
      (await sourceGit(root, ["branch", "--show-current"])).stdout.toString().trim() ||
      "detached HEAD";
    if (root !== this.session.root) {
      return;
    }
    this.session.status = status;
    this.session.configuration = configuration;
    // Persisted editor state can outlive Finish or an integration completed in a terminal.
    // A candidate from the old accepted generation cannot be previewed after another integration.
    // Keep an unvalidated committed merge available for Finish; otherwise offer a fresh Prepare.
    if (shouldClearSourceCandidate(status)) {
      await this.clearCandidate(root);
    }
    if (root !== this.session.root) {
      return;
    }
    this.session.branch = branch;
    if (this.session.candidate) {
      await this.incoming();
    }
    this.session.changed.fire(undefined);
  }

  /** Release only the editor selection; the source service owns Git pin and preview lifetimes. */
  async clearCandidate(root: string): Promise<void> {
    if (root === this.session.root) {
      this.session.candidate = undefined;
      this.session.preview = undefined;
      this.session.incoming = [];
    }
    await this.context.workspaceState.update(`source.candidate:${root}`, undefined);
  }

  /** Source snapshots include only tracked-authoring roots, never private ROMs/captures or SQL files. */
  binaryBuffers() {
    return [...this.binaryDrafts.documents].filter(
      (document) => document.dirty && this.authoringFile(document.uri.fsPath),
    );
  }

  /** Capture lightweight versions, including interchange documents saved outside the selected source root. */
  assetEditorVersions(): AssetEditorVersion[] {
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

  /** Hide stale menu actions immediately; evaluated paths and continued calls come from the normal build worker. */
  private scheduleAssetContext(): void {
    return this.assets.scheduleAssetContext();
  }

  /** One clean command stages validated recovery bytes, publishes a native undo unit, then verifies the saved ROM. */
  private async assetConvert(representation: string, request?: unknown): Promise<unknown> {
    return this.assets.assetConvert(representation, request);
  }

  /** Saved-source export/review/apply share the existing source worker, busy state and live editor-version checks. */
  private async assetFile(
    action: "export" | "review" | "apply",
    request?: unknown,
  ): Promise<unknown> {
    return this.assets.assetFile(action, request);
  }

  /** All asset workers use the same cancellation and final live-buffer gate, including explicit journal recovery. */
  private async runAssetOperation(
    operation: AssetOperation | AssetSourceOperation,
    epoch: number,
    versions: readonly AssetEditorVersion[],
    reviewedVersions = versions,
  ): Promise<unknown> {
    return this.assets.runAssetOperation(operation, epoch, versions, reviewedVersions);
  }

  /** Recovery is an explicit journal direction; unknown external bytes and relevant drafts remain protected by the worker. */
  private async assetRecovery(): Promise<void> {
    return this.assets.assetRecovery();
  }

  /** A draft owned by another extension cannot be represented by its older saved file. */
  opaqueBinaryBuffers(): string[] {
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
  buffers() {
    const roots = [
      ...(this.session.configuration?.sourceRoots ?? []),
      ...(this.session.configuration?.researchRoots ?? []),
      ".uttori",
    ];
    return workspace.textDocuments
      .filter(
        (document) =>
          document.isDirty && document.uri.scheme === "file" && this.contains(document.uri.fsPath),
      )
      .flatMap((document) => {
        const relative = path
          .relative(this.session.root!, document.uri.fsPath)
          .split(path.sep)
          .join("/");
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

  /**
   * Run against the selected project while retaining its busy state through worker settlement.
   * Explicit capture URIs bypass the picker; queues retain completed per-file commits on interruption.
   */
  private async perform(
    action: SourceAction,
    cancellation?: AbortSignal,
    progress?: (message: string) => void,
    captureUri?: Uri | readonly Uri[],
  ): Promise<unknown> {
    return this.builds.perform(action, cancellation, progress, captureUri);
  }

  /** Populate immutable review diffs without saving or applying the proposed generation. */
  private async incoming(): Promise<SourceGenerationReview | undefined> {
    return this.builds.incoming();
  }

  private buildTask(root: string, folder?: WorkspaceFolder): Task {
    return this.builds.buildTask(root, folder);
  }

  publishDiagnostics(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostics = new Map<string, Diagnostic[]>();
    for (const line of message.split("\n").slice(0, 30)) {
      const match = /^(.*):(\d+): ([\w-]+): (.*)$/.exec(line);
      const file =
        match?.[1] ?? path.join(this.session.root!, this.session.configuration!.buildConfig);
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
    this.session.diagnostics.clear();
    this.session.diagnostics.set(
      [...diagnostics].map(([file, values]) => [Uri.file(file), values]),
    );
  }
  private contains(file: string): boolean {
    if (!this.session.root) {
      return false;
    }
    const relative = path.relative(this.session.root, file);
    return (
      relative === "" ||
      (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
    );
  }
  /** Ignore local evidence, verification reports and caches even when they share the repository root. */
  private authoringFile(file: string): boolean {
    if (!this.session.root || !this.session.configuration || !this.contains(file)) {
      return false;
    }
    const relative = path.relative(this.session.root, file).split(path.sep).join("/");
    if (
      // Finder metadata may change when browsing assets; it never contributes build bytes.
      path.basename(relative) === ".DS_Store" ||
      // These conventional subdirectories hold analysis/capture evidence or golden outputs,
      // not editable source. Consumed files are still checked by the build receipt.
      this.session.configuration.sourceRoots.some((root) =>
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
      ...this.session.configuration.sourceRoots,
      ...this.session.configuration.researchRoots,
      ".uttori",
    ];
    return roots.some((root) => relative === root || relative.startsWith(`${root}/`));
  }
  private async openResearch(): Promise<void> {
    if (!this.session.root || !this.session.configuration) {
      return;
    }
    await commands.executeCommand(
      "revealInExplorer",
      Uri.file(path.join(this.session.root, this.session.configuration.researchRoots[0])),
    );
  }
  private async restore(): Promise<void> {
    const selectionRevision = this.session.selectionRevision;
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
    // Discovery can finish after an explicit selection has started. Startup must not supersede
    // that request, including while its configuration is still being read.
    if (roots.length === 1 && selectionRevision === this.session.selectionRevision) {
      await this.guard(() => this.select(roots[0]));
    }
  }
  /** Keep notifications compact while retaining every blocking input in the analysis log. */
  changedBuildError(files: readonly string[]): Error {
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
    this.session.selectionRevision++;
    this.session.root = undefined;
    clearTimeout(this.session.refreshTimer);
    clearTimeout(this.session.assetContextTimer);
    this.session.assetContextAbort?.abort();
    this.session.watcher?.dispose();
    for (const item of this.#disposables) {
      item.dispose();
    }
  }
}
