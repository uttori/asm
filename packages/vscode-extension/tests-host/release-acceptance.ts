import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  loadAnalysisProjectViewSnapshot,
  loadSourceExportManifest,
} from "@uttori/asm-disassembler";
import { initializeSnesDisassemblyWorkspace } from "@uttori/asm-plugin-snes";
import * as vscode from "vscode";

import { AnalysisWorkerClient } from "../src/analysis/worker-client.js";
import type { AnnotationSaveResult } from "../src/disassembly/annotation-data.js";
import { DisassemblyMaintenanceClient } from "../src/disassembly/maintenance-client.js";

/** Poll provider registration and asynchronous diagnostics without imposing a startup-speed claim. */
async function eventually(
  check: () => boolean | Promise<boolean>,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

/** Flatten the API's Markdown variants for assertions on visible hover documentation. */
function hoverText(hovers: readonly vscode.Hover[]): string {
  return hovers
    .flatMap((hover) =>
      hover.contents.map((content) => (typeof content === "string" ? content : content.value)),
    )
    .join("\n");
}

/** Exercise registered language providers and restore source after each editable operation. */
async function languageFeatures(folder: vscode.WorkspaceFolder): Promise<void> {
  const uri = vscode.Uri.joinPath(folder.uri, "features.asm");
  const source = "lorom\norg $008000\nEntry:\n  lda #$01\n  bra Entry\n";
  fs.writeFileSync(uri.fsPath, source);
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
  await eventually(async () => {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      uri,
    );
    return symbols?.some((symbol) => symbol.name === "Entry") ?? false;
  }, "assembly symbols");
  const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
    "vscode.executeCompletionItemProvider",
    uri,
    new vscode.Position(3, 4),
  );
  assert.ok(completions?.items.length, "Instruction completion is empty.");
  const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
    "vscode.executeHoverProvider",
    uri,
    new vscode.Position(3, 3),
  );
  assert.match(hoverText(hovers ?? []), /lda|accumulator/i);
  const definitions = await vscode.commands.executeCommand<readonly unknown[]>(
    "vscode.executeDefinitionProvider",
    uri,
    new vscode.Position(4, 7),
  );
  assert.ok(definitions?.length, "Label definition is missing.");
  const references = await vscode.commands.executeCommand<readonly unknown[]>(
    "vscode.executeReferenceProvider",
    uri,
    new vscode.Position(2, 2),
  );
  assert.ok(references?.length, "Label references are missing.");
  const rename = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
    "vscode.executeDocumentRenameProvider",
    uri,
    new vscode.Position(2, 2),
    "RenamedEntry",
  );
  assert.ok(rename?.size, "Rename returned no edits.");
  assert.equal(await vscode.workspace.applyEdit(rename), true);
  assert.match(document.getText(), /bra renamedentry/i);
  const formatted = await vscode.commands.executeCommand<vscode.TextEdit[]>(
    "vscode.executeFormatDocumentProvider",
    uri,
    { tabSize: 2, insertSpaces: true },
  );
  assert.equal(formatted, undefined, "The current server does not advertise a formatter.");
  const replace = async (text: string): Promise<void> => {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      uri,
      new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
      text,
    );
    assert.equal(await vscode.workspace.applyEdit(edit), true);
    await document.save();
  };
  await replace('lorom\norg $008000\nincsrc "missing-release-file.asm"\n');
  await eventually(
    () =>
      vscode.languages
        .getDiagnostics(uri)
        .some((item) => item.severity === vscode.DiagnosticSeverity.Error),
    "invalid-source diagnostic",
  );
  await replace(source);
  await eventually(
    () =>
      !vscode.languages
        .getDiagnostics(uri)
        .some((item) => item.severity === vscode.DiagnosticSeverity.Error),
    "diagnostic recovery",
  );
  const configuration = vscode.workspace.getConfiguration("asm", uri);
  try {
    await configuration.update(
      "buildOutput",
      "reconfigured.sfc",
      vscode.ConfigurationTarget.Workspace,
    );
    await vscode.commands.executeCommand("asm.build");
    assert.ok(
      fs.existsSync(path.join(folder.uri.fsPath, "reconfigured.sfc")),
      "Configuration reload did not change the build destination.",
    );
  } finally {
    await configuration.update("buildOutput", undefined, vscode.ConfigurationTarget.Workspace);
  }

  const consumer = vscode.Uri.joinPath(folder.uri, "consumer.mts");
  fs.writeFileSync(
    consumer.fsPath,
    'import { Assembler } from "@uttori/asm-core";\nconst assembler = new Assembler();\nassembler.setIncludePaths([]);\n',
  );
  const typescript = await vscode.workspace.openTextDocument(consumer);
  await vscode.window.showTextDocument(typescript);
  await eventually(async () => {
    const result = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      consumer,
      new vscode.Position(2, 17),
    );
    return /Retains the array without copying/.test(hoverText(result ?? []));
  }, "installed declaration JSDoc hover");
  assert.equal(
    fs.lstatSync(path.join(folder.uri.fsPath, "node_modules/@uttori/asm-core")).isSymbolicLink(),
    false,
  );
  console.log(
    "Installed language providers: symbols, completion, hover, navigation, references, rename, diagnostics, and package JSDoc passed. Formatting is unsupported.",
  );
}

