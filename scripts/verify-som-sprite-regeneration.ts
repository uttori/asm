import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { executeSourceOperation, inspectSourceProject } from "@uttori/asm-workflows/source";
import { sourceGit, sourceContentHash } from "@uttori/asm-disassembler/source-project";

/** Private full-ROM proof, restricted to a separately prepared verification clone with an imported edit. */
async function main(): Promise<void> {
  const root = path.resolve(process.argv[2] ?? "");
  const firstCycle = Number(process.argv[3] ?? 1);
  assert.ok(
    firstCycle === 1 || firstCycle === 2,
    "Choose starting cycle 1 or 2 after a reviewed resolution.",
  );
  assert.ok(
    fs.existsSync(path.join(root, ".verification/aseprite-spike.json")),
    "Use only an isolated spike clone.",
  );
  assert.ok(
    fs.existsSync(path.join(root, ".verification/import.json")),
    "Apply the combined import in the clone first.",
  );
  const original = fs.readFileSync(path.join(root, "Secret of Mana (USA).sfc"));
  assert.equal(
    sourceContentHash(original),
    "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f",
  );
  const expected = Buffer.from(original);
  assert.equal(expected[0x196540], 0);
  expected[0x196540] = 0x80;
  assert.equal(expected[0x81000], 0);
  expected[0x81000] = 1;
  assert.equal(expected[0x133d2a], 0x6c);
  expected[0x133d2a] = 0x6d;
  assert.deepEqual(Buffer.from((await inspectSourceProject(root)).output), expected);
  const prior: unknown =
    firstCycle === 2
      ? JSON.parse(fs.readFileSync(path.join(root, ".verification/regeneration.json"), "utf8"))
      : [];
  assert.ok(Array.isArray(prior), "Missing reviewed first-cycle report.");
  const report: unknown[] = prior;
  for (let cycle = firstCycle; cycle <= 2; cycle++) {
    const id = "manual.comment.aseprite-spike";
    const text = `Sprite regeneration verification ${cycle}`;
    const research = ".uttori/research/aseprite-spike.json";
    fs.writeFileSync(
      path.join(root, research),
      JSON.stringify(
        {
          format: "uttori-research",
          version: 1,
          project: "secret-of-mana",
          romSha256: sourceContentHash(original),
          decisions: [
            {
              id,
              collection: "comments",
              value: {
                id,
                addressSpace: "rom.file",
                address: 0,
                placement: "before",
                text,
                evidence: [],
              },
            },
          ],
        },
        null,
        2,
      ) + "\n",
    );
    await sourceGit(root, ["add", "--", research]);
    await sourceGit(root, ["commit", "-m", `Declare independent research ${cycle}`]);
    const prepared: unknown = await executeSourceOperation({
      directory: root,
      action: "prepare",
      onProgress: console.log,
    });
    if (
      !isRecord(prepared) ||
      !isRecord(prepared.generation) ||
      typeof prepared.generation.commit !== "string" ||
      !isRecord(prepared.verification)
    ) {
      throw new Error("Missing prepared generation evidence.");
    }
    assert.equal(prepared.verification.outputSha256, sourceContentHash(original));
    const candidate = prepared.generation.commit;
    const preview: unknown = await executeSourceOperation({
      directory: root,
      action: "preview",
      candidate,
    });
    if (!isRecord(preview)) {
      throw new Error("Missing native preview.");
    }
    assert.deepEqual(
      preview.conflicts,
      [],
      "Review and resolve native conflicts before continuing.",
    );
    const applied: unknown = await executeSourceOperation({
      directory: root,
      action: "apply",
      candidate,
    });
    if (isRecord(applied) && applied.phase === "merging") {
      await executeSourceOperation({
        directory: root,
        action: "finish",
        message: `Verify imported sprite through regeneration ${cycle}`,
      });
    }
    const build = await inspectSourceProject(root);
    assert.deepEqual(build.diagnostics, []);
    assert.deepEqual(Buffer.from(build.output), expected);
    assert.ok(
      fs.readFileSync(path.join(root, "disassembly/banks/bank-000.asm"), "utf8").includes(text),
    );
    report.push({
      cycle,
      candidate,
      pureOutputSha256: prepared.verification.outputSha256,
      editedOutputSha256: sourceContentHash(build.output),
    });
    fs.writeFileSync(
      path.join(root, ".verification/regeneration.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(`cycle ${cycle}: complete ROM and independent research verified`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

await main();
