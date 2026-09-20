import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NativeCaptureFileCursor,
  exportCaptureJson,
  recoverCaptureFile,
  type NativeCaptureFilePosition,
} from "../packages/debug-adapter/src/capture-file.js";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  createRuntimeBusTraceImporter,
  importRuntimeBusTraceSourceIntoProject,
  openAnalysisProjectStore,
  writeAnalysisProject,
  type AnalysisProject,
  type RuntimeBusAccess,
  type RuntimeBusTraceMetadata,
  type RuntimeTransferBoundary,
} from "../packages/disassembler/src/index.js";
import { LiveBusAnalysis } from "../packages/vscode-extension/src/runtime/live-bus-analysis.js";
import { captureFixtureHeader, writeCaptureFixture } from "../tests/helpers/capture-archive.js";
import { busChunk, busJsonFrame, busPosition } from "../tests/helpers/capture-bus.js";

/** Fixed work is generated before timing. Each sample has a fresh process/project.
 * Sample zero is a visible warmup, never part of the measured median.
 */
interface Scenario {
  readonly name: string;
  readonly kind: "import" | "recover" | "cursor" | "worker" | "export";
  readonly workload?: "cpu" | "dma" | "hdma" | "ppu";
  readonly facts?: number;
  readonly chunk?: number;
  readonly progress?: boolean;
  readonly memory?: boolean;
  readonly duplicate?: boolean;
  readonly failLate?: boolean;
  readonly outcome?: "written" | "blocked" | "latched";
  readonly target?: "vram" | "cgram" | "oam";
  readonly slice?: number;
  readonly cancel?: boolean;
  readonly lagFailure?: boolean;
  readonly unowned?: boolean;
  readonly interrupted?: boolean;
  /** Deterministic cache stress. Generation stays outside the measured region. */
  readonly distribution?: "scan" | "shuffled" | "skewed";
}

const scenarios: readonly Scenario[] = [
  { name: "cpu-hot-256", kind: "import", facts: 256 },
  { name: "cpu-cache-4096", kind: "import", facts: 4096 },
  { name: "cpu-cache-4097", kind: "import", facts: 4097 },
  { name: "cpu-distinct-65536", kind: "import", facts: 65536, duplicate: true },
  { name: "cpu-unique", kind: "import", facts: 131072 },
  { name: "cpu-hot-scan", kind: "import", facts: 16384, distribution: "scan" },
  { name: "cpu-shuffled", kind: "import", facts: 4097, distribution: "shuffled" },
  { name: "cpu-skewed", kind: "import", facts: 8192, distribution: "skewed" },
  { name: "cpu-chunks-64", kind: "import", facts: 256, chunk: 64 },
  { name: "cpu-progress", kind: "import", facts: 256, progress: true },
  { name: "cpu-memory", kind: "import", facts: 256, memory: true },
  { name: "cpu-unowned", kind: "import", facts: 256, unowned: true },
  { name: "cpu-late-failure", kind: "import", facts: 65536, failLate: true },
  { name: "dma-windows", kind: "import", workload: "dma", facts: 256 },
  { name: "dma-interrupted", kind: "import", workload: "dma", facts: 256, interrupted: true },
  { name: "hdma-direct-indirect", kind: "import", workload: "hdma", facts: 256 },
  { name: "ppu-vram-written", kind: "import", workload: "ppu", target: "vram", outcome: "written" },
  { name: "ppu-vram-blocked", kind: "import", workload: "ppu", target: "vram", outcome: "blocked" },
  {
    name: "ppu-cgram-written",
    kind: "import",
    workload: "ppu",
    target: "cgram",
    outcome: "written",
  },
  {
    name: "ppu-cgram-latched",
    kind: "import",
    workload: "ppu",
    target: "cgram",
    outcome: "latched",
  },
  { name: "ppu-oam-written", kind: "import", workload: "ppu", target: "oam", outcome: "written" },
  { name: "recover-chunks-64", kind: "recover", chunk: 64 },
  { name: "recover-chunks-4095", kind: "recover", chunk: 4095 },
  { name: "cursor-slice-1", kind: "cursor", slice: 1 },
  { name: "cursor-slice-16", kind: "cursor", slice: 16 },
  { name: "cursor-slice-256", kind: "cursor", slice: 256 },
  { name: "worker-replay", kind: "worker" },
  { name: "worker-cancel", kind: "worker", cancel: true },
  { name: "worker-lag-failure", kind: "worker", lagFailure: true },
  { name: "instruction-json-export", kind: "export" },
];
const events = 131072;
const rom = new RomImage(new Uint8Array(32768)).identity;
const metadata: RuntimeBusTraceMetadata = {
  format: "uttori-asm-bus-trace",
  schemaVersion: 1,
  scope: "snes.cpu-bus",
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256: rom.contentSha256,
  producer: { id: "benchmark", revision: "capture-path-audit-v1" },
  session: captureFixtureHeader.session,
  clock: captureFixtureHeader.clock,
};

