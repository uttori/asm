import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { validateDebugMap, type DebugMap } from "@uttori/asm-core";
import {
  createRomModificationProject,
  addRomReplacement,
  extractRomAsset,
  type ModifiedRomBuild,
} from "@uttori/asm-plugin-snes";
import * as vscode from "vscode";

import { ownershipFixture } from "../../../tests/helpers/ownership-fixture.js";

/** Exercise the registered generic Build command through the real modification worker process.
 * @param {vscode.WorkspaceFolder} folder Temporary smoke workspace owning test settings.
 * @returns {Promise<void>} Completes after validating command routing and emitted source provenance.
 */
export const runModificationSmoke = async (folder: vscode.WorkspaceFolder): Promise<void> => {
  const fixture = ownershipFixture(folder.uri.fsPath);
  const configuration = vscode.workspace.getConfiguration("asm");
  const previousTarget = configuration.inspect("buildTarget")?.workspaceValue;
  const previousProject = configuration.inspect("modificationProject")?.workspaceValue;
  try {
    const manifestFile = await createRomModificationProject({
      sourceDirectory: fixture.sourceDirectory,
      romFile: fixture.romFile,
      directory: path.join(fixture.directory, "modifications"),
    });
    const input = addRomReplacement({
      manifestFile,
      id: "price",
      offset: 0x40,
      size: 2,
      kind: "assembly",
      value: 20,
    });
    addRomReplacement({ manifestFile, id: "palette", offset: 0x100, size: 4, kind: "binary" });
    const asset = await extractRomAsset({
      manifestFile,
      id: "palette",
      format: "snes.palette.bgr555",
    });
    const model = JSON.parse(fs.readFileSync(asset, "utf8")) as { colors: { red: number }[] };
    model.colors[0].red = 0;
    fs.writeFileSync(asset, JSON.stringify(model));
    await configuration.update(
      "modificationProject",
      manifestFile,
      vscode.ConfigurationTarget.Workspace,
    );
    await configuration.update("buildTarget", "modified", vscode.ConfigurationTarget.Workspace);
    await vscode.window.showTextDocument(vscode.Uri.file(input));
    const result = await vscode.commands.executeCommand<ModifiedRomBuild>("asm.build");
    assert.equal(result?.ok, true);
    assert.equal(fs.readFileSync(result!.outputPath).readUInt16LE(0x40), 20);
    assert.equal(
      fs.readFileSync(result!.outputPath)[0x100] & 31,
      0,
      "Owned asset reencodes through the maintenance worker.",
    );
    const map = JSON.parse(fs.readFileSync(result!.debugMapPath, "utf8")) as DebugMap;
    assert.deepEqual(validateDebugMap(map, fs.readFileSync(result!.outputPath)), []);
    assert.ok(map.sources.some((entry) => entry.path === input));
    await vscode.commands.executeCommand("asm.toggleWatch");
    try {
      fs.writeFileSync(input, "dw 22\n");
      const deadline = Date.now() + 20000;
      const current = path.join(path.dirname(manifestFile), "build/current.json");
      let watched: ModifiedRomBuild = result!;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        watched = JSON.parse(fs.readFileSync(current, "utf8")) as ModifiedRomBuild;
        if (watched.outputSha256 !== result!.outputSha256) {
          break;
        }
      }
      assert.notEqual(
        watched.outputSha256,
        result!.outputSha256,
        "External owned input edits trigger the selected watch target.",
      );
      assert.equal(fs.readFileSync(watched.outputPath).readUInt16LE(0x40), 22);
    } finally {
      await vscode.commands.executeCommand("asm.toggleWatch");
    }
    console.log(
      "Modification host: generic Build selected the modified target, worker verified bounded output and matching source map.",
    );
  } finally {
    await configuration.update("buildTarget", previousTarget, vscode.ConfigurationTarget.Workspace);
    await configuration.update(
      "modificationProject",
      previousProject,
      vscode.ConfigurationTarget.Workspace,
    );
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    fixture.cleanup();
  }
};
