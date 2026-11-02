import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { sourceContentHash } from "@uttori/asm-disassembler/source-project";

import { test } from "../../../../tests/ava-helper.js";
import {
  readBuildCoverage,
  checkBuildCoverageFreshness,
} from "../../src/analysis/build-coverage.js";

test("persisted progress checks exact saved inputs after restart without requiring a ROM, map or evidence", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-coverage-freshness-"));
  t.teardown(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, ".uttori"));
  await fs.mkdir(path.join(root, ".uttori-local/builds"), { recursive: true });
  const project = {
    format: "uttori-source-project",
    version: 1,
    id: "freshness",
    target: "snes.sfc",
    romSha256: "a".repeat(64),
    sourceRoots: ["source"],
    researchRoots: ["research"],
    buildConfig: "config.json",
    layout: "layout.json",
    captures: "captures.json",
  };
  await fs.writeFile(path.join(root, ".uttori/project.json"), JSON.stringify(project));
  await fs.writeFile(path.join(root, "main.asm"), "db $01");
  await fs.writeFile(path.join(root, "layout.json"), "{}");
  const inputs = await Promise.all(
    [".uttori/project.json", "main.asm", "layout.json"].map(async (file) => ({
      path: file,
      sha256: sourceContentHash(await fs.readFile(path.join(root, file))),
    })),
  );
  const summary = {
    version: 1 as const,
    inputSha256: "b".repeat(64),
    coverage: { romSha256: project.romSha256, totalBytes: 2, remainingBytes: 1, convertedBytes: 1 },
  };
  const summaryFile = path.join(root, ".uttori-local/builds/summary.json");
  const current = path.join(root, ".uttori-local/builds/current.json");
  await fs.writeFile(summaryFile, JSON.stringify(summary));
  await fs.writeFile(current, JSON.stringify({ ...summary, inputs }));
  t.deepEqual((await readBuildCoverage(root))?.summary, summary);
  t.is((await checkBuildCoverageFreshness(root, summary)).status, "current");
  const stat = await fs.stat(path.join(root, "main.asm"));
  await fs.writeFile(path.join(root, "main.asm"), "db $02");
  await fs.utimes(path.join(root, "main.asm"), stat.atime, stat.mtime);
  t.is((await checkBuildCoverageFreshness(root, summary)).status, "stale");
  await fs.writeFile(path.join(root, "main.asm"), "db $01");
  await fs.rm(path.join(root, "layout.json"));
  t.true((await checkBuildCoverageFreshness(root, summary)).reason.includes("layout.json"));
  await fs.writeFile(current, JSON.stringify({ ...summary, inputSha256: "c".repeat(64), inputs }));
  t.is((await checkBuildCoverageFreshness(root, summary)).status, "stale");
  await fs.writeFile(current, JSON.stringify({ ...summary, inputs: [] }));
  t.is((await checkBuildCoverageFreshness(root, summary)).status, "unknown");
  await fs.rm(current);
  t.is((await checkBuildCoverageFreshness(root, summary)).status, "unknown");
  await fs.writeFile(
    summaryFile,
    JSON.stringify({ ...summary, coverage: { ...summary.coverage, romSha256: "d".repeat(64) } }),
  );
  await t.throwsAsync(readBuildCoverage(root), { message: /different original ROM/ });
  await fs.writeFile(
    summaryFile,
    JSON.stringify({ ...summary, coverage: { ...summary.coverage, remainingBytes: 3 } }),
  );
  await t.throwsAsync(readBuildCoverage(root), { message: /Invalid build coverage/ });
  await fs.writeFile(summaryFile, " ".repeat(4097));
  await t.throwsAsync(readBuildCoverage(root), { message: /size budget/ });
  await fs.rm(summaryFile);
  t.is(await readBuildCoverage(root), undefined);
});