/** Build one deterministic event outside the measured region. PPU decisions are
 * synthetic contract fixtures, not evidence of hardware rendering behavior.
 * @param {number} i Zero-based event index. Sequence and cycle remain contiguous.
 * @param {Scenario} scenario Branch family and distinct-fact working set.
 * @returns {RuntimeBusAccess | RuntimeTransferBoundary} Valid transport-neutral event.
 */
function eventAt(i: number, scenario: Scenario): RuntimeBusAccess | RuntimeTransferBoundary {
  let variant = i % (scenario.facts ?? 256);
  // Each pattern visits every declared fact at least once, so correctness still
  // compares a known distinct count rather than the implementation's own index.
  // Scan/skewed cases measure hot-set survival. The shuffled capacity-plus-one
  // case prevents tuning only for the simple rotating-order cache reproducer.
  if (scenario.distribution === "scan") {
    const slot = i % 32768;
    variant = slot < 16384 ? slot : slot % 256;
  } else if (scenario.distribution === "shuffled") {
    variant = (variant * 2053 + Math.floor(i / 4097) * 31) % 4097;
  } else if (scenario.distribution === "skewed" && i >= 8192) {
    variant = i % 16 === 0 ? i % 8192 : i % 256;
  }
  const common = {
    sequence: String(i + 1),
    ordinal: scenario.unowned ? "0" : String(i + 1),
    cycle: String(i * 8),
    pc: 0x808000,
    context: scenario.unowned ? ("wait" as const) : ("instruction" as const),
    hcounter: (i * 8) % 1368,
    vcounter: i % 313,
  };
  let access: RuntimeBusAccess = {
    ...common,
    address: 0x7e0000 + variant,
    value: variant & 255,
    direction: "read",
    actor: "cpu",
    channel: null,
    phase: "cpu",
  };
  if (scenario.workload === "dma" || scenario.workload === "hdma") {
    const hdma = scenario.workload === "hdma";
    const length = hdma ? 14 : 66;
    const slot = i % length;
    const beginSlot = hdma ? 4 : 0;
    const begin = i - slot + beginSlot;
    const channel = Math.floor(i / length) % 8;
    const actor = hdma ? "hdma" : "dma";
    if (slot === beginSlot || slot === length - 1) {
      let boundary: RuntimeTransferBoundary["boundary"] = "complete";
      if (scenario.interrupted) boundary = "interrupted";
      if (slot === beginSlot) boundary = "begin";
      return {
        ...common,
        kind: "transfer",
        actor,
        channel,
        boundary,
        transferId: String(begin + 1),
        transferred: slot === beginSlot ? 0 : (length - beginSlot - 2) / 2,
        configuration: {
          dmap: hdma ? 0x43 : 0,
          bbad: 0x18,
          a1t: 0,
          a1b: 0x7e,
          das: scenario.interrupted ? 64 : 32,
          dasb: 0x7e,
          a2a: 0,
          ntlr: 0x84,
          flags: 3,
        },
      };
    }
    let phase: RuntimeBusAccess["phase"] = "dma";
    if (hdma) {
      phase = "hdma-transfer";
      if (slot < 2) phase = "hdma-table";
      else if (slot < 4) phase = "hdma-indirect";
    }
    const write = slot > beginSlot && (slot - beginSlot) % 2 === 0;
    access = {
      ...access,
      actor,
      channel,
      phase,
      direction: write ? "write" : "read",
      address: write ? 0x2118 : access.address,
    };
  }
  if (scenario.workload === "ppu") {
    const target = scenario.target!;
    const outcome = scenario.outcome!;
    let port = 0x2118;
    if (target === "cgram") port = 0x2122;
    if (target === "oam") port = 0x2104;
    let bytes: { address: number; value: number }[] = [];
    if (outcome === "written") {
      bytes = [{ address: variant * 2, value: access.value }];
      if (target === "cgram") bytes.push({ address: variant * 2 + 1, value: access.value & 127 });
    }
    access = {
      ...access,
      address: port,
      direction: "write",
      ppu: {
        target,
        outcome,
        forcedBlank: outcome !== "blocked",
        renderingRestricted: outcome === "blocked",
        implementation: "performance",
        vramBytes: target === "vram" ? 65536 : null,
        bytes,
        hcounter: common.hcounter,
        vcounter: common.vcounter,
      },
    };
  }
  return access;
}

