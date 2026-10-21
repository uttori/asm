import fs from "node:fs/promises";
import path from "node:path";

import { sourceContentHash } from "@uttori/asm-disassembler/source-project";
import type { AssetFileOperation, AssetOperation } from "@uttori/asm-workflows/asset-interchange";
import { readAssetOperation } from "@uttori/asm-workflows/asset-interchange/operation-records";
import { readAssetImportReview } from "@uttori/asm-workflows/asset-interchange/public-records";
import type { AssetSourceOperation } from "@uttori/asm-workflows/asset-source";
import { commands, env, ProgressLocation, Range, Uri, window, workspace } from "vscode";

import { assertAssetEditorVersions, type AssetEditorVersion } from "./asset-drafts.js";
import { changedBuildInputs, type SavedBuildInput } from "./build-inputs.js";
import type { SourceController } from "./controller.js";
import { applyAssetSourceEdit } from "./conversion-editor.js";
import { findSourceRoot } from "./project-path.js";
import { readConversionPlan, readSourceRepresentation } from "./result-readers.js";
import { SourceProjectSession } from "./session.js";
import { isRecord, chooseAssetFile } from "./ui-contracts.js";

/** Shared metadata is small; saved bytes and assembler instances remain owned by the worker. */
type CheckedMenu = NonNullable<ReturnType<typeof readSourceRepresentation>> & {
  readonly inputs: readonly SavedBuildInput[];
  readonly worker: string;
};
/** Feature coordinator borrows one project session; the controller owns presentation and disposal. */
export class SourceAssetCoordinator {
  /** Identical notifications share pending work; bounded advisory results expire with the project input epoch. */
  readonly #menuResults = new Map<string, CheckedMenu>();
  /** One validated build covers all calls; every reuse still checks its complete saved input manifest. */
  #menuIndex?: { root: string; epoch: number; selection: number; result: CheckedMenu };
  #menuRequest?: string;
  constructor(
    readonly session: SourceProjectSession,
    readonly host: Pick<SourceController, "select" | "assetEditorVersions" | "refresh"> & {
      readonly output: Pick<SourceController["output"], "warn">;
    },
  ) {}

