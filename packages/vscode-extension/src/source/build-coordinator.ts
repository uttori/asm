import fs from "node:fs/promises";
import path from "node:path";

import { sourceContentHash } from "@uttori/asm-disassembler/source-project";
import type { SnesSourceBuild } from "@uttori/asm-plugin-snes/disassembler";
import type { SourceAction } from "@uttori/asm-workflows/source";
import { readSourceOperation } from "@uttori/asm-workflows/source-requests";
import {
  commands,
  CustomExecution,
  EventEmitter,
  ProgressLocation,
  Range,
  Task,
  TaskGroup,
  TaskScope,
  Uri,
  window,
  workspace,
  WorkspaceEdit,
  type Pseudoterminal,
  type WorkspaceFolder,
} from "vscode";

import { summarizeSourceAnalysis } from "./analysis-summary.js";
import { captureBuildControls, changedBuildInputs } from "./build-inputs.js";
import { SourceCaptureCoordinator } from "./capture-coordinator.js";
import type { SourceController } from "./controller.js";
import {
  readGenerationDiffStats,
  readSourceGenerationReview,
  type SourceGenerationReview,
} from "./generation-review.js";
import { SourceProjectSession } from "./session.js";
import {
  isRecord,
  isLayoutObject,
  isSnesSourceBuild,
  isSourceMergePreview,
  isGenerationCommit,
  relocationEdits,
  SourceRow,
} from "./ui-contracts.js";
/** Feature coordinator borrows one project session; the controller owns presentation and disposal. */
export class SourceBuildCoordinator {
  constructor(
    readonly session: SourceProjectSession,
    readonly host: Pick<
      SourceController,
      | "select"
      | "output"
      | "buffers"
      | "binaryBuffers"
      | "opaqueBinaryBuffers"
      | "changedBuildError"
      | "context"
      | "clearCandidate"
      | "publishDiagnostics"
      | "refresh"
    >,
  ) {}

