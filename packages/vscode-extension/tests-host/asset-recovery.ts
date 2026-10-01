import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";

import * as vscode from "vscode";

import { paletteView, paletteWordEdit } from "../src/assets/palette-model.js";
import type { activate } from "./asset-recovery-driver.js";

const hash = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

/** Two isolated editor processes share one disposable profile, exercising VS Code's real hot-exit storage. */
export async function runAssetRecoverySmoke(
  folder: vscode.WorkspaceFolder,
  phase: string,
): Promise<void> {
  const paletteUri = vscode.Uri.joinPath(
    folder.uri,
    "disassembly/assets/palettes/rom-palettes.json",
  );
  const pngUri = vscode.Uri.joinPath(
    folder.uri,
    "disassembly/assets/images/enemy/rabite-frames.png",
  );
  const reportUri = vscode.Uri.joinPath(
    folder.uri,
    ".verification",
    `asset-hot-exit-${vscode.version}.json`,
  );
  const paletteBefore = await fs.readFile(paletteUri.fsPath, "utf8");
  const pngBefore = await fs.readFile(pngUri.fsPath);
  const record = paletteView(paletteBefore)[0];
  const word = (parseInt(record.words[0], 16) ^ 1).toString(16).padStart(4, "0");
  const edit = paletteWordEdit(paletteBefore, record.id, record.firstIndex, word);
  const paletteExpected =
    paletteBefore.slice(0, edit.offset) +
    edit.text +
    paletteBefore.slice(edit.offset + edit.length);
  const driver = vscode.extensions.getExtension<ReturnType<typeof activate>>(
    "uttori-tests.uttori-asset-test-driver",
  );
  assert.ok(driver);
  const { state, paletteEditor } = await driver.activate();
  const wait = async (predicate: () => boolean, label: string) => {
    const end = Date.now() + 20000;
    while (!predicate() && Date.now() < end) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(predicate(), label);
  };
  await vscode.commands.executeCommand("vscode.openWith", paletteUri, "uttori.paletteSmoke", {
    preview: false,
  });
  const palette = await vscode.workspace.openTextDocument(paletteUri);
  await vscode.commands.executeCommand("vscode.openWith", pngUri, "uttori.pngSmoke", {
    preview: false,
  });
  await wait(() => !!state.document, "Native PNG provider did not open");
  const png = state.document!;
  if (phase === "draft") {
    assert.equal(palette.isDirty, false);
    assert.equal(png!.dirty, false);
    await paletteEditor.edit(palette, {
      version: palette.version,
      id: record.id,
      index: record.firstIndex,
      word,
    });
    const region = png.guidance!.regions[0];
    const pixel = region.y * png.image.width + region.x;
    const first = region.paletteStart + 1;
    png.paint({
      version: png.version,
      pixels: [pixel],
      index: png.image.indexes[pixel] === first ? first + 1 : first,
    });
    const expected = hash(await png!.snapshot());
    await wait(() => state.backups > 0 && palette.isDirty, "VS Code did not back up the dirty PNG");
    // Text backups are owned entirely by VS Code; allow its delayed write after the binary callback.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    assert.equal(palette.isClosed, false, "The dirty palette must remain open for hot exit");
    assert.equal(await fs.readFile(paletteUri.fsPath, "utf8"), paletteBefore);
    assert.deepEqual(await fs.readFile(pngUri.fsPath), pngBefore);
    await fs.writeFile(
      reportUri.fsPath,
      JSON.stringify(
        {
          success: false,
          phase: "native backups written",
          paletteOriginal: hash(paletteBefore),
          pngOriginal: hash(pngBefore),
          paletteDraft: hash(paletteExpected),
          pngDraft: expected,
        },
        null,
        2,
      ),
    );
    console.log("Asset hot exit: native backups written; exiting with both assets unsaved.");
    // Keep providers registered until shutdown: unregistering them would close the recoverable editors.
    return;
  }
  const report = JSON.parse(await fs.readFile(reportUri.fsPath, "utf8")) as Record<string, unknown>;
  assert.equal(
    state.restoredFromBackup,
    true,
    "VS Code must pass its retained PNG backup to the new process",
  );
  await wait(
    () => palette.isDirty && palette.getText() === paletteExpected,
    "VS Code did not restore the unsaved palette text",
  );
  assert.equal(png!.dirty, true);
  assert.equal(hash(await png!.snapshot()), report.pngDraft);
  assert.equal(hash(palette.getText()), report.paletteDraft);
  assert.equal(hash(pngBefore), report.pngOriginal);
  assert.equal(hash(paletteBefore), report.paletteOriginal);
  await vscode.commands.executeCommand("workbench.action.files.revert");
  await wait(() => !png!.dirty, "Native PNG Revert did not clear the restored draft");
  await vscode.commands.executeCommand("vscode.openWith", paletteUri, "uttori.paletteSmoke");
  await vscode.commands.executeCommand("workbench.action.files.revert");
  await wait(() => !palette.isDirty, "Native palette Revert did not clear the restored draft");
  assert.equal(await fs.readFile(paletteUri.fsPath, "utf8"), paletteBefore);
  assert.deepEqual(await fs.readFile(pngUri.fsPath), pngBefore);
  await fs.writeFile(
    reportUri.fsPath,
    JSON.stringify(
      {
        ...report,
        success: true,
        phase: "restored in a second editor process and reverted",
        editor: vscode.version,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Asset hot exit: both unsaved assets restored in a second editor process; native Revert preserved disk files.",
  );
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
}
