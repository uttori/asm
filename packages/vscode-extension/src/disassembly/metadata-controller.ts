import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  findManagedSourceFile,
  loadSourceOwnership,
  sourceOwnersAt,
  sourceExportSha256,
  type MetadataEditRequest,
  type MetadataShard,
  type ProjectLabel,
} from "@uttori/asm-disassembler";
import {
  createSnesAddressContext,
  snesRomAddressSpace,
  type SnesMapper,
} from "@uttori/asm-plugin-snes";
import { commands, Uri, ViewColumn, window, workspace, type Disposable } from "vscode";

import { analysisWorker } from "../analysis/worker-client.js";
import { renderWebviewTemplate } from "../webview-template.js";
import type { MetadataPage, MetadataWorkerInput } from "./metadata-data.js";
import { owningProject } from "./ownership-data.js";
import { readOwnershipProjects } from "./ownership-projects.js";

/** Initial navigation hints; all records and capabilities are resolved again in the worker. */
export interface MetadataEditorTarget {
  readonly projectDirectory?: string;
  readonly sourceDirectory?: string;
  readonly shard?: MetadataShard;
  readonly action?: "remove-label" | "reset-label";
  /** Coverage navigation supplies a file interval independently of the active source editor. */
  readonly range?: { readonly start: number; readonly end: number };
  readonly selectedId?: string;
  /** Open persisted inverse receipts instead of session-only text history. */
  readonly history?: boolean;
  /** A bound workbench opens its project without borrowing another source editor's cursor. */
  readonly useActiveSelection?: boolean;
}

/** Worker-backed metadata editor with paged discovery, retained drafts, previews and saved history. */
export class DisassemblyMetadataController implements Disposable {
  readonly #disposables: Disposable[] = [];

