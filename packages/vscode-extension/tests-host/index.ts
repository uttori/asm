import * as assert from "node:assert/strict";

import * as vscode from "vscode";

const EXTENSION_ID = "matthewcallis.uttori-asm-vscode";
const REQUIRED_COMMANDS = [
  "asm.build",
  "asm.outline.refresh",
  "asm.coverage.refresh",
  "asm.analysisGraph.refresh",
  "asm.trace.start",
  "asm.trace.stop",
];

/**
 * Waits until the language client has registered a document-symbol provider.
 * @param {vscode.Uri} uri Open assembly document URI.
 * @returns {Promise<void>} Promise resolved when the provider answers.
 */
async function waitForLanguageServer(uri: vscode.Uri): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
      "vscode.executeDocumentSymbolProvider",
      uri,
    );
    if (Array.isArray(symbols)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Uttori language server did not register within 20 seconds.");
}

/**
 * Executes the minimum end-to-end editor contract in an Extension Development Host.
 *
 * The test activates the packaged entry point, opens a language-associated document, observes an
 * LSP response, invokes read-only analysis-tree commands, and assembles through the registered VS
 * Code command. It does not start an emulator or claim native-runtime portability.
 * @returns {Promise<void>} Promise rejected when any editor, LSP, or build assertion fails.
 */
export async function run(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "Smoke test requires its temporary workspace.");
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `Extension '${EXTENSION_ID}' was not discovered.`);
  await extension.activate();
  assert.equal(extension.isActive, true, "Extension did not activate.");

  const commands = new Set(await vscode.commands.getCommands(true));
  for (const command of REQUIRED_COMMANDS) {
    assert.ok(commands.has(command), `Command '${command}' was not registered.`);
  }

  const sourceUri = vscode.Uri.joinPath(folder.uri, "main.asm");
  const document = await vscode.workspace.openTextDocument(sourceUri);
  await vscode.window.showTextDocument(document);
  assert.equal(document.languageId, "uttori-snes", "Assembly language association is missing.");
  await waitForLanguageServer(sourceUri);

  await vscode.commands.executeCommand("asm.outline.refresh");
  await vscode.commands.executeCommand("asm.coverage.refresh");
  await vscode.commands.executeCommand("asm.analysisGraph.refresh");
  await vscode.commands.executeCommand("asm.build");

  const outputUri = vscode.Uri.joinPath(folder.uri, "main.sfc");
  const output = await vscode.workspace.fs.readFile(outputUri);
  assert.ok(output.length > 0, "VS Code build command produced no ROM bytes.");
}
