import * as assert from "node:assert/strict";

import * as vscode from "vscode";

import { ownershipFixture } from "../../../tests/helpers/ownership-fixture.js";

/** Exercise the registered UI providers using generated data that has never been assembled. */
export const runOwnershipSmoke = async (folder: vscode.WorkspaceFolder): Promise<void> => {
  const fixture = ownershipFixture(folder.uri.fsPath);
  const uri = vscode.Uri.file(fixture.file);
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const position = new vscode.Position(fixture.line - 1, 1);
    await vscode.window.showTextDocument(document, {
      selection: new vscode.Range(position, position),
    });
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      uri,
      position,
    );
    const text = (hovers ?? [])
      .flatMap((hover) =>
        hover.contents.map((content) => (typeof content === "string" ? content : content.value)),
      )
      .join("\n");
    assert.match(text.replaceAll("&nbsp;", " "), /Generated source: current/);
    assert.match(text, /Item_Price_Candy/);
    const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      "vscode.executeCodeActionProvider",
      uri,
      new vscode.Range(position, position),
    );
    assert.ok(
      actions?.some((action) => action.command?.command === "asm.disassembly.inspectOwnership"),
    );
    assert.ok(
      actions?.some((action) => action.command?.command === "asm.disassembly.editOwnedAnnotation"),
    );

    // Rename can reject at prepare or edit time, but must never return a text replacement here.
    let rename: vscode.WorkspaceEdit | undefined;
    try {
      rename = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
        "vscode.executeDocumentRenameProvider",
        uri,
        position,
        "ChangedCandy",
      );
    } catch {
      /* The LSP's actionable ownership error is expected. */
    }
    assert.ok(!rename?.size, "F2 must not return edits for generated labels.");
    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(0, 0), "; unsaved draft\n");
    assert.equal(await vscode.workspace.applyEdit(edit), true);
    const shifted = position.translate(1);
    const dirtyActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      "vscode.executeCodeActionProvider",
      uri,
      new vscode.Range(shifted, shifted),
    );
    assert.ok(
      !dirtyActions?.some(
        (action) => action.command?.command === "asm.disassembly.editOwnedAnnotation",
      ),
    );
    await vscode.commands.executeCommand("workbench.action.files.revert");
    console.log(
      "Ownership host: data-only hover, contextual actions, F2 guard, and dirty-buffer guard passed.",
    );
  } finally {
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    fixture.cleanup();
  }
};
