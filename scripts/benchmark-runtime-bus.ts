import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  readCaptureFileHeader,
  recoverCaptureFile,
} from "../packages/debug-adapter/src/capture-file.js";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  writeAnalysisProject,
  importRuntimeBusTraceSourceIntoProject,
  validateRuntimeBusTraceMetadata,
  type AnalysisProject,
  type RuntimeBusTraceSource,
} from "../packages/disassembler/src/index.js";

// Measure the actual SQLite import into a disposable project. The supplied archive
// is read-only. ROM identity is copied into a benchmark-only manifest, never a user project.
const archive = process.argv[2];
const output = process.argv[3];
if (!archive || !output) {
  throw new Error("Usage: benchmark-runtime-bus.ts ARCHIVE OUTPUT [--profile]");
}
const profile = process.argv.includes("--profile");
const header = await readCaptureFileHeader(archive);
const metadata = validateRuntimeBusTraceMetadata({
  ...header,
  format: "uttori-asm-bus-trace",
  schemaVersion: 1,
});
const directory = await mkdtemp(path.join(os.tmpdir(), "uttori-bus-bench-"));
const project: AnalysisProject = {
  manifest: {
    format: "uttori-asm-analysis",
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "benchmark",
    rom: {
      ...new RomImage(new Uint8Array(32768)).identity,
      contentSha256: header.romContentSha256,
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
const timings: Record<string, { calls: number; ms: number }> = {};
const timing = (stage: string, ms: number): void => {
  const entry = (timings[stage] ??= { calls: 0, ms: 0 });
  entry.calls++;
  entry.ms += ms;
};
const source: RuntimeBusTraceSource = {
  metadata,
  read: async (accept) => {
    const result = await recoverCaptureFile(
      archive,
      (chunk) => {
        if (chunk.scope === "snes.65816.instructions") {
          throw new Error("Bus scope required");
        }
        accept({ accesses: chunk.scope === "snes.cpu-bus" ? chunk.accesses : chunk.events });
      },
      { onTiming: profile ? timing : undefined },
    );
    assert(result.complete, result.reason ?? "Archive did not validate completely.");
  },
};
const sources: Record<string, string> = {};
for (const file of [
  "packages/disassembler/src/runtime-bus-trace.ts",
  "packages/disassembler/src/runtime-bus-project.ts",
  "packages/disassembler/src/runtime-bus-types.ts",
  "packages/disassembler/src/trace-cache.ts",
  "packages/disassembler/src/sqlite-runtime-storage.ts",
  "packages/disassembler/src/sqlite-records.ts",
  "packages/disassembler/src/sqlite-store.ts",
  "packages/debug-adapter/src/capture-file.ts",
  "packages/debug-adapter/src/capture-file-reader.ts",
  "packages/debug-adapter/src/capture-v2.ts",
]) {
  sources[file] = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

try {
  writeAnalysisProject(directory, project);
  global.gc?.();
  const memoryBefore = process.memoryUsage();
  const started = performance.now();
  let stage = "setup",
    stageStarted = started;
  const result = await importRuntimeBusTraceSourceIntoProject(
    source,
    directory,
    {
      projectRomContentSha256: header.romContentSha256,
      sourceName: path.basename(archive),
    },
    {
      onStage: (next) => {
        const now = performance.now();
        timing(stage, now - stageStarted);
        stage = next;
        stageStarted = now;
      },
    },
  );
  const wallMs = performance.now() - started;
  timing(stage, performance.now() - stageStarted);
  const memoryAfter = process.memoryUsage();
  const evidence = {
    schemaVersion: 1,
    platform: `${process.platform}-${process.arch}`,
    runtime: process.version,
    profile,
    archiveBytes: (await stat(archive)).size,
    session: header.session,
    scope: header.scope,
    wallMs,
    eventsPerSecond: (result.observedEvents * 1000) / wallMs,
    timings,
    heapDeltaBytes: memoryAfter.heapUsed - memoryBefore.heapUsed,
    rssDeltaBytes: memoryAfter.rss - memoryBefore.rss,
    peakRssBytes: process.resourceUsage().maxRSS * 1024,
    sourceSha256: result.sourceSha256,
    report: result.report,
    storage: result.storage,
    sources,
  };
  await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
}