/** A disposable production SQLite project. No existing analysis is opened or modified.
 * @param {string} directory New project location beneath the benchmark's temporary directory.
 */
function projectAt(directory: string): void {
  const project: AnalysisProject = {
    manifest: {
      format: "uttori-asm-analysis",
      schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
      target: "benchmark",
      rom,
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
  writeAnalysisProject(directory, project);
}

/** Produce a complete bounded bus archive before the read/worker timer starts.
 * @param {string} file New archive path. Existing files are never overwritten.
 * @param {number} chunkSize Events per frame, within the production wire limit.
 * @returns {Promise<NativeCaptureFilePosition>} Terminal status matching the synced file.
 */
async function archiveAt(file: string, chunkSize: number): Promise<NativeCaptureFilePosition> {
  const handle = await open(file, "wx");
  let chunks = 0;
  const position = {
    ...busPosition(String(events), String(Math.ceil(events / chunkSize)), "complete"),
    fileState: "complete" as const,
    fileBytes: "0",
    fileBatches: "0",
  };
  try {
    await handle.writeFile(
      busJsonFrame("ACS2", {
        ...captureFixtureHeader,
        scope: metadata.scope,
        romContentSha256: rom.contentSha256,
      }),
    );
    for (let start = 0; start < events; start += chunkSize) {
      const count = Math.min(chunkSize, events - start);
      const records = Array.from({ length: count }, (_, i) => ({
        address: BigInt(0x7e0000 + ((start + i) % 256)),
      }));
      await handle.writeFile(busChunk(records, BigInt(++chunks), BigInt(start + 1)));
      await handle.writeFile(
        busJsonFrame("ACK2", {
          session: metadata.session,
          chunkThrough: String(chunks),
          eventThrough: String(start + count),
        }),
      );
    }
    await handle.writeFile(busJsonFrame("END2", position));
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { ...position, fileBytes: String((await stat(file)).size), fileBatches: String(chunks) };
}

/** Measure a phase with coarse boundaries only. CPU and heap figures accompany
 * wall time so I/O waiting is not mistaken for synchronous processing cost.
 * @param {Function} action Work whose startup and settlement belong to the measured phase.
 * @returns {Promise<object>} Result and wall/process CPU milliseconds. Child CPU is excluded.
 */
async function timed<T>(
  action: () => Promise<T>,
): Promise<{ value: T; wallMs: number; cpuMs: number }> {
  const cpu = process.cpuUsage();
  const start = performance.now();
  const value = await action();
  const wallMs = performance.now() - start;
  const used = process.cpuUsage(cpu);
  return { value, wallMs, cpuMs: (used.user + used.system) / 1000 };
}

/** Execute one isolated sample and validate counts outside its timer.
 * @param {Scenario} scenario Selected branch, resource limit or archive reader workload.
 * @returns {Promise<object>} Measurements. Process peak RSS includes fixture construction and validation.
 */
async function run(scenario: Scenario) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "capture-path-audit-"));
  const stages: Record<string, number> = {};
  const metrics: Record<string, unknown> = {};
  try {
    const project = path.join(directory, "project");
    projectAt(project);
    if (scenario.kind === "import") {
      const chunkSize = scenario.chunk ?? 4095;
      const chunks: { accesses: (RuntimeBusAccess | RuntimeTransferBoundary)[] }[] = [];
      for (let start = 0; start < events; start += chunkSize)
        chunks.push({
          accesses: Array.from({ length: Math.min(chunkSize, events - start) }, (_, j) =>
            eventAt(start + j, scenario),
          ),
        });
      let scope: RuntimeBusTraceMetadata["scope"] = "snes.cpu-bus";
      if (scenario.workload === "dma" || scenario.workload === "hdma")
        scope = "snes.cpu-bus-transfers";
      if (scenario.workload === "ppu") scope = "snes.cpu-bus-ppu";
      const source = {
        metadata: { ...metadata, scope },
        read: async (accept: (chunk: unknown) => void) => {
          for (const chunk of chunks) accept(chunk);
          if (scenario.failLate) throw new Error("audit deliberate torn tail");
          await Promise.resolve();
        },
      };
      let previews = 0;
      const counters = () => ({ hits: 0, misses: 0, evictions: 0, peakEntries: 0 });
      const cacheMetrics = process.argv.includes("--diagnostics")
        ? { facts: counters(), index: { ...counters(), sqlStatements: 0, payloads: 0 } }
        : undefined;
      const context = {
        projectRomContentSha256: rom.contentSha256,
        sourceName: scenario.name,
        cacheMetrics,
        onProgress: scenario.progress
          ? () => {
              previews++;
            }
          : undefined,
      };
      global.gc?.();
      let currentStage = "setup",
        stageStart = performance.now();
      const onStage = (next: string): void => {
        const now = performance.now();
        stages[currentStage] = (stages[currentStage] ?? 0) + now - stageStart;
        currentStage = next;
        stageStart = now;
      };
      const measurement = await timed(async () => {
        if (scenario.memory) {
          const importer = createRuntimeBusTraceImporter(source.metadata, context);
          await source.read(importer.push);
          return importer.finish();
        }
        if (scenario.failLate) {
          await assert.rejects(
            importRuntimeBusTraceSourceIntoProject(source, project, context),
            /deliberate torn tail/,
          );
          return undefined;
        }
        return importRuntimeBusTraceSourceIntoProject(source, project, context, { onStage });
      });
      onStage("done");
      const imported = measurement.value;
      Object.assign(metrics, {
        wallMs: measurement.wallMs,
        cpuMs: measurement.cpuMs,
        stages,
        previews,
        sourceSha256: imported?.sourceSha256,
        report: imported?.report.imported,
        cacheMetrics,
      });
      if (imported) {
        const streamEvents = imported.report.imported.streamEvents ?? imported.observedEvents;
        assert.equal(streamEvents, events);
        if (scenario.workload === undefined || scenario.workload === "cpu")
          assert.equal(imported.report.imported.busRecords, scenario.facts);
      }
      if (scenario.duplicate) {
        const duplicate = await timed(() =>
          importRuntimeBusTraceSourceIntoProject(source, project, context),
        );
        assert.equal(duplicate.value.changed, false);
        assert.equal(duplicate.value.added.runtime, 0);
        assert.equal(duplicate.value.sourceSha256, imported!.sourceSha256);
        metrics.duplicate = {
          wallMs: duplicate.wallMs,
          cpuMs: duplicate.cpuMs,
          added: duplicate.value.added,
        };
        const another = { ...source, metadata: { ...source.metadata, session: "f".repeat(32) } };
        const reuse = await timed(() =>
          importRuntimeBusTraceSourceIntoProject(another, project, context),
        );
        assert.equal(reuse.value.storage.newFacts, 0);
        metrics.newSourceSameFacts = {
          wallMs: reuse.wallMs,
          cpuMs: reuse.cpuMs,
          storage: reuse.value.storage,
        };
      }
      if (scenario.failLate) {
        const store = openAnalysisProjectStore(project);
        try {
          assert.equal(store.storageSnapshot().facts, 0);
          assert.equal(store.loadTable("imports").length, 0);
        } finally {
          store.close();
        }
      }
    } else {
      const file = path.join(directory, "capture.act2");
      if (scenario.kind === "export") {
        await writeCaptureFixture(file, events);
        global.gc?.();
        const output = path.join(directory, "export.json");
        const result = await timed(() => exportCaptureJson(file, output));
        const exported = JSON.parse(await readFile(output, "utf8")) as {
          chunks: { addresses: unknown[] }[];
        };
        assert.equal(
          exported.chunks.reduce(
            (sum: number, chunk: { addresses: unknown[] }) => sum + chunk.addresses.length,
            0,
          ),
          events,
        );
        Object.assign(metrics, {
          wallMs: result.wallMs,
          cpuMs: result.cpuMs,
          outputBytes: (await stat(output)).size,
        });
      } else {
        const position = await archiveAt(file, scenario.chunk ?? 1024);
        global.gc?.();
        if (scenario.kind === "recover") {
          const result = await timed(() =>
            recoverCaptureFile(file, undefined, {
              onTiming: (stage, ms) => {
                stages[stage] = (stages[stage] ?? 0) + ms;
              },
            }),
          );
          assert(result.value.complete);
          assert.equal(result.value.eventThrough, String(events));
          Object.assign(metrics, { wallMs: result.wallMs, cpuMs: result.cpuMs, stages });
        } else if (scenario.kind === "cursor") {
          const result = await timed(async () => {
            const cursor = await NativeCaptureFileCursor.open(file);
            let slices = 0;
            try {
              while (!cursor.complete) {
                await cursor.readThrough(position, () => {}, scenario.slice, file);
                slices++;
              }
              assert.equal(cursor.observedEvents, String(events));
              return slices;
            } finally {
              await cursor.close();
            }
          });
          Object.assign(metrics, {
            wallMs: result.wallMs,
            cpuMs: result.cpuMs,
            slices: result.value,
          });
        } else {
          let previews = 0,
            cancelledAt = 0;
          const start = performance.now();
          const worker = new LiveBusAnalysis(
            path.resolve("packages/vscode-extension/out/live-bus-analysis-process.cjs"),
            {
              file,
              projectDirectory: project,
              position,
              maxLagBytes: scenario.lagFailure ? 1 : 256 * 1024 ** 2,
              maxBytes: 256 * 1024 ** 2,
              maxIndexRecords: 2_000_000,
              profile: process.argv.includes("--diagnostics"),
            },
            () => {
              previews++;
              if (scenario.cancel && !cancelledAt) {
                cancelledAt = performance.now();
                worker.cancel();
              }
            },
            512,
          );
          if (scenario.cancel || scenario.lagFailure) {
            await assert.rejects(worker.completion, /cancel|abort|lag budget/i);
            const finished = performance.now();
            const store = openAnalysisProjectStore(project);
            try {
              assert.equal(store.storageSnapshot().facts, 0);
              assert.equal(store.loadTable("imports").length, 0);
            } finally {
              store.close();
            }
            Object.assign(metrics, {
              wallMs: finished - start,
              cancelMs: cancelledAt ? finished - cancelledAt : undefined,
              previews,
            });
          } else {
            const result = await worker.completion;
            assert.equal(result.observedEvents, events);
            assert.equal(result.storage.after.facts, 256);
            Object.assign(metrics, {
              wallMs: performance.now() - start,
              worker: result.live,
              sourceSha256: result.sourceSha256,
              previews,
            });
            // Separate offline validation follows the timer. Matching counts
            // alone would miss normalization differences between the two readers.
            const offline = createRuntimeBusTraceImporter(
              {
                ...captureFixtureHeader,
                format: "uttori-asm-bus-trace",
                schemaVersion: 1,
                scope: "snes.cpu-bus",
                romContentSha256: rom.contentSha256,
              },
              { projectRomContentSha256: rom.contentSha256, sourceName: scenario.name },
            );
            const recovered = await recoverCaptureFile(file, (chunk) => {
              assert.equal(chunk.scope, "snes.cpu-bus");
              if (chunk.scope === "snes.cpu-bus") offline.push({ accesses: chunk.accesses });
            });
            assert(recovered.complete);
            assert.equal(result.sourceSha256, offline.finish().sourceSha256);
          }
          assert.equal((await stat(file)).size, Number(position.fileBytes));
        }
      }
      metrics.archiveBytes = (await stat(file)).size;
    }
    return {
      name: scenario.name,
      events,
      ...metrics,
      peakProcessRssBytes: process.resourceUsage().maxRSS * 1024,
      memory: process.memoryUsage(),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const ownFile = fileURLToPath(import.meta.url);
const caseIndex = process.argv.indexOf("--case");
if (caseIndex >= 0) {
  const scenario = scenarios.find((item) => item.name === process.argv[caseIndex + 1]);
  if (!scenario) throw new Error("Unknown audit scenario");
  console.log(JSON.stringify(await run(scenario)));
} else {
  const output = process.argv[2];
  if (!output)
    throw new Error("Usage: benchmark-capture-audit.ts OUTPUT [--filter SUBSTRING] [--samples N]");
  const sampleIndex = process.argv.indexOf("--samples");
  const samples = sampleIndex < 0 ? 3 : Number(process.argv[sampleIndex + 1]);
  assert(Number.isInteger(samples) && samples >= 1 && samples <= 10);
  const filterIndex = process.argv.indexOf("--filter");
  const filter = filterIndex < 0 ? "" : process.argv[filterIndex + 1];
  const selected = scenarios.filter((scenario) => scenario.name.includes(filter));
  assert(selected.length > 0, "No matching audit scenarios");
  const sources: Record<string, string> = {};
  for (const file of [
    ownFile,
    "packages/debug-adapter/src/capture-file.ts",
    "packages/debug-adapter/src/capture-file-reader.ts",
    "packages/debug-adapter/src/capture-v2.ts",
    "packages/disassembler/src/runtime-bus-trace.ts",
    "packages/disassembler/src/runtime-bus-types.ts",
    "packages/disassembler/src/runtime-ppu.ts",
    "packages/disassembler/src/runtime-transfer.ts",
    "packages/disassembler/src/runtime-graphics.ts",
    "packages/disassembler/src/runtime-bus-project.ts",
    "packages/disassembler/src/sqlite-store.ts",
    "packages/disassembler/src/sqlite-runtime-storage.ts",
    "packages/disassembler/src/sqlite-records.ts",
    "packages/disassembler/src/trace-cache.ts",
    "packages/vscode-extension/out/live-bus-analysis-process.cjs",
  ])
    sources[path.relative(process.cwd(), path.resolve(file))] = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
  const results = [];
  // Sequential child processes avoid cross-case heap/JIT and CPU contention.
  // Every child does identical unmeasured fixture creation. OS caches are warm.
  for (const scenario of selected) {
    const runs = [];
    for (let sample = 0; sample <= samples; sample++) {
      const value = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            "--expose-gc",
            "--conditions=uttori-source",
            "--import=tsx",
            ownFile,
            "--case",
            scenario.name,
          ],
          { stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "",
          stderr = "";
        child.stdout.on("data", (part) => {
          stdout += part;
        });
        child.stderr.on("data", (part) => {
          stderr += part;
        });
        child.on("error", reject);
        child.on("exit", (code) => {
          if (code !== 0) reject(new Error(`${scenario.name}: ${stderr}`));
          else {
            try {
              resolve(JSON.parse(stdout) as Record<string, unknown>);
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          }
        });
      });
      runs.push({ sample, warmup: sample === 0, ...value });
    }
    const walls = runs
      .slice(1)
      .map((run) => Number((run as Record<string, unknown>).wallMs))
      .sort((a, b) => a - b);
    const middle = Math.floor(walls.length / 2);
    let medianMs = walls[middle];
    if (walls.length % 2 === 0) medianMs = (walls[middle - 1] + medianMs) / 2;
    results.push({ scenario, medianMs, minMs: walls[0], maxMs: walls.at(-1), runs });
    await writeFile(
      output,
      JSON.stringify(
        {
          schemaVersion: 1,
          platform: `${process.platform}-${process.arch}`,
          runtime: process.version,
          events,
          measuredSamples: samples,
          methodology:
            "Fixture creation excluded. Sequential fresh processes, first sample warms OS caches only. Process RSS includes retained fixtures and untimed validation. Worker RSS is reported separately. Inclusive CPU samples overlap.",
          sources,
          results,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `${scenario.name}: ${medianMs.toFixed(2)} ms median (${walls[0].toFixed(2)}–${walls.at(-1)!.toFixed(2)})`,
    );
  }
}
