import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { durableReplace, sourceExportSha256 } from "@uttori/asm-disassembler";
import {
  loadRomModificationProject,
  readRomEditor,
  type RomEditorDocument,
  type RomPlacementPlan,
  type RomRebaseReview,
  type MetadataRelocation,
  type RetentionInventory,
} from "@uttori/asm-plugin-snes";
import { commands, debug, Uri, ViewColumn, window, workspace, type Disposable } from "vscode";

import { renderWebviewTemplate } from "../webview-template.js";
import type { MaintenanceJobs } from "./maintenance-jobs.js";

/** Maintenance work remains in cancellable child processes; webview messages contain only user intent. */
export type RomWorkbenchRunner = <K extends keyof MaintenanceJobs>(
  operation: K,
  input: MaintenanceJobs[K]["input"],
) => Promise<MaintenanceJobs[K]["output"]>;

/** One workbench is permanently bound to its selected manifest, independent of editor focus.
 * @param {Uri} extensionUri Installed extension resources for CSP-scoped assets.
 * @param {string} manifestFile Selected modification project; messages cannot substitute another path.
 * @param {RomWorkbenchRunner} run Cancellable maintenance worker dispatcher.
 * @param {string} initialTab Initial workflow tab selected by the command.
 * @returns {Disposable} Panel whose disposal releases all message subscriptions.
 */
