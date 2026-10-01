import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import {
  DebugAdapterSession,
  ReplayDebugBackend,
  type DebugBackend,
  type DebugBackendEvent,
} from "@uttori/asm-debug-adapter";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_MANIFEST,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RUNTIME_INSTRUCTION_TRACE_FORMAT,
  RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
  RomImage,
  buildInstructionAnalysisAnnotations,
  buildRomCoverageMap,
  commitPreparedAnalysisProjectTransaction,
  importRuntimeInstructionTrace,
  loadAnalysisProject,
  loadAnalysisProjectSnapshot,
  mergeRuntimeEvidence,
  prepareAnalysisProjectTransaction,
  sourceExportSha256,
  publishAnalysisProject,
  type AnalysisProject,
  type AnalysisProjectShards,
  type AnalysisTargetOverrideRecord,
  type AnalysisTargetSetRecord,
  type LoadedAnalysisProject,
  type RuntimeInstructionTraceArtifact,
} from "@uttori/asm-disassembler";
import {
  SNES_CPU_ADDRESS_SPACE,
  SNES_FILE_ADDRESS_SPACE,
  SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR,
  SNES_TARGET_ID,
  SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR,
  SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR,
  SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR,
  analyzeSnes65816,
  createSnesAddressContext,
  exportSnes65816Source,
  importDizRaw,
  snesRomAddressSpace,
} from "@uttori/asm-plugin-snes";

import { SECRET_OF_MANA_ANALYSIS_FIXTURE } from "../fixtures/fixture-manifest.js";
import { aggregateOperationSamples, type OperationBenchmarkSample } from "./benchmark-report.js";
import {
  assertDisassemblerBudgetEnvironment,
  evaluateDisassemblerBenchmarkBudgets,
  type DisassemblerBenchmarkBudgets,
} from "./disassembler-benchmark-budget.js";

const root = path.resolve(import.meta.dirname, "..");
const scriptPath = fileURLToPath(import.meta.url);

const OPERATION_IDS = [
  "analysis",
  "project-serialization",
  "project-load",
  "coverage-projection",
  "instruction-annotation-projection",
  "transaction-prepare",
  "transaction-commit",
  "source-export",
  "trace-ingestion",
  "dap-event-flow",
] as const;
type OperationId = (typeof OPERATION_IDS)[number];

type SyntheticFixture = {
  readonly id: string;
  readonly displayName: string;
  readonly kind: "synthetic";
  readonly mapper: "lorom";
  readonly contentBytes: number;
};

type PrivateFixture = {
  readonly id: "secret-of-mana";
  readonly displayName: string;
  readonly kind: "private-local";
  readonly mapper: "hirom";
  readonly contentBytes: number;
};

type Fixture = SyntheticFixture | PrivateFixture;

type BenchmarkOptions = {
  readonly warmups: number;
  readonly repetitions: number;
  readonly fixtureIds: readonly string[];
  readonly operationIds: readonly OperationId[];
  readonly jsonPath?: string;
  readonly budgetsPath?: string;
  readonly summaryOnly: boolean;
};

type OperationObservation = Readonly<Record<string, string | number | boolean>>;

type WorkerResult = {
  readonly sample: OperationBenchmarkSample;
  readonly observation: OperationObservation;
  readonly gcAvailable: boolean;
};

type OperationValue = {
  /** Keeps the operation result reachable through the ending memory sample. */
  readonly retained: unknown;
  readonly observation: OperationObservation;
  readonly dispose?: () => void;
};

const fixtures: readonly Fixture[] = [
  {
    id: "synthetic-512k",
    displayName: "Synthetic LoROM 512 KiB",
    kind: "synthetic",
    mapper: "lorom",
    contentBytes: 512 * 1024,
  },
  {
    id: "synthetic-2m",
    displayName: "Synthetic LoROM 2 MiB",
    kind: "synthetic",
    mapper: "lorom",
    contentBytes: 2 * 1024 * 1024,
  },
  {
    id: "synthetic-4m",
    displayName: "Synthetic LoROM 4 MiB",
    kind: "synthetic",
    mapper: "lorom",
    contentBytes: 4 * 1024 * 1024,
  },
  {
    id: "secret-of-mana",
    displayName: SECRET_OF_MANA_ANALYSIS_FIXTURE.displayName,
    kind: "private-local",
    mapper: SECRET_OF_MANA_ANALYSIS_FIXTURE.mapper,
    contentBytes: SECRET_OF_MANA_ANALYSIS_FIXTURE.bytes,
  },
];
const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
const operationSet = new Set<string>(OPERATION_IDS);

