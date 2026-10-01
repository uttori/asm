/** Compare full pure generation and edited builds using the original and rebuilt evidence stores. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeSourceOperation } from "@uttori/asm-cli/source";
import {
  openSourceProject,
  sourceGit,
  verifySourceGeneration,
  SOURCE_INPUT_SNAPSHOT_FILE,
} from "@uttori/asm-disassembler";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const clone = path.join(application, "experiments/secret-of-mana-git-workflow-full");
const rebuilt = path.join(clone, ".verification/rebuild-evidence");
assert.equal(JSON.parse(fs.readFileSync(path.join(rebuilt, "rebuild.json"))).success, true);
const temporary = fs.mkdtempSync(path.join(clone, ".verification/database-generation-"));
const directory = path.join(temporary, "source");
const reportFile = path.join(rebuilt, "generation.json");
assert.equal(fs.existsSync(reportFile), false, "Preserve earlier generation results.");
const report = { started: new Date().toISOString(), directory, results: [] };
await sourceGit(clone, ["worktree", "add", "--detach", directory, "HEAD"]);
try {
  fs.mkdirSync(path.join(directory, ".uttori-local"));
  const baselineStatus = (await sourceGit(directory, ["status", "--porcelain"])).stdout;
  const payloads = [];
  for (const [label, evidence] of [
    ["original", path.join(clone, "disassembly/analysis")],
    ["rebuilt", rebuilt],
  ]) {
    fs.writeFileSync(
      path.join(directory, ".uttori-local/project.json"),
      JSON.stringify({
        format: "uttori-source-local",
        version: 1,
        rom: path.join(clone, "Secret of Mana (USA).sfc"),
        evidence,
      }),
    );
    const start = performance.now();
    const prepared = await executeSourceOperation({
      directory,
      action: "prepare",
      onProgress: console.log,
    });
    assert.equal(
      prepared.verification.outputSha256,
      "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f",
    );
    const project = await openSourceProject(directory);
    const generation = await verifySourceGeneration(project.repository, prepared.generation.commit);
    // Rebuilding an index publishes a new evidence revision. Only its retained input receipt should
    // change; source and assets generated from identical semantic records must remain byte-identical.
    payloads.push(generation.files.filter((file) => file.path !== SOURCE_INPUT_SNAPSHOT_FILE));
    const build = await executeSourceOperation({ directory, action: "build" });
    assert.equal(
      build.verification.outputSha256,
      "6abc48cc519de82d50edc730ba9ad32bdadc1e26e62f7420c3b75ea7eb033622",
    );
    assert.deepEqual(
      (await sourceGit(directory, ["status", "--porcelain"])).stdout,
      baselineStatus,
    );
    report.results.push({
      label,
      evidence,
      generation: prepared.generation,
      files: prepared.files,
      codeBytes: prepared.codeBytes,
      originalRomSha256: prepared.verification.outputSha256,
      editedRomSha256: build.verification.outputSha256,
      elapsedMs: performance.now() - start,
    });
    // Retain exact proofs through explicit verification branches before releasing local candidate pins.
    await sourceGit(directory, [
      "update-ref",
      `refs/heads/codex/database-${label}-${path.basename(temporary)}`,
      prepared.generation.commit,
      "0".repeat(40),
    ]);
    await executeSourceOperation({
      directory,
      action: "discard",
      candidate: prepared.generation.commit,
    });
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
  }
  assert.deepEqual(payloads[1], payloads[0]);
  report.equalGeneratedFiles = payloads[0].length;
  report.success = true;
} finally {
  report.finished = new Date().toISOString();
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
  await sourceGit(clone, ["worktree", "remove", "--force", directory]);
}
