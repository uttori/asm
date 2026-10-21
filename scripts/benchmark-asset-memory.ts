import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { createIndexedPng, readAssetPng, rewriteIndexedPng } from "@uttori/asm-assets/image";

import { benchmarkStatistics } from "./benchmark-report.js";

const hash = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const worker = process.argv.indexOf("--worker");
if (worker >= 0) {
  const side = Number(process.argv[worker + 1]);
  assert.ok(side === 1024 || side === 2048);
  const indexes = Uint8Array.from(
    { length: side * side },
    (_, index) => (index * 17 + (index >>> 8)) & 255,
  );
  const palette = Array.from(
    { length: 256 },
    (_, index): readonly [number, number, number, number] => [index, 255 - index, index, 255],
  );
  const input = createIndexedPng({ width: side, height: side, indexes, palette });
  const inputSha256 = hash(input);
  const samples = [];
  for (let iteration = 0; iteration < 6; iteration++) {
    const before = process.memoryUsage();
    const started = performance.now();
    const decoded = readAssetPng(input).toIndexed({ copy: false });
    // A palette-only edit must preserve the compressed image data and palette-slot identity.
    const edited = rewriteIndexedPng(input, { palette: palette.toReversed() });
    const roundtrip = readAssetPng(edited).toIndexed({ copy: false });
    assert.deepEqual(roundtrip.indexes, decoded.indexes);
    assert.equal(hash(input), inputSha256, "Borrowed source was mutated");
    assert.notEqual(decoded.indexes.buffer, input.buffer);
    samples.push({
      state: iteration === 0 ? "cold" : "warm",
      wallMs: performance.now() - started,
      heapDeltaBytes: process.memoryUsage().heapUsed - before.heapUsed,
      boundaryRssBytes: process.memoryUsage().rss,
      inputBytes: input.length,
      outputBytes: edited.length,
      decodedPixelBytes: decoded.indexes.byteLength + roundtrip.indexes.byteLength,
      outputSha256: hash(edited),
    });
  }
  console.log(
    JSON.stringify({
      side,
      pixels: indexes.length,
      inputSha256,
      samples,
      warm: benchmarkStatistics(samples.slice(1).map((sample) => sample.wallMs)),
      peakProcessRssBytes: process.resourceUsage().maxRSS * 1024,
    }),
  );
} else {
  const output = process.argv[2];
  assert.ok(output, "Pass a JSON receipt path");
  const workloads = [1024, 2048].map((side) => {
    const child = spawnSync(
      process.execPath,
      [...process.execArgv, fileURLToPath(import.meta.url), "--worker", String(side)],
      { encoding: "utf8" },
    );
    assert.equal(child.status, 0, child.stderr);
    const result: unknown = JSON.parse(child.stdout);
    return result;
  });
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        version: 1,
        node: process.version,
        harnessSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
        cliBundleSha256: hash(fs.readFileSync("packages/cli/out/cli.mjs")),
        workload:
          "Import, palette edit, encode and reimport at one and four megapixels (the raster ceiling).",
        decision:
          "Retain owned decoded pixels and borrowed container spans. No additional copy-elision change is justified without a measured prototype and cancellation/ownership validation.",
        workloads,
      },
      null,
      2,
    ) + "\n",
  );
}
