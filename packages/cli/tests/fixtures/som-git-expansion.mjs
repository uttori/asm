/** Rehearse full-ROM expansion in an owned worktree of the independent Secret of Mana clone. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sourceContentHash, sourceGit } from "@uttori/asm-disassembler/source-project";
import { executeSourceOperation } from "@uttori/asm-workflows/source";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const clone = path.join(application, "experiments/secret-of-mana-git-workflow-full");
const seed = JSON.parse(fs.readFileSync(path.join(clone, ".verification/seed.json"), "utf8"));
assert.equal(seed.root, clone);
const parent = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-som-expansion-"));
const root = path.join(parent, "project");
const branch = `codex/verify-expansion-${Date.now()}`;
const report = { branch, started: new Date().toISOString(), operations: [], success: false };
let added = false;

/** Keep compact evidence; source proposals stay in ordinary Git history rather than a second file backup. */
async function operation(action, directory = root, values = {}) {
  const start = performance.now();
  const result = await executeSourceOperation({
    action,
    directory,
    ...values,
    onProgress: (message) => console.log(`${action}: ${message}`),
  });
  report.operations.push({ action, elapsedMs: performance.now() - start });
  return result;
}

try {
  report.base = (await sourceGit(clone, ["rev-parse", "HEAD"])).stdout.toString().trim();
  const baseline = await operation("build", clone);
  const original = fs.readFileSync(path.join(clone, "Secret of Mana (USA).sfc"));
  assert.equal(original.length, 0x200000);
  assert.equal(
    sourceContentHash(original),
    "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f",
  );
  const expected = Buffer.alloc(0x400000, 0xff);
  expected.set(fs.readFileSync(baseline.outputFile));
  expected[0xffd7] = 0x0c;
  expected.writeUInt32LE(0xffff, 0xffdc);
  let checksum = 0;
  for (const byte of expected) {
    checksum = (checksum + byte) % 65536;
  }
  expected.writeUInt16LE(checksum ^ 0xffff, 0xffdc);
  expected.writeUInt16LE(checksum, 0xffde);
  report.expectedSha256 = sourceContentHash(expected);
  await sourceGit(clone, ["worktree", "add", "-b", branch, root, report.base]);
  added = true;
  fs.mkdirSync(path.join(root, ".uttori-local"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules"));
  fs.symlinkSync(
    path.join(application, "node_modules/@uttori"),
    path.join(root, "node_modules/@uttori"),
    "dir",
  );
  fs.writeFileSync(
    path.join(root, ".uttori-local/project.json"),
    JSON.stringify({
      format: "uttori-source-local",
      version: 1,
      evidence: path.join(clone, "disassembly/analysis"),
      rom: path.join(clone, "Secret of Mana (USA).sfc"),
    }),
  );
  const expansion = await operation("expand", root, { expansionSize: 0x400000 });
  assert.equal(expansion.outputSha256, report.expectedSha256);
  assert.equal(expansion.freeSpace.filter((pool) => pool.id.startsWith("expansion:")).length, 32);
  report.editedFiles = expansion.edits.map((edit) => edit.path);
  for (const edit of expansion.edits) {
    const file = path.join(root, edit.path);
    assert.equal(sourceContentHash(fs.readFileSync(file)), edit.beforeSha256);
    fs.writeFileSync(file, edit.after);
  }
  const built = await operation("build");
  assert.deepEqual(fs.readFileSync(built.outputFile), expected);
  await sourceGit(root, ["add", "--all"]);
  await sourceGit(root, [
    "commit",
    "-m",
    "Verify explicit 4 MiB expansion in full Secret of Mana source",
  ]);
  for (let cycle = 0; cycle < 2; cycle++) {
    const researchRoot = path.join(root, ".uttori/research");
    const declaration = fs
      .readdirSync(researchRoot, { recursive: true })
      .map((file) => path.join(researchRoot, file))
      .filter((file) => file.endsWith(".json"))
      .map((file) => ({ file, value: JSON.parse(fs.readFileSync(file, "utf8")) }))
      .find(({ value }) =>
        value.decisions?.some((decision) => decision.collection === "labels" && decision.value),
      );
    assert.ok(declaration);
    const label = declaration.value.decisions.find(
      (decision) => decision.collection === "labels" && decision.value,
    ).value;
    label.aliases = [...(label.aliases ?? []), `GitExpansionCycle${cycle + 1}`];
    fs.writeFileSync(declaration.file, JSON.stringify(declaration.value, null, 2) + "\n");
    await sourceGit(root, ["add", "--all"]);
    await sourceGit(root, [
      "commit",
      "-m",
      `Verify expansion with changed research inputs ${cycle + 1}`,
    ]);
    const generation = await operation("prepare");
    assert.equal(generation.verification.outputSha256, sourceContentHash(original));
    const candidate = generation.generation.commit;
    const preview = await operation("preview", root, { candidate });
    assert.deepEqual(preview.conflicts, []);
    const applied = await operation("apply", root, { candidate });
    if (applied.phase === "merging") {
      const finished = await operation("finish");
      assert.equal(finished.phase, "verified");
    } else {
      assert.equal(applied.phase, "verified");
    }
    const current = await operation("build");
    assert.deepEqual(fs.readFileSync(current.outputFile), expected);
  }
  assert.equal((await sourceGit(root, ["status", "--porcelain"])).stdout.toString(), "");
  report.head = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  report.afterRom = path.join(clone, ".verification/expansion-after.sfc");
  fs.writeFileSync(report.afterRom, expected);
  report.success = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  throw error;
} finally {
  report.finished = new Date().toISOString();
  fs.writeFileSync(
    path.join(clone, ".verification/expansion.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  // Failed work remains inspectable. Successful evidence is committed on the retained test branch;
  // only this fixture's clean worktree and ignored rebuildable outputs are removed.
  if (added && report.success) {
    await sourceGit(clone, ["worktree", "remove", "--force", root]);
    fs.rmSync(parent, { recursive: true });
  } else {
    console.log(`Retained verification workspace: ${root}`);
  }
  console.log(JSON.stringify(report, null, 2));
}
