import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { Session } from "node:inspector/promises";
import os from "node:os";
import path from "node:path";
import { PerformanceObserver } from "node:perf_hooks";
import { setImmediate } from "node:timers/promises";

import { Assembler } from "../packages/core/src/assembler.js";
import { runWithInternalInstrumentation } from "../packages/core/src/internal-instrumentation.js";
import { InstructionResolutionFrame } from "../packages/core/src/ir/resolved-instruction.js";
import {
  create65xxAssemblerEnvironment,
  RAW_65XX_TARGET_ID,
} from "../packages/plugin-65xx/src/index.js";
import {
  createSnesAssemblerEnvironment,
  SNES_TARGET_ID,
} from "../packages/plugin-snes/src/index.js";
import { benchmarkStatistics } from "./benchmark-report.js";

/** Independent byte recipes allow profiling without accepting the first assembly as its oracle. */
type Fixture = {
  source: string;
  expected: Uint8Array;
  cpu?: boolean;
  inputs?: Record<string, string>;
};
/** Every matrix cell gets a new process; inspector and forced GC never enter throughput samples. */
type Options = {
  output: string;
  fixtures: string[];
  scales: number[];
  metadata: boolean[];
  repetitions: number;
  warmups: number;
  mode: "timing" | "observe";
  worker: boolean;
};
const fixtureNames = [
  "65xx",
  "65816",
  "spc700",
  "superfx",
  "macro-string-struct",
  "large-generated",
  "include-heavy",
  "reference-heavy",
  "byte-heavy",
];
const hash = (data: string | Uint8Array): string => createHash("sha256").update(data).digest("hex");

/** Matrix counts must be finite safe integers so invalid requests never create partial runs. */
function positive(text: string): number {
  const number = Number(text);
  assert.ok(Number.isSafeInteger(number) && number > 0, `Invalid positive integer: ${text}`);
  return number;
}

/** Reject malformed matrix dimensions before starting potentially expensive child processes. */
function parseOptions(): Options {
  const args = process.argv.slice(2);
  const value = (flag: string, fallback: string): string => {
    const index = args.indexOf(flag);
    if (index < 0) {
      return fallback;
    }
    assert.ok(args[index + 1] && !args[index + 1].startsWith("--"), `${flag} needs a value`);
    return args[index + 1];
  };
  const mode = value("--mode", "timing");
  assert.ok(mode === "timing" || mode === "observe", "--mode must be timing or observe");
  const metadata = value("--metadata", "false,true").split(",");
  assert.ok(metadata.every((entry) => entry === "true" || entry === "false"));
  const fixtures = value("--fixtures", fixtureNames.join(",")).split(",");
  assert.ok(
    fixtures.every((entry) => fixtureNames.includes(entry)),
    "Unknown fixture",
  );
  const scales = value("--scales", "1,2,4").split(",").map(positive);
  // The raw 6502 recipe must stay within its 16-bit address space.
  assert.ok(
    scales.every((scale) => scale <= 16),
    "Scale must be at most 16",
  );
  return {
    output: path.resolve(value("--output", "/tmp/assembler-ast-profile")),
    fixtures,
    scales,
    metadata: metadata.map((entry) => entry === "true"),
    repetitions: positive(value("--repetitions", "7")),
    warmups: positive(value("--warmups", "2")),
    mode,
    worker: args.includes("--worker"),
  };
}

