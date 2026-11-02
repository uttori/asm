import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assertLinkRecipe } from "@uttori/asm-core/linker";
import { sourceGit } from "@uttori/asm-disassembler/source-project";
import * as vscode from "vscode";

import {
  createAsarSourceBuildFixture,
  createLinkedBuildFixture,
} from "../../../tests/fixtures/linked-build.js";
import { SourceProcessClient } from "../src/source/process-client.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The command returns the production editor artifact contract, rather than an imported test implementation. */
async function build(): Promise<Record<string, unknown>> {
  const value: unknown = await vscode.commands.executeCommand("asm.build");
  assert(isRecord(value));
  return value;
}

/** Exercise the real Build Binary command and live publication check in a disposable editor workspace. */
export async function runLinkedBuildSmoke(folder: vscode.WorkspaceFolder): Promise<void> {
  const directory = path.join(folder.uri.fsPath, "linked-project");
  const { original } = createLinkedBuildFixture(directory);
  const settings = vscode.workspace.getConfiguration("asm", folder.uri);
  await settings.update(
    "configFile",
    "linked-project/uttori-asm.config.json",
    vscode.ConfigurationTarget.WorkspaceFolder,
  );
  await settings.update("linkProject", "", vscode.ConfigurationTarget.WorkspaceFolder);
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(path.join(directory, "main.asm")),
  );
  await vscode.window.showTextDocument(document);
  const first = await build();
  assert.equal(first.ok, true, String(first.message));
  assert.equal(typeof first.outputPath, "string");
  assert.deepEqual(fs.readFileSync(String(first.outputPath)), Buffer.from(original));
  assert(fs.existsSync(String(first.debugMapPath)));
  const pointerFile = path.join(directory, "build/current.json");
  const selected = fs.readFileSync(pointerFile);

  const edit = new vscode.WorkspaceEdit();
  edit.insert(document.uri, new vscode.Position(document.lineCount, 0), "; unsaved build input\n");
  assert(await vscode.workspace.applyEdit(edit));
  const rejected = await build();
  assert.equal(rejected.ok, false);
  assert.match(String(rejected.message), /Save changed build input/);
  assert.deepEqual(fs.readFileSync(pointerFile), selected);

  assert(await document.save());
  const saved = await build();
  assert.equal(saved.ok, true, String(saved.message));
  assert.equal(saved.outputChanged, false);
  assert.equal(saved.debugMapChanged, true);
  const repeated = await build();
  assert.equal(repeated.outputChanged, false);
  assert.equal(repeated.debugMapChanged, false);

  // A selected native manifest must fail directly; falling back to assembling the active
  // include would hide the invalid link graph and could launch a partial ROM.
  const recipeFile = path.join(directory, "recipe.json");
  const recipe = fs.readFileSync(recipeFile);
  const parsed: unknown = JSON.parse(recipe.toString());
  assertLinkRecipe(parsed);
  fs.writeFileSync(
    recipeFile,
    JSON.stringify({
      ...parsed,
      regions: parsed.regions.map((region, index) =>
        Object.assign({}, region, { size: index === 0 ? 1 : region.size }),
      ),
    }),
  );
  const previous = fs.readFileSync(pointerFile);
  const failed = await build();
  assert.equal(failed.ok, false);
  assert.deepEqual(fs.readFileSync(pointerFile), previous);
  fs.writeFileSync(recipeFile, recipe);
  console.log(
    "Linked editor Build Binary matches original ROM; drafts and invalid layouts preserve the selected artifacts.",
  );
  const adaptedDirectory = path.join(folder.uri.fsPath, "asar-linked-project");
  const adapted = createAsarSourceBuildFixture(adaptedDirectory);
  await settings.update(
    "configFile",
    "asar-linked-project/uttori-asm.config.json",
    vscode.ConfigurationTarget.WorkspaceFolder,
  );
  const adaptedDocument = await vscode.workspace.openTextDocument(
    vscode.Uri.file(path.join(adaptedDirectory, "main.asm")),
  );
  await vscode.window.showTextDocument(adaptedDocument);
  const adaptedBuild = await build();
  assert.equal(adaptedBuild.ok, true, String(adaptedBuild.message));
  assert.deepEqual(fs.readFileSync(String(adaptedBuild.outputPath)), Buffer.from(adapted.original));
  console.log("Asar source adapter Build Binary matches the complete original ROM in the editor.");
  const extension = vscode.extensions.getExtension("matthewcallis.uttori-asm-vscode");
  assert(extension);
  const client = new SourceProcessClient(
    path.join(extension.extensionPath, "out/source-process.mjs"),
  );
  const migration = path.join(folder.uri.fsPath, "migration-project");
  const originalFile = path.join(folder.uri.fsPath, "migration-original.sfc");
  const rom = Buffer.alloc(0x8000, 0xea);
  rom[0] = 0x60;
  rom.fill(0x20, 0x7fc0, 0x7fd5);
  rom[0x7fd5] = 0x20;
  rom[0x7fd7] = 5;
  rom.set([0xcb, 0xed, 0x34, 0x12], 0x7fdc);
  rom.fill(0, 0x7fe0);
  rom.writeUInt16LE(0x8000, 0x7ffc);
  fs.writeFileSync(originalFile, rom);
  const identity = {
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@localhost",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@localhost",
  };
  const previousIdentity = new Map(Object.keys(identity).map((key) => [key, process.env[key]]));
  Object.assign(process.env, identity);
  try {
    await client.run(
      { action: "init", directory: migration, rom: originalFile, mapper: "lorom" },
      { maxMemoryMiB: 512 },
    );
    await vscode.commands.executeCommand("asm.source.select", migration);
    const prepared: unknown = await vscode.commands.executeCommand("asm.source.migrate");
    assert(isRecord(prepared) && isRecord(prepared.verification) && isRecord(prepared.generation));
    assert(Array.isArray(prepared.verification.checks));
    assert(prepared.verification.checks.includes("object-serialization"));
    assert(prepared.verification.checks.includes("complete-container-equality"));
    const commit = prepared.generation.commit;
    assert(typeof commit === "string");
    const proof = JSON.parse(
      (
        await sourceGit(migration, ["show", `${commit}:source/link-verification.json`])
      ).stdout.toString(),
    );
    assert.equal(proof.outputSha256, proof.originalContainerSha256);
    const preview: unknown = await vscode.commands.executeCommand("asm.source.preview");
    assert(isRecord(preview) && Array.isArray(preview.conflicts));
    assert.deepEqual(preview.conflicts, []);
    assert.match(
      fs.readFileSync(path.join(migration, "source/banks/bank-000.asm"), "utf8"),
      /^org /m,
    );
    await vscode.commands.executeCommand("asm.source.discard");
    console.log(
      "Editor migration command prepares and previews a byte-identical native generation without changing working source.",
    );
  } finally {
    client.dispose();
    for (const [key, value] of previousIdentity) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