/** Run installed workers and registered regeneration against a synthetic ROM and persistent edit. */
async function analysisWorkflow(
  extension: vscode.Extension<unknown>,
  folder: vscode.WorkspaceFolder,
): Promise<void> {
  const sourceDirectory = path.join(folder.uri.fsPath, "generated");
  const romFile = path.join(folder.uri.fsPath, "synthetic.sfc");
  const bytes = new Uint8Array(0x8000).fill(0xea);
  bytes.set([0xea, 0xea, 0xdb]);
  bytes.fill(0x20, 0x7fc0, 0x7fd5);
  bytes.set(new TextEncoder().encode("RELEASE ACCEPTANCE"), 0x7fc0);
  bytes[0x7fd5] = 0x20;
  bytes[0x7fd7] = 5;
  bytes.set([0xcb, 0xed, 0x34, 0x12], 0x7fdc);
  bytes.fill(0, 0x7fe0);
  bytes.set([0, 0x80], 0x7ffc);
  fs.writeFileSync(romFile, bytes);
  await initializeSnesDisassemblyWorkspace({
    romFile,
    outputDirectory: sourceDirectory,
    mapper: "lorom",
  });
  const projectDirectory = path.join(sourceDirectory, "analysis");
  const target = {
    romFile,
    sourceDirectory,
    projectDirectory,
    sourceManifest: loadSourceExportManifest(sourceDirectory),
  };
  const worker = new AnalysisWorkerClient(
    path.join(extension.extensionPath, "out/analysis-worker.cjs"),
  );
  const maintenance = new DisassemblyMaintenanceClient(
    path.join(extension.extensionPath, "out/disassembly-maintenance-process.cjs"),
  );
  try {
    const saved = await worker.request<AnnotationSaveResult>(projectDirectory, "annotationSave", {
      annotationSave: {
        revision: loadAnalysisProjectViewSnapshot(projectDirectory).revision,
        sourceDirectory,
        request: {
          addressSpace: "snes.cpu",
          address: 0x8000,
          labelId: "release.entry",
          name: "ReleaseEntry",
          comment: "Persistent release annotation",
          evidenceId: "release.annotation",
          sourceId: "release-test",
        },
      },
    });
    await vscode.commands.executeCommand("asm.disassembly.regenerate", {
      ...target,
      annotationRefresh: saved.refresh,
    });
    const exported = loadSourceExportManifest(sourceDirectory);
    assert.equal(exported.sourceProjectSha256, saved.refresh.after);
    const sources = exported.files.filter((file) => file.path.endsWith(".asm"));
    assert.ok(
      sources.some((file) =>
        fs.readFileSync(path.join(sourceDirectory, file.path), "utf8").includes("ReleaseEntry"),
      ),
    );
    assert.equal(
      (
        await maintenance.run(
          "verify",
          { ...target, sourceManifest: exported },
          { maxMemoryMiB: 256 },
        )
      ).comparison.equal,
      true,
    );
    const cancellation = new AbortController();
    cancellation.abort(new Error("release cancellation"));
    await assert.rejects(
      maintenance.run("coverage", target, { signal: cancellation.signal, maxMemoryMiB: 256 }),
    );
    assert.equal(
      (
        await maintenance.run(
          "verify",
          { ...target, sourceManifest: exported },
          { maxMemoryMiB: 256 },
        )
      ).comparison.equal,
      true,
    );
    const corrupt = path.join(folder.uri.fsPath, "corrupt-analysis");
    fs.mkdirSync(corrupt);
    fs.writeFileSync(path.join(corrupt, "analysis.json"), "{invalid");
    await assert.rejects(worker.request(corrupt, "manifest"));
    await worker.request(projectDirectory, "manifest");
    worker.dispose();
    await worker.request(projectDirectory, "manifest");
    const edited = path.join(sourceDirectory, sources[0].path);
    const content = fs.readFileSync(edited, "utf8") + "\n; preserved user edit\n";
    fs.writeFileSync(edited, content);
    await vscode.commands.executeCommand("asm.disassembly.regenerate", target);
    assert.equal(fs.readFileSync(edited, "utf8"), content, "Regeneration overwrote a user edit.");
    fs.writeFileSync(
      path.join(folder.uri.fsPath, "release-reopen.json"),
      JSON.stringify({ edited, content }),
    );
    console.log(
      "Installed analysis: annotation, regeneration, byte-identical rebuild, cancellation, corrupt input, worker restart, and edit preservation passed.",
    );
  } finally {
    worker.dispose();
    maintenance.dispose();
  }
}

