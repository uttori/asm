import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { pngImporter, type IndexedImage } from "@uttori/asm-assets/image";
import { sourceGit, type SourceMergePreview } from "@uttori/asm-disassembler";
import type { PreparedSnesGeneration } from "@uttori/asm-plugin-snes";
import * as vscode from "vscode";

import { BinaryDrafts } from "../src/assets/binary-drafts.js";
import { PngCodec } from "../src/assets/png-codec.js";
import type { PngDocument } from "../src/assets/png-document.js";
import { PngEditor } from "../src/assets/png-editor.js";
import { readPngGuidance } from "../src/assets/png-guidance.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOpaqueDirty = () =>
  vscode.window.tabGroups.all.some((group) =>
    group.tabs.some(
      (tab) =>
        tab.isDirty &&
        tab.input instanceof vscode.TabInputCustom &&
        tab.input.viewType === "uttori.pngSmoke",
    ),
  );

const isIndexedImage = (value: unknown): value is IndexedImage =>
  isRecord(value) &&
  value.kind === "indexed-image" &&
  typeof value.width === "number" &&
  typeof value.height === "number" &&
  value.indexes instanceof Uint8Array &&
  Array.isArray(value.palette);

/** Verify production editor/controller wiring through actual native custom-document lifecycle. */
export async function runBinaryPreviewSmoke(
  folder: vscode.WorkspaceFolder,
  extensionUri: vscode.Uri,
): Promise<void> {
  const root = folder.uri.fsPath;
  const relative = "disassembly/assets/images/enemy/rabite-frames.png";
  const uri = vscode.Uri.joinPath(folder.uri, relative);
  const before = await fs.readFile(uri.fsPath);
  const imported = pngImporter.import({ bytes: before, mediaType: "image/png" });
  if (!isIndexedImage(imported.value)) {
    assert.fail("PNG import did not produce an indexed image.");
  }
  const original = imported.value;
  const region = (await readPngGuidance(uri.fsPath, original))!.regions[0];
  const pixel = region.y * original.width + region.x;
  const slot =
    original.indexes[pixel] === region.paletteStart + 1
      ? region.paletteStart + 2
      : region.paletteStart + 1;
  const initialTree = (await sourceGit(root, ["write-tree"])).stdout;
  assert.equal((await sourceGit(root, ["status", "--porcelain"])).stdout.length, 0);
  let candidate: string | undefined;
  const inspect = (paint?: number) =>
    vscode.commands.executeCommand<{ dirty: boolean; bytes: Uint8Array } | undefined>(
      "uttori.tests.png",
      uri.fsPath,
      paint,
    );
  try {
    await vscode.commands.executeCommand("asm.source.select", folder.uri);
    await vscode.commands.executeCommand("vscode.openWith", uri, "uttori.indexedPng", {
      preview: false,
    });
    const deadline = Date.now() + 15000;
    while (!(await inspect()) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(await inspect(), "Production PNG document did not open.");
    const prepared =
      await vscode.commands.executeCommand<PreparedSnesGeneration>("asm.source.prepare");
    candidate = prepared.generation.commit;
    assert.ok(candidate);
    const draft = await inspect(slot);
    assert.equal(draft?.dirty, true);
    assert.notDeepEqual(Buffer.from(draft!.bytes), before);
    const preview = await vscode.commands.executeCommand<SourceMergePreview>("asm.source.preview");
    assert.ok(preview.sourceTree);
    assert.deepEqual(
      (await sourceGit(root, ["show", `${preview.sourceTree}:${relative}`])).stdout,
      Buffer.from(draft!.bytes),
    );
    assert.equal(
      await vscode.commands.executeCommand("asm.source.build"),
      undefined,
      "Build must require saving the binary draft.",
    );
    assert.equal(
      await vscode.commands.executeCommand("asm.source.apply"),
      undefined,
      "Apply must require an explicit saved checkpoint.",
    );
    assert.deepEqual(await fs.readFile(uri.fsPath), before);
    assert.deepEqual((await sourceGit(root, ["write-tree"])).stdout, initialTree);
    assert.equal((await sourceGit(root, ["status", "--porcelain"])).stdout.length, 0);
    await vscode.commands.executeCommand("vscode.openWith", uri, "uttori.indexedPng", {
      preview: false,
    });
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    await new Promise((resolve) => setTimeout(resolve, 250));
    await vscode.commands.executeCommand("undo");
    const undoDeadline = Date.now() + 5000;
    while ((await inspect())?.dirty && Date.now() < undoDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal((await inspect())?.dirty, false);
    assert.deepEqual(Buffer.from((await inspect())!.bytes), before);
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    const drafts = new BinaryDrafts();
    const codec = new PngCodec(vscode.Uri.joinPath(extensionUri, "out/png-worker.cjs").fsPath);
    let opaqueDocument: PngDocument | undefined;
    let opaquePanel: vscode.WebviewPanel | undefined;
    let reverted: (() => void) | undefined;
    const revertFinished = new Promise<void>((resolve) => {
      reverted = resolve;
    });
    class OpaqueEditor extends PngEditor {
      override resolveCustomEditor(document: PngDocument, panel: vscode.WebviewPanel): void {
        opaqueDocument = document;
        opaquePanel = panel;
        super.resolveCustomEditor(document, panel);
      }
      override async revertCustomDocument(document: PngDocument): Promise<void> {
        await super.revertCustomDocument(document);
        reverted?.();
      }
    }
    const provider = new OpaqueEditor(extensionUri, codec, drafts);
    const registration = vscode.window.registerCustomEditorProvider("uttori.pngSmoke", provider);
    try {
      await vscode.commands.executeCommand("vscode.openWith", uri, "uttori.pngSmoke");
      const openDeadline = Date.now() + 15000;
      // The custom-editor callback publishes the document while the smoke test yields.
      while (Date.now() < openDeadline) {
        if (opaqueDocument) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.ok(opaqueDocument);
      opaqueDocument.paint({
        version: opaqueDocument.version,
        index: slot,
        pixels: [pixel],
      });

      const dirtyDeadline = Date.now() + 5000;
      while (!isOpaqueDirty() && Date.now() < dirtyDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.ok(isOpaqueDirty());
      assert.equal(
        await vscode.commands.executeCommand("asm.source.preview"),
        undefined,
        "Opaque custom drafts cannot preview stale disk bytes.",
      );
      assert.equal(await vscode.commands.executeCommand("asm.source.build"), undefined);
    } finally {
      if (opaquePanel && opaqueDocument) {
        const disposed = new Promise<void>((resolve) => opaqueDocument!.onDidDispose(resolve));
        opaquePanel.reveal(vscode.ViewColumn.Active, false);
        await vscode.commands.executeCommand("workbench.action.files.revert");
        // The workbench command returns before the custom provider's asynchronous reload.
        await revertFinished;
        await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        await disposed;
      }
      registration.dispose();
      provider.dispose();
      codec.dispose();
      drafts.dispose();
    }
    await fs.writeFile(
      vscode.Uri.joinPath(folder.uri, ".verification", `binary-preview-${vscode.version}.json`)
        .fsPath,
      JSON.stringify(
        {
          success: true,
          editor: vscode.version,
          checks: [
            "production PNG editor and controller share draft",
            "preview tree contains exact unsaved PNG",
            "build and apply reject dirty binary",
            "saved file and Git index unchanged",
            "native undo restores exact original",
            "other custom editor drafts block stale preview and build",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "Binary preview: production draft snapshot, checkpoint guards and native undo passed.",
    );
  } finally {
    if (candidate) {
      await vscode.commands.executeCommand("asm.source.discard");
    }
    if ((await inspect())?.dirty) {
      await vscode.commands.executeCommand("workbench.action.files.revert");
    }
    assert.deepEqual(await fs.readFile(uri.fsPath), before);
  }
}
