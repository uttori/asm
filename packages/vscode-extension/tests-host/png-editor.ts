import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { pngImporter, type IndexedImage } from "@uttori/asm-assets/image";
import * as vscode from "vscode";

import { BinaryDrafts } from "../src/assets/binary-drafts.js";
import { PngCodec } from "../src/assets/png-codec.js";
import type { PngDocument } from "../src/assets/png-document.js";
import { PngEditor } from "../src/assets/png-editor.js";
import { readPngGuidance } from "../src/assets/png-guidance.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isIndexedImage = (value: unknown): value is IndexedImage =>
  isRecord(value) &&
  value.kind === "indexed-image" &&
  typeof value.width === "number" &&
  typeof value.height === "number" &&
  value.indexes instanceof Uint8Array &&
  Array.isArray(value.palette);

/** A real binary custom document with a test-only DOM driver for its pixel canvas. */
export async function runPngEditorSmoke(
  folder: vscode.WorkspaceFolder,
  extensionUri: vscode.Uri,
): Promise<void> {
  const uri = vscode.Uri.joinPath(folder.uri, "disassembly/assets/images/enemy/rabite-frames.png");
  const before = await fs.readFile(uri.fsPath);
  const imported = pngImporter.import({ bytes: before, mediaType: "image/png" });
  assert.equal(imported.kind, "indexed-image");
  if (!isIndexedImage(imported.value)) {
    assert.fail("PNG import did not produce an indexed image.");
  }
  const original = imported.value;
  const region = (await readPngGuidance(uri.fsPath, original))!.regions[0];
  const pixel = region.y * original.width + region.x;
  const selected =
    original.indexes[pixel] === region.paletteStart + 1
      ? region.paletteStart + 2
      : region.paletteStart + 1;
  const drafts = new BinaryDrafts();
  const codec = new PngCodec(vscode.Uri.joinPath(extensionUri, "out/png-worker.cjs").fsPath);
  let document: PngDocument | undefined;
  let panel: vscode.WebviewPanel | undefined;
  let submitted = false;
  let error: string | undefined;
  class DrivenPngEditor extends PngEditor {
    override resolveCustomEditor(doc: PngDocument, view: vscode.WebviewPanel): void {
      document = doc;
      panel = view;
      super.resolveCustomEditor(doc, view);
      const nonce = /script nonce="([^"]+)"/.exec(view.webview.html)?.[1];
      assert.ok(nonce);
      const listener = view.webview.onDidReceiveMessage(
        (message: { type?: string; error?: string }) => {
          if (message.type === "png-smoke") {
            submitted = true;
            error = message.error;
          }
        },
      );
      view.onDidDispose(() => listener.dispose());
      view.webview.html = view.webview.html.replace(
        "</body>",
        `<script nonce="${nonce}">
        let ran = false;
        window.addEventListener("message", ({data}) => {
          if (data.type !== "image" || ran) return;
          ran = true;
          try {
            const canvas = document.getElementById("image");
            if (canvas.width !== ${original.width} || canvas.height !== ${original.height}) throw new Error("Unexpected backing canvas size");
            document.querySelectorAll("#palette button")[${selected}].click();
            const box = canvas.getBoundingClientRect();
            // Synthetic pointer events have no native capture target; the real brush still handles both events.
            canvas.setPointerCapture = () => {};
            const zoom = Number(document.getElementById("zoom").value);
            canvas.dispatchEvent(new PointerEvent("pointerdown", {pointerId:1, button:0, clientX:box.left+${region.x}*zoom+1, clientY:box.top+${region.y}*zoom+1}));
            canvas.dispatchEvent(new PointerEvent("pointerup", {pointerId:1}));
            vscode.postMessage({type:"png-smoke"});
          } catch(error) { vscode.postMessage({type:"png-smoke",error:String(error)}); }
        });
      </script></body>`,
      );
    }
  }
  const provider = new DrivenPngEditor(extensionUri, codec, drafts);
  const registration = vscode.window.registerCustomEditorProvider("uttori.pngSmoke", provider, {
    supportsMultipleEditorsPerDocument: true,
  });
  const wait = async (predicate: () => boolean, description: string) => {
    const deadline = Date.now() + 15000;
    while (!predicate() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(predicate(), `${description}; submitted=${submitted}, error=${error}`);
  };
  const token = new vscode.CancellationTokenSource();
  try {
    await vscode.commands.executeCommand("vscode.openWith", uri, "uttori.indexedPng");
    assert.ok(
      vscode.window.tabGroups.all.some((group) =>
        group.tabs.some(
          (tab) =>
            tab.input instanceof vscode.TabInputCustom &&
            tab.input.viewType === "uttori.indexedPng",
        ),
      ),
    );
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    await vscode.commands.executeCommand("vscode.openWith", uri, "uttori.pngSmoke");
    await wait(
      () => submitted && !!document?.dirty,
      "PNG canvas did not produce a native document edit",
    );
    assert.equal(error, undefined);
    assert.equal(document!.image.indexes[pixel], selected);
    const expected = original.indexes.slice();
    expected[pixel] = selected;
    assert.deepEqual(document!.image.indexes, expected);
    assert.throws(
      () => document!.paint({ version: document!.version, pixels: [0], index: selected }),
      /padding or a preview/,
    );
    assert.deepEqual(await fs.readFile(uri.fsPath), before);
    const snapshot = await document!.snapshot();
    const backupUri = vscode.Uri.joinPath(folder.uri, ".verification/png-editor-backup.json");
    const backup = await provider.backupCustomDocument(
      document!,
      { destination: backupUri },
      token.token,
    );
    const restored = await provider.openCustomDocument(
      uri,
      { backupId: backup.id, untitledDocumentData: undefined },
      token.token,
    );
    assert.equal(restored.dirty, true);
    assert.deepEqual(await restored.snapshot(), snapshot);
    restored.dispose();
    await backup.delete();
    panel!.reveal(vscode.ViewColumn.Active, false);
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    await new Promise((resolve) => setTimeout(resolve, 250));
    await vscode.commands.executeCommand("undo");
    await wait(() => !document!.dirty, "Native PNG Undo failed");
    assert.deepEqual(Buffer.from(await document!.snapshot()), before);
    await vscode.commands.executeCommand("redo");
    await wait(() => document!.dirty, "Native PNG Redo failed");
    await vscode.commands.executeCommand("workbench.action.files.save");
    await wait(() => !document!.dirty, "Native PNG Save failed");
    assert.deepEqual(await fs.readFile(uri.fsPath), Buffer.from(snapshot));
    await vscode.commands.executeCommand("undo");
    await wait(() => document!.dirty, "Native PNG Undo after Save failed");
    await vscode.commands.executeCommand("workbench.action.files.save");
    await wait(() => !document!.dirty, "Native PNG restoration Save failed");
    assert.deepEqual(await fs.readFile(uri.fsPath), before);
    await fs.writeFile(
      vscode.Uri.joinPath(folder.uri, ".verification", `png-editor-${vscode.version}.json`).fsPath,
      JSON.stringify(
        {
          success: true,
          editor: vscode.version,
          checks: [
            "production Open With",
            "real canvas/slot controls",
            "unchanged palette indexes outside stroke",
            "unsaved binary snapshot",
            "backup callback/reopen retains draft",
            "native undo/redo",
            "native Save",
            "undo after Save restores exact original PNG",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    console.log("PNG editor: canvas, native save/undo/redo and backup restoration passed.");
  } finally {
    // A failed assertion must not leave the verification clone's image edited.
    await fs.writeFile(uri.fsPath, before);
    if (document) {
      await document.revert();
    }
    panel?.dispose();
    registration.dispose();
    provider.dispose();
    codec.dispose();
    drafts.dispose();
    token.dispose();
  }
}
