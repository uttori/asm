/** Grow a captured same-bank leaf handler, repair its table entry, and verify full native regenerations. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeSourceOperation } from "@uttori/asm-cli/source";
import { openAnalysisProjectStore, sourceContentHash, sourceGit } from "@uttori/asm-disassembler";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const clone = path.join(application, "experiments/secret-of-mana-git-workflow-full");
assert.equal(JSON.parse(fs.readFileSync(path.join(clone, ".verification/seed.json"))).root, clone);
const parent = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-som-code-"));
const root = path.join(parent, "project");
const branch = `codex/verify-code-relocation-${Date.now()}`;
const bank = "disassembly/banks/bank-008.asm";
const report = { branch, started: new Date().toISOString(), operations: [], success: false };
let added = false;

/** Record phase timings without embedding full assembly proposals in the report. */
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
  const original = fs.readFileSync(path.join(clone, "Secret of Mana (USA).sfc"));
  assert.equal(
    sourceContentHash(original),
    "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f",
  );
  const nearUses = [],
    longUses = [];
  for (let offset = 0; offset < original.length - 2; offset++) {
    if (original.readUIntLE(offset, 3) === 0xc8e2b5) {
      longUses.push(offset);
    }
    if (offset >= 0x80000 && offset < 0x8ffff && original.readUInt16LE(offset) === 0xe2b5) {
      nearUses.push(offset);
    }
  }
  assert.deepEqual(nearUses, [0x8e25f]);
  assert.deepEqual(longUses, []);
  const store = openAnalysisProjectStore(path.join(clone, "disassembly/analysis"));
  try {
    const node = store
      .navigationNodes("snes.cpu", 0xc8e2b5, [])
      .find((candidate) => candidate.address === 0xc8e2b5 && candidate.id.startsWith("runtime:"));
    assert.ok(node);
    assert.deepEqual(
      [node.incomingState.e.value, node.incomingState.m.value, node.incomingState.x.value],
      [0, 1, 0],
    );
    assert.ok(
      node.evidence.includes(
        "runtime:instruction-trace:d650e49a4b69edf68e3a888838679170bb59b62182a77ae7d833e7be670bb2a3",
      ),
    );
    report.entryEvidence = { id: node.id, state: node.incomingState, evidence: node.evidence };
  } finally {
    store.close();
  }
  const baseline = await operation("build", clone);
  const expected = fs.readFileSync(baseline.outputFile);
  report.beforeRom = path.join(clone, ".verification/code-relocation-before.sfc");
  report.beforeSha256 = sourceContentHash(expected);
  fs.writeFileSync(report.beforeRom, expected);
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
  const sourceFile = path.join(root, bank);
  const source = fs.readFileSync(sourceFile, "utf8");
  const body =
    "  LDX.b $85\n  LDA.w (Characters[0].status + $1) & $FFFF,x\n  ORA.b #$20\n  STA.w (Characters[0].status + $1) & $FFFF,x\n  RTS";
  assert.equal(source.split(body).length, 2);
  fs.writeFileSync(
    sourceFile,
    source.replace(
      body,
      `Chest_SetPoisonStatus:\n${body.replace("  RTS", "  NOP\n  RTS")}\nChest_SetPoisonStatus_End:`,
    ),
  );
  const layoutFile = path.join(root, ".uttori/layout.json");
  const layout = JSON.parse(fs.readFileSync(layoutFile, "utf8"));
  layout.objects.push({
    id: "code:chest-status-leaf",
    kind: "code",
    file: bank,
    startSymbol: "Chest_SetPoisonStatus",
    endSymbol: "Chest_SetPoisonStatus_End",
    originalStart: 0x8e2b5,
    originalEnd: 0x8e2c0,
    start: 0x8e2b5,
    length: 11,
    alignment: 1,
    bankSize: 0x10000,
    movable: true,
    referencesComplete: true,
    closedControlFlow: true,
    returnInstruction: "RTS",
  });
  layout.states.push({ offset: 0x8e2b5, e: false, m: true, x: false });
  layout.references.push({
    id: "chest-type-three",
    target: "code:chest-status-leaf",
    offset: 0x8ffc6,
    expected: [0xb5, 0xe2],
    encoding: "bank16",
    bank: 0xc8,
    expression: "$E2B5",
  });
  fs.writeFileSync(layoutFile, JSON.stringify(layout, null, 2) + "\n");
  const result = await operation("relocate", root, { objectId: "code:chest-status-leaf" });
  assert.equal(result.object.start, 0x8ffd4);
  assert.equal(result.object.length, 12);
  expected.set([0xa6, 0x85, 0xbd, 0x91, 0xe1, 0x09, 0x20, 0x9d, 0x91, 0xe1, 0xea, 0x60], 0x8ffd4);
  expected.writeUInt16LE(0xffd4, 0x8ffc6);
  report.expectedSha256 = sourceContentHash(expected);
  assert.equal(result.outputSha256, report.expectedSha256);
  for (const edit of result.edits) {
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
    "Verify captured leaf growth and same-bank table reference repair",
  ]);
  for (let cycle = 0; cycle < 2; cycle++) {
    const generation = await operation("prepare");
    assert.equal(generation.verification.outputSha256, sourceContentHash(original));
    const candidate = generation.generation.commit;
    assert.deepEqual((await operation("preview", root, { candidate })).conflicts, []);
    const applied = await operation("apply", root, { candidate });
    if (applied.phase === "merging") {
      assert.equal((await operation("finish")).phase, "verified");
    } else {
      assert.equal(applied.phase, "verified");
    }
    const current = await operation("build");
    assert.deepEqual(fs.readFileSync(current.outputFile), expected);
  }
  report.afterRom = path.join(clone, ".verification/code-relocation-after.sfc");
  fs.writeFileSync(report.afterRom, expected);
  report.head = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  report.success = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  throw error;
} finally {
  report.finished = new Date().toISOString();
  fs.writeFileSync(
    path.join(clone, ".verification/code-relocation.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  if (added && report.success) {
    assert.equal((await sourceGit(root, ["status", "--porcelain"])).stdout.toString(), "");
    await sourceGit(clone, ["worktree", "remove", "--force", root]);
    fs.rmSync(parent, { recursive: true });
  } else {
    console.log(`Retained verification workspace: ${root}`);
  }
  console.log(JSON.stringify(report, null, 2));
}
