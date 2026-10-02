/** Verify full-project semantic naming, with exact bytes and real regeneration in an owned worktree. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeSourceOperation } from "@uttori/asm-cli/source";
import { WorkspaceIndex } from "@uttori/asm-core";
import { sourceContentHash, sourceGit } from "@uttori/asm-disassembler";
import { TextDocumentEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { snesWorkspaceIndexOptions } from "../../../../tests/test-assembler.js";
import { pathToUri, uriToPath } from "../../../language-server/src/providers.ts";
import { researchRenameEditsFor } from "../../../language-server/src/research-rename.ts";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const clone = path.join(application, "experiments/secret-of-mana-git-workflow-full");
assert.equal(JSON.parse(fs.readFileSync(path.join(clone, ".verification/seed.json"))).root, clone);
const parent = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-som-recipe-"));
const root = path.join(parent, "project");
const branch = `codex/verify-recipe-renames-${Date.now()}`;
const report = { branch, root, started: new Date().toISOString(), operations: [], success: false };
let added = false;

/** Resolve only the three reviewed overlaps with the clone's pre-existing moved/edited chest table. */
function resolveKnownTableConflicts(file, text) {
  let count = 0;
  const resolved = text.replace(
    /^<{7} .*\n([\S\s]*?)^={7}\n([\S\s]*?)^>{7} .*\n/gm,
    (_whole, current, incoming) => {
      count++;
      if (file.endsWith("bank-008.asm")) {
        if (count === 1) {
          assert.equal(current, "    pointerOffset = $E26C\n");
          assert.equal(incoming, "    pointerOffset = $E26B\n");
        } else {
          assert.equal(current, "  }\n  [9] = {\n    pointerOffset = $E26C\n");
          assert.equal(incoming, "");
        }
        return current;
      }
      assert.ok(file.endsWith("structs.asm"));
      // Keep the already verified allocation/count and adopt the incoming type's
      // descriptive name. No other declaration difference is accepted by this fixture.
      assert.equal(
        incoming,
        current
          .replace("; BankPointer;", "; BankOffsetEntry;")
          .replace("$C8FFC0", "$C8E259")
          .replace("endstruct count 10", "endstruct count 9"),
      );
      return current.replace("; BankPointer;", "; BankOffsetEntry;");
    },
  );
  assert.equal(count, file.endsWith("bank-008.asm") ? 2 : 1);
  assert.doesNotMatch(resolved, /^(?:<<<<<<<|=======|>>>>>>>)/m);
  return resolved;
}
/** Keep phase timing and identities; exact editable source is retained by Git. */
async function operation(action, directory = root, values = {}) {
  const started = performance.now();
  const result = await executeSourceOperation({
    action,
    directory,
    ...values,
    onProgress: (message) => console.log(`${action}: ${message}`),
  });
  report.operations.push({ action, elapsedMs: performance.now() - started });
  return result;
}
try {
  const baseline = await operation("build", clone);
  const expected = fs.readFileSync(baseline.outputFile);
  assert.equal(
    sourceContentHash(expected),
    "6abc48cc519de82d50edc730ba9ad32bdadc1e26e62f7420c3b75ea7eb033622",
  );
  report.expectedSha256 = sourceContentHash(expected);
  report.base = (await sourceGit(clone, ["rev-parse", "HEAD"])).stdout.toString().trim();
  await sourceGit(clone, ["worktree", "add", "-b", branch, root, report.base]);
  added = true;
  fs.mkdirSync(path.join(root, "node_modules"));
  fs.symlinkSync(
    path.join(application, "node_modules/@uttori"),
    path.join(root, "node_modules/@uttori"),
    "dir",
  );
  fs.mkdirSync(path.join(root, ".uttori-local"));
  fs.writeFileSync(
    path.join(root, ".uttori-local/project.json"),
    JSON.stringify({
      format: "uttori-source-local",
      version: 1,
      rom: path.join(clone, "Secret of Mana (USA).sfc"),
      evidence: path.join(clone, "disassembly/analysis"),
    }),
  );
  const files = JSON.parse(fs.readFileSync(baseline.debugMapFile, "utf8"))
    .sources.map((item) => item.path)
    .filter((file) => file.endsWith(".asm"));
  const index = new WorkspaceIndex(snesWorkspaceIndexOptions());
  for (const file of files) {
    index.openDocument(path.join(root, file), fs.readFileSync(path.join(root, file), "utf8"));
  }
  const changes = new Set();
  for (const [file, container, oldName, newName] of [
    ["ram-defines.asm", "", "RAM_PARTY_STAT_INDEX_WORK", "PartyStatIndex"],
    ["structs.asm", "", "LZ_COPY_TOKEN_FLAG", "LZ_BACK_REFERENCE_FLAG"],
    ["structs.asm", "BankPointer", "offset", "pointerOffset"],
    ["structs.asm", "", "BankPointer", "BankOffsetEntry"],
  ]) {
    const started = performance.now();
    const symbol = index
      .getAllSymbols()
      .find(
        (item) =>
          item.location.file === path.join(root, "disassembly", file) &&
          item.name === oldName &&
          (item.containerName ?? "") === container,
      );
    assert.ok(symbol, `Missing rename declaration ${container}.${oldName}`);
    const source = fs.readFileSync(symbol.location.file, "utf8");
    const line = source.split("\n")[symbol.location.line];
    const edit = await researchRenameEditsFor(
      index,
      symbol.location.file,
      { line: symbol.location.line, character: line.indexOf(oldName) + 1 },
      newName,
      [],
    );
    assert.ok(edit?.documentChanges?.length);
    for (const item of edit.documentChanges) {
      assert.ok(TextDocumentEdit.is(item));
      const changed = uriToPath(item.textDocument.uri);
      assert.ok(changed.startsWith(root + path.sep));
      const document = TextDocument.create(
        pathToUri(changed),
        "plaintext",
        1,
        fs.readFileSync(changed, "utf8"),
      );
      const after = TextDocument.applyEdits(document, item.edits);
      fs.writeFileSync(changed, after);
      if (changed.endsWith(".asm")) {
        index.updateDocument(changed, after);
      }
      changes.add(path.relative(root, changed));
    }
    index.reindex();
    report.operations.push({
      action: "rename",
      oldName,
      newName,
      elapsedMs: performance.now() - started,
    });
  }
  const built = await operation("build");
  assert.deepEqual(fs.readFileSync(built.outputFile), expected);
  report.changedFiles = [...changes].toSorted();
  await sourceGit(root, ["add", "--all"]);
  await sourceGit(root, [
    "commit",
    "-m",
    "Verify persistent RAM, constant, shared field and type renames",
  ]);
  for (let cycle = 0; cycle < 2; cycle++) {
    const generation = await operation("prepare");
    assert.equal(
      generation.verification.outputSha256,
      "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f",
    );
    const candidate = generation.generation.commit;
    const preview = await operation("preview", root, { candidate });
    const expectedConflicts =
      cycle === 0 ? ["disassembly/banks/bank-008.asm", "disassembly/structs.asm"] : [];
    assert.deepEqual(preview.conflicts, expectedConflicts);
    const applied = await operation("apply", root, { candidate });
    for (const file of expectedConflicts) {
      const absolute = path.join(root, file);
      fs.writeFileSync(
        absolute,
        resolveKnownTableConflicts(file, fs.readFileSync(absolute, "utf8")),
      );
      await sourceGit(root, ["add", "--", file]);
    }
    report.operations.push({
      action: "reviewed-conflict-resolution",
      cycle,
      paths: expectedConflicts,
    });
    if (applied.phase === "merging") {
      assert.equal((await operation("finish")).phase, "verified");
    } else {
      assert.equal(applied.phase, "verified");
    }
    assert.deepEqual(fs.readFileSync((await operation("build")).outputFile), expected);
  }
  assert.equal((await sourceGit(root, ["status", "--porcelain"])).stdout.length, 0);
  report.head = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  report.success = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  throw error;
} finally {
  report.finished = new Date().toISOString();
  fs.writeFileSync(
    path.join(clone, ".verification/recipe-renames.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  if (added && report.success) {
    await sourceGit(clone, ["worktree", "remove", "--force", root]);
    fs.rmSync(parent, { recursive: true });
  } else {
    console.log(`Retained verification workspace: ${root}`);
  }
  console.log(JSON.stringify(report, null, 2));
}
