import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  exportCaptureJson,
  recoverCaptureFile,
} from "../packages/debug-adapter/src/capture-file.js";
import {
  createRuntimeInstructionTraceImporter,
  importRuntimeInstructionTraceFile,
  readRuntimeTraceFileChunks,
  validateRuntimeInstructionTraceMetadata,
  importRuntimeTraceIntoProject,
  importRuntimeTraceSourceIntoProject,
  writeAnalysisProject,
  loadAnalysisProject,
  RomImage,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  type AnalysisProject,
  type RuntimeInstructionTraceArtifact,
} from "../packages/disassembler/src/index.js";
import { createEditorRuntimeTraceSource } from "../packages/vscode-extension/src/runtime/trace-source.js";
import { writeCaptureFixture, captureFixtureHeader } from "../tests/helpers/capture-archive.js";

/**
 * Deterministic rich hot-loop trace. Register variation exercises both indexing profiles.
 * @param {number} events Positive instruction count.
 * @returns {RuntimeInstructionTraceArtifact} Bounded chunks with repeated code and bus variants.
 */
const fixture = (events: number): RuntimeInstructionTraceArtifact => {
  const chunks: RuntimeInstructionTraceArtifact["chunks"][number][] = [];
  for (let start = 0; start < events; start += 1024) {
    const count = Math.min(1024, events - start);
    const addresses = Array.from({ length: count }, (_, i) => 0x808000 + ((start + i) % 256));
    chunks.push({
      sequenceStart: start + 1,
      addresses,
      details: addresses.map((address, i) => ({
        bytes: [0xea],
        state: {
          a: (start + i) % 1024,
          x: 0,
          y: 0,
          s: 511,
          d: 0,
          db: 0,
          pb: 128,
          pc: address & 65535,
          p: 48,
          e: true,
        },
        memoryAccesses: [
          {
            addressSpace: "snes.cpu",
            address: 0x2118,
            access: "write",
            width: 1,
            value: (start + i) % 256,
          },
        ],
      })),
      droppedEvents: 0,
      active: start + count < events,
    });
  }
  return {
    format: "uttori-asm-instruction-trace",
    schemaVersion: 1,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    romContentSha256: "a".repeat(64),
    producer: { id: "benchmark", revision: "rich-loop-v1" },
    chunks,
  };
};

/**
 * Validate command-line counts before allocating the fixture.
 * @param {string} name Option flag.
 * @param {number} fallback Default count when absent.
 * @param {number} minimum Smallest accepted count. Warmups may be zero.
 * @returns {number} Safe integer count.
 */
const countOption = (name: string, fallback: number, minimum = 1): number => {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? fallback : Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error(`${name} requires an integer >= ${minimum}.`);
  return value;
};

const events = countOption("--events", 100_000);
const repetitions = countOption("--repetitions", 3);
const warmups = countOption("--warmups", 1, 0);
const archiveIndex = process.argv.indexOf("--archive");
const inputArchive = archiveIndex < 0 ? undefined : process.argv[archiveIndex + 1];
if (archiveIndex >= 0 && (!inputArchive || inputArchive.startsWith("--")))
  throw new Error("--archive requires a capture path.");

/**
 * Read a bounded event prefix from an explicitly selected local capture. Never import its project.
 * @param {string} file Selected trace or ACT2 archive.
 * @returns {Promise<RuntimeInstructionTraceArtifact>} Benchmark-only prefix. The archive tail is not checked.
 */
const archivePrefix = async (file: string): Promise<RuntimeInstructionTraceArtifact> => {
  const source = await createEditorRuntimeTraceSource(file, { maxBytes: Number.MAX_SAFE_INTEGER });
  const chunks: RuntimeInstructionTraceArtifact["chunks"][number][] = [];
  const stop = new Error("Benchmark prefix collected");
  let count = 0;
  try {
    await source.read((value) => {
      const chunk = value as RuntimeInstructionTraceArtifact["chunks"][number];
      const take = Math.min(events - count, chunk.addresses.length);
      chunks.push({
        ...chunk,
        addresses: chunk.addresses.slice(0, take),
        details: chunk.details?.slice(0, take),
      });
      count += take;
      if (count === events) throw stop;
    });
  } catch (error) {
    if (error !== stop) throw error;
  }
  if (count !== events)
    throw new Error(`Capture only contains ${count} events. Request a smaller --events prefix.`);
  return { ...source.metadata, chunks };
};

const artifact = inputArchive ? await archivePrefix(inputArchive) : fixture(events);
const metadata = validateRuntimeInstructionTraceMetadata(artifact);
const context = {
  projectRomContentSha256: artifact.romContentSha256,
  sourceName: "benchmark.json",
};
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-trace-benchmark-"));
const file = path.join(directory, "trace.json");
const text = JSON.stringify(artifact);
const stages: Record<string, number[]> = {};
const memory: Record<string, { heapDeltaBytes: number; rssDeltaBytes: number }[]> = {};
let expectedHash: string | undefined;
let recording = false;

/**
 * Boundary deltas include temporary allocations, not process peaks. Explicit GC precedes each stage.
 * @param {string} name Stable stage identifier in the report.
 * @param {Function} run Timed operation with setup already complete.
 * @returns {Promise<T>} Result retained through the memory sample for correctness checks.
 */