  constructor(readonly extensionUri: Uri) {
    const register = (command: string, target: MetadataEditorTarget): void => {
      this.#disposables.push(commands.registerCommand(command, () => this.open(target)));
    };
    this.#disposables.push(
      commands.registerCommand("asm.disassembly.editMetadata", (target?: MetadataEditorTarget) =>
        this.open(target),
      ),
    );
    register("asm.disassembly.removeLabel", { shard: "labels", action: "remove-label" });
    register("asm.disassembly.resetLabel", { shard: "labels", action: "reset-label" });
    register("asm.disassembly.editComments", { shard: "comments" });
    register("asm.disassembly.editClassification", { shard: "annotations" });
    register("asm.disassembly.editTargets", { shard: "analysis" });
  }

  /**
   * Infer ownership before choosing a project. Saved metadata is read only until explicit preview
   * and Save; webview text survives validation errors and stale revisions.
   * @param {MetadataEditorTarget} [target] Optional project and initial collection selected by a command.
   */
  async open(target: MetadataEditorTarget = {}): Promise<void> {
    try {
      if (!workspace.isTrusted) {
        throw new Error("Metadata editing requires a trusted workspace.");
      }
      const editor =
        target.range || target.useActiveSelection === false ? undefined : window.activeTextEditor;
      const managed =
        editor?.document.uri.scheme === "file"
          ? findManagedSourceFile(editor.document.uri.fsPath)
          : undefined;
      const projects = await readOwnershipProjects();
      let project = target.projectDirectory
        ? projects.find(({ directory }) => directory === target.projectDirectory)
        : undefined;
      if (target.projectDirectory && !project) {
        throw new Error("The requested metadata project is no longer available.");
      }
      if (
        project &&
        managed &&
        owningProject(managed, projects).project?.directory !== project.directory
      ) {
        throw new Error(
          "The active source belongs to another analysis project. Open the requested project's source first.",
        );
      }
      if (!project && managed) {
        project = owningProject(managed, projects).project;
      }
      if (!project) {
        const choice = await window.showQuickPick(
          projects.map((item) => ({
            label: path.basename(item.directory),
            description: item.directory,
            project: item,
          })),
          { title: "Choose the metadata project" },
        );
        if (!choice) {
          return;
        }
        project = choice.project;
      }
      const directory = project.directory;
      const sourceDirectory =
        target.sourceDirectory ?? managed?.directory ?? path.dirname(directory);
      let source: MetadataWorkerInput["source"];
      let selectedId = target.selectedId;
      let shard = target.shard ?? "labels";
      let mapName: string | undefined;
      let mapSymbol: string | undefined;
      let anchor: { addressSpace: string; address: number; end?: number } | undefined;
      if (target.range) {
        anchor = { addressSpace: "rom.file", address: target.range.start, end: target.range.end };
      }
      let outputStart = target.range?.start;
      let generatedSuppression: ProjectLabel | undefined;
      if (managed && editor) {
        if (
          editor.document.isDirty ||
          sourceExportSha256(editor.document.getText()) !==
            managed.manifest.files.find(({ path: file }) => file === managed.relative)?.sha256
        ) {
          throw new Error("Preserve the changed source draft before editing its metadata owner.");
        }
        source = {
          file: editor.document.uri.fsPath,
          sha256: sourceExportSha256(editor.document.getText()),
        };
        const map = loadSourceOwnership(managed);
        const owners = map
          ? sourceOwnersAt(
              map,
              managed.relative,
              editor.document.getText(),
              editor.selection.active.line + 1,
              editor.selection.active.character,
            )
          : [];
        const owner = owners[0];
        outputStart = owner?.outputStart;
        if (owner?.addressSpace && owner.address !== undefined) {
          anchor = { addressSpace: owner.addressSpace, address: owner.address };
        }
        if (shard === "annotations" && owner?.outputStart !== undefined) {
          anchor = { addressSpace: "rom.file", address: owner.outputStart };
        }
        if (owner?.kind === "label" && (!target.shard || target.shard === "labels")) {
          selectedId = owner.id;
          shard = "labels";
        }
        if (owner?.kind === "comment" && (!target.shard || target.shard === "comments")) {
          selectedId = owner.id;
          shard = "comments";
        }
        if (owner?.inputPath && ["ram-map.json", "struct-map.json"].includes(owner.inputPath)) {
          mapName = owner.inputPath;
          mapSymbol = owner.kind === "field" ? owner.id : (owner.symbol ?? owner.name);
        }
        if (target.action && owner?.kind !== "label") {
          if (target.action === "remove-label" && owner?.kind === "function" && anchor) {
            generatedSuppression = {
              id: `manual-hidden-name:${randomUUID()}`,
              ...anchor,
              name: owner.symbol ?? "Generated_Function",
              suppressed: true,
              analysisEntryPoint: false,
              evidence: [],
            };
          } else {
            throw new Error(
              "Select a native label to reset, or a native/generated function name to remove.",
            );
          }
        }
      }
      // Target overrides in the SNES analyzer use CPU addresses; coverage arrives in ROM offsets.
      if (shard === "analysis" && anchor?.addressSpace === "rom.file") {
        anchor = {
          addressSpace: "snes.cpu",
          address: snesRomAddressSpace.fromOutputOffset(
            anchor.address,
            createSnesAddressContext(project.manifest.mapping.mapper as SnesMapper),
          ),
        };
      }
      const panel = window.createWebviewPanel(
        "uttori.metadataEditor",
        "Disassembly Metadata",
        ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [Uri.joinPath(this.extensionUri, "media")],
        },
      );
      panel.webview.html = renderWebviewTemplate(panel.webview, this.extensionUri, "metadata");
      let page: MetadataPage | undefined;
      let reviewed: MetadataWorkerInput | undefined;
      let busy = false;
      let draftGeneration = 0;
      let draftId: string = randomUUID();
      let draftText: unknown;
      const send = (value: unknown): void => {
        void panel.webview.postMessage(value);
      };
      const call = <T>(input: MetadataWorkerInput): Promise<T> =>
        analysisWorker().request<T>(directory, "metadata", {
          metadata: { ...input, sourceDirectory },
        });
      const listener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (!message || typeof message !== "object") {
          return;
        }
        const input = message as {
          type?: string;
          shard?: MetadataShard;
          query?: string;
          offset?: number;
          request?: MetadataEditRequest;
          map?: MetadataWorkerInput["map"];
          receiptId?: string;
          draft?: unknown;
          draftId?: string;
        };
        // A user can type while validation is running. Invalidate that preview before its late
        // reply is allowed to enable Save, rather than dropping this message behind the worker.
        if (input.type === "invalidate") {
          reviewed = undefined;
          draftGeneration++;
          return;
        }
        if (input.type === "draft-new") {
          draftId = randomUUID();
          draftText = undefined;
          reviewed = undefined;
          draftGeneration++;
          return;
        }
        if (input.type === "draft-save") {
          if (!workspace.isTrusted) {
            return;
          }
          draftText = input.draft;
          try {
            await call({
              action: "draft-save",
              draft: {
                id: draftId,
                value: { form: draftText, reviewed, revision: page?.revision },
              },
            });
          } catch (error) {
            send({ type: "status", text: `Draft recovery could not be saved: ${String(error)}` });
          }
          return;
        }
        if (busy) {
          return;
        }
        busy = true;
        try {
          if (!workspace.isTrusted) {
            throw new Error("Metadata editing requires a trusted workspace.");
          }
          if (input.type === "ready" || input.type === "list") {
            // Explicit reload reviews stable native IDs against current records; the old source
            // cursor fingerprint no longer describes the regenerated projection.
            if (input.type === "list") {
              source = undefined;
            }
            page = await call<MetadataPage>({
              action: "list",
              shard: input.shard ?? shard,
              query: input.query,
              offset: input.offset,
              selectedId: input.type === "ready" ? selectedId : undefined,
              outputStart: input.type === "ready" ? outputStart : undefined,
            });
            reviewed = undefined;
            send({
              type: "page",
              page,
              shard: input.shard ?? shard,
              anchor,
              generatedSuppression,
              initialAction: input.type === "ready" ? target.action : undefined,
              mapName: input.type === "ready" ? mapName : undefined,
              mapSymbol: input.type === "ready" ? mapSymbol : undefined,
              history: target.history,
            });
            if (input.type === "ready") {
              send({ type: "drafts", drafts: await call({ action: "draft-list" }) });
            }
          } else if (input.type === "recover-draft") {
            const drafts = await call<
              Array<{
                id: string;
                value: {
                  form: unknown;
                  reviewed?: MetadataWorkerInput;
                  revision?: MetadataPage["revision"];
                };
              }>
            >({ action: "draft-list" });
            const saved = drafts.find((draft) => draft.id === input.draftId);
            if (!saved) {
              throw new Error("This recovery draft is no longer available.");
            }
            draftId = saved.id;
            draftText = saved.value.form;
            reviewed = saved.value.reviewed;
            if (page && saved.value.revision) {
              page = { ...page, revision: saved.value.revision };
            }
            send({ type: "recovered-draft", form: draftText, reviewed: Boolean(reviewed) });
          } else if (input.type === "preview") {
            if (!page || !input.request) {
              throw new Error("Load a record before previewing an edit.");
            }
            // Operation identity is host-owned, not supplied by editable webview fields.
            const id = randomUUID();
            const request = {
              ...input.request,
              id: `metadata:${id}`,
              evidenceId: `metadata-evidence:${id}`,
              sourceId: "vscode.metadata",
            };
            const intent: MetadataWorkerInput = {
              action: "preview",
              revision: page.revision,
              request,
              source,
            };
            const generation = draftGeneration;
            const result = await call(intent);
            if (generation !== draftGeneration) {
              send({
                type: "status",
                text: "Draft changed during validation. Preview it again before saving.",
              });
              return;
            }
            reviewed = intent;
            await call({
              action: "draft-save",
              draft: {
                id: draftId,
                value: { form: draftText, reviewed, revision: page?.revision },
              },
            });
            send({ type: "review", result });
          } else if (input.type === "map-read") {
            reviewed = undefined;
            const result = await call<{ revision: MetadataPage["revision"] }>({
              action: "map-read",
              map: input.map,
            });
            if (page) {
              page = { ...page, revision: result.revision };
            }
            send({ type: "map", result });
          } else if (input.type === "map-preview" || input.type === "map-restore-preview") {
            const intent: MetadataWorkerInput = {
              action: input.type,
              operationId: randomUUID(),
              receiptId: input.receiptId,
              revision: page?.revision,
              map: input.map,
            };
            const generation = draftGeneration;
            const result = await call(intent);
            if (generation !== draftGeneration) {
              send({ type: "status", text: "Draft changed during validation. Preview it again." });
              return;
            }
            reviewed = intent;
            await call({
              action: "draft-save",
              draft: {
                id: draftId,
                value: { form: draftText, reviewed, revision: page?.revision },
              },
            });
            send({ type: "review", result });
          } else if (input.type === "save") {
            if (!reviewed) {
              throw new Error("Preview this draft before saving.");
            }
            let action: MetadataWorkerInput["action"] = "commit";
            if (reviewed.action === "map-preview") {
              action = "map-commit";
            }
            if (reviewed.action === "map-restore-preview") {
              action = "map-restore";
            }
            const result = await call<{ revision?: MetadataPage["revision"] }>({
              ...reviewed,
              action,
            });
            if (page && result.revision) {
              page = { ...page, revision: result.revision };
            }
            reviewed = undefined;
            send({ type: "saved", result });
            // Recovery housekeeping must not turn a known committed edit into a failed save.
            try {
              await call({
                action: "draft-save",
                draft: { id: draftId, value: { form: draftText, saved: true } },
              });
            } catch (error) {
              send({
                type: "status",
                text: `Metadata saved; recovery draft cleanup failed (${String(error)}). Its original operation ID remains safe to reconcile.`,
              });
            }
          } else if (input.type === "regenerate") {
            const outcome = await commands.executeCommand<{ ok: boolean; error?: string }>(
              "asm.disassembly.regenerate",
              {
                projectDirectory: directory,
                sourceDirectory,
              },
            );
            if (!outcome?.ok) {
              throw new Error(outcome?.error ?? "Regeneration did not complete.");
            }
            source = undefined;
            send({
              type: "status",
              text: "Source generation published after exact ROM verification. Reload metadata before another edit.",
            });
          } else if (input.type === "operation-history") {
            send({
              type: "operation-history",
              result: await call({ action: "operation-history" }),
            });
          } else if (input.type === "map-history") {
            send({ type: "map-history", result: await call({ action: "map-history" }) });
          }
        } catch (error) {
          // A lost save response must retain the same intent/ID for reconciliation.
          if (input.type !== "save") {
            reviewed = undefined;
          }
          send({
            type: "error",
            text: String(error),
            retry: input.type === "save" && Boolean(reviewed),
          });
        } finally {
          busy = false;
          send({ type: "idle" });
        }
      });
      panel.onDidDispose(() => {
        listener.dispose();
      });
      this.#disposables.push(panel);
    } catch (error) {
      await window.showErrorMessage(String(error));
    }
  }

  dispose(): void {
    for (const item of this.#disposables) {
      item.dispose();
    }
  }
}