/** Match the original AST recipes where available, adding scalable instruction and include cases. */
function createFixture(name: string, scale: number, root: string): Fixture {
  const sourceHeader = "lorom\norg $808000\n";
  if (name === "65xx") {
    const count = 256 * scale;
    return {
      cpu: true,
      source:
        "org $8000\n" +
        Array.from(
          { length: count },
          (_, i) => `Label${i}:\nlda #${i & 255}\nsta $0200+${i},x\nlda Label${(i + 1) % count}\n`,
        ).join(""),
      expected: Uint8Array.from(
        Array.from({ length: count }, (_, i) => {
          const address = 0x8000 + 8 * ((i + 1) % count);
          return [
            0xa9,
            i & 255,
            0x9d,
            (0x200 + i) & 255,
            (0x200 + i) >> 8,
            0xad,
            address & 255,
            address >> 8,
          ];
        }).flat(),
      ),
    };
  }
  if (name === "65816") {
    const count = 512 * scale;
    return {
      source:
        sourceHeader +
        Array.from(
          { length: count },
          (_, i) => `lda.b #${i & 255}\nsta.w $0200,x\nlda.l $7e0200\n`,
        ).join(""),
      expected: Uint8Array.from(
        Array.from({ length: count }, (_, i) => [
          0xa9,
          i & 255,
          0x9d,
          0,
          2,
          0xaf,
          0,
          2,
          0x7e,
        ]).flat(),
      ),
    };
  }
  if (name === "spc700") {
    return {
      source: sourceHeader + "arch spc700\n" + "mov a,#7\nmov $20,a\ninc a\n".repeat(512 * scale),
      expected: Uint8Array.from(
        Array.from({ length: 512 * scale }, () => [0xe8, 7, 0xc4, 0x20, 0xbc]).flat(),
      ),
    };
  }
  if (name === "superfx") {
    return {
      source: sourceHeader + "arch superfx\n" + "nop\nstop\n".repeat(1024 * scale),
      expected: Uint8Array.from(Array.from({ length: 1024 * scale }, () => [1, 0]).flat()),
    };
  }
  if (name === "macro-string-struct") {
    return {
      source:
        sourceHeader +
        'struct Pair $0000\n.a: skip 1\n.b: skip 1\nendstruct\nmacro emit(value)\ndb "AB", <value>\nendmacro\n' +
        Array.from({ length: 256 * scale }, (_, i) => `%emit(${i & 255})\ndw Pair.b\n`).join(""),
      expected: Uint8Array.from(
        Array.from({ length: 256 * scale }, (_, i) => [65, 66, i & 255, 1, 0]).flat(),
      ),
    };
  }
  if (name === "large-generated") {
    return {
      source:
        sourceHeader +
        Array.from(
          { length: 4096 * scale },
          (_, i) => `Block${i}: db (${i & 255} + 1) & $ff\n`,
        ).join(""),
      expected: Uint8Array.from({ length: 4096 * scale }, (_, i) => (i + 1) & 255),
    };
  }
  if (name === "reference-heavy") {
    const count = 512 * scale;
    // Keep every 3-byte instruction and pair of 2-byte references inside the same mapped bank.
    assert.ok(scale <= 9, "reference-heavy must fit one LoROM bank");
    const target = 0x8000 + count * 7;
    const low = target & 255;
    const high = target >> 8;
    return {
      source:
        sourceHeader +
        "lda.w #Target&$ffff\ndw Target&$ffff,Target&$ffff\n".repeat(count) +
        "Target: db 0\n",
      expected: Uint8Array.from([
        ...Array.from({ length: count }, () => [0xa9, low, high, low, high, low, high]).flat(),
        0,
      ]),
    };
  }
  if (name === "byte-heavy") {
    assert.ok(scale <= 4, "byte-heavy supports at most 4 MiB of LoROM output");
    const bytes = 1024 * 1024 * scale;
    const bank = new Uint8Array(0x8000).fill(0x5a);
    fs.writeFileSync(path.join(root, "payload.bin"), bank);
    // Explicit mapped-bank origins avoid relying on a target's bank-crossing write policy.
    const chunks = Array.from(
      { length: bytes / bank.length },
      (_, index) => `org $${(0x808000 + index * 0x10000).toString(16)}\nincbin "payload.bin"\n`,
    );
    return {
      source: "lorom\n" + chunks.join(""),
      inputs: { "payload.bin": hash(bank) },
      expected: new Uint8Array(bytes).fill(0x5a),
    };
  }
  const inputs: Record<string, string> = {};
  const includes = Array.from({ length: 64 * scale }, (_entry, index) => {
    const file = `include-${index}.asm`;
    const body = Array.from({ length: 16 }, (_, i) => `db (${index * 16 + i} + 1) & $ff\n`).join(
      "",
    );
    fs.writeFileSync(path.join(root, file), body);
    inputs[file] = hash(body);
    return `incsrc "${file}"\n`;
  });
  return {
    source: sourceHeader + includes.join(""),
    inputs,
    expected: Uint8Array.from({ length: 1024 * scale }, (_, i) => (i + 1) & 255),
  };
}

