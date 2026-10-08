import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { AssetSourceConversionPlan } from "@uttori/asm-cli/asset-source";
import * as vscode from "vscode";

/** Exercise shipped commands and VS Code's native resource/text undo without the interchange wizard. */
export async function runAssetSourceConversionSmoke(folder: vscode.WorkspaceFolder): Promise<void> {
  const root = folder.uri.fsPath;
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(root, ".verification/asset-interchange-case.json"), "utf8"),
    ).disposable,
    true,
  );
  const file = path.join(root, "source/main.asm");
  // The actual saved build evaluates the shared define; conversion must change only its call operand.
  const originalText =
    '!sprite = "sprite.png"\n' +
    fs
      .readFileSync(file, "utf8")
      .replace(
        'includeAsset("sprite.png", "som.sprite.frames",',
        'includeAsset(\n  "!sprite", ; shared source define\n  "som.sprite.frames",',
      );
  fs.writeFileSync(file, originalText);
  const originalPng = fs.readFileSync(path.join(root, "source/sprite.png"));
  const line = originalText.split("\n").findIndex((text) => text.includes('"!sprite",')) + 1;
  await vscode.commands.executeCommand("asm.source.select", folder.uri);
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  await vscode.window.showTextDocument(document, {
    selection: new vscode.Range(line - 1, 0, line - 1, 0),
  });
  const forward = await vscode.commands.executeCommand<AssetSourceConversionPlan | undefined>(
    "asm.asset.convertToAseprite",
    document.uri,
  );
  assert.ok(forward, "Forward conversion returned no result.");
  assert.ok(fs.existsSync(path.join(root, forward.destination)));
  assert.equal(fs.existsSync(path.join(root, forward.source)), false);
  const savedForward = fs.readFileSync(file, "utf8");
  assert.match(savedForward, /sprite\.aseprite/);
  assert.ok(savedForward.startsWith('!sprite = "sprite.png"'));
  assert.ok(savedForward.includes('"sprite.aseprite", ; shared source define'));
  assert.equal(document.isDirty, false);
  await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand("undo");
  assert.equal(document.getText(), originalText);
  assert.equal(fs.existsSync(path.join(root, forward.destination)), false);
  assert.deepEqual(fs.readFileSync(path.join(root, forward.source)), originalPng);
  await document.save();
  await vscode.commands.executeCommand("redo");
  assert.equal(document.getText(), savedForward);
  assert.ok(fs.existsSync(path.join(root, forward.destination)));
  assert.equal(fs.existsSync(path.join(root, forward.source)), false);
  await document.save();
  // Explicit invocation coordinates support keyboard/test clients and are re-resolved against the current saved build.
  const inverse = await vscode.commands.executeCommand<AssetSourceConversionPlan | undefined>(
    "asm.asset.convertToPng",
    { file, line },
  );
  assert.ok(inverse, "Inverse conversion returned no result.");
  assert.equal(inverse.outputSha256, forward.outputSha256);
  assert.ok(fs.existsSync(path.join(root, inverse.destination)));
  assert.equal(fs.existsSync(path.join(root, inverse.source)), false);
  assert.match(document.getText(), /sprite\.png/);
  await vscode.window.showTextDocument(document, {
    selection: new vscode.Range(line - 1, 0, line - 1, 0),
  });
  const keyboard = await vscode.commands.executeCommand<AssetSourceConversionPlan | undefined>(
    "asm.asset.convertToAseprite",
  );
  assert.ok(keyboard, "Keyboard conversion returned no result.");
  assert.equal(keyboard.outputSha256, inverse.outputSha256);
  fs.writeFileSync(
    path.join(root, ".verification/asset-source-conversion-result.json"),
    JSON.stringify(
      {
        success: true,
        editor: vscode.version,
        outputSha256: inverse.outputSha256,
        checks: [
          "clean cursor conversion in multiline define include",
          "context-menu URI and command-palette invocation",
          "native file/text undo and redo",
          "independent inverse conversion",
          "published full ROM equality",
        ],
      },
      null,
      2,
    ),
  );
}
