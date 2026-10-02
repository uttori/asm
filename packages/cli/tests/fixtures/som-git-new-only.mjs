/** Verify retained full-project edit oracles using only the final Git implementation. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { executeSourceOperation } from "@uttori/asm-cli/source";
import { sourceGit } from "@uttori/asm-disassembler";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const clone = path.join(application, "experiments/secret-of-mana-git-workflow-full");
const evidence = path.join(clone, ".verification");
const temporary = fs.mkdtempSync(path.join(evidence, "new-only-"));
const reportFile = path.join(temporary, "report.json");
const original = "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f";
const cases = [
  { name: "baseline", head: "79c88fc", expectedSha256: original },
  {
    name: "instructions-labels-table-palette-raw",
    head: "4a598e1",
    expectedSha256: "6abc48cc519de82d50edc730ba9ad32bdadc1e26e62f7420c3b75ea7eb033622",
  },
  ...["code-relocation", "expansion", "compressed-relocation", "authored-assets"].map((name) =>
    Object.assign({ name }, JSON.parse(fs.readFileSync(path.join(evidence, name + ".json")))),
  ),
];
const report = { started: new Date().toISOString(), results: [] };
const selected = process.argv.slice(2);
for (const item of cases.filter((entry) => !selected.length || selected.includes(entry.name))) {
  const directory = path.join(temporary, item.name);
  const branch = `codex/${path.basename(temporary)}-${item.name}`;
  await sourceGit(clone, ["worktree", "add", "-b", branch, directory, item.head]);
  fs.mkdirSync(path.join(directory, ".uttori-local"), { recursive: true });
  fs.writeFileSync(
    path.join(directory, ".uttori-local/project.json"),
    JSON.stringify({
      format: "uttori-source-local",
      version: 1,
      rom: path.join(clone, "Secret of Mana (USA).sfc"),
      evidence: path.join(clone, "disassembly/analysis"),
    }),
  );
  await executeSourceOperation({ directory, action: "catalog" });
  if ((await sourceGit(directory, ["status", "--porcelain"])).stdout.length) {
    await sourceGit(directory, ["add", ".uttori/captures.json"]);
    await sourceGit(directory, [
      "commit",
      "-m",
      "Record retained evidence identities for final verification",
    ]);
  }
  const result = {
    name: item.name,
    branch,
    source: item.head,
    expectedSha256: item.expectedSha256,
    cycles: [],
  };
  report.results.push(result);
  try {
    for (let cycle = 0; cycle < 3; cycle++) {
      console.log(`${item.name}: generation ${cycle + 1}`);
      const prepared = await executeSourceOperation({ directory, action: "prepare" });
      assert.equal(prepared.verification.outputSha256, original);
      const operation = { directory, candidate: prepared.generation.commit };
      const preview = await executeSourceOperation({ ...operation, action: "preview" });
      assert.deepEqual(preview.conflicts, []);
      const applied = await executeSourceOperation({ ...operation, action: "apply" });
      if (["merging", "committed"].includes(applied.phase)) {
        await executeSourceOperation({ directory, action: "finish" });
      }
      const built = await executeSourceOperation({ directory, action: "build" });
      assert.equal(built.verification.outputSha256, item.expectedSha256);
      assert.equal((await sourceGit(directory, ["status", "--porcelain"])).stdout.length, 0);
      result.cycles.push({
        generation: prepared.generation.commit,
        outputSha256: built.verification.outputSha256,
        head: (await sourceGit(directory, ["rev-parse", "HEAD"])).stdout.toString().trim(),
      });
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
    }
    result.success = true;
    // Proof branches retain source and pure-generation ancestry after disposable checkouts are removed.
    await sourceGit(clone, ["worktree", "remove", directory]);
  } catch (error) {
    result.error = String(error);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
    throw error;
  }
}
report.success = true;
report.finished = new Date().toISOString();
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
console.log(reportFile);