/** Fingerprint current source bytes because HEAD alone does not identify a dirty benchmark checkout. */
function sourceHashes(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const directory of [
    "packages/core/src",
    "packages/plugin-65xx/src",
    "packages/plugin-snes/src",
  ]) {
    for (const entry of fs.readdirSync(directory, { recursive: true }).map(String).toSorted()) {
      const file = path.join(directory, entry);
      if (file.endsWith(".ts") && fs.statSync(file).isFile()) {
        result[file] = hash(fs.readFileSync(file));
      }
    }
  }
  return result;
}

/** Memory snapshots are operation boundaries, not an estimate of the unsampled peak heap. */
function memory() {
  return { ...process.memoryUsage(), processPeakRssBytes: process.resourceUsage().maxRSS * 1024 };
}

/** A forced full collection makes live-object comparisons distinct from V8's reserved capacity. */
function collect() {
  assert.ok(global.gc, "Run observation workers with --expose-gc");
  global.gc();
  global.gc();
  return memory();
}

/** Weight CPU self samples by microseconds; inclusive entries overlap and must never be added. */
function summarizeCpu(profile: import("node:inspector").Profiler.Profile) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map<number, number>();
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) {
      parents.set(child, node.id);
    }
  }
  const self = new Map<string, number>();
  const inclusive = new Map<string, number>();
  const key = (id: number): string => {
    const frame = nodes.get(id)!.callFrame;
    return `${frame.functionName || "(anonymous)"} ${frame.url}:${frame.lineNumber + 1}`;
  };
  let totalUs = 0;
  for (let i = 0; i < (profile.samples?.length ?? 0); i++) {
    let id: number | undefined = profile.samples![i];
    const weight = profile.timeDeltas?.[i] ?? 0;
    totalUs += weight;
    self.set(key(id), (self.get(key(id)) ?? 0) + weight);
    const seen = new Set<string>();
    while (id !== undefined) {
      const site = key(id);
      if (!seen.has(site)) {
        inclusive.set(site, (inclusive.get(site) ?? 0) + weight);
      }
      seen.add(site);
      id = parents.get(id);
    }
  }
  const rank = (values: Map<string, number>) =>
    [...values]
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 35)
      .map(([site, us]) => ({ site, ms: us / 1000, percent: (us / totalUs) * 100 }));
  return { totalSampledMs: totalUs / 1000, self: rank(self), inclusive: rank(inclusive) };
}

/** Sampling includes collected objects to expose allocation churn, not just surviving objects. */
function summarizeAllocations(profile: import("node:inspector").HeapProfiler.SamplingHeapProfile) {
  const sites = new Map<string, number>();
  const visit = (node: typeof profile.head) => {
    const frame = node.callFrame;
    const site = `${frame.functionName || "(anonymous)"} ${frame.url}:${frame.lineNumber + 1}`;
    sites.set(site, (sites.get(site) ?? 0) + node.selfSize);
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(profile.head);
  const totalSampledBytes = [...sites.values()].reduce((sum, size) => sum + size, 0);
  return {
    totalSampledBytes,
    self: [...sites]
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 35)
      .map(([site, bytes]) => ({ site, bytes, percent: (bytes / totalSampledBytes) * 100 })),
  };
}