  /** Hide stale menu actions immediately; evaluated paths and continued calls come from the normal build worker. */
  scheduleAssetContext(): void {
    const editor = window.activeTextEditor;
    const document = editor?.document;
    const eligible =
      workspace.isTrusted &&
      !this.session.busy &&
      document &&
      !document.isDirty &&
      document.uri.scheme === "file" &&
      /^(uttori-|asm)/.test(document.languageId);
    const key = JSON.stringify([
      this.session.root,
      this.session.selectionRevision,
      this.session.epoch,
      document?.uri.toString(),
      document?.version,
      eligible,
      editor?.selection.active.line,
    ]);
    // Output delivery and selection notifications can describe the same target.
    // Deduplicate before aborting so a worker cannot cancel itself through its log.
    if (this.#menuRequest === key) {
      return;
    }
    this.#menuRequest = key;
    clearTimeout(this.session.assetContextTimer);
    this.session.assetContextAbort?.abort();
    const version = ++this.session.assetContextVersion;
    void commands.executeCommand("setContext", "asm.assetSourceRepresentation", "");
    if (!eligible) {
      return;
    }
    this.session.assetContextTimer = setTimeout(() => {
      void (async () => {
        if (
          !workspace.isTrusted ||
          this.session.busy ||
          editor.document.isDirty ||
          editor.document.uri.scheme !== "file" ||
          !/^(uttori-|asm)/.test(editor.document.languageId)
        ) {
          return;
        }
        const root = await findSourceRoot(editor.document.uri.fsPath);
        if (!root || version !== this.session.assetContextVersion) {
          return;
        }
        const abort = new AbortController();
        this.session.assetContextAbort = abort;
        try {
          const worker = sourceContentHash(await fs.readFile(this.session.worker.file));
          let cached = this.#menuResults.get(key);
          const index = this.#menuIndex;
          if (
            !cached &&
            index?.root === root &&
            index.epoch === this.session.epoch &&
            index.selection === this.session.selectionRevision
          ) {
            cached = index.result;
          }
          if (
            cached &&
            cached.worker === worker &&
            !(await changedBuildInputs(root, cached.inputs)).length
          ) {
            if (version === this.session.assetContextVersion && !abort.signal.aborted) {
              let representation = cached.representation;
              if (cached.menus) {
                const relative = path
                  .relative(root, editor.document.uri.fsPath)
                  .split(path.sep)
                  .join("/");
                const line = editor.selection.active.line + 1;
                const matches = cached.menus.filter(
                  (row) => row.file === relative && row.line <= line && row.endLine >= line,
                );
                // Repeated macro emissions at one physical call remain ambiguous.
                representation = matches.length === 1 ? matches[0].representation : "";
              }
              await commands.executeCommand(
                "setContext",
                "asm.assetSourceRepresentation",
                representation,
              );
            }
            return;
          }
          // Byte checks may await disk while the cursor changes. Never launch an already-obsolete request.
          abort.signal.throwIfAborted();
          const result = await this.session.worker.run(
            {
              action: "asset-source-target",
              directory: root,
              file: editor.document.uri.fsPath,
              line: editor.selection.active.line + 1,
            },
            { signal: abort.signal, maxMemoryMiB: 4096, readResult: readSourceRepresentation },
          );
          // The document can acquire a draft while the worker is running; never publish context from that older saved version.
          // oxlint-disable-next-line typescript/no-unnecessary-condition
          if (version === this.session.assetContextVersion && !editor.document.isDirty) {
            // Menu state is advisory: conversion always performs its own fresh saved-source build.
            // Epoch/version keys invalidate every result after source, asset or project changes.
            if (result?.inputs) {
              if (
                worker !== sourceContentHash(await fs.readFile(this.session.worker.file)) ||
                (await changedBuildInputs(root, result.inputs)).length
              ) {
                return;
              }
              const checked: CheckedMenu = {
                representation: result.representation,
                inputs: result.inputs,
                worker,
                menus: result.menus,
              };
              this.#menuResults.set(key, checked);
              if (result.menus) {
                this.#menuIndex = {
                  root,
                  epoch: this.session.epoch,
                  selection: this.session.selectionRevision,
                  result: checked,
                };
              }
              if (this.#menuResults.size > 64) {
                this.#menuResults.delete(this.#menuResults.keys().next().value!);
              }
            }
            if (
              version === this.session.assetContextVersion &&
              !abort.signal.aborted &&
              // Saved state can change while dependency hashing awaits filesystem reads.
              // oxlint-disable-next-line typescript/no-unnecessary-condition
              !editor.document.isDirty
            ) {
              await commands.executeCommand(
                "setContext",
                "asm.assetSourceRepresentation",
                result?.representation ?? "",
              );
            }
          }
        } catch {
          // Ordinary cursor locations, invalid current builds and cancelled probes have no applicable conversion menu.
          if (abort.signal.aborted && this.#menuRequest === key) {
            this.#menuRequest = undefined;
          }
        }
      })();
    }, 400);
  }

  /** One clean command stages validated recovery bytes, publishes a native undo unit, then verifies the saved ROM. */
  async assetConvert(representation: string, request?: unknown): Promise<unknown> {
    if (!workspace.isTrusted) {
      throw new Error("Trust this workspace before converting source assets.");
    }
    if (this.session.busy) {
      throw new Error(`Source operation already running: ${this.session.busy}.`);
    }
    const editor = window.activeTextEditor;
    let file = editor?.document.uri.fsPath;
    let line = editor ? editor.selection.active.line + 1 : undefined;
    let destination: string | undefined;
    if (request instanceof Uri) {
      // Editor context menus supply the model URI. Resolve the active cursor only if that same editor still owns the invocation.
      if (editor?.document.uri.toString() !== request.toString()) {
        throw new Error(
          "The selected editor changed before conversion. Invoke the command on the intended include again.",
        );
      }
    } else if (isRecord(request)) {
      if (
        typeof request.file !== "string" ||
        !Number.isSafeInteger(request.line) ||
        Number(request.line) < 1 ||
        (request.destination !== undefined && typeof request.destination !== "string")
      ) {
        throw new Error("Conversion needs a file and one-based cursor line.");
      }
      file = request.file;
      line = Number(request.line);
      destination = request.destination;
    }
    if (!file || !line) {
      throw new Error("Place the cursor in an includeAsset call to convert its saved source.");
    }
    const root = await findSourceRoot(file);
    if (!root) {
      throw new Error("The selected include is outside an adopted source project.");
    }
    if (this.session.root !== root) {
      await this.host.select(root);
    }
    this.session.assetContextAbort?.abort();
    const epoch = this.session.epoch;
    const versions = this.host.assetEditorVersions();
    this.session.busy = "asset-convert";
    this.session.assetSavedInputPending = false;
    this.session.changed.fire(undefined);
    let published = false;
    try {
      const result = readConversionPlan(
        await this.runAssetOperation(
          {
            action: "asset-convert",
            directory: root,
            file,
            line,
            representation,
            destination,
            stageOnly: true,
            drafts: versions
              .filter((entry) => entry.dirty)
              .map(({ path: filePath, version, opaque }) => ({ path: filePath, version, opaque })),
          },
          epoch,
          versions,
        ),
      );
      if (!result.transaction) {
        throw new Error("Conversion returned no staged publication journal.");
      }
      await applyAssetSourceEdit(root, result, (paths) => {
        if (this.session.root !== root) {
          throw new Error(
            "Selected source project changed before conversion publication. Recover the staged conversion.",
          );
        }
        assertAssetEditorVersions(versions, this.host.assetEditorVersions(), paths);
      });
      published = true;
      // Native publication deliberately changes document versions. The finish operation checks their new
      // saved state against the staged after bytes, while the journal still protects interrupted publication.
      const savedVersions = this.host.assetEditorVersions();
      await this.runAssetOperation(
        {
          action: "asset-conversion-finish",
          directory: root,
          transaction: result.transaction,
          outputSha256: result.outputSha256,
          drafts: savedVersions
            .filter((entry) => entry.dirty)
            .map(({ path: filePath, version, opaque }) => ({ path: filePath, version, opaque })),
        },
        this.session.epoch,
        savedVersions,
      );
      this.session.assetReview = undefined;
      const document = await workspace.openTextDocument(Uri.file(file));
      await window.showTextDocument(document, {
        selection: new Range(line - 1, 0, line - 1, 0),
        preview: false,
      });
      const destinationUri = Uri.file(path.resolve(root, result.destination));
      await commands.executeCommand("revealInExplorer", destinationUri);
      const retained = result.retained.length
        ? ` Retained other source references: ${result.retained.join(", ")}.`
        : "";
      const unresolved = result.unresolvedDeclarations.length
        ? ` ${result.unresolvedDeclarations.length} declarations are outside the current build.`
        : "";
      void window
        .showInformationMessage(
          `Converted ${result.destination}; complete ROM verified. Updated ${result.affected.length} includes.${retained}${unresolved}`,
          "Open in Associated Editor",
        )
        .then((choice) => (choice ? env.openExternal(destinationUri) : undefined));
      return result;
    } finally {
      this.session.busy = undefined;
      this.session.changed.fire(undefined);
      // A throw after native publication still invalidates build state; TypeScript does not retain that mutation through finally.
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      if (published || this.session.assetSavedInputPending) {
        this.session.buildStale = true;
        this.session.savedInput.fire();
      }
      this.session.assetSavedInputPending = false;
      await this.host
        .refresh()
        .catch((error: unknown) =>
          this.host.output.warn(`Conversion status requires recovery: ${String(error)}`),
        );
      this.scheduleAssetContext();
    }
  }

  /** Saved-source export/review/apply share the existing source worker, busy state and live editor-version checks. */
  async assetFile(action: "export" | "review" | "apply", request?: unknown): Promise<unknown> {
    if (!workspace.isTrusted) {
      throw new Error("Trust this workspace before editing source assets.");
    }
    if (this.session.busy) {
      throw new Error(`Source operation already running: ${this.session.busy}.`);
    }
    if (!this.session.root) {
      await this.host.select();
    }
    const root = this.session.root;
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
        (!this.session.assetReview ||
          selected.review !== this.session.assetReview.summary.id ||
          path.resolve(selected.document) !== path.resolve(this.session.assetReview.document) ||
          path.resolve(selected.manifest) !== path.resolve(this.session.assetReview.manifest))
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
      const review = this.session.assetReview;
      if (!review || review.root !== root) {
        throw new Error("Review a saved asset in the selected project before applying it.");
      }
      if (review.epoch !== this.session.epoch) {
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
    if (this.session.root !== root || this.session.busy) {
      throw new Error("Selected source project changed. Start the asset operation again.");
    }
    if (action === "apply" && this.session.assetReview?.epoch !== this.session.epoch) {
      throw new Error("Source changed after asset review. Review again.");
    }
    const epoch = this.session.epoch,
      versions = this.host.assetEditorVersions(),
      reviewed = this.session.assetReview;
    operation = {
      ...operation,
      drafts: versions
        .filter((entry) => entry.dirty)
        .map(({ path: file, version, opaque }) => ({ path: file, version, opaque })),
    };
    this.session.busy = operation.action;
    this.session.assetSavedInputPending = false;
    this.session.changed.fire(undefined);
    let published = false;
    try {
      const result = await this.runAssetOperation(operation, epoch, versions, reviewed?.versions);
      if (action === "review") {
        if (this.session.root !== root || this.session.epoch !== epoch) {
          throw new Error("Source changed during asset review. Review again.");
        }
        const summary = readAssetImportReview(result);
        assertAssetEditorVersions(versions, this.host.assetEditorVersions(), [
          ...summary.files.map((file) => path.resolve(root, file.path)),
          operation.document,
        ]);
        this.session.assetReview = {
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
        this.session.assetReview = undefined;
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
      this.session.busy = undefined;
      this.session.changed.fire(undefined);
      // Saved-input callbacks can set this flag across awaits; publication and external changes both invalidate the build.
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      if (published || this.session.assetSavedInputPending) {
        this.session.buildStale = true;
        this.session.savedInput.fire();
      }
      this.session.assetSavedInputPending = false;
      await this.host.refresh();
    }
  }

  /** All asset workers use the same cancellation and final live-buffer gate, including explicit journal recovery. */
  async runAssetOperation(
    operation: AssetOperation | AssetSourceOperation,
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
          return await this.session.worker.run(operation, {
            signal: abort.signal,
            maxMemoryMiB: workspace
              .getConfiguration("asm", Uri.file(root))
              .get<number>("analysis.maxMemoryMiB", 4096),
            onProgress: (message) => reporter.report({ message }),
            onBeforePublish: (paths) => {
              // File creates/removals can deliver delayed watcher events from the native edit itself.
              // Finishing checks current editor versions and exact journal bytes instead of that event counter.
              if (
                this.session.root !== root ||
                (operation.action !== "asset-convert" &&
                  operation.action !== "asset-conversion-finish" &&
                  this.session.epoch !== epoch)
              ) {
                const input = this.session.epochInput
                  ? ` (${path.relative(root, this.session.epochInput)}; ${this.session.epochEvent} event)`
                  : "";
                throw new Error(
                  `Source/editor state changed during asset validation${input}. Review again.`,
                );
              }
              assertAssetEditorVersions(reviewedVersions, this.host.assetEditorVersions(), paths);
            },
          });
        } finally {
          listener.dispose();
        }
      },
    );
  }

  /** Recovery is an explicit journal direction; unknown external bytes and relevant drafts remain protected by the worker. */
  async assetRecovery(): Promise<void> {
    if (!workspace.isTrusted) {
      throw new Error("Trust this workspace before recovering asset edits.");
    }
    if (this.session.busy) {
      throw new Error(`Source operation already running: ${this.session.busy}.`);
    }
    if (!this.session.root) {
      await this.host.select();
    }
    const root = this.session.root;
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
    if (this.session.root !== root || this.session.busy) {
      throw new Error("Selected source project changed; start recovery again.");
    }
    const epoch = this.session.epoch,
      versions = this.host.assetEditorVersions();
    this.session.busy = "asset-recover";
    this.session.assetSavedInputPending = false;
    this.session.changed.fire(undefined);
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
      this.session.assetReview = undefined;
      void window.showInformationMessage(
        recovered
          ? "Asset publication recovered. Re-export before editing again."
          : "No interrupted asset publication to recover.",
      );
    } finally {
      this.session.busy = undefined;
      this.session.changed.fire(undefined);
      // Recovery awaits can receive saved-input events; emit one invalidation after releasing the busy state.
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      if (recovered || this.session.assetSavedInputPending) {
        this.session.buildStale = true;
        this.session.savedInput.fire();
      }
      this.session.assetSavedInputPending = false;
      await this.host.refresh();
    }
  }
}
