/** Compare complete source exports with/without explicit struct uses on the same synthetic ROM. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";

import {
  RomImage,
  type AnalysisProject,
  type RuntimeInstructionRecord,
} from "@uttori/asm-disassembler";
import {
  analyzeSnesRuntimeCode,
  exportSnes65816Source,
  verifySnesProjectRoundTrip,
} from "@uttori/asm-plugin-snes";

const { values } = parseArgs({
  options: {
    records: { type: "string", default: "2000" },
    repetitions: { type: "string", default: "5" },
    output: { type: "string" },
  },
});
const count = Number(values.records);
const repetitions = Number(values.repetitions);
if (
  !Number.isSafeInteger(count) ||
  count < 1 ||
  count > 4000 ||
  !Number.isSafeInteger(repetitions) ||
  repetitions < 1
) {
  throw new Error("Use --records 1..4000 and a positive --repetitions count.");
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-struct-use-benchmark-"));
const bytes = new Uint8Array(0x8000).fill(0xea);
const runtime: RuntimeInstructionRecord[] = [];
const sites: { address: number; expectedBytes: number[]; role: number }[] = [];
for (let record = 0; record < count; record++) {
  let offset = record * 7;
  for (const [role, encoded] of [
    [0xa0, 2],
    [0xb7, 0xd1],
    [0x69, 4, 0],
  ].entries()) {
    bytes.set(encoded, offset);
    const address = 0x808000 + offset;
    sites.push({ address, expectedBytes: encoded, role });
    runtime.push({
      id: `fixture:${offset}`,
      kind: "runtime-instruction",
      architecture: "snes.65816",
      addressSpace: "snes.cpu",
      address,
      bytes: encoded,
      state: { e: 0, p: 0x10, d: 0, db: 0x7e },
      count: 1,
      evidence: [],
    });
    offset += encoded.length;
  }
}
const rom = new RomImage(bytes, { headerSize: 0 });
const project: AnalysisProject = {
  manifest: {
    format: "uttori-asm-analysis",
    schemaVersion: 3,
    target: "snes.sfc",
    rom: rom.identity,
    mapping: { mapper: "lorom", source: "override", candidates: [] },
    addressSpaces: [{ id: "snes.cpu", name: "CPU", kind: "cpu", addressBits: 24 }],
  },
  shards: {
    analysis: [],
    annotations: [],
    labels: [],
    comments: [],
    regions: [],
    runtime,
    evidence: [],
    imports: [],
  },
};
const analysis = analyzeSnesRuntimeCode(project.shards, rom, "lorom");
// Both runs receive identical accepted instructions. Capture import/analysis is outside the timer.
const exportProject = {
  ...project,
  manifest: { ...project.manifest, shards: [] as const },
  shards: { ...project.shards, analysis, runtime: [] },
};
const map = {
  format: "uttori-asm-snes-struct-map",
  schemaVersion: 1,
  structures: [
    {
      id: "Tint",
      size: 4,
      fields: [
        { name: "opcode", offset: 0, size: 1 },
        { name: "scope", offset: 1, size: 1 },
        { name: "target", offset: 2, size: 2 },
      ],
    },
  ],
  bindings: [
    { name: "Command", structure: "Tint", address: 0x80f000, fileOffset: 0x7000, count: 1 },
  ],
};
const instructionUses = sites.map(({ role, ...site }) => {
  if (role === 0) {
    return {
      ...site,
      reason: "Target field offset.",
      operand: "Tint.target",
    };
  }
  if (role === 2) {
    return { ...site, reason: "Command stride.", operand: "sizeof(Tint)" };
  }
  return {
    ...site,
    reason: "Shared indirect consumer.",
    observations: [
      {
        target: "Command.target",
        width: 2,
        access: "read",
        provenance: "trace-derived",
        source: "synthetic-fixture",
        detail: "Synthetic benchmark relationship. No game capture is claimed.",
        romSha256: rom.identity.contentSha256,
      },
    ],
  };
});
const modes = ["withoutUses", "withUses"] as const;
const samples: Record<(typeof modes)[number], number[]> = { withoutUses: [], withUses: [] };
const heaps: Record<(typeof modes)[number], number[]> = { withoutUses: [], withUses: [] };
const manifests = new Map<string, ReturnType<typeof exportSnes65816Source>>();
try {
  fs.writeFileSync(path.join(root, "rom.sfc"), bytes);
  for (let iteration = -1; iteration < repetitions; iteration++) {
    // Alternate execution order to reduce systematic cache/thermal bias. One warmup per mode.
    const order = iteration % 2 === 0 ? [...modes].reverse() : modes;
    for (const mode of order) {
      const directory = path.join(root, mode);
      fs.rmSync(directory, { recursive: true, force: true });
      fs.mkdirSync(directory);
      fs.writeFileSync(
        path.join(directory, "struct-map.json"),
        JSON.stringify(mode === "withUses" ? { ...map, instructionUses } : map),
      );
      global.gc?.();
      const heap = process.memoryUsage().heapUsed;
      const start = performance.now();
      const manifest = exportSnes65816Source(exportProject, rom, directory, {
        sourceProjectSha256: "0".repeat(64),
      });
      const elapsed = performance.now() - start;
      if (iteration >= 0) {
        samples[mode].push(elapsed);
        heaps[mode].push(Math.max(0, process.memoryUsage().heapUsed - heap));
      }
      manifests.set(mode, manifest);
    }
  }
  const codeSpans = (mode: string) =>
    manifests.get(mode)!.spans.filter((span) => span.role === "code");
  assert.deepEqual(codeSpans("withoutUses"), codeSpans("withUses"));
  assert.equal(codeSpans("withUses").length, count * 3);
  const hashes: string[] = [];
  for (const mode of modes) {
    const verified = await verifySnesProjectRoundTrip({
      sourceDirectory: path.join(root, mode),
      romFile: path.join(root, "rom.sfc"),
      emitDebugMap: false,
    });
    assert(verified.comparison.equal);
    hashes.push(verified.comparison.actualSha256);
  }
  assert.equal(hashes[0], hashes[1]);
  const median = (input: number[]) =>
    [...input].sort((a, b) => a - b)[Math.floor(input.length / 2)];
  const report = {
    date: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    instructions: count * 3,
    observations: count,
    repetitions,
    samplesMs: samples,
    medianMs: { withoutUses: median(samples.withoutUses), withUses: median(samples.withUses) },
    medianHeapDeltaBytes: {
      withoutUses: median(heaps.withoutUses),
      withUses: median(heaps.withUses),
    },
    addedMicrosecondsPerUse:
      ((median(samples.withUses) - median(samples.withoutUses)) * 1000) / (count * 3),
    roundTripSha256: hashes[0],
    identicalCodeSpans: true,
    notes:
      "Complete export including metadata validation, indexing, decoding, formatting and file writes. Setup/analysis and verification excluded from timing. One warmup per mode. Alternating order. Heap deltas are boundary measurements, not peak RSS. Baseline uses the same exporter and struct bindings with instructionUses omitted.",
  };
  console.log(JSON.stringify(report, null, 2));
  if (values.output) {
    fs.writeFileSync(path.resolve(values.output), `${JSON.stringify(report, null, 2)}\n`);
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
