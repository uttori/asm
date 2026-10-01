import assert from "node:assert/strict";
import fs from "node:fs/promises";

import * as vscode from "vscode";

import { PaletteEditor } from "../src/assets/palette-editor.js";
import { paletteView, paletteWordEdit } from "../src/assets/palette-model.js";

/** Drive the actual webview form, then let native custom-text-editor save/undo handle its document. */
export async function runPaletteEditorSmoke(
  folder: vscode.WorkspaceFolder,
  extensionUri: vscode.Uri,
): Promise<void> {
  const uri = vscode.Uri.joinPath(folder.uri, "disassembly/assets/palettes/rom-palettes.json");
  const before = await fs.readFile(uri.fsPath, "utf8");
  let document = await vscode.workspace.openTextDocument(uri);
  const first = paletteView(before)[0];
  const word = (parseInt(first.words[0], 16) ^ 1).toString(16).padStart(4, "0").toUpperCase();
  const edit = paletteWordEdit(before, first.id, first.firstIndex, word);
  const expected =
    before.slice(0, edit.offset) + edit.text + before.slice(edit.offset + edit.length);
  let panel: vscode.WebviewPanel | undefined;
  let formError: string | undefined;
  let formSubmitted = false;
  // Only the smoke subclass injects automation; production has no test commands or message backdoor.
  class DrivenPaletteEditor extends PaletteEditor {
    override resolveCustomTextEditor(doc: vscode.TextDocument, view: vscode.WebviewPanel): void {
      console.log("Palette smoke provider resolved.");
      panel = view;
      super.resolveCustomTextEditor(doc, view);
      const nonce = /script nonce="([^"]+)"/.exec(view.webview.html)?.[1];
      assert.ok(nonce);
      const listener = view.webview.onDidReceiveMessage(
        (message: { type?: string; error?: string }) => {
          console.log(`Palette form message: ${JSON.stringify(message)}`);
          if (message.type === "palette-smoke") {
            formSubmitted = true;
            formError = message.error;
          }
        },
      );
      view.onDidDispose(() => listener.dispose());
      view.webview.html = view.webview.html.replace(
        "</body>",
        `<script nonce="${nonce}">
        let ran = false;
        window.addEventListener("message", ({data}) => {
          if (data.type !== "palette" || ran) return;
          ran = true;
          try {
            const select = document.getElementById("palettes");
            select.value = ${JSON.stringify(first.id)};
            select.dispatchEvent(new Event("change"));
            if (document.querySelectorAll("#colors button").length !== ${first.words.length}) throw new Error("Missing palette slots");
            document.getElementById("word").value = ${JSON.stringify(word)};
            document.getElementById("edit").requestSubmit();
            vscode.postMessage({type:"palette-smoke"});
          } catch(error) { vscode.postMessage({type:"palette-smoke", error:String(error)}); }
        });
      </script></body>`,
      );
    }
  }
  const provider = new DrivenPaletteEditor(extensionUri);
  const registration = vscode.window.registerCustomEditorProvider("uttori.paletteSmoke", provider, {
    supportsMultipleEditorsPerDocument: true,
  });
  const wait = async (predicate: () => boolean, description: string) => {
    const deadline = Date.now() + 15000;
    while (!predicate() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(
      predicate(),
      `${description}; panel=${!!panel}, submitted=${formSubmitted}, error=${formError}, closed=${document.isClosed}, dirty=${document.isDirty}`,
    );
  };
  try {
    await vscode.commands.executeCommand("vscode.openWith", uri, "uttori.palette");
    assert.ok(
      vscode.window.tabGroups.all.some((group) =>
        group.tabs.some(
          (tab) =>
            tab.input instanceof vscode.TabInputCustom && tab.input.viewType === "uttori.palette",
        ),
      ),
    );
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    document = await vscode.workspace.openTextDocument(uri);
    const initialVersion = document.version;
    await vscode.commands.executeCommand("vscode.openWith", uri, "uttori.paletteSmoke");
    await wait(
      () => formSubmitted && document.getText() === expected && document.isDirty,
      "Real palette form did not edit the text document",
    );
    assert.equal(formError, undefined);
    assert.equal(document.isDirty, true);
    assert.equal(
      await fs.readFile(uri.fsPath, "utf8"),
      before,
      "Applying a color must not save implicitly",
    );
    await assert.rejects(
      provider.edit(document, {
        version: initialVersion,
        id: first.id,
        index: first.firstIndex,
        word: "0000",
      }),
      /changed in another editor/,
    );
    panel!.reveal(vscode.ViewColumn.Active, false);
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    await new Promise((resolve) => setTimeout(resolve, 250));
    console.log(
      `Palette active tab: ${JSON.stringify(vscode.window.tabGroups.activeTabGroup.activeTab?.input)}`,
    );
    await vscode.commands.executeCommand("undo");
    await wait(() => document.getText() === before, "Native undo did not restore the palette");
    await vscode.commands.executeCommand("redo");
    await wait(() => document.getText() === expected, "Native redo did not restore the color edit");
    await vscode.commands.executeCommand("workbench.action.files.save");
    await wait(() => !document.isDirty, "Native Save did not save the palette");
    assert.equal(await fs.readFile(uri.fsPath, "utf8"), expected);
    await vscode.commands.executeCommand("undo");
    await wait(() => document.getText() === before, "Undo after Save did not restore the source");
    assert.ok(await document.save());
    assert.equal(await fs.readFile(uri.fsPath, "utf8"), before);
    await fs.writeFile(
      vscode.Uri.joinPath(folder.uri, ".verification", `palette-editor-${vscode.version}.json`)
        .fsPath,
      JSON.stringify(
        {
          success: true,
          editor: vscode.version,
          checks: [
            "production Open With registration",
            "real palette DOM edit",
            "dirty text and untouched disk",
            "stale edit rejection",
            "native undo/redo",
            "native Save",
            "undo after Save",
            "exact source restoration",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    console.log("Palette editor: real DOM, native save/undo/redo and stale-view checks passed.");
  } finally {
    // Keep this isolated clone clean even if a native assertion fails halfway through the test.
    if (document.getText() !== before) {
      const reset = new vscode.WorkspaceEdit();
      reset.replace(
        uri,
        new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
        before,
      );
      assert.ok(await vscode.workspace.applyEdit(reset));
    }
    await document.save();
    panel?.dispose();
    registration.dispose();
  }
}
