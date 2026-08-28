import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createSnesAssemblerEnvironment, SNES_TARGET_ID } from "@uttori/asm-plugin-snes";
import { WorkspaceIndex } from "@uttori/asm-core";
import { runWithInternalInstrumentation } from "../packages/core/src/internal-instrumentation.js";
import { aggregateSamples, type BenchmarkSample } from "./benchmark-report.js";

const root = process.cwd();

type RunMode = "cold" | "warm" | "warm-validate";

type IndexingBenchmarkOptions = {
  warmups: number;
  repetitions: number;
  modes: RunMode[];
  jsonPath?: string;
  isolate: boolean;
  phaseReport: boolean;
};

type IndexingSample = BenchmarkSample & {
  cachedRoots: number;
  analyzedRoots: number;
  fileCount: number;
  symbolCount: number;
  referenceCount: number;
};

const chouDir = path.join(root, "fixtures/integration/chou");
const chouEntryPoint = path.join(chouDir, "Chou.asm");

/**
 * Creates a fresh WorkspaceIndex pointed at the Chou project with an isolated
 * cache directory so cold/warm runs are controlled independently.
 * @param {string} cacheDir The cache directory.
 * @returns {Promise<WorkspaceIndex>} The workspace index.
 */
async function createIndex(cacheDir: string): Promise<WorkspaceIndex> {
  const snesEnvironment = await createSnesAssemblerEnvironment();
  return new WorkspaceIndex({
    environment: snesEnvironment,
    target: SNES_TARGET_ID,
    entryPoints: [chouEntryPoint],
    includePaths: [chouDir, "./"],
    cacheDir,
  });
}

/**
 * Runs a single timed indexing pass. Returns the sample.
 * @param {WorkspaceIndex} index The workspace index to reindex.
 * @returns {IndexingSample} Timing and status for this run.
 */
function runIndexingPass(index: WorkspaceIndex): IndexingSample {
  const started = performance.now();
  const instrumented = runWithInternalInstrumentation(() => index.reindex());
  const elapsed = performance.now() - started;
  const memory = process.memoryUsage();
  const status = index.getStatus();
  return {
    wallMs: elapsed,
    peakRssBytes: instrumented.metrics.peakRssBytes || memory.rss,
    peakHeapUsedBytes: instrumented.metrics.peakHeapUsedBytes || memory.heapUsed,
    phasesMs: instrumented.metrics.phasesMs,
    counters: instrumented.metrics.counters,
    cachedRoots: index.lastReindexCachedRoots,
    analyzedRoots: index.lastReindexAnalyzedRoots,
    fileCount: status.fileCount,
    symbolCount: status.symbolCount,
    referenceCount: status.referenceCount,
  };
}

/**
 * Runs one complete benchmark iteration for a given mode.
 * - cold: wipes the cache dir before reindexing (forces full re-analysis)
 * - warm: retains the cache dir (should be a cache hit)
 * - warm-validate: creates a fresh index instance over an existing cache (measures
 *   the startup overhead of reading + validating the cache without re-analysing)
 * @param {RunMode} mode The mode to benchmark.
 * @param {string} cacheDir The cache directory.
 * @param {WorkspaceIndex} sharedIndex The shared index.
 * @returns {Promise<IndexingSample>} The sample.
 */
async function runMode(
  mode: RunMode,
  cacheDir: string,
  sharedIndex: WorkspaceIndex,
): Promise<IndexingSample> {
  if (mode === "cold") {
    // Wipe cache and force a full reindex on the shared index.
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    sharedIndex.fullReindexRequired = true;
    sharedIndex.rootAnalyses.clear();
    return runIndexingPass(sharedIndex);
  }

  if (mode === "warm") {
    // Reindex on the existing (already populated) index — should be a full cache hit.
    sharedIndex.fullReindexRequired = true;
    sharedIndex.rootAnalyses.clear();
    return runIndexingPass(sharedIndex);
  }

  // warm-validate: spin up a brand-new index over the existing cache.
  // This simulates exactly what happens at language-server startup after the
  // first session has written the cache to disk.
  const freshIndex = await createIndex(cacheDir);
  return runIndexingPass(freshIndex);
}

/**
 * Runs the full benchmark sequence for one mode: warmups then measured reps.
 * @param {RunMode} mode The mode to benchmark.
 * @param {IndexingBenchmarkOptions} options Benchmark options.
 * @param {string} cacheDir The cache directory.
 * @param {WorkspaceIndex} sharedIndex The shared index.
 * @returns {Promise<IndexingSample[]>} The samples.
 */