const emptyShards = (): AnalysisProjectShards => ({
  analysis: [],
  annotations: [],
  labels: [],
  comments: [],
  regions: [],
  runtime: [],
  evidence: [],
  imports: [],
});

const countRecords = (shards: AnalysisProjectShards): number =>
  shards.analysis.length +
  shards.annotations.length +
  shards.labels.length +
  shards.comments.length +
  shards.regions.length +
  shards.runtime.length +
  shards.evidence.length +
  shards.imports.length;

const parseNonNegativeInteger = (value: string | undefined, option: string): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${option} requires a non-negative safe integer.`);
  }
  return parsed;
};

const parseCommaList = (value: string | undefined, option: string): readonly string[] => {
  const values = value?.split(",").filter(Boolean);
  if (!values?.length) {
    throw new Error(`${option} requires a value.`);
  }
  return values;
};

const parseOptions = (args: readonly string[]): BenchmarkOptions => {
  const fast = args.includes("--fast");
  let warmups = fast ? 0 : 1;
  let repetitions = fast ? 1 : 5;
  let jsonPath: string | undefined;
  let budgetsPath: string | undefined;
  const requestedFixtures: string[] = [];
  const requestedOperations: OperationId[] = [];
  let summaryOnly = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--fast") {
      continue;
    }
    if (argument === "--summary-only") {
      summaryOnly = true;
    } else if (argument === "--warmups") {
      warmups = parseNonNegativeInteger(args[++index], argument);
    } else if (argument === "--repetitions") {
      repetitions = parseNonNegativeInteger(args[++index], argument);
    } else if (argument === "--fixture") {
      for (const fixture of parseCommaList(args[++index], argument)) {
        requestedFixtures.push(fixture);
      }
    } else if (argument === "--operation") {
      for (const operation of parseCommaList(args[++index], argument)) {
        if (!operationSet.has(operation)) {
          throw new Error(
            `Unknown operation '${operation}'. Available operations: ${OPERATION_IDS.join(", ")}.`,
          );
        }
        requestedOperations.push(operation as OperationId);
      }
    } else if (argument === "--json") {
      jsonPath = args[++index];
      if (!jsonPath) {
        throw new Error("--json requires an output path.");
      }
    } else if (argument === "--budgets") {
      budgetsPath = args[++index];
      if (!budgetsPath) {
        throw new Error("--budgets requires an input path.");
      }
    } else if (argument.startsWith("--max-") || argument.startsWith("--budget")) {
      throw new Error(
        `Unknown budget option '${argument}'. Pass a versioned budget file with --budgets.`,
      );
    } else {
      throw new Error(`Unknown option '${argument}'.`);
    }
  }
  if (repetitions === 0) {
    throw new Error("--repetitions must be at least one.");
  }
  let fixtureIds: readonly string[];
  if (requestedFixtures.length > 0) {
    fixtureIds = [...new Set(requestedFixtures)];
  } else if (fast) {
    fixtureIds = ["synthetic-512k"];
  } else {
    fixtureIds = fixtures.filter(({ kind }) => kind === "synthetic").map(({ id }) => id);
  }
  for (const fixtureId of fixtureIds) {
    if (!fixtureById.has(fixtureId)) {
      throw new Error(
        `Unknown fixture '${fixtureId}'. Available fixtures: ${fixtures.map(({ id }) => id).join(", ")}.`,
      );
    }
  }
  return {
    warmups,
    repetitions,
    fixtureIds,
    operationIds:
      requestedOperations.length > 0 ? [...new Set(requestedOperations)] : OPERATION_IDS,
    ...(jsonPath === undefined ? {} : { jsonPath }),
    ...(budgetsPath === undefined ? {} : { budgetsPath }),
    summaryOnly,
  };
};

const syntheticRom = (fixture: SyntheticFixture): RomImage => {
  const bytes = new Uint8Array(fixture.contentBytes);
  const codeBytesPerBank = 256;
  for (let bankOffset = 0; bankOffset < bytes.length; bankOffset += 0x8000) {
    bytes.fill(0xea, bankOffset, bankOffset + codeBytesPerBank - 1);
    bytes[bankOffset + codeBytesPerBank - 1] = 0xdb;
  }
  return new RomImage(bytes, { headerSize: 0 });
};

const privateRomPath = (): string =>
  path.join(root, "Local Only", SECRET_OF_MANA_ANALYSIS_FIXTURE.filename);

const loadRom = (fixture: Fixture): RomImage => {
  if (fixture.kind === "synthetic") {
    return syntheticRom(fixture);
  }
  const file = privateRomPath();
  if (!fs.existsSync(file)) {
    throw new Error(
      `The opt-in private fixture is unavailable. Place '${SECRET_OF_MANA_ANALYSIS_FIXTURE.filename}' in 'Local Only'.`,
    );
  }
  const rom = RomImage.load(file);
  if (
    rom.identity.fileSize !== SECRET_OF_MANA_ANALYSIS_FIXTURE.bytes ||
    rom.identity.sha256 !== SECRET_OF_MANA_ANALYSIS_FIXTURE.sha256
  ) {
    throw new Error("The opt-in private fixture has the wrong byte length or SHA-256 identity.");
  }
  return rom;
};

const initialShards = (fixture: Fixture, rom: RomImage): AnalysisProjectShards => {
  if (fixture.kind === "synthetic") {
    return emptyShards();
  }
  const dizrawPath = path.join(root, SECRET_OF_MANA_ANALYSIS_FIXTURE.dizraw);
  if (!fs.existsSync(dizrawPath)) {
    throw new Error("The opt-in private .dizraw testing fixture is unavailable.");
  }
  const imported = importDizRaw(fs.readFileSync(dizrawPath, "utf8"), {
    sourceName: SECRET_OF_MANA_ANALYSIS_FIXTURE.dizraw,
    expectedRomSize: rom.length,
  });
  return { ...imported.shards, imports: [imported.report] };
};

const baseProject = (fixture: Fixture, rom: RomImage): AnalysisProject => ({
  manifest: {
    format: ANALYSIS_PROJECT_FORMAT,
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: SNES_TARGET_ID,
    rom: rom.identity,
    mapping: { mapper: fixture.mapper, source: "override", candidates: [] },
    addressSpaces: [
      { id: SNES_FILE_ADDRESS_SPACE, name: "ROM file offset", addressBits: 24, kind: "file" },
      { id: SNES_CPU_ADDRESS_SPACE, name: "SNES CPU bus", addressBits: 24, kind: "cpu" },
      SNES_WRAM_ADDRESS_SPACE_DESCRIPTOR,
      SNES_SRAM_ADDRESS_SPACE_DESCRIPTOR,
      SPC700_ARAM_ADDRESS_SPACE_DESCRIPTOR,
      SUPERFX_ROM_ADDRESS_SPACE_DESCRIPTOR,
    ],
  },
  shards: initialShards(fixture, rom),
});

const syntheticEntryPoints = (fixture: Fixture): readonly { id: string; address: number }[] => {
  if (fixture.kind !== "synthetic") {
    return [];
  }
  const context = createSnesAddressContext(fixture.mapper);
  const entries: { id: string; address: number }[] = [];
  for (let fileOffset = 0; fileOffset < fixture.contentBytes; fileOffset += 0x8000) {
    const address = snesRomAddressSpace.fromOutputOffset(fileOffset, context);
    if (address < 0) {
      throw new Error(`Synthetic file offset ${fileOffset} is not LoROM-mapped.`);
    }
    entries.push({ id: `benchmark-${fileOffset.toString(16)}`, address });
  }
  return entries;
};

const analyzeProject = (
  fixture: Fixture,
  rom: RomImage,
  project: AnalysisProject,
): AnalysisProject => {
  const editableRecords = project.shards.analysis.filter(
    (record): record is AnalysisTargetOverrideRecord | AnalysisTargetSetRecord =>
      record.kind === "target-override" || record.kind === "target-set",
  );
  const result = analyzeSnes65816(rom, fixture.mapper, {
    annotations: project.shards.annotations,
    labels: project.shards.labels,
    evidence: project.shards.evidence,
    entryPoints: syntheticEntryPoints(fixture),
    targetOverrides: editableRecords.filter(
      (record): record is AnalysisTargetOverrideRecord => record.kind === "target-override",
    ),
    targetSets: editableRecords.filter(
      (record): record is AnalysisTargetSetRecord => record.kind === "target-set",
    ),
  });
  if (result.nodes.length === 0) {
    throw new Error(`${fixture.id} analysis produced no instructions.`);
  }
  if (fixture.kind === "synthetic" && result.status !== "complete") {
    throw new Error(`${fixture.id} synthetic analysis was unexpectedly incomplete.`);
  }
  return {
    manifest: project.manifest,
    shards: {
      ...project.shards,
      analysis: [...editableRecords, ...result.records],
      annotations: [
        ...project.shards.annotations.filter(
          (annotation) => !annotation.id.startsWith("static:65816:"),
        ),
        ...result.annotations,
      ],
      evidence: [
        ...project.shards.evidence.filter(
          (record) =>
            record.sourceId !== "snes.65816.static-v1" && !record.id.startsWith("detector:vector:"),
        ),
        ...result.evidenceRecords,
      ],
    },
  };
};

const analyzedProject = (fixture: Fixture, rom: RomImage): AnalysisProject =>
  analyzeProject(fixture, rom, baseProject(fixture, rom));

const writeAndLoad = (directory: string, project: AnalysisProject): LoadedAnalysisProject => {
  publishAnalysisProject(directory, project);
  return loadAnalysisProject(directory);
};

/** Supply a metadata delta to measure SQLite transactions without an authoring/undo layer. */
const editLoadedProject = (loaded: LoadedAnalysisProject): AnalysisProject => ({
  manifest: loaded.manifest,
  shards: {
    ...loaded.shards,
    annotations: [
      ...loaded.shards.annotations,
      {
        id: "benchmark.manual.range",
        addressSpace: SNES_FILE_ADDRESS_SPACE,
        start: loaded.manifest.rom.contentSize - 1,
        end: loaded.manifest.rom.contentSize,
        classification: "data8",
        architecture: "snes.65816",
        evidence: ["benchmark.manual.evidence"],
      },
    ],
    evidence: [
      ...loaded.shards.evidence,
      {
        id: "benchmark.manual.evidence",
        source: "manual",
        sourceId: "benchmark",
        confidence: "certain",
        detail: "Metadata transaction benchmark.",
      },
    ],
  },
});

const traceArtifact = (
  fixture: Fixture,
  rom: RomImage,
  project: AnalysisProject,
): RuntimeInstructionTraceArtifact => {
  const addresses = project.shards.analysis
    .filter((record) => record.kind === "cfg-node")
    .map((record) => record.address);
  if (addresses.length === 0) {
    throw new Error("Trace benchmark requires analyzed CFG nodes.");
  }
  const eventCount = Math.min(262_144, Math.max(32_768, fixture.contentBytes >>> 4));
  const chunks = [];
  const chunkSize = 4_096;
  for (let start = 0; start < eventCount; start += chunkSize) {
    const end = Math.min(eventCount, start + chunkSize);
    chunks.push({
      sequenceStart: start + 1,
      addresses: Array.from(
        { length: end - start },
        (_, index) => addresses[(start + index) % addresses.length],
      ),
      droppedEvents: 0,
      active: end < eventCount,
    });
  }
  return {
    format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
    schemaVersion: RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
    architecture: "snes.65816",
    addressSpace: SNES_CPU_ADDRESS_SPACE,
    romContentSha256: rom.identity.contentSha256,
    producer: { id: "uttori.benchmark", revision: "synthetic-v1" },
    chunks,
  };
};

const prepareDapEventFlow = (eventCount: number): (() => OperationValue) => {
  const listeners = new Set<(event: DebugBackendEvent) => void>();
  const replay = new ReplayDebugBackend({
    snapshots: [
      {
        threads: [{ id: 1, name: "65816", architecture: "snes.65816" }],
        frames: [
          {
            id: 1,
            threadId: 1,
            name: "65816",
            pc: {
              architecture: "snes.65816",
              addressSpace: SNES_CPU_ADDRESS_SPACE,
              address: 0x808000,
            },
          },
        ],
        registers: { 1: [] },
        memory: [],
      },
    ],
  });
  const backend: DebugBackend = {
    protocolVersion: replay.protocolVersion,
    capabilities: replay.capabilities,
    connect: (options) => replay.connect(options),
    disconnect: (options) => replay.disconnect(options),
    pause: (threadId) => replay.pause(threadId),
    continue: (threadId) => replay.continue(threadId),
    step: (threadId, kind) => replay.step(threadId, kind),
    threads: () => replay.threads(),
    stackFrames: (threadId) => replay.stackFrames(threadId),
    registers: (frameId) => replay.registers(frameId),
    readMemory: (address, count) => replay.readMemory(address, count),
    setBreakpoints: (addresses) => replay.setBreakpoints(addresses),
    disassemble: (address, count) => replay.disassemble(address, count),
    startTrace: (options) => replay.startTrace(options),
    readTrace: (maxEvents) => replay.readTrace(maxEvents),
    stopTrace: () => replay.stopTrace(),
    onEvent: (listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
  let delivered = 0;
  let lastSequence = 0;
  const session = new DebugAdapterSession({
    backend,
    onMessage: (message) => {
      delivered++;
      lastSequence = message.seq;
    },
  });
  return () => {
    for (let index = 0; index < eventCount; index++) {
      let event: DebugBackendEvent;
      switch (index % 5) {
        case 0:
          event = { type: "stopped", reason: "step", threadId: 1 };
          break;
        case 1:
          event = { type: "continued", threadId: 1, allThreads: true };
          break;
        case 2:
          event = {
            type: "breakpoint",
            breakpoint: {
              id: index + 1,
              verified: true,
              address: {
                architecture: "snes.65816",
                addressSpace: SNES_CPU_ADDRESS_SPACE,
                address: 0x808000 + (index & 0x7fff),
              },
            },
          };
          break;
        case 3:
          event = { type: "output", category: "stdout", text: "benchmark\n" };
          break;
        default:
          event = { type: "terminated", restart: false };
          break;
      }
      for (const listener of listeners) {
        listener(event);
      }
    }
    if (delivered !== eventCount || lastSequence !== eventCount) {
      throw new Error(
        `DAP delivered ${delivered}/${eventCount} events at sequence ${lastSequence}.`,
      );
    }
    return {
      retained: session,
      observation: { inputEvents: eventCount, outputMessages: delivered, lastSequence },
      dispose: () => session.dispose(),
    };
  };
};

/**
 * Prepares one isolated operation while keeping all prerequisites outside its timed boundary.
 *
 * Each returned closure performs exactly the named action and retains its result through the end
 * sample. Do not preload a second project merely to obtain setup metadata: that contaminates the
 * baseline RSS and can turn a single-load/commit measurement into a hidden multi-project test.
 * @param {Fixture} fixture Synthetic or explicitly authorized private fixture description.
 * @param {OperationId} operation Operation whose exclusive boundary is measured.
 * @param {RomImage} rom Loaded immutable ROM for this worker.
 * @param {string} temporary Worker-private directory removed after measurement.
 * @returns {() => OperationValue} Timed closure with a retained result and stable observation.
 */
const prepareOperation = (
  fixture: Fixture,
  operation: OperationId,
  rom: RomImage,
  temporary: string,
): (() => OperationValue) => {
  if (operation === "analysis") {
    const initial = baseProject(fixture, rom);
    return () => {
      const project = analyzeProject(fixture, rom, initial);
      const nodes = project.shards.analysis.filter((record) => record.kind === "cfg-node").length;
      return {
        retained: project,
        observation: { instructions: nodes, projectRecords: countRecords(project.shards) },
      };
    };
  }
  if (operation === "dap-event-flow") {
    const eventCount = Math.min(262_144, Math.max(32_768, fixture.contentBytes >>> 4));
    return prepareDapEventFlow(eventCount);
  }

  const project = analyzedProject(fixture, rom);
  const projectDirectory = path.join(temporary, "project.analysis");
  if (operation === "project-serialization") {
    return () => {
      const manifest = publishAnalysisProject(projectDirectory, project).manifest;
      return {
        retained: manifest,
        observation: {
          projectRecords: countRecords(project.shards),
          databaseRevision: manifest.revision ?? 0,
        },
      };
    };
  }
  if (operation === "coverage-projection") {
    return () => {
      const coverage = buildRomCoverageMap(project.manifest, project.shards);
      if (coverage.summary.totalBytes !== rom.length) {
        throw new Error("Coverage projection did not span the complete ROM.");
      }
      return {
        retained: coverage,
        observation: {
          segments: coverage.segments.length,
          classifiedBytes: coverage.summary.classifiedBytes,
          unknownBytes: coverage.summary.unknownBytes,
        },
      };
    };
  }
  if (operation === "instruction-annotation-projection") {
    return () => {
      const annotations = buildInstructionAnalysisAnnotations(project.manifest, project.shards);
      if (annotations.instructions.length === 0) {
        throw new Error("Instruction projection produced no instructions.");
      }
      return {
        retained: annotations,
        observation: {
          instructions: annotations.instructions.length,
          diagnostics: annotations.diagnostics.length,
        },
      };
    };
  }
  if (operation === "trace-ingestion") {
    const artifact = traceArtifact(fixture, rom, project);
    return () => {
      const imported = importRuntimeInstructionTrace(artifact, {
        projectRomContentSha256: rom.identity.contentSha256,
        sourceName: "benchmark.trace.json",
      });
      const merged = mergeRuntimeEvidence(project.shards, imported.batch);
      if (!merged.changed || imported.observedEvents === 0) {
        throw new Error("Trace ingestion did not add runtime evidence.");
      }
      return {
        retained: merged,
        observation: {
          inputEvents: imported.observedEvents,
          runtimeRecords: merged.shards.runtime.length,
          droppedEvents: imported.droppedEvents,
        },
      };
    };
  }
  if (operation === "project-load") {
    // Measure one retained load. Loading here during setup would leave a full project reachable or
    // resident and make the timed operation a misleading second-copy measurement.
    publishAnalysisProject(projectDirectory, project);
    return () => {
      const reloaded = loadAnalysisProject(projectDirectory);
      return {
        retained: reloaded,
        observation: {
          projectRecords: countRecords(reloaded.shards),
          databaseRevision: reloaded.manifest.revision ?? 0,
        },
      };
    };
  }
  if (operation === "transaction-commit") {
    // Commit needs one caller snapshot and a validated in-memory edit. Write the fixture,
    // then load exactly that single snapshot. WriteAndLoad() plus another snapshot would retain two
    // equivalent projects before the measured commit begins.
    publishAnalysisProject(projectDirectory, project);
    const snapshot = loadAnalysisProjectSnapshot(projectDirectory);
    const edited = editLoadedProject(snapshot);
    const prepared = prepareAnalysisProjectTransaction(projectDirectory, edited);
    return () => {
      const committed = commitPreparedAnalysisProjectTransaction(
        projectDirectory,
        snapshot.revision,
        prepared,
      );
      return {
        retained: committed,
        observation: { databaseRevision: committed.manifest.revision ?? 0 },
      };
    };
  }
  const loaded = writeAndLoad(projectDirectory, project);
  if (operation === "transaction-prepare") {
    const edited = editLoadedProject(loaded);
    return () => {
      const prepared = prepareAnalysisProjectTransaction(projectDirectory, edited);
      return {
        retained: prepared,
        observation: {
          projectRecords: countRecords(prepared.project.shards),
        },
      };
    };
  }
  if (operation === "source-export") {
    const manifestBytes = fs.readFileSync(path.join(projectDirectory, ANALYSIS_PROJECT_MANIFEST));
    return () => {
      const exported = exportSnes65816Source(loaded, rom, path.join(temporary, "source"), {
        sourceProjectSha256: sourceExportSha256(manifestBytes),
        emitFile: (file) => {
          const target = path.join(temporary, "source", file.path);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, file.bytes);
        },
      });
      if (exported.spans.reduce((total, span) => total + span.end - span.start, 0) < rom.length) {
        throw new Error("Source export did not cover the complete ROM.");
      }
      return {
        retained: exported,
        observation: { generatedFiles: exported.files.length, spans: exported.spans.length },
      };
    };
  }
  throw new Error("Unhandled benchmark operation.");
};

/**
 * Executes one prepared operation and samples memory immediately before and after it.
 *
 * The operation is synchronous, so these values are operation-boundary observations rather than an
 * in-operation peak. A fresh child process and requested pre-run GC make repetitions comparable.
 * `value.retained` prevents the optimizer/collector from discarding the result before the end sample.
 * @param {Fixture} fixture Fixture executed by this worker.
 * @param {OperationId} operation Single measured operation.
 * @returns {WorkerResult} Timing, boundary memory, and correctness observation.
 */
const runWorker = (fixture: Fixture, operation: OperationId): WorkerResult => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-disassembler-benchmark-"));
  let value: OperationValue | undefined;
  try {
    const rom = loadRom(fixture);
    const execute = prepareOperation(fixture, operation, rom, temporary);
    if (global.gc) {
      global.gc();
    }
    const before = process.memoryUsage();
    const started = performance.now();
    value = execute();
    const wallMs = performance.now() - started;
    const after = process.memoryUsage();
    // Performance invariant: keep the result live until after `after`. Otherwise memory regressions
    // can disappear from the boundary measurement through early collection.
    void value.retained;
    return {
      sample: {
        wallMs,
        baselineRssBytes: before.rss,
        baselineHeapUsedBytes: before.heapUsed,
        endRssBytes: after.rss,
        endHeapUsedBytes: after.heapUsed,
        boundaryMaxRssBytes: Math.max(before.rss, after.rss),
        boundaryMaxHeapUsedBytes: Math.max(before.heapUsed, after.heapUsed),
        rssDeltaBytes: after.rss - before.rss,
        heapUsedDeltaBytes: after.heapUsed - before.heapUsed,
      },
      observation: value.observation,
      gcAvailable: typeof global.gc === "function",
    };
  } finally {
    value?.dispose?.();
    fs.rmSync(temporary, { recursive: true, force: true });
  }
};

/**
 * Runs one measurement in a fresh Node process with explicit-GC support.
 * Process isolation prevents retained state and allocator high-water behavior from one operation or
 * repetition contaminating another, which is essential for meaningful memory budgets.
 * @param {Fixture} fixture Fixture identifier passed to the worker process.
 * @param {OperationId} operation Operation identifier passed to the worker process.
 * @returns {WorkerResult} Parsed worker result after a successful exit.
 */
const runIsolated = (fixture: Fixture, operation: OperationId): WorkerResult => {
  const child = spawnSync(
    process.execPath,
    ["--expose-gc", "--import", "tsx", scriptPath, "--internal-worker", fixture.id, operation],
    { cwd: root, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (child.error) {
    throw child.error;
  }
  if (child.status !== 0) {
    throw new Error(
      `Isolated ${fixture.id}/${operation} benchmark failed with status ${String(child.status)}: ${child.stderr.trim()}`,
    );
  }
  return JSON.parse(child.stdout) as WorkerResult;
};

const gitText = (args: readonly string[]): string => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
};

const formatMilliseconds = (value: number): string => `${value.toFixed(2)} ms`;
const formatMebibytes = (value: number): string => `${(value / 1_048_576).toFixed(1)} MiB`;

const main = (): void => {
  const options = parseOptions(process.argv.slice(2));
  const environment = {
    gitRevision: gitText(["rev-parse", "HEAD"]),
    worktreeDirty: gitText(["status", "--porcelain"]) !== "",
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    cpuModel: os.cpus()[0]?.model ?? "unknown",
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
  };
  let budgets: DisassemblerBenchmarkBudgets | undefined;
  let budgetsIdentity:
    | { readonly path: string; readonly sha256: string; readonly sourceReportSha256: string }
    | undefined;
  if (options.budgetsPath) {
    const budgetsPath = path.resolve(root, options.budgetsPath);
    const bytes = fs.readFileSync(budgetsPath);
    budgets = JSON.parse(bytes.toString("utf8")) as DisassemblerBenchmarkBudgets;
    assertDisassemblerBudgetEnvironment(
      { suite: "uttori-asm-disassembler", environment, benchmarks: [] },
      budgets,
    );
    budgetsIdentity = {
      path: path.relative(root, budgetsPath),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sourceReportSha256: budgets.sourceReport.sha256,
    };
  }
  const selectedFixtures = options.fixtureIds.map((fixtureId) => fixtureById.get(fixtureId)!);
  const benchmarks = [];
  let allWorkersHadGc = true;
  for (const fixture of selectedFixtures) {
    const operations = [];
    for (const operation of options.operationIds) {
      for (let warmup = 0; warmup < options.warmups; warmup++) {
        console.error(
          `[${fixture.id}/${operation}] warmup ${warmup + 1}/${options.warmups} (isolated)...`,
        );
        runIsolated(fixture, operation);
      }
      const samples: OperationBenchmarkSample[] = [];
      let observation: OperationObservation | undefined;
      for (let repetition = 0; repetition < options.repetitions; repetition++) {
        console.error(
          `[${fixture.id}/${operation}] measured ${repetition + 1}/${options.repetitions} (isolated)...`,
        );
        const result = runIsolated(fixture, operation);
        allWorkersHadGc &&= result.gcAvailable;
        if (observation && JSON.stringify(observation) !== JSON.stringify(result.observation)) {
          throw new Error(`${fixture.id}/${operation} produced unstable observations.`);
        }
        observation = result.observation;
        samples.push(result.sample);
      }
      const aggregate = aggregateOperationSamples(samples);
      operations.push({ id: operation, observation, aggregate, samples });
      console.log(
        `${fixture.id.padEnd(16)} ${operation.padEnd(34)} median ${formatMilliseconds(aggregate.wallMs.median).padStart(11)}  p95 ${formatMilliseconds(aggregate.wallMs.p95).padStart(11)}  boundary RSS ${formatMebibytes(aggregate.boundaryMaxRssBytes.max).padStart(10)}  median ΔRSS ${formatMebibytes(aggregate.rssDeltaBytes.median).padStart(10)}`,
      );
    }
    benchmarks.push({
      fixture: {
        id: fixture.id,
        displayName: fixture.displayName,
        kind: fixture.kind,
        mapper: fixture.mapper,
        contentBytes: fixture.contentBytes,
      },
      operations,
    });
  }

  const report = {
    schemaVersion: 1,
    suite: "uttori-asm-disassembler",
    generatedAt: new Date().toISOString(),
    configuration: {
      warmups: options.warmups,
      repetitions: options.repetitions,
      processMode: "isolated",
      memorySampling: "operation-boundary",
      garbageCollectionBeforeBoundary: allWorkersHadGc,
      fixtureIds: options.fixtureIds,
      operationIds: options.operationIds,
      performanceBudgets: budgetsIdentity ?? null,
    },
    environment,
    benchmarks,
  };
  const budgetViolations = budgets ? evaluateDisassemblerBenchmarkBudgets(report, budgets) : [];
  const finalReport = {
    ...report,
    budgetEvaluation: budgets
      ? { valid: budgetViolations.length === 0, violations: budgetViolations }
      : null,
  };
  if (budgets) {
    console.log(
      budgetViolations.length === 0
        ? "Performance budgets: PASS"
        : `Performance budgets: FAIL (${budgetViolations.length} violation(s))`,
    );
    for (const violation of budgetViolations) {
      console.error(
        `[${violation.fixtureId}/${violation.operationId}] ${violation.metric}: ${String(violation.actual ?? "missing")} > ${String(violation.limit ?? "missing")}`,
      );
    }
  }
  const json = `${JSON.stringify(finalReport, null, 2)}\n`;
  if (options.jsonPath) {
    const output = path.resolve(root, options.jsonPath);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, json);
    console.log(`Report: ${output}`);
  } else if (!options.summaryOnly) {
    console.log("\nJSON report:");
    console.log(json.trimEnd());
  }
  if (budgetViolations.length > 0) {
    process.exitCode = 1;
  }
};

const internalWorker = (args: readonly string[]): boolean => {
  const index = args.indexOf("--internal-worker");
  if (index < 0) {
    return false;
  }
  const fixtureId = args[index + 1];
  const operation = args[index + 2];
  const fixture = fixtureId ? fixtureById.get(fixtureId) : undefined;
  if (!fixture) {
    throw new Error(`Unknown internal fixture '${String(fixtureId)}'.`);
  }
  if (!operation || !operationSet.has(operation)) {
    throw new Error(`Unknown internal operation '${String(operation)}'.`);
  }
  process.stdout.write(JSON.stringify(runWorker(fixture, operation as OperationId)));
  return true;
};

if (!internalWorker(process.argv.slice(2))) {
  main();
}
