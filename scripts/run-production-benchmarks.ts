import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Assembler } from "@uttori/asm-core";
import { createSnesAssemblerEnvironment, SNES_TARGET_ID } from "@uttori/asm-plugin-snes";
import {
  measureInternalPhase,
  runWithInternalInstrumentation,
  type InternalInstrumentationSnapshot,
} from "../packages/core/src/internal-instrumentation.js";
import { aggregateSamples, type BenchmarkSample } from "./benchmark-report.js";

const snesEnvironment = await createSnesAssemblerEnvironment();

type FixtureBase = {
  id: string;
  category: "production" | "macro-heavy" | "include-heavy" | "instruction-encoding";
  source: string;
};

type SingleSourceFixture = FixtureBase & {
  kind?: "single-source";
  target: string;
  checksumMode: "asar" | "simple";
};

type SmrpgFixture = FixtureBase & {
  kind: "smrpg";
};

type Fixture = SingleSourceFixture | SmrpgFixture;

type Golden = {
  bytes: number;
  sha256: string;
};

type BenchmarkOptions = {
  warmups: number;
  repetitions: number;
  jsonPath?: string;
  updateGoldens: boolean;
  fixtureIds: string[];
  isolate: boolean;
  instrumentation: boolean;
  maxMedianMs?: number;
};

type FixtureRun = {
  sample: BenchmarkSample;
  actual: Golden;
};