/**
 * Check the production extension in its installed, reopened, or restricted-profile phase.
 * Every fixture belongs to the launcher's disposable workspace.
 */
export async function runReleaseAcceptance(
  extension: vscode.Extension<unknown>,
  folder: vscode.WorkspaceFolder,
): Promise<void> {
  const installedRoot = process.env.UTTORI_VSCODE_INSTALLED_ROOT;
  assert.ok(
    installedRoot && extension.extensionPath.startsWith(installedRoot + path.sep),
    "Tests must load the installed VSIX, not the source checkout.",
  );
  const phase = process.env.UTTORI_VSCODE_RELEASE_PHASE;
  if (phase === "restricted") {
    assert.equal(
      vscode.workspace.isTrusted,
      false,
      "Restricted smoke must enable Workspace Trust.",
    );
    const output = path.join(folder.uri.fsPath, "main.sfc");
    // Replace the prior output so the test proves bundled assembly still works without trust.
    const expected = fs.readFileSync(output);
    fs.writeFileSync(output, "Restricted build must replace this sentinel.");
    const doc = await vscode.workspace.openTextDocument(
      vscode.Uri.joinPath(folder.uri, "main.asm"),
    );
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand("asm.build");
    assert.deepEqual(
      fs.readFileSync(output),
      expected,
      "Restricted build did not use bundled assembly.",
    );
    assert.equal(fs.existsSync(path.join(folder.uri.fsPath, "plugin-executed")), false);
    console.log(
      "Installed restricted workspace: built-in assembly works and workspace plugins remain blocked.",
    );
    return;
  }
  assert.equal(vscode.workspace.isTrusted, true);
  if (phase === "reopen") {
    const saved = JSON.parse(
      fs.readFileSync(path.join(folder.uri.fsPath, "release-reopen.json"), "utf8"),
    ) as { edited: string; content: string };
    assert.equal(fs.readFileSync(saved.edited, "utf8"), saved.content);
    const doc = await vscode.workspace.openTextDocument(
      vscode.Uri.joinPath(folder.uri, "main.asm"),
    );
    await vscode.window.showTextDocument(doc);
    await vscode.commands.executeCommand("asm.build");
    console.log(
      "Installed extension reopened after shutdown, rebuilt source, and retained user edits.",
    );
    return;
  }
  await languageFeatures(folder);
  await analysisWorkflow(extension, folder);
  const second = path.join(folder.uri.fsPath, "second-folder");
  fs.mkdirSync(second);
  fs.writeFileSync(path.join(second, "second.asm"), "lorom\norg $008000\nSecondEntry:\n nop\n");
  assert.equal(
    vscode.workspace.updateWorkspaceFolders(1, 0, { uri: vscode.Uri.file(second), name: "second" }),
    true,
  );
  await eventually(
    () => vscode.workspace.workspaceFolders?.length === 2,
    "second workspace folder",
  );
  const secondUri = vscode.Uri.file(path.join(second, "second.asm"));
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(secondUri));
  await eventually(async () => {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      secondUri,
    );
    return symbols?.some((symbol) => symbol.name === "SecondEntry") ?? false;
  }, "second-folder symbols");
  console.log("Installed extension handles documents in multiple workspace folders.");
}
