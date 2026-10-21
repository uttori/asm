import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { decodeAsepriteDocument, encodeAsepriteDocument } from "@uttori/asm-assets/aseprite";
import {
  readAssetExportManifest,
  readAssetImportReview,
} from "@uttori/asm-workflows/asset-interchange/public-records";
import * as vscode from "vscode";

/** Exact fixture bytes supply the oracle independently of the worker's normal source conversion. */
const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** Real command handlers, worker bundles, text buffers and custom PNG drafts share one disposable adopted source project. */
export async function runAssetInterchangeSmoke(folder: vscode.WorkspaceFolder): Promise<void> {
  const root = folder.uri.fsPath;
  const marker = JSON.parse(
    fs.readFileSync(path.join(root, ".verification/asset-interchange-case.json"), "utf8"),
  );
  assert.equal(marker.disposable, true);
  const document = path.join(root, ".uttori-local/editor.aseprite"),
    manifest = document + ".json";
  const selection = path.join(root, ".verification/asset-selection.json");
  const image = path.join(root, "source/sprite.png"),
    layout = path.join(root, "source/sprite.layout.json");
  const original = fs.readFileSync(path.join(root, ".uttori-local/original.sfc"));
  const imageBefore = fs.readFileSync(image),
    layoutBefore = fs.readFileSync(layout);
  const checks: string[] = [];
  const resources: vscode.Disposable[] = [];
  const report: {
    success: boolean;
    editor: string;
    node: string;
    checks: string[];
    error?: string;
  } = {
    success: false,
    editor: vscode.version,
    node: process.versions.node,
    checks,
  };
  try {
    await vscode.commands.executeCommand("asm.source.select", folder.uri);
    const exported = readAssetExportManifest(
      await vscode.commands.executeCommand("asm.asset.export", {
        action: "asset-export",
        directory: root,
        adapter: "som.sprite.native",
        selection,
        document,
        manifest,
      }),
    );
    assert.equal(exported.codec.id, "aseprite.indexed-structure");
    const initial = readAssetImportReview(
      await vscode.commands.executeCommand("asm.asset.review", {
        action: "asset-review",
        directory: root,
        document,
        manifest,
      }),
    );
    assert.deepEqual(initial.files, []);
    checks.push(
      "bundled commands export and review the complete native inventory without an installed editor",
    );
    const buffer = await vscode.workspace.openTextDocument(vscode.Uri.file(layout));
    await vscode.window.showTextDocument(buffer);
    const change = new vscode.WorkspaceEdit();
    change.insert(buffer.uri, buffer.positionAt(buffer.getText().length), "\n");
    assert.equal(await vscode.workspace.applyEdit(change), true);
    assert.equal(buffer.isDirty, true);
    assert.equal(
      await vscode.commands.executeCommand("asm.asset.review", {
        action: "asset-review",
        directory: root,
        document,
        manifest,
      }),
      undefined,
    );
    assert.equal(buffer.isDirty, true);
    assert.deepEqual(fs.readFileSync(layout), layoutBefore);
    // Error reporting focuses the output channel. Native undo must target the preserved source editor again.
    await vscode.window.showTextDocument(buffer);
    await vscode.commands.executeCommand("undo");
    const undoDeadline = Date.now() + 5000;
    // The document-change event updates isDirty while the delay yields; the prior assertion is only a snapshot.
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    while (buffer.isDirty && Date.now() < undoDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(buffer.isDirty, false);
    checks.push("relevant text drafts reject while preserving saved bytes and native undo");
    await vscode.commands.executeCommand(
      "vscode.openWith",
      vscode.Uri.file(image),
      "uttori.indexedPng",
      { preview: false },
    );
    const png = await vscode.commands.executeCommand<{ dirty: boolean } | undefined>(
      "uttori.tests.png",
      image,
      2,
    );
    assert.equal(png?.dirty, true);
    assert.equal(
      await vscode.commands.executeCommand("asm.asset.review", {
        action: "asset-review",
        directory: root,
        document,
        manifest,
      }),
      undefined,
    );
    assert.equal(
      (
        await vscode.commands.executeCommand<{ dirty: boolean } | undefined>(
          "uttori.tests.png",
          image,
        )
      )?.dirty,
      true,
    );
    assert.deepEqual(fs.readFileSync(image), imageBefore);
    // Revert through the editor so both the custom document and VS Code's dirty-tab
    // model clear. Calling the document directly leaves a stale native dirty state.
    await vscode.commands.executeCommand(
      "vscode.openWith",
      vscode.Uri.file(image),
      "uttori.indexedPng",
      { preview: false },
    );
    await vscode.commands.executeCommand("workbench.action.files.revert");
    const revertDeadline = Date.now() + 5000;
    let clean = false;
    while (!clean && Date.now() < revertDeadline) {
      const state = await vscode.commands.executeCommand<{ dirty: boolean } | undefined>(
        "uttori.tests.png",
        image,
        undefined,
        false,
      );
      const dirtyTab = vscode.window.tabGroups.all.some((group) =>
        group.tabs.some(
          (tab) =>
            tab.input instanceof vscode.TabInputCustom &&
            tab.input.uri.fsPath === image &&
            tab.isDirty,
        ),
      );
      // Missing command results cannot prove that the custom document has finished reverting.
      clean = state !== undefined && !state.dirty && !dirtyTab;
      if (!clean) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    assert.equal(clean, true, "Native PNG Revert must clear both document and tab dirty state");
    checks.push("real custom PNG drafts reject without save, discard or overwrite");
    const saved = await decodeAsepriteDocument(fs.readFileSync(document));
    const indexes = saved.tilesets[0].indexes.slice();
    indexes[64] ^= 1;
    fs.writeFileSync(
      document,
      await encodeAsepriteDocument({ ...saved, tilesets: [{ ...saved.tilesets[0], indexes }] }),
    );
    const reviewed = readAssetImportReview(
      await vscode.commands.executeCommand("asm.asset.review", {
        action: "asset-review",
        directory: root,
        document,
        manifest,
      }),
    );
    const expected = Buffer.from(original);
    expected[0x200] ^= 0x80;
    assert.equal(reviewed.outputSha256, hash(expected));
    assert.deepEqual(fs.readFileSync(image), imageBefore);
    // A read-only preview can share a source fsPath. Refresh it exactly at the
    // worker gate so asynchronous SCM display events cannot cause false invalidation.
    const referenceUri = vscode.Uri.from({ scheme: "uttori-asset-reference", path: layout });
    const referenceChanged = new vscode.EventEmitter<vscode.Uri>();
    let referenceText = layoutBefore.toString();
    const provider = vscode.workspace.registerTextDocumentContentProvider(referenceUri.scheme, {
      onDidChange: referenceChanged.event,
      provideTextDocumentContent: () => referenceText,
    });
    resources.push(provider, referenceChanged);
    await vscode.workspace.openTextDocument(referenceUri);
    await vscode.commands.executeCommand("uttori.tests.assetPublicationEvent", async () => {
      let listener: vscode.Disposable | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const changed = new Promise<void>((resolve, reject) => {
        listener = vscode.workspace.onDidChangeTextDocument((event) => {
          if (
            event.document.uri.toString() === referenceUri.toString() &&
            event.contentChanges.length
          ) {
            resolve();
          }
        });
        timer = setTimeout(() => reject(new Error("Read-only preview did not refresh.")), 5000);
      });
      try {
        referenceText += "\n";
        referenceChanged.fire(referenceUri);
        await changed;
      } finally {
        clearTimeout(timer);
        listener?.dispose();
      }
    });
    const applied = await vscode.commands.executeCommand<
      { review: unknown; transaction: string } | undefined
    >("asm.asset.apply", {
      action: "asset-apply",
      directory: root,
      document,
      manifest,
      review: reviewed.id,
    });
    assert.ok(applied?.transaction);
    assert.equal(readAssetImportReview(applied.review).id, reviewed.id);
    const build = await vscode.commands.executeCommand<
      { verification: { outputSha256: string } } | undefined
    >("asm.source.build");
    assert.equal(build?.verification.outputSha256, hash(expected));
    checks.push(
      "the live publication gate applies the exact reviewed plan and the normal full ROM matches the independent bit oracle",
    );
    checks.push(
      "a read-only source-path preview refresh at publication preserves saved-source freshness",
    );
    report.success = true;
  } catch (error) {
    report.error = error instanceof Error ? error.stack : String(error);
    throw error;
  } finally {
    for (const resource of resources.toReversed()) {
      resource.dispose();
    }
    fs.writeFileSync(
      path.join(root, ".verification/editor-asset-interchange.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
}