  /** Build/Run/Debug/Watch call this same selected target, independent of which include is focused. */
  async build(): Promise<SnesSourceBuild & { outputChanged: boolean; debugMapChanged: boolean }> {
    const previous = this.session.build;
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

  /**
   * Run against the selected project while retaining its busy state through worker settlement.
   * Explicit capture URIs bypass the picker; queues retain completed per-file commits on interruption.
   */
  async perform(
    action: SourceAction,
    cancellation?: AbortSignal,
    progress?: (message: string) => void,
    captureUri?: Uri | readonly Uri[],
    assembly?: "linked",
  ): Promise<unknown> {
    if (!workspace.isTrusted) {
      throw new Error("Trust this workspace before running source tools or plugins.");
    }
    if (!this.session.root) {
      await this.host.select();
    }
    if (!this.session.root) {
      return undefined;
    }
    if (this.session.busy) {
      throw new Error(`Source operation already running: ${this.session.busy}.`);
    }
    const root = this.session.root;
    if (["apply", "preview", "discard"].includes(action) && !this.session.candidate) {
      this.host.output.info("No pending regeneration. Prepare a generation first.");
      void window.showInformationMessage("No pending regeneration. Prepare a generation first.");
      return undefined;
    }
    const epoch = this.session.epoch;
    const buffers = this.host.buffers();
    const binaryBuffers = this.host.binaryBuffers();
    const opaqueBuffers = this.host.opaqueBinaryBuffers();
    // Builds consume saved inputs. Name drafts up front and use the same recovery action as a
    // mid-build edit, instead of making users guess which editor is blocking Run/Debug.
    if (action === "build" && (buffers.length || binaryBuffers.length || opaqueBuffers.length)) {
      const files = [
        ...buffers.map((buffer) => buffer.path),
        ...binaryBuffers.map((document) => path.relative(root, document.uri.fsPath)),
        ...opaqueBuffers.map((file) => path.relative(root, file)),
      ];
      throw this.host.changedBuildError(files);
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
    let captures: readonly string[] | undefined;
    let objectId: string | undefined;
    let expansionSize: number | undefined;
    if (action === "expand") {
      const layoutText = await fs.readFile(
        path.join(root, this.session.configuration!.layout),
        "utf8",
      );
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
      const file = path.join(root, this.session.configuration!.layout);
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
      const selected = await new SourceCaptureCoordinator(this.session).select(captureUri);
      if (!selected) {
        return undefined;
      }
      capture = selected.capture;
      captures = selected.captures;
    }
    this.session.busy = action;
    this.session.changed.fire(undefined);
    this.host.output.info(`Source ${action}: ${root}`);
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
        if (this.session.epoch !== epoch || this.session.root !== root) {
          throw new Error("Source changed while capturing unsaved assets. Preview again.");
        }
      }
      const run = (signal: AbortSignal | undefined, onProgress: (message: string) => void) =>
        this.session.worker.run(
          readSourceOperation({
            action,
            directory: root,
            ...(assembly ? { assembly } : {}),
            candidate: ["status", "preview", "apply", "discard"].includes(action)
              ? this.session.candidate
              : undefined,
            capture,
            captures,
            objectId,
            expansionSize,
            overlays: action === "preview" ? overlays : undefined,
          }),
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
        this.session.candidate = result.generation.commit;
        await this.host.context.workspaceState.update(
          `source.candidate:${root}`,
          this.session.candidate,
        );
        this.session.preview = undefined;
      } else if (action === "preview") {
        if (!isSourceMergePreview(result)) {
          throw new Error("Invalid source preview.");
        }
        this.session.preview = result;
        const review = await this.incoming();
        if (!review) {
          throw new Error("Selected source project changed during preview. Preview again.");
        }
        const conflicts = this.session.preview.conflicts;
        const fileLabel = conflicts.length === 1 ? "file" : "files";
        let summary = `Preview: ${conflicts.length} predicted merge conflicts.`;
        if (conflicts.length) {
          summary = `Preview: ${conflicts.length} ${fileLabel} with predicted merge conflicts: ${conflicts.join(", ")}.`;
        }
        let next =
          "Apply Previewed Generation to see the changes in Source Control. Your existing commit is the starting point; no additional commit is needed before Apply.";
        if (review.localChanges.length) {
          // Only existing local edits need a checkpoint; generated changes are committed after review.
          next = `Before Apply, save and commit or move these existing local changes: ${review.localChanges.join(", ")}.`;
        }
        const message = `${summary} Review ${review.files.length} changed files in Generation Preview. ${next} After applying, review/resolve and stage changes, then Finish; Finish builds and commits the merge.`;
        // Persist every conflicting path and the next steps after the notification disappears.
        this.host.output.info(message);
        if (this.session.incoming.length > 0) {
          const diffArgs = this.session.incoming[0].command?.arguments;
          if (Array.isArray(diffArgs) && diffArgs.length >= 2) {
            const left: unknown = diffArgs[0];
            const right: unknown = diffArgs[1];
            const title = typeof diffArgs[2] === "string" ? diffArgs[2] : "Incoming";
            if (left instanceof Uri && right instanceof Uri) {
              void commands.executeCommand("asm.source.diff", left, right, title);
            }
          }
        }
        void commands.executeCommand("uttori-asm.home.focus");
        void window
          .showInformationMessage(message, "Review Generation", "Show Analysis Output")
          .then((choice) => {
            if (choice === "Review Generation") {
              void commands.executeCommand("uttori-asm.home.focus");
            }
            if (choice === "Show Analysis Output") {
              this.host.output.show(true);
            }
            return undefined;
          });
      } else if (action === "build") {
        if (!isSnesSourceBuild(result)) {
          throw new Error("Invalid source build.");
        }
        // Watcher delivery can lag Save or report an unchanged custom tab. Verify consumed bytes
        // rather than rejecting a successful worker build on an unrelated event counter.
        const changed = await changedBuildInputs(root, [...buildControls, ...result.inputs]);
        const unsaved = [
          ...this.host.buffers().map((buffer) => buffer.path),
          ...this.host.binaryBuffers().map((document) => path.relative(root, document.uri.fsPath)),
          ...this.host.opaqueBinaryBuffers().map((file) => path.relative(root, file)),
        ];
        if (this.session.root !== root) {
          throw new Error(
            "Selected project changed during the build. Select the intended source project and Build Current Source again.",
          );
        }
        if (changed.length || unsaved.length) {
          throw this.host.changedBuildError([...changed, ...unsaved]);
        }
        this.session.build = result;
        this.session.buildInputs = [...buildControls, ...result.inputs];
        this.session.buildStale = false;
        this.session.diagnostics.clear();
        this.session.built.fire({ root, build: this.session.build });
      } else if (action === "relocate" || action === "expand") {
        const edits = relocationEdits(result);
        const documents = await Promise.all(
          edits.map((edit) => workspace.openTextDocument(Uri.file(path.join(root, edit.path)))),
        );
        if (
          this.session.root !== root ||
          this.session.epoch !== epoch ||
          this.host.buffers().length ||
          this.host.binaryBuffers().length
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
        this.session.buildStale = true;
        await commands.executeCommand("workbench.view.scm");
      } else if (action === "apply") {
        await commands.executeCommand("workbench.view.scm");
        void window.showInformationMessage(
          "Generation applied. Resolve conflicts and stage the intended changes in Source Control, then Validate and Finish Regeneration. Finish builds and creates the merge commit.",
        );
      } else if (action === "import" || action === "analyze") {
        let message =
          "Capture imported. Next: Analyze Evidence, then Prepare Regeneration. Current source has not changed.";
        if (captures && isRecord(result) && Array.isArray(result.imports)) {
          message = `${result.imports.length} captures imported. Next: Analyze Evidence, then Prepare Regeneration. Current source has not changed.`;
        }
        let button = "Analyze Evidence";
        let command = "asm.source.analyze";
        let warning = false;
        let reportFile: string | undefined;
        if (action === "analyze") {
          const summary = summarizeSourceAnalysis(result);
          message = `${summary.message} Next: Prepare Regeneration, then Preview with Current Edits.`;
          warning = summary.warning;
          this.host.output.info([summary.message, ...summary.details].join("\n"));
          // Persist every diagnostic outside authored source. Output stays readable even when
          // shallow call contexts produce thousands of bounds; the report remains inspectable.
          reportFile = path.join(root, ".uttori-local/reports/analysis.json");
          try {
            await fs.mkdir(path.dirname(reportFile), { recursive: true });
            await fs.writeFile(reportFile, JSON.stringify(result, null, 2) + "\n");
            this.host.output.info(`Full analysis report: ${reportFile}`);
          } catch (error) {
            // Publication already succeeded. A report-write failure must not turn it into a
            // failed Analyze or discard diagnostics that exist only in the worker response.
            this.host.output.warn(`Could not save analysis report: ${String(error)}`);
            this.host.output.info(JSON.stringify(result, null, 2));
            reportFile = undefined;
          }
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
        if (action === "import") {
          this.host.output.info(JSON.stringify(loggedResult, null, 2));
        }
        // Notifications do not hold the operation busy; only an explicit click starts the next step.
        const buttons = reportFile ? [button, "Open Analysis Report"] : [button];
        const notification = warning
          ? window.showWarningMessage(message, ...buttons)
          : window.showInformationMessage(message, ...buttons);
        void notification.then((choice) => {
          if (choice === button) {
            void commands.executeCommand(command);
          } else if (choice === "Open Analysis Report" && reportFile) {
            void window.showTextDocument(Uri.file(reportFile));
          }
          return undefined;
        });
      } else if (action === "catalog") {
        this.host.output.info(JSON.stringify(result, null, 2));
        void window.showInformationMessage(
          "Capture catalog refreshed. Follow Next in Source Project to analyze or prepare regeneration. Review the catalog change with your checkpoint.",
        );
      } else if (action === "abort") {
        this.session.preview = undefined;
      } else if (action === "discard" || action === "finish") {
        await this.host.clearCandidate(root);
      } else if (action === "clean") {
        this.host.output.info(JSON.stringify(result, null, 2));
        this.host.output.show(true);
      }
      this.host.output.info(`Source ${action} completed.`);
      return result;
    } catch (error) {
      let failure = error;
      const changedPrefix = "Source dependency changed during assembly: ";
      if (action === "build" && error instanceof Error && error.message.startsWith(changedPrefix)) {
        // The assembler can detect a race before a receipt exists. Give that failure the same
        // named-file recovery as edits detected during controller acceptance.
        const file = error.message.slice(changedPrefix.length);
        failure = this.host.changedBuildError([path.relative(root, file)]);
      }
      if (action === "build" || action === "finish") {
        this.host.publishDiagnostics(failure);
      }
      throw failure;
    } finally {
      this.session.busy = undefined;
      // A status refresh cannot undo a completed operation or hide its original error.
      try {
        await this.host.refresh();
      } catch (error) {
        this.host.output.warn(`Source status refresh failed: ${String(error)}`);
        this.session.changed.fire(undefined);
      }
    }
  }

  /** Populate immutable review diffs without saving or applying the proposed generation. */
  async incoming(): Promise<SourceGenerationReview | undefined> {
    if (!this.session.candidate || !this.session.root) {
      return undefined;
    }
    const root = this.session.root,
      candidate = this.session.candidate;
    const preview = this.session.preview;
    const review = await readSourceGenerationReview(root, candidate, preview);
    // A selection or newer preview can arrive while Git is reading immutable trees.
    if (
      root !== this.session.root ||
      candidate !== this.session.candidate ||
      preview !== this.session.preview
    ) {
      return undefined;
    }
    const stats = await readGenerationDiffStats(root, review.before, review.after);
    if (
      root !== this.session.root ||
      candidate !== this.session.candidate ||
      preview !== this.session.preview
    ) {
      return undefined;
    }
    const rows: SourceRow[] = [];
    const label = review.previewed ? "Generation Preview" : "Generated";
    for (const { status, path: file, conflict } of review.files) {
      const left = this.session.files.uri(root, status === "A" ? null : review.before, file);
      const right = this.session.files.uri(root, status === "D" ? null : review.after, file);
      const row = new SourceRow(file, [], "asm.source.diff", [
        left,
        right,
        `${file} · ${label} ${review.before.slice(0, 7)} → ${review.after.slice(0, 7)}`,
      ]);
      row.description = conflict ? "predicted conflict" : status;
      const count = stats.get(file);
      row.additions = count?.additions;
      row.deletions = count?.deletions;
      rows.push(row);
    }
    this.session.incoming = rows;
    return review;
  }

  /** Create a VS Code task that runs the native source build for one project root. */
  buildTask(root: string, folder?: WorkspaceFolder): Task {
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
              if (this.session.root !== root) {
                await this.host.select(root);
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
      scope ?? TaskScope.Workspace,
      "Build and Check",
      "Uttori Source",
      execution,
      [],
    );
    task.group = TaskGroup.Build;
    return task;
  }
}
