import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { exportNesSource as ExportNesSource } from "../packages/plugin-65xx/src/nes/source-export.js";
import { sourceExportFixture } from "../packages/plugin-65xx/tests/helpers/source-export-fixture.js";

const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const exporterFile =
  process.env.UTTORI_EXPORT_BENCHMARK_MODULE ?? "packages/plugin-65xx/src/nes/source-export.ts";
const exporterSha256 = hash(fs.readFileSync(exporterFile));
/** Benchmark modules expose the same exporter contract; reject missing/non-callable entries early. */
function isExporter(value: unknown): value is { exportNesSource: typeof ExportNesSource } {
  return (
    typeof value === "object" &&
    value !== null &&
    "exportNesSource" in value &&
    typeof value.exportNesSource === "function"
  );
}
const exporter: unknown = await import(pathToFileURL(exporterFile).href);
assert.ok(isExporter(exporter), "Benchmark module must expose exportNesSource");
const { exportNesSource } = exporter;
const workerCount = Number(process.argv[process.argv.indexOf("--worker") + 1]);
if (process.argv.includes("--worker")) {
  const { rom, nodes, labels } = sourceExportFixture(workerCount);
  const romSha256 = hash(rom.bytes());
  const inputSha256 = hash(JSON.stringify({ romSha256, nodes, labels }));
  const samples = [];
  // Each fresh process records its first export separately; subsequent samples share only JIT state.
  for (let sample = 0; sample < 6; sample++) {
    const before = process.memoryUsage();
    const started = performance.now();
    const result = exportNesSource(rom, nodes, romSha256, { labels });
    const wallMs = performance.now() - started;
    const after = process.memoryUsage();
    samples.push({
      state: sample === 0 ? "cold" : "warm",
      wallMs,
      heapDeltaBytes: after.heapUsed - before.heapUsed,
      boundaryRssBytes: Math.max(before.rss, after.rss),
      files: result.files.length,
      bytes: result.files.reduce((sum, file) => sum + file.bytes.length, 0),
      codeBytes: result.codeBytes,
      rangesSha256: hash(JSON.stringify(result.ranges)),
      outputSha256: hash(JSON.stringify(result.files.map((file) => [file.path, hash(file.bytes)]))),
    });
  }
  assert.equal(new Set(samples.map((sample) => sample.outputSha256)).size, 1);
  console.log(
    JSON.stringify({
      count: workerCount,
      nodes: nodes.length,
      labels: labels.length,
      romBytes: rom.size,
      inputSha256,
      peakProcessRssBytes: process.resourceUsage().maxRSS * 1024,
      samples,
      warm: (() => {
        const timings = samples
          .slice(1)
          .map((sample) => sample.wallMs)
          .toSorted((a, b) => a - b);
        const median = timings[2];
        const deviations = timings.map((time) => Math.abs(time - median)).toSorted((a, b) => a - b);
        return { medianMs: median, p95Ms: timings[4], medianAbsoluteDeviationMs: deviations[2] };
      })(),
    }),
  );
} else {
  const workloads = [1024, 2048, 4096].map((count) => {
    const child = spawnSync(
      process.execPath,
      [...process.execArgv, fileURLToPath(import.meta.url), "--worker", String(count)],
      { encoding: "utf8" },
    );
    assert.equal(child.status, 0, child.stderr);
    return JSON.parse(child.stdout) as unknown;
  });
  const report = {
    version: 1,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    exporterSha256,
    fixtureSha256: hash(
      fs.readFileSync("packages/plugin-65xx/tests/helpers/source-export-fixture.ts"),
    ),
    workloads,
  };
  const output = process.argv[2];
  assert.ok(output, "Pass a JSON receipt path");
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