async function benchmarkMode(
  mode: RunMode,
  options: IndexingBenchmarkOptions,
  cacheDir: string,
  sharedIndex: WorkspaceIndex,
): Promise<IndexingSample[]> {
  for (let warmup = 0; warmup < options.warmups; warmup++) {
    const w = warmup + 1;
    console.error(`[chou/${mode}] warmup ${w}/${options.warmups}…`);
    const started = performance.now();
    await runMode(mode, cacheDir, sharedIndex);
    console.error(
      `[chou/${mode}] warmup ${w}/${options.warmups} done in ${(performance.now() - started).toFixed(1)} ms`,
    );
  }

  const samples: IndexingSample[] = [];
  for (let rep = 0; rep < options.repetitions; rep++) {
    const r = rep + 1;
    console.error(`[chou/${mode}] rep ${r}/${options.repetitions}…`);
    const started = performance.now();
    const sample = await runMode(mode, cacheDir, sharedIndex);
    const elapsed = performance.now() - started;
    samples.push(sample);
    console.error(
      `[chou/${mode}] rep ${r}/${options.repetitions} done in ${elapsed.toFixed(1)} ms` +
        ` (cached=${sample.cachedRoots} analyzed=${sample.analyzedRoots}` +
        ` files=${sample.fileCount} symbols=${sample.symbolCount})`,
    );
    // Always print the phase table for each rep so the bottleneck is immediately visible.
    printPhaseTable(`${mode} rep ${r}`, sample.phasesMs);
  }
  return samples;
}

function runIsolated(
  mode: RunMode,
  options: IndexingBenchmarkOptions,
  cacheDir: string,
): IndexingSample[] {
  const scriptPath = fileURLToPath(import.meta.url);
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      scriptPath,
      "--internal-worker",
      mode,
      "--reps",
      String(options.repetitions),
      "--warmups",
      String(options.warmups),
      "--cache-dir",
      cacheDir,
    ],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (child.error) throw child.error;
  if (child.status !== 0) {
    throw new Error(
      `Isolated worker for [chou/${mode}] failed (status=${String(child.status)}): ${child.stderr.trim()}`,
    );
  }
  return JSON.parse(child.stdout) as IndexingSample[];
}