const root = process.cwd();
const goldenPath = path.join(root, "scripts/benchmark-goldens.json");
const fixtures: Fixture[] = [
  {
    id: "slideshow",
    category: "production",
    source: "fixtures/integration/snes-slideshow/SLIDE.SRC",
    target: "fixtures/integration/snes-slideshow/test.sfc",
    checksumMode: "simple",
  },
  {
    id: "macro-variadic",
    category: "macro-heavy",
    source: "fixtures/asar/tests/variadic_syntax.asm",
    target: "fixtures/asar/dummy_rom.sfc",
    checksumMode: "asar",
  },
  {
    id: "include-once",
    category: "include-heavy",
    source: "fixtures/asar/tests/includeonce.asm",
    target: "fixtures/asar/dummy_rom.sfc",
    checksumMode: "asar",
  },
  {
    id: "instruction-encoding",
    category: "instruction-encoding",
    source: "fixtures/asar/tests/opcodesize.asm",
    target: "fixtures/asar/dummy_rom.sfc",
    checksumMode: "asar",
  },
  {
    id: "chou",
    category: "production",
    source: "fixtures/integration/chou/Chou.asm",
    target: "fixtures/integration/chou/test.sfc",
    checksumMode: "simple",
  },
  {
    id: "smrpg",
    category: "production",
    kind: "smrpg",
    source: "fixtures/integration/Super-Mario-RPG-Disassembly/Global/AssembleFile.asm",
  },
];
const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function parseNonNegativeInteger(value: string | undefined, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${option} requires a non-negative integer.`);
  }
  return parsed;
}

function parseOptions(args: string[]): BenchmarkOptions {
  const fast = args.includes("--fast");
  const options: BenchmarkOptions = {
    warmups: fast ? 0 : 1,
    repetitions: fast ? 1 : 5,
    updateGoldens: args.includes("--update-goldens"),
    fixtureIds: [],
    isolate: args.includes("--isolate"),
    instrumentation: !args.includes("--no-instrumentation"),
  };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--warmups") {
      options.warmups = parseNonNegativeInteger(args[++index], argument);
    } else if (argument === "--repetitions") {
      options.repetitions = parseNonNegativeInteger(args[++index], argument);
    } else if (argument === "--json") {
      options.jsonPath = args[++index];
      if (!options.jsonPath) {
        throw new Error("--json requires an output path.");
      }
    } else if (argument === "--fixture") {
      const fixtureIds = args[++index]?.split(",").filter(Boolean);
      if (!fixtureIds?.length) {
        throw new Error("--fixture requires a fixture id or comma-separated fixture ids.");
      }
      options.fixtureIds.push(...fixtureIds);
    } else if (argument === "--max-median-ms") {
      options.maxMedianMs = parseNonNegativeInteger(args[++index], argument);
    }
  }
  if (options.repetitions === 0) {
    throw new Error("--repetitions must be at least one.");
  }
  for (const fixtureId of options.fixtureIds) {
    if (!fixtureById.has(fixtureId)) {
      throw new Error(
        `Unknown fixture '${fixtureId}'. Available fixtures: ${fixtures.map((fixture) => fixture.id).join(", ")}.`,
      );
    }
  }
  return options;
}

function emptyMetrics(): InternalInstrumentationSnapshot {
  return {
    counters: {
      passProgramCacheHits: 0,
      passProgramCacheMisses: 0,
      passProgramCachePeakSize: 0,
      normalizedCommandClones: 0,
      actualReparses: 0,
      includeReads: 0,
      includeBytesRead: 0,
      includeTextCacheHits: 0,
      includeResolutionCacheHits: 0,
      expressionEvaluations: 0,
      expressionStringEvaluations: 0,
      expressionUniqueStringEvaluations: 0,
      expressionNodeEvaluations: 0,
      expressionUniqueNodeEvaluations: 0,
      pureExpressionEvaluations: 0,
      pureExpressionUniqueNodes: 0,
      pureStringExpressionEvaluations: 0,
      pureStringExpressionUniqueValues: 0,
      pureStringExpressionCacheHits: 0,
      pureStringExpressionCacheMisses: 0,
      macroExpansions: 0,
      macroLinesProcessed: 0,
      passthroughDispatches: 0,
      loweredProgramBuilds: 0,
      runtimeNodesLowered: 0,
      referenceCollections: 0,
      addressMappings: 0,
      assemblerConstructions: 0,
      sessionConstructions: 0,
      cacheWriteBytes: 0,
    },
    phasesMs: {},
    peakRssBytes: 0,
    peakHeapUsedBytes: 0,
  };
}

function assembleSmrpgFixture(): Uint8Array {
  const fixtureDir = path.join(root, "fixtures/integration/Super-Mario-RPG-Disassembly");
  const globalDir = path.join(fixtureDir, "Global");
  const gameDir = path.join(fixtureDir, "SMRPG");
  const sourcePath = path.join(globalDir, "AssembleFile.asm");
  const enginePath = path.join(gameDir, "SPC700/Engine.bin");
  const source = fs.readFileSync(sourcePath, "utf8");
  const includePaths = ["./", globalDir, gameDir];

  const assembleProduct = (
    fileType: number,
    extraDefines: Readonly<Record<string, string>> | undefined,
    baseImage: Uint8Array | undefined,
  ): Uint8Array => {
    const assembler = new Assembler({
      environment: snesEnvironment,
      target: SNES_TARGET_ID,
      targetOptions: { checksumMode: "asar" },
      baseImage,
      collectSourceMetadata: false,
    });
    try {
      if (baseImage && baseImage.length > 0) {
        assembler.outputBytes = Array.from(baseImage);
      }
      assembler.setIncludePaths(includePaths);
      assembler.setCurrentFile(sourcePath);
      assembler.defines.set("GameID", "SMRPG");
      assembler.defines.set("ROMID", "SMRPG_U");
      assembler.defines.set("FileType", String(fileType));
      if (extraDefines) {
        for (const [name, value] of Object.entries(extraDefines)) {
          assembler.defines.set(name, value);
        }
      }
      const program = assembler.buildProgramModel(source, sourcePath, 0);
      assembler.assembleProgram(program);
      return assembler.getBinaryOutput();
    } finally {
      assembler.dispose();
    }
  };

  const initialized = measureInternalPhase("smrpg.initialize", () =>
    assembleProduct(0, undefined, undefined),
  );
  const engine = measureInternalPhase("smrpg.engine", () =>
    assembleProduct(4, { PathToFile: "SPC700/Engine.asm" }, undefined),
  );
  fs.writeFileSync(enginePath, engine);
  try {
    const assembled = measureInternalPhase("smrpg.main", () =>
      assembleProduct(1, undefined, initialized),
    );
    return measureInternalPhase("smrpg.finalize", () => assembleProduct(2, undefined, assembled));
  } finally {
    fs.rmSync(enginePath, { force: true });
  }
}

function assembleFixture(fixture: Fixture): Uint8Array {
  if (fixture.kind === "smrpg") {
    return assembleSmrpgFixture();
  }
  const sourcePath = path.join(root, fixture.source);
  const targetPath = path.join(root, fixture.target);
  const source = fs.readFileSync(sourcePath, "utf8");
  const target = new Uint8Array(fs.readFileSync(targetPath));
  const assembler = new Assembler({
    environment: snesEnvironment,
    target: SNES_TARGET_ID,
    targetOptions: { checksumMode: fixture.checksumMode },
    baseImage: target,
    collectSourceMetadata: false,
  });
  try {
    assembler.setIncludePaths(["./", path.dirname(sourcePath)]);
    assembler.setCurrentFile(sourcePath);
    const program = assembler.buildProgramModel(source, sourcePath, 0);
    assembler.assembleProgram(program);
    return assembler.getBinaryOutput();
  } finally {
    assembler.dispose();
  }
}

function runFixture(fixture: Fixture, instrumentation: boolean): FixtureRun {
  const started = performance.now();
  const instrumented = instrumentation
    ? runWithInternalInstrumentation(() => assembleFixture(fixture))
    : { value: assembleFixture(fixture), metrics: emptyMetrics() };
  const elapsed = performance.now() - started;
  if (!instrumentation) {
    const memory = process.memoryUsage();
    instrumented.metrics.peakRssBytes = memory.rss;
    instrumented.metrics.peakHeapUsedBytes = memory.heapUsed;
  }
  return {
    actual: {
      bytes: instrumented.value.length,
      sha256: sha256(instrumented.value),
    },
    sample: {
      wallMs: elapsed,
      peakRssBytes: instrumented.metrics.peakRssBytes,
      peakHeapUsedBytes: instrumented.metrics.peakHeapUsedBytes,
      phasesMs: instrumented.metrics.phasesMs,
      counters: instrumented.metrics.counters,
    },
  };
}

function runFixtureIsolated(fixture: Fixture, instrumentation: boolean): FixtureRun {
  const scriptPath = fileURLToPath(import.meta.url);
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      scriptPath,
      "--internal-worker",
      fixture.id,
      `--instrumentation=${instrumentation ? "true" : "false"}`,
    ],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (child.error) {
    throw child.error;
  }
  if (child.status !== 0) {
    throw new Error(
      `Isolated benchmark for ${fixture.id} failed with status ${String(child.status)}: ${child.stderr.trim()}`,
    );
  }
  return JSON.parse(child.stdout) as FixtureRun;
}

function gitRevision(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function readGoldens(): Record<string, Golden> {
  return JSON.parse(fs.readFileSync(goldenPath, "utf8")) as Record<string, Golden>;
}

function formatMilliseconds(value: number): string {
  return `${value.toFixed(2)} ms`;
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  const goldens = readGoldens();
  const selectedFixtures =
    options.fixtureIds.length > 0
      ? options.fixtureIds.map((fixtureId) => fixtureById.get(fixtureId) as Fixture)
      : fixtures;
  const updatedGoldens: Record<string, Golden> = {};
  const benchmarkResults = [];
  let validationFailed = false;

  for (const fixture of selectedFixtures) {
    for (let warmup = 0; warmup < options.warmups; warmup++) {
      console.error(
        `[${fixture.id}] warmup ${warmup + 1}/${options.warmups} (${options.isolate ? "isolated" : "in-process"})...`,
      );
      const started = performance.now();
      if (options.isolate) {
        runFixtureIsolated(fixture, options.instrumentation);
      } else {
        runFixture(fixture, options.instrumentation);
      }
      console.error(
        `[${fixture.id}] warmup completed in ${formatMilliseconds(performance.now() - started)}.`,
      );
    }
    const samples: BenchmarkSample[] = [];
    let actual: Golden | undefined;
    for (let repetition = 0; repetition < options.repetitions; repetition++) {
      console.error(
        `[${fixture.id}] measured ${repetition + 1}/${options.repetitions} (${options.isolate ? "isolated" : "in-process"})...`,
      );
      const run = options.isolate
        ? runFixtureIsolated(fixture, options.instrumentation)
        : runFixture(fixture, options.instrumentation);
      samples.push(run.sample);
      actual = run.actual;
      console.error(
        `[${fixture.id}] measured ${repetition + 1}/${options.repetitions} completed in ${formatMilliseconds(run.sample.wallMs)}.`,
      );
    }
    if (!actual) {
      throw new Error(`No measured output produced for ${fixture.id}.`);
    }
    updatedGoldens[fixture.id] = actual;
    const expected = goldens[fixture.id];
    const valid =
      options.updateGoldens ||
      (expected !== undefined &&
        expected.bytes === actual.bytes &&
        expected.sha256 === actual.sha256);
    validationFailed ||= !valid;
    const aggregate = aggregateSamples(samples);
    const performanceValid =
      options.maxMedianMs === undefined || aggregate.wallMs.median <= options.maxMedianMs;
    validationFailed ||= !performanceValid;
    benchmarkResults.push({
      id: fixture.id,
      category: fixture.category,
      source: fixture.source,
      validation: { valid, expected: expected ?? null, actual },
      performance: {
        valid: performanceValid,
        maxMedianMs: options.maxMedianMs ?? null,
      },
      aggregate,
      samples,
    });
  }

  if (options.updateGoldens) {
    fs.writeFileSync(goldenPath, `${JSON.stringify({ ...goldens, ...updatedGoldens }, null, 2)}\n`);
  }

  const report = {
    schemaVersion: 2,
    configuration: {
      warmups: options.warmups,
      repetitions: options.repetitions,
      instrumentation: options.instrumentation,
      memorySampling: options.instrumentation ? "phase-boundary" : "end-of-run",
      processMode: options.isolate ? "isolated" : "in-process",
      fixtureIds: selectedFixtures.map((fixture) => fixture.id),
      maxMedianMs: options.maxMedianMs ?? null,
    },
    environment: {
      gitRevision: gitRevision(),
      node: process.version,
      execArgv: process.execArgv,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpuModel: os.cpus()[0]?.model ?? "unknown",
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
    },
    benchmarks: benchmarkResults,
  };

  console.log(
    `Production benchmarks: ${options.warmups} warmup(s), ${options.repetitions} measured repetition(s)`,
  );
  const rssLabel = options.instrumentation ? "peak RSS" : "end RSS";
  for (const result of benchmarkResults) {
    const status = !result.validation.valid ? "FAIL" : result.performance.valid ? "PASS" : "SLOW";
    console.log(
      `${result.id.padEnd(22)} ${status}  median ${formatMilliseconds(result.aggregate.wallMs.median).padStart(11)}  MAD ${formatMilliseconds(result.aggregate.wallMs.medianAbsoluteDeviation).padStart(11)}  range ${formatMilliseconds(result.aggregate.wallMs.min)}–${formatMilliseconds(result.aggregate.wallMs.max)}  ${rssLabel} ${(result.aggregate.peakRssBytes / 1048576).toFixed(1)} MiB  heap ${(result.aggregate.peakHeapUsedBytes / 1048576).toFixed(1)} MiB`,
    );
  }

  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.jsonPath) {
    fs.writeFileSync(path.resolve(root, options.jsonPath), json);
  } else {
    console.log("\nJSON report:");
    console.log(json.trimEnd());
  }
  if (validationFailed) {
    process.exitCode = 1;
  }
}

function runInternalWorker(args: string[]): boolean {
  const workerIndex = args.indexOf("--internal-worker");
  if (workerIndex < 0) {
    return false;
  }
  const fixtureId = args[workerIndex + 1];
  const fixture = fixtureId ? fixtureById.get(fixtureId) : undefined;
  if (!fixture) {
    throw new Error(`Unknown internal worker fixture '${String(fixtureId)}'.`);
  }
  const instrumentation = args.includes("--instrumentation=true");
  process.stdout.write(JSON.stringify(runFixture(fixture, instrumentation)));
  return true;
}

if (!runInternalWorker(process.argv.slice(2))) {
  main();
}