export function openRomWorkbench(
  extensionUri: Uri,
  manifestFile: string,
  run: RomWorkbenchRunner,
  initialTab = "edit",
): Disposable {
  const panel = window.createWebviewPanel(
    "uttori.romEditor",
    "ROM Editing Workbench",
    ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [Uri.joinPath(extensionUri, "media")],
    },
  );
  panel.webview.html = renderWebviewTemplate(panel.webview, extensionUri, "rom-editor");
  let rawDraftId: string = randomUUID();
  const root = path.dirname(path.resolve(manifestFile));
  let busy = false;
  let generation = 0;
  let selected: ReturnType<typeof readRomEditor> | undefined;
  let reviewId: string | undefined;
  let retention: RetentionInventory | undefined;
  let migrationId: string | undefined;
  let rebase: { file: string; hash: string; value: RomRebaseReview } | undefined;
  const send = (message: unknown): void => {
    void panel.webview.postMessage(message);
  };
  const load = (): void => {
    send({
      type: "project",
      project: loadRomModificationProject(manifestFile),
      manifestSha256: sourceExportSha256(fs.readFileSync(manifestFile)),
      file: manifestFile,
    });
  };
  const listener = panel.webview.onDidReceiveMessage(
    async (message: {
      type?: string;
      id?: string;
      document?: RomEditorDocument;
      plan?: RomPlacementPlan;
      resolutions?: RomRebaseReview["resolutions"];
      relocations?: MetadataRelocation[];
      selected?: string[];
      pinned?: boolean;
    }) => {
      if (!message || typeof message !== "object") {
        return;
      }
      if (message.type === "draft" && selected && message.document && workspace.isTrusted) {
        const text = JSON.stringify({ selected, document: message.document });
        if (Buffer.byteLength(text) <= 10 * 1024 * 1024) {
          try {
            durableReplace(path.join(root, ".editor-drafts", rawDraftId, "form.json"), text);
          } catch (error) {
            send({ type: "error", text: `Draft recovery could not be saved: ${String(error)}` });
          }
        }
        return;
      }
      if (message.type === "changed") {
        generation++;
        reviewId = undefined;
        return;
      }
      if (busy) {
        return;
      }
      busy = true;
      send({ type: "busy", value: true });
      try {
        if (!workspace.isTrusted) {
          throw new Error("ROM editing requires a trusted workspace.");
        }
        if (message.type === "ready" || message.type === "reload") {
          reviewId = undefined;
          const id = selected?.entry.id;
          load();
          if (id) {
            selected = readRomEditor({ manifestFile, id });
            send({ type: "document", ...selected });
          }
          send({ type: "navigate", tab: initialTab });
        } else if (message.type === "select" && message.id) {
          rawDraftId = randomUUID();
          selected = readRomEditor({ manifestFile, id: message.id });
          reviewId = undefined;
          send({ type: "document", ...selected });
        } else if (message.type === "recover") {
          const directory = path.join(root, ".editor-drafts");
          const drafts = fs.existsSync(directory)
            ? fs
                .readdirSync(directory)
                .filter(
                  (id) =>
                    /^[\da-f-]{36}$/.test(id) &&
                    fs.existsSync(path.join(directory, id, "form.json")) &&
                    !fs.existsSync(path.join(directory, id, "saved.json")),
                )
            : [];
          const choice = await window.showQuickPick(
            drafts.map((id) => ({
              label: id,
              description: fs.statSync(path.join(directory, id, "form.json")).mtime.toISOString(),
            })),
            { title: "Recover visual editor draft" },
          );
          if (choice) {
            const saved = JSON.parse(
              fs.readFileSync(path.join(directory, choice.label, "form.json"), "utf8"),
            ) as { selected: NonNullable<typeof selected>; document: RomEditorDocument };
            selected = saved.selected;
            rawDraftId = choice.label;
            reviewId = undefined;
            send({ type: "document", ...selected, document: saved.document });
            send({
              type: "status",
              text: "Recovered draft with its original input identity. Preview rejects external changes; open owned source to compare if it is stale.",
            });
          }
        } else if (message.type === "preview" && selected && message.document) {
          const version = generation;
          const review = await run("editorPreview", {
            manifestFile,
            id: selected.entry.id,
            manifestSha256: selected.manifestSha256,
            inputSha256: selected.inputSha256,
            document: message.document,
          });
          if (version !== generation) {
            throw new Error("Draft changed during preview. Review again.");
          }
          reviewId = review.id;
          send({ type: "review", review });
        } else if (message.type === "save" && reviewId) {
          await run("editorSave", { manifestFile, reviewId });
          reviewId = undefined;
          try {
            durableReplace(
              path.join(root, ".editor-drafts", rawDraftId, "saved.json"),
              JSON.stringify({ saved: true }),
            );
          } catch (error) {
            send({
              type: "status",
              text: `Input saved; recovery marker could not be written: ${String(error)}`,
            });
          }
          rawDraftId = randomUUID();
          if (selected) {
            selected = readRomEditor({ manifestFile, id: selected.entry.id });
            send({ type: "document", ...selected });
          }
          load();
          send({
            type: "status",
            text: "Reviewed input saved. Build the modified ROM to update Run and Debug.",
          });
        } else if (message.type === "build") {
          const built = await run("modificationBuild", { manifestFile });
          send({
            type: "status",
            text: `Modified ROM verified: ${built.changedBytes} changed bytes. ${built.finalOutput}`,
          });
        } else if (message.type === "metadata") {
          const bound = loadRomModificationProject(manifestFile);
          const sourceDirectory = path.resolve(root, bound.baseline.sourceDirectory);
          await commands.executeCommand("asm.disassembly.editMetadata", {
            projectDirectory: path.join(sourceDirectory, "analysis"),
            sourceDirectory,
            useActiveSelection: false,
          });
        } else if (message.type === "source" && selected) {
          await window.showTextDocument(
            Uri.file(path.resolve(path.dirname(manifestFile), selected.entry.input)),
            { viewColumn: ViewColumn.Beside },
          );
        } else if (message.type === "allocation" && message.plan) {
          await run("placementApply", { manifestFile, plan: message.plan });
          selected = readRomEditor({ manifestFile, id: message.plan.replacement });
          reviewId = undefined;
          load();
          send({ type: "document", ...selected });
          send({
            type: "status",
            text: "Allocation saved. Build validates the relocated instructions and encoded assets.",
          });
        } else if (message.type === "retention-review") {
          retention = await run("retentionReview", { manifestFile });
          send({ type: "retention", inventory: retention });
        } else if (message.type === "retention-pin" && message.id) {
          await run("retentionPin", {
            manifestFile,
            itemId: message.id,
            label: message.pinned ? undefined : "User milestone",
          });
          retention = await run("retentionReview", { manifestFile });
          send({ type: "retention", inventory: retention });
        } else if (message.type === "retention-prune" && retention && message.selected) {
          if (debug.activeDebugSession) {
            throw new Error("Stop the active debugging session before removing retained builds.");
          }
          const selected = retention.items.filter((item) => message.selected!.includes(item.id));
          if (!selected.length || selected.some((item) => item.protected.length)) {
            throw new Error("Select eligible artifacts first.");
          }
          const bytes = selected.reduce((sum, item) => sum + item.bytes, 0);
          const accepted = await window.showWarningMessage(
            `Permanently remove ${selected.length} reviewed artifact(s), ${(bytes / 1048576).toFixed(2)} MiB? Dependencies were checked within ${retention.scope}. Pin anything used outside that scope first.`,
            { modal: true },
            "Delete Reviewed History",
          );
          if (accepted) {
            const result = await run("retentionPrune", {
              manifestFile,
              fingerprint: retention.fingerprint,
              selected: message.selected,
            });
            retention = await run("retentionReview", { manifestFile });
            send({ type: "retention", inventory: retention });
            send({
              type: "status",
              text: `Removed ${result.removed} artifacts (${result.bytes} bytes). Receipt: ${result.receiptFile}`,
            });
          }
        } else if (message.type === "migration-review" || message.type === "migration-current") {
          let target: Uri | undefined;
          if (message.type === "migration-current") {
            target = Uri.file((await run("modificationBuild", { manifestFile })).finalOutput);
          } else {
            target = (
              await window.showOpenDialog({
                title: "ROM to receive migrated research",
                canSelectMany: false,
                filters: { ROM: ["sfc", "smc", "bin"] },
              })
            )?.[0];
          }
          if (target) {
            const review = await run("metadataMigrationReview", {
              manifestFile,
              targetRomFile: target.fsPath,
              relocations: message.relocations,
            });
            migrationId = review.id;
            send({ type: "migration", review });
          }
        } else if (message.type === "migration-apply" && migrationId && message.selected) {
          const destination = await window.showSaveDialog({
            title: "New workspace for migrated research",
            defaultUri: Uri.file(path.join(path.dirname(manifestFile), "migrated-analysis")),
          });
          if (destination) {
            const result = await run("metadataMigrationApply", {
              manifestFile,
              reviewId: migrationId,
              selected: message.selected,
              outputDirectory: destination.fsPath,
            });
            send({
              type: "status",
              text: `Migrated ${result.migrated} selected items and verified the ROM: ${result.outputDirectory}`,
            });
          }
        } else if (message.type === "rebase-open") {
          const file = (
            await window.showOpenDialog({
              title: "Open rebase-review.json",
              canSelectMany: false,
              filters: { JSON: ["json"] },
            })
          )?.[0]?.fsPath;
          if (file) {
            const bytes = fs.readFileSync(file);
            const value = JSON.parse(bytes.toString()) as RomRebaseReview;
            if (value.format !== "uttori-rom-rebase-review") {
              throw new Error("Select a ROM rebase review.");
            }
            rebase = { file, value, hash: sourceExportSha256(bytes) };
            send({ type: "rebase", review: value });
          }
        } else if (
          (message.type === "rebase-save" ||
            message.type === "rebase-accept" ||
            message.type === "rebase-refresh") &&
          rebase
        ) {
          if (sourceExportSha256(fs.readFileSync(rebase.file)) !== rebase.hash) {
            throw new Error("Rebase review changed on disk. Reopen it.");
          }
          const resolutions = message.resolutions ?? {};
          if (
            Object.entries(resolutions).some(
              ([id, value]) =>
                !rebase!.value.conflicts.some((item) => item.id === id) ||
                !["keep-owned", "take-baseline"].includes(value),
            )
          ) {
            throw new Error("Invalid conflict resolution.");
          }
          // Only decisions are editable; backend retains its independent comparison and input hashes.
          durableReplace(rebase.file, JSON.stringify({ ...rebase.value, resolutions }, null, 2));
          rebase.hash = sourceExportSha256(fs.readFileSync(rebase.file));
          rebase.value = { ...rebase.value, resolutions };
          if (message.type === "rebase-accept") {
            const result = await run("rebaseAccept", { reviewFile: rebase.file });
            send({
              type: "status",
              text: `Rebase accepted and verified: ${result.manifestFile}. Select this project to Run or Debug it.`,
            });
          } else if (message.type === "rebase-refresh") {
            await run("rebaseRefresh", { reviewFile: rebase.file, reviewSha256: rebase.hash });
            rebase.value = JSON.parse(fs.readFileSync(rebase.file, "utf8")) as RomRebaseReview;
            rebase.hash = sourceExportSha256(fs.readFileSync(rebase.file));
            send({ type: "rebase", review: rebase.value });
          } else {
            send({
              type: "status",
              text: "Conflict decisions saved. Accept rebuilds and verifies the candidate.",
            });
          }
        }
      } catch (error) {
        send({ type: "error", text: String(error) });
      } finally {
        busy = false;
        send({ type: "busy", value: false });
      }
    },
  );
  panel.onDidDispose(() => {
    listener.dispose();
  });
  return panel;
}
