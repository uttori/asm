import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Assembler } from "../src/assembler.js";
import { runWithInternalInstrumentation } from "../src/internal-instrumentation.js";
import { aggregateSamples, type BenchmarkSample } from "./benchmark-report.js";

type Fixture = {
  id: string;
  category: "production" | "macro-heavy" | "include-heavy" | "instruction-encoding";
  source: string;
  target: string;
  checksumMode: "asar" | "simple";
};

type Golden = {
  bytes: number;
  sha256: string;
};

type BenchmarkOptions = {
  warmups: number;
  repetitions: number;
  jsonPath?: string;
  updateGoldens: boolean;
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
];

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
    }
  }
  if (options.repetitions === 0) {
    throw new Error("--repetitions must be at least one.");
  }
  return options;
}

function runFixture(fixture: Fixture): { sample: BenchmarkSample; output: Uint8Array } {
  const sourcePath = path.join(root, fixture.source);
  const targetPath = path.join(root, fixture.target);
  const source = fs.readFileSync(sourcePath, "utf8");
  const target = new Uint8Array(fs.readFileSync(targetPath));
  const started = performance.now();
  const instrumented = runWithInternalInstrumentation(() => {
    const assembler = new Assembler(target);
    assembler.setChecksumMode(fixture.checksumMode);
    assembler.setIncludePaths(["./", path.dirname(sourcePath)]);
    assembler.setCurrentFile(sourcePath);
    const program = assembler.buildProgramModel(source, sourcePath, 0);
    assembler.assembleProgram(program);
    return assembler.getBinaryOutput();
  });
  return {
    output: instrumented.value,
    sample: {
      wallMs: performance.now() - started,
      peakRssBytes: instrumented.metrics.peakRssBytes,
      peakHeapUsedBytes: instrumented.metrics.peakHeapUsedBytes,
      phasesMs: instrumented.metrics.phasesMs,
      counters: instrumented.metrics.counters,
    },
  };
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
  const updatedGoldens: Record<string, Golden> = {};
  const benchmarkResults = [];
  let validationFailed = false;

  for (const fixture of fixtures) {
    for (let warmup = 0; warmup < options.warmups; warmup++) {
      runFixture(fixture);
    }
    const samples: BenchmarkSample[] = [];
    let actual: Golden | undefined;
    for (let repetition = 0; repetition < options.repetitions; repetition++) {
      const run = runFixture(fixture);
      samples.push(run.sample);
      actual = { bytes: run.output.length, sha256: sha256(run.output) };
    }
    if (!actual) {
      throw new Error(`No measured output produced for ${fixture.id}.`);
    }
    updatedGoldens[fixture.id] = actual;
    const expected = goldens[fixture.id];
    const valid = options.updateGoldens || (
      expected !== undefined &&
      expected.bytes === actual.bytes &&
      expected.sha256 === actual.sha256
    );
    validationFailed ||= !valid;
    benchmarkResults.push({
      id: fixture.id,
      category: fixture.category,
      source: fixture.source,
      validation: { valid, expected: expected ?? null, actual },
      aggregate: aggregateSamples(samples),
      samples,
    });
  }

  if (options.updateGoldens) {
    fs.writeFileSync(goldenPath, `${JSON.stringify(updatedGoldens, null, 2)}\n`);
  }

  const report = {
    schemaVersion: 1,
    configuration: {
      warmups: options.warmups,
      repetitions: options.repetitions,
      instrumentation: true,
    },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpuModel: os.cpus()[0]?.model ?? "unknown",
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
    },
    benchmarks: benchmarkResults,
  };

  console.log(`Production benchmarks: ${options.warmups} warmup(s), ${options.repetitions} measured repetition(s)`);
  for (const result of benchmarkResults) {
    const status = result.validation.valid ? "PASS" : "FAIL";
    console.log(
      `${result.id.padEnd(22)} ${status}  median ${formatMilliseconds(result.aggregate.wallMs.median).padStart(11)}  p95 ${formatMilliseconds(result.aggregate.wallMs.p95).padStart(11)}  peak RSS ${(result.aggregate.peakRssBytes / 1048576).toFixed(1)} MiB  heap ${(result.aggregate.peakHeapUsedBytes / 1048576).toFixed(1)} MiB`,
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

main();