const measure = async <T>(name: string, run: () => T | Promise<T>): Promise<T> => {
  global.gc?.();
  const before = process.memoryUsage();
  const started = performance.now();
  const result = await run();
  const wallMs = performance.now() - started;
  const after = process.memoryUsage();
  if (recording) {
    (stages[name] ??= []).push(wallMs);
    (memory[name] ??= []).push({
      heapDeltaBytes: after.heapUsed - before.heapUsed,
      rssDeltaBytes: after.rss - before.rss,
    });
  }
  return result;
};

try {
  for (let repetition = 0; repetition < repetitions + warmups; repetition++) {
    recording = repetition >= warmups;
    await measure("json-stringify", () => JSON.stringify(artifact));
    await measure("json-write", () => fs.writeFile(file, text));
    await measure("json-read", () => fs.readFile(file, "utf8"));
    await measure("json-parse", () => JSON.parse(text) as unknown);
    const parsedEvents = await measure("stream-parse-validate", async () => {
      let count = 0;
      for await (const chunk of readRuntimeTraceFileChunks(file, metadata))
        count += chunk.addresses.length;
      return count;
    });
    assert.equal(parsedEvents, events);
    for (const indexMode of ["full", "65816-disassembly"] as const) {
      const importer = createRuntimeInstructionTraceImporter(artifact, { ...context, indexMode });
      await measure(`memory-index-${indexMode}`, () => {
        for (const chunk of artifact.chunks) importer.push(chunk);
      });
      const result = await measure(`memory-finalize-${indexMode}`, () => importer.finish());
      expectedHash ??= result.sourceSha256;
      assert.equal(result.sourceSha256, expectedHash);
      assert.equal(result.observedEvents, events);
      const streamed = await measure(`file-import-${indexMode}`, () =>
        importRuntimeInstructionTraceFile(file, { ...context, indexMode }),
      );
      assert.deepEqual(streamed, result);
    }
  }
  const archive = path.join(directory, "capture.act2");
  if (!inputArchive) await writeCaptureFixture(archive, events);
  const project: AnalysisProject = {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target: "benchmark",
      rom: {
        ...new RomImage(new Uint8Array(0x8000)).identity,
        contentSha256: captureFixtureHeader.romContentSha256,
      },
      mapping: { mapper: "fixture", source: "override", candidates: [] },
      addressSpaces: [{ id: "snes.cpu", name: "CPU", addressBits: 24, kind: "cpu" }],
    },
    shards: {
      analysis: [],
      annotations: [],
      labels: [],
      comments: [],
      regions: [],
      runtime: [],
      evidence: [],
      imports: [],
    },
  };
  for (let repetition = 0; !inputArchive && repetition < repetitions + warmups; repetition++) {
    recording = repetition >= warmups;
    const scanned = await measure("act2-decode", () => recoverCaptureFile(archive));
    assert.equal(scanned.complete, true);
    assert.equal(scanned.eventThrough, String(events));
    for (const indexMode of ["full", "65816-disassembly"] as const) {
      const directDirectory = path.join(directory, `direct-${indexMode}-${repetition}`);
      const legacyDirectory = path.join(directory, `legacy-${indexMode}-${repetition}`);
      const legacyFile = path.join(directory, `legacy-${indexMode}-${repetition}.json`);
      // Fresh projects prevent identical-import fast paths from distorting publication costs.
      writeAnalysisProject(directDirectory, project);
      writeAnalysisProject(legacyDirectory, project);
      const importContext = {
        projectRomContentSha256: captureFixtureHeader.romContentSha256,
        sourceName: "capture",
        indexMode,
      };
      const direct = await measure(`act2-direct-project-${indexMode}`, async () => {
        const source = await createEditorRuntimeTraceSource(archive);
        return importRuntimeTraceSourceIntoProject(source, directDirectory, importContext);
      });
      const legacy = await measure(`act2-json-project-${indexMode}`, async () => {
        await exportCaptureJson(archive, legacyFile);
        return importRuntimeTraceIntoProject(legacyFile, legacyDirectory, importContext);
      });
      assert.deepEqual(direct, legacy);
      assert.deepEqual(
        loadAnalysisProject(directDirectory).shards,
        loadAnalysisProject(legacyDirectory).shards,
      );
    }
  }
  const report = {
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpu: os.cpus()[0]?.model,
    },
    configuration: {
      events,
      repetitions,
      warmups,
      chunkEvents: 1024,
      jsonBytes: Buffer.byteLength(text),
      gc: !!global.gc,
      fixture: inputArchive ? "local-capture-prefix" : "rich-loop-v1",
      inputArchive: inputArchive ? path.resolve(inputArchive) : undefined,
      prefixOnly: !!inputArchive,
      archiveFixture: inputArchive ? undefined : "act2-loop-v1",
      archiveBytes: inputArchive ? undefined : (await fs.stat(archive)).size,
      memorySampling: "stage-boundary-deltas. Same process, not peaks",
    },
    sourceSha256: expectedHash,
    stages: Object.fromEntries(
      Object.entries(stages).map(([name, samples]) => {
        const sorted = [...samples].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        const medianMs =
          sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
        return [
          name,
          {
            medianMs,
            p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
            samplesMs: samples,
            memory: memory[name],
          },
        ];
      }),
    ),
  };
  console.log(JSON.stringify(report, undefined, 2));
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}