/** Run a single matrix cell; the output file is written only after every byte oracle passes. */
async function worker(options: Options): Promise<void> {
  const name = options.fixtures[0],
    scale = options.scales[0],
    metadata = options.metadata[0];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-ast-profile-"));
  try {
    const fixture = createFixture(name, scale, root);
    const environment = fixture.cpu
      ? await create65xxAssemblerEnvironment()
      : await createSnesAssemblerEnvironment();
    const file = path.join(root, `${name}.asm`);
    const expected = hash(fixture.expected);
    const create = () => {
      const assembler = new Assembler({
        environment,
        target: fixture.cpu ? RAW_65XX_TARGET_ID : SNES_TARGET_ID,
        targetOptions: fixture.cpu ? { origin: 0x8000 } : { checksumEnabled: false },
        collectSourceMetadata: metadata,
      });
      assembler.includePaths = [root];
      return assembler;
    };
    const run = () => {
      const assembler = create();
      try {
        assembler.assembleSource(fixture.source, file);
        return assembler.getBinaryOutput();
      } finally {
        assembler.dispose();
      }
    };
    const validate = (bytes: Uint8Array) => {
      assert.equal(bytes.length, fixture.expected.length);
      assert.equal(hash(bytes), expected);
    };
    const receipt = {
      name,
      scale,
      metadata,
      mode: options.mode,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpu: os.cpus()[0].model,
      qualification: process.env.UTTORI_AST_QUALIFY ?? "unset",
      runtime: import.meta.filename.endsWith(".ts") ? "tsx-source" : "bundle",
      harnessSha256: hash(fs.readFileSync(import.meta.filename)),
      sourceHarnessSha256: hash(fs.readFileSync("scripts/profile-assembler-ast.ts")),
      statisticsHelperSha256: hash(fs.readFileSync("scripts/benchmark-report.ts")),
      packageLockSha256: hash(fs.readFileSync("package-lock.json")),
      sourceHashes: sourceHashes(),
      sourceBytes: Buffer.byteLength(fixture.source),
      sourceLines: fixture.source.split("\n").length,
      inputSha256: hash(fixture.source),
      includeHashes: fixture.inputs,
      outputSha256: expected,
      outputBytes: fixture.expected.length,
    };
    const samples = [];
    for (let index = 0; index < options.warmups + options.repetitions; index++) {
      const started = performance.now();
      const bytes = run();
      const wallMs = performance.now() - started;
      validate(bytes);
      samples.push({ state: index < options.warmups ? "warmup" : "warm", wallMs });
    }
    if (options.mode === "timing") {
      fs.writeFileSync(
        options.output,
        JSON.stringify(
          {
            ...receipt,
            samples,
            warm: benchmarkStatistics(
              samples.slice(options.warmups).map((sample) => sample.wallMs),
            ),
            endMemory: memory(),
          },
          null,
          2,
        ) + "\n",
      );
      return;
    }
    const boundaries: { phase: string; memory: ReturnType<typeof memory> }[] = [];
    boundaries.push({ phase: "baselineAfterGc", memory: collect() });
    let assembler: Assembler | undefined = create();
    boundaries.push({ phase: "constructedAfterGc", memory: collect() });
    let program: ReturnType<Assembler["buildProgramModel"]> | undefined =
      assembler.buildProgramModel(fixture.source, file);
    boundaries.push({ phase: "parsedAfterGc", memory: collect() });
    // Observe the full-build orchestrator, including reclamation between completed stages.
    // Keep an unbound method so the observer itself cannot retain a released assembler.
    // oxlint-disable-next-line typescript/unbound-method -- Restored below and invoked with explicit this.
    const runStage = assembler.runStage;
    assembler.runStage = function (stage, source) {
      const state = runStage.call(this, stage, source);
      boundaries.push({ phase: stage, memory: memory() });
      boundaries.push({ phase: `${stage}AfterGc`, memory: collect() });
      return state;
    };
    try {
      assembler.assembleProgram(program);
    } finally {
      assembler.runStage = runStage;
    }
    let bytes: Uint8Array | undefined = assembler.getBinaryOutput();
    validate(bytes);
    boundaries.push({ phase: "output", memory: memory() });
    assembler.dispose();
    boundaries.push({ phase: "disposedWithReferencesAfterGc", memory: collect() });
    assembler = undefined;
    program = undefined;
    bytes = undefined;
    boundaries.push({ phase: "releasedAfterGc", memory: collect() });
    const frameCounts = {
      selections: 0,
      stateCopies: 0,
      scalarSelections: 0,
      scalarValues: 0,
      snapshots: 0,
    };
    // oxlint-disable-next-line typescript/unbound-method -- The saved method is invoked with apply and restored below.
    const choose = InstructionResolutionFrame.prototype.choose;
    // oxlint-disable-next-line typescript/unbound-method -- The saved method is invoked with apply and restored below.
    const chooseScalars = InstructionResolutionFrame.prototype.chooseScalars;
    // oxlint-disable-next-line typescript/unbound-method -- The saved method is invoked with call and restored below.
    const snapshot = InstructionResolutionFrame.prototype.snapshot;
    let instrumented: ReturnType<typeof runWithInternalInstrumentation<Uint8Array>>;
    // Count frame work in its own observation. Restore shared prototypes before CPU/heap sampling.
    InstructionResolutionFrame.prototype.choose = function (...args) {
      frameCounts.selections++;
      if (args[2] !== undefined && args[2] !== null) {
        frameCounts.stateCopies++;
      }
      return choose.apply(this, args);
    };
    InstructionResolutionFrame.prototype.chooseScalars = function (...args) {
      frameCounts.selections++;
      frameCounts.scalarSelections++;
      frameCounts.scalarValues += args.length - 2;
      return chooseScalars.apply(this, args);
    };
    InstructionResolutionFrame.prototype.snapshot = function () {
      frameCounts.snapshots++;
      return snapshot.call(this);
    };
    try {
      instrumented = runWithInternalInstrumentation(run);
      validate(instrumented.value);
    } finally {
      InstructionResolutionFrame.prototype.choose = choose;
      InstructionResolutionFrame.prototype.chooseScalars = chooseScalars;
      InstructionResolutionFrame.prototype.snapshot = snapshot;
    }
    const retention = [];
    for (let batch = 0; batch < 4; batch++) {
      for (let index = 0; index < 5; index++) {
        validate(run());
      }
      retention.push({ assemblies: (batch + 1) * 5, memory: collect() });
    }
    const gcEntries: { kind: number; durationMs: number }[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const detail: unknown = Reflect.get(entry, "detail");
        assert.ok(typeof detail === "object" && detail !== null && "kind" in detail);
        assert.equal(typeof detail.kind, "number");
        if (typeof detail.kind === "number") {
          gcEntries.push({ kind: detail.kind, durationMs: entry.duration });
        }
      }
    });
    const session = new Session();
    session.connect();
    try {
      collect();
      await session.post("Profiler.enable");
      await session.post("Profiler.setSamplingInterval", { interval: 500 });
      observer.observe({ entryTypes: ["gc"] });
      await session.post("Profiler.start");
      for (let index = 0; index < 5; index++) {
        validate(run());
      }
      const { profile: cpuProfile } = await session.post("Profiler.stop");
      await setImmediate();
      await setImmediate();
      observer.disconnect();
      collect();
      await session.post("HeapProfiler.startSampling", {
        samplingInterval: 32768,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      });
      for (let index = 0; index < 3; index++) {
        validate(run());
      }
      const { profile: heapProfile } = await session.post("HeapProfiler.stopSampling");
      fs.writeFileSync(
        options.output.replace(/\.json$/, ".cpuprofile"),
        JSON.stringify(cpuProfile),
      );
      fs.writeFileSync(
        options.output.replace(/\.json$/, ".heapprofile"),
        JSON.stringify(heapProfile),
      );
      fs.writeFileSync(
        options.output,
        JSON.stringify(
          {
            ...receipt,
            boundaries,
            retention,
            metrics: instrumented.metrics,
            frameCounts,
            cpu: summarizeCpu(cpuProfile),
            allocations: summarizeAllocations(heapProfile),
            gcDuringCpuProfile: gcEntries,
            cpuProfileAssemblies: 5,
            allocationProfileAssemblies: 3,
            memoryDefinition:
              "heapUsed after two forced collections is live V8 heap at this boundary; RSS includes runtime/loader and reserved capacity; phase peaks are boundary samples only; allocation sampling includes collected objects",
          },
          null,
          2,
        ) + "\n",
      );
    } finally {
      observer.disconnect();
      session.disconnect();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const options = parseOptions();
if (options.worker) {
  await worker(options);
} else {
  fs.mkdirSync(options.output, { recursive: true });
  // Bundled runs match the shipped esbuild execution model without the source loader's wrappers.
  const loaderArgs = import.meta.filename.endsWith(".ts")
    ? ["--conditions=uttori-source", "--import=tsx"]
    : [];
  // Serial children avoid cross-workload JIT, heap high-water carryover, and CPU contention.
  for (const fixture of options.fixtures) {
    for (const scale of options.scales) {
      for (const metadata of options.metadata) {
        const output = path.join(
          options.output,
          `${fixture}-${scale}-metadata-${metadata}-${options.mode}.json`,
        );
        console.log(`${fixture} scale=${scale} metadata=${metadata} ${options.mode}`);
        const child = spawnSync(
          process.execPath,
          [
            "--expose-gc",
            ...loaderArgs,
            import.meta.filename,
            "--worker",
            "--output",
            output,
            "--fixtures",
            fixture,
            "--scales",
            String(scale),
            "--metadata",
            String(metadata),
            "--mode",
            options.mode,
            "--repetitions",
            String(options.repetitions),
            "--warmups",
            String(options.warmups),
          ],
          { stdio: "inherit", timeout: 300_000 },
        );
        if (child.error) {
          throw child.error;
        }
        assert.equal(child.status, 0, `Profiling worker failed: ${output}`);
      }
    }
  }
}