function gitRevision(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function parseOptions(args: string[]): IndexingBenchmarkOptions {
  const fast = args.includes("--fast");
  const options: IndexingBenchmarkOptions = {
    warmups: fast ? 0 : 1,
    repetitions: fast ? 1 : 3,
    modes: ["cold", "warm", "warm-validate"],
    isolate: args.includes("--isolate"),
    phaseReport: args.includes("--phase-report"),
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--warmups") {
      options.warmups = Number(args[++i]);
    } else if (arg === "--reps" || arg === "--repetitions") {
      options.repetitions = Number(args[++i]);
    } else if (arg === "--json") {
      options.jsonPath = args[++i];
    } else if (arg === "--mode") {
      const mode = args[++i] as RunMode;
      if (!["cold", "warm", "warm-validate"].includes(mode)) {
        throw new Error(`Unknown mode '${mode}'. Valid: cold, warm, warm-validate`);
      }
      options.modes = [mode];
    }
  }
  return options;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(1)} ms`;
}

/**
 * Known parent → children relationships for the LSP analysis phases.
 * Used to indent sub-phases under their logical parent in the phase table.
 */
const PHASE_CHILDREN: Record<string, string[]> = {
  lspAssemblerConstruct: [
    "pluginStateCreate",
    "directiveRegistryClone",
    "onSessionCreated",
    "constructorActivateStage",
  ],
  lspAnalyzeSource: [
    "sessionConstruct",
    "pluginStateClone",
    "buildProgramModel",
    "lowerProgram",
    "executeProgram",
    "finishPass",
  ],
  lspCacheWrite: ["cacheSerialize", "cacheDiskWrite"],
};

/** Phases that are sub-phases of some parent (not printed at top level). */
const CHILD_PHASES = new Set(Object.values(PHASE_CHILDREN).flat());

/**
 * Prints a phase breakdown table sorted by milliseconds descending.
 * Sub-phases are indented under their parent.
 * @param {string} label Title for the table.
 * @param {Record<string, number>} phasesMs Phase timings from instrumentation.
 */
function printPhaseTable(label: string, phasesMs: Record<string, number>): void {
  const entries = Object.entries(phasesMs);
  if (entries.length === 0) {
    console.log(`\nPhase breakdown (${label}): (no data)`);
    return;
  }

  const topLevel = entries
    .filter(([name]) => !CHILD_PHASES.has(name))
    .sort(([, a], [, b]) => b - a);

  const numLen = Math.max(...entries.map(([, ms]) => ms.toFixed(1).length)) + 3; // " ms"
  const nameLen = Math.max(...entries.map(([n]) => n.length)) + 4; // indent + extra

  console.log(`\nPhase breakdown (${label}):`);
  for (const [name, ms] of topLevel) {
    const children = (PHASE_CHILDREN[name] ?? [])
      .map((child) => [child, phasesMs[child] ?? 0] as [string, number])
      .filter(([, childMs]) => childMs > 0)
      .sort(([, a], [, b]) => b - a);

    const msStr = `${ms.toFixed(1)} ms`;
    console.log(`  ${name.padEnd(nameLen - 2)} ${msStr.padStart(numLen)}`);
    for (const [child, childMs] of children) {
      const childMsStr = `${childMs.toFixed(1)} ms`;
      console.log(`    ${child.padEnd(nameLen - 4)} ${childMsStr.padStart(numLen)}`);
    }
  }

  // Print any child phases that appeared but have no known parent (future-proofing).
  const orphans = entries
    .filter(([name]) => CHILD_PHASES.has(name) && !topLevel.some(([p]) => (PHASE_CHILDREN[p] ?? []).includes(name)))
    .sort(([, a], [, b]) => b - a);
  for (const [name, ms] of orphans) {
    const msStr = `${ms.toFixed(1)} ms`;
    console.log(`  ${name.padEnd(nameLen - 2)} ${msStr.padStart(numLen)}  (orphan sub-phase)`);
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const cacheDir = path.join(root, "fixtures/integration/chou/.uttori-asm/cache");

  console.log(
    `LSP indexing benchmark: ${options.warmups} warmup(s), ${options.repetitions} rep(s), modes=[${options.modes.join(",")}]`,
  );
  console.log(`Cache dir: ${cacheDir}`);

  // Ensure the cache dir exists and seed it with one cold run before measuring warm modes.
  fs.mkdirSync(cacheDir, { recursive: true });
  const sharedIndex = await createIndex(cacheDir);

  // Always do one cold seeding pass before warm modes so cache is populated.
  const hasCold = options.modes.includes("cold");
  const hasWarmModes =
    options.modes.includes("warm") || options.modes.includes("warm-validate");
  if (!hasCold && hasWarmModes) {
    console.error("[chou] seeding cache with one cold pass before warm modes…");
    sharedIndex.fullReindexRequired = true;
    sharedIndex.rootAnalyses.clear();
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    runIndexingPass(sharedIndex);
  }

  const results: Array<{
    mode: RunMode;
    samples: IndexingSample[];
    aggregate: ReturnType<typeof aggregateSamples>;
  }> = [];

  for (const mode of options.modes) {
    // For cold mode: wipe the cache before the first run so warmup + reps all start cold.
    if (mode === "cold") {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    let samples: IndexingSample[];
    if (options.isolate) {
      samples = runIsolated(mode, options, cacheDir);
    } else {
      samples = await benchmarkMode(mode, options, cacheDir, sharedIndex);
    }

    const aggregate = aggregateSamples(samples);
    results.push({ mode, samples, aggregate });

    const lastSample = samples[samples.length - 1];
    console.log(
      `chou/${mode.padEnd(14)} median ${formatMs(aggregate.wallMs.median).padStart(10)}` +
        `  MAD ${formatMs(aggregate.wallMs.medianAbsoluteDeviation).padStart(8)}` +
        `  range ${formatMs(aggregate.wallMs.min)}–${formatMs(aggregate.wallMs.max)}` +
        `  cached=${String(lastSample?.cachedRoots ?? 0)} analyzed=${String(lastSample?.analyzedRoots ?? 0)}` +
        `  files=${String(lastSample?.fileCount ?? 0)} symbols=${String(lastSample?.symbolCount ?? 0)}`,
    );
    // When --phase-report is set, also print a combined phase table using the median rep.
    if (options.phaseReport && samples.length > 0) {
      const medianRep = samples[Math.floor(samples.length / 2)];
      if (medianRep) {
        printPhaseTable(`${mode} median rep`, medianRep.phasesMs);
      }
    }
  }

  const report = {
    schemaVersion: 1,
    configuration: {
      warmups: options.warmups,
      repetitions: options.repetitions,
      modes: options.modes,
      processMode: options.isolate ? "isolated" : "in-process",
    },
    environment: {
      gitRevision: gitRevision(),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpuModel: os.cpus()[0]?.model ?? "unknown",
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
    },
    benchmarks: results.map(({ mode, samples, aggregate }) => ({
      id: `chou/${mode}`,
      mode,
      aggregate,
      samples,
    })),
  };

  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.jsonPath) {
    fs.writeFileSync(path.resolve(root, options.jsonPath), json);
    console.log(`JSON report written to ${options.jsonPath}`);
  } else {
    console.log("\nJSON report:");
    console.log(json.trimEnd());
  }
}

/**
 * Internal worker path — used when --isolate is set so each rep runs in a
 * fresh process without heap accumulation from prior reps.
 * @param {string[]} args Command line arguments.
 * @returns {Promise<boolean>} True if the worker was run, false otherwise.
 */
async function runInternalWorker(args: string[]): Promise<boolean> {
  const workerIndex = args.indexOf("--internal-worker");
  if (workerIndex < 0) return false;

  const mode = args[workerIndex + 1] as RunMode;
  const reps = Number(args[args.indexOf("--reps") + 1] || 1);
  const warmups = Number(args[args.indexOf("--warmups") + 1] || 0);
  const cacheDir = args[args.indexOf("--cache-dir") + 1] ?? "";

  const sharedIndex = await createIndex(cacheDir);
  const fakeopts: IndexingBenchmarkOptions = {
    warmups,
    repetitions: reps,
    modes: [mode],
    isolate: false,
    phaseReport: false,
  };
  const samples = await benchmarkMode(mode, fakeopts, cacheDir, sharedIndex);
  process.stdout.write(JSON.stringify(samples));
  return true;
}

if (!(await runInternalWorker(process.argv.slice(2)))) {
  await main();
}
