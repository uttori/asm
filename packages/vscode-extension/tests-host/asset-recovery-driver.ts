import fs from "node:fs/promises";

import * as vscode from "vscode";

import { BinaryDrafts } from "../src/assets/binary-drafts.js";
import { PaletteEditor } from "../src/assets/palette-editor.js";
import { PngCodec } from "../src/assets/png-codec.js";
import type { PngDocument } from "../src/assets/png-document.js";
import { PngEditor } from "../src/assets/png-editor.js";
import { runAssetRecoverySmoke } from "./asset-recovery.js";

/** Test-only driver registers during custom-editor activation, before workbench backup restoration. */
export function activate(context: vscode.ExtensionContext) {
  const extension = vscode.extensions.getExtension("matthewcallis.uttori-asm-vscode")!;
  const drafts = new BinaryDrafts();
  const codec = new PngCodec(
    vscode.Uri.joinPath(extension.extensionUri, "out/png-worker.cjs").fsPath,
  );
  const state: { document?: PngDocument; restoredFromBackup: boolean; backups: number } = {
    restoredFromBackup: false,
    backups: 0,
  };
  class RecoveryPngEditor extends PngEditor {
    override async openCustomDocument(
      uri: vscode.Uri,
      input: vscode.CustomDocumentOpenContext,
      token: vscode.CancellationToken,
    ): Promise<PngDocument> {
      state.restoredFromBackup = !!input.backupId;
      state.document = await super.openCustomDocument(uri, input, token);
      return state.document;
    }
    override async backupCustomDocument(
      document: PngDocument,
      input: vscode.CustomDocumentBackupContext,
      token: vscode.CancellationToken,
    ) {
      const result = await super.backupCustomDocument(document, input, token);
      state.backups++;
      return result;
    }
  }
  const imageEditor = new RecoveryPngEditor(extension.extensionUri, codec, drafts);
  const paletteEditor = new PaletteEditor(extension.extensionUri);
  context.subscriptions.push(
    drafts,
    codec,
    imageEditor,
    vscode.window.registerCustomEditorProvider("uttori.paletteSmoke", paletteEditor),
    vscode.window.registerCustomEditorProvider("uttori.pngSmoke", imageEditor),
  );
  if (process.env.UTTORI_VSCODE_NATIVE_RECOVERY === "1") {
    // Register synchronously for restored tabs, then start assertions after activate
    // returns so the driver can retrieve its own exported state without deadlocking.
    setTimeout(() => {
      void (async () => {
        const phase = process.env.UTTORI_VSCODE_ASSET_RECOVERY_PHASE!;
        const result = process.env.UTTORI_VSCODE_ASSET_RECOVERY_RESULT!;
        try {
          await extension.activate();
          await runAssetRecoverySmoke(vscode.workspace.workspaceFolders![0], phase);
          await fs.writeFile(result, JSON.stringify({ success: true, phase }));
        } catch (error) {
          await fs.writeFile(
            result,
            JSON.stringify({ success: false, phase, error: String(error) }),
          );
        }
        await vscode.commands.executeCommand("workbench.action.quit");
      })();
    }, 1000);
  }
  return { state, paletteEditor };
}
