import { test } from "../../../tests/ava-helper.js";
import {
  RUNTIME_INSTRUCTION_TRACE_FORMAT,
  RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
  importRuntimeInstructionTrace,
  mergeRuntimeEvidence,
  type AnalysisProjectShards,
  type RuntimeInstructionTraceArtifact,
} from "../src/index.js";

const romContentSha256 = "a".repeat(64);

const artifact = (): RuntimeInstructionTraceArtifact => ({
  format: RUNTIME_INSTRUCTION_TRACE_FORMAT,
  schemaVersion: RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256,
  producer: { id: "ares", revision: "runtime-trace-fixture" },
  chunks: [
    { sequenceStart: 1, addresses: [0x808000, 0x808001], droppedEvents: 0, active: true },
    { sequenceStart: 4, addresses: [0x808000], droppedEvents: 1, active: false },
  ],
});

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

test("runtime trace import aggregates execution only after an explicit merge", (t) => {
  const shards = emptyShards();
  const imported = importRuntimeInstructionTrace(artifact(), {
    projectRomContentSha256: romContentSha256,
    sourceName: "fixture.trace.json",
  });
  t.is(shards.runtime.length, 0);
  t.is(imported.observedEvents, 3);
  t.is(imported.droppedEvents, 1);
  t.deepEqual(
    imported.batch.runtime?.map(({ address, count }) => ({ address, count })),
    [
      { address: 0x808000, count: 2 },
      { address: 0x808001, count: 1 },
    ],
  );
  t.deepEqual(imported.report.unsupported, [
    {
      field: "instruction-addresses",
      count: 1,
      reason: "Producer buffer overflow occurred before these events could be pulled.",
    },
  ]);
  const merged = mergeRuntimeEvidence(shards, imported.batch);
  t.true(merged.changed);
  t.is(merged.added.runtime, 2);
  t.is(merged.added.evidence, 1);
  t.is(merged.added.imports, 1);
  t.false(mergeRuntimeEvidence(merged.shards, imported.batch).changed);
});

test("runtime trace import preserves the recorder address space", (t) => {
  const imported = importRuntimeInstructionTrace(artifact(), {
    projectRomContentSha256: romContentSha256,
    sourceName: "fixture.trace.json",
  });
  t.true(imported.batch.runtime.length > 0);
  t.true(imported.batch.runtime.every(({ addressSpace }) => addressSpace === "snes.cpu"));
});

test("runtime trace import rejects ROM drift and inconsistent ordering/loss", (t) => {
  t.throws(
    () =>
      importRuntimeInstructionTrace(artifact(), {
        projectRomContentSha256: "b".repeat(64),
        sourceName: "fixture.trace.json",
      }),
    { message: /ROM\/project mismatch/ },
  );

  const reordered = structuredClone(artifact());
  reordered.chunks[1]!.sequenceStart = 2;
  t.throws(
    () =>
      importRuntimeInstructionTrace(reordered, {
        projectRomContentSha256: romContentSha256,
        sourceName: "fixture.trace.json",
      }),
    { message: /overlaps or reorders/ },
  );

  const hiddenLoss = structuredClone(artifact());
  hiddenLoss.chunks[1]!.droppedEvents = 0;
  t.throws(
    () =>
      importRuntimeInstructionTrace(hiddenLoss, {
        projectRomContentSha256: romContentSha256,
        sourceName: "fixture.trace.json",
      }),
    { message: /inconsistent producer loss/ },
  );
});

test("runtime trace import preserves incomplete capture as an explicit warning", (t) => {
  const incomplete = structuredClone(artifact());
  incomplete.chunks = [{ sequenceStart: 1, addresses: [0x808000], droppedEvents: 0, active: true }];
  const imported = importRuntimeInstructionTrace(incomplete, {
    projectRomContentSha256: romContentSha256,
    sourceName: "incomplete.trace.json",
  });
  t.deepEqual(imported.report.warnings, ["Trace artifact ended while capture was still active."]);
  t.is(imported.batch.evidence?.[0]?.confidence, "high");
});

test("runtime trace import validates every untrusted artifact boundary", (t) => {
  const context = { projectRomContentSha256: romContentSha256, sourceName: "fixture.trace.json" };
  const cases: Array<{
    readonly mutate: (value: Record<string, unknown>) => void;
    readonly message: RegExp;
  }> = [
    {
      mutate: (value) => (value.format = "foreign"),
      message: /Unsupported instruction trace format/,
    },
    { mutate: (value) => (value.schemaVersion = 2), message: /schema version/ },
    { mutate: (value) => (value.producer = null), message: /producer must be an object/ },
    { mutate: (value) => (value.chunks = null), message: /chunks must be an array/ },
    {
      mutate: (value) => ((value.chunks as Array<Record<string, unknown>>)[0]!.addresses = null),
      message: /addresses must be an array/,
    },
    {
      mutate: (value) => ((value.chunks as Array<Record<string, unknown>>)[0]!.active = "yes"),
      message: /active must be boolean/,
    },
    {
      mutate: (value) => ((value.chunks as Array<Record<string, unknown>>)[0]!.sequenceStart = 0),
      message: /sequenceStart/,
    },
    {
      mutate: (value) =>
        (((value.chunks as Array<Record<string, unknown>>)[0]!.addresses as number[])[0] = -1),
      message: /address 0/,
    },
    {
      mutate: (value) => ((value.chunks as Array<Record<string, unknown>>)[0]!.droppedEvents = -1),
      message: /droppedEvents/,
    },
    {
      mutate: (value) => {
        value.chunks = [
          { sequenceStart: 1, addresses: [], droppedEvents: 0, active: false },
          { sequenceStart: 1, addresses: [], droppedEvents: 0, active: true },
        ];
      },
      message: /resumes after capture stopped/,
    },
    {
      mutate: (value) => (value.romContentSha256 = "A".repeat(64)),
      message: /lowercase SHA-256/,
    },
  ];
  for (const { mutate, message } of cases) {
    const value = structuredClone(artifact()) as unknown as Record<string, unknown>;
    mutate(value);
    t.throws(
      () =>
        importRuntimeInstructionTrace(value as unknown as RuntimeInstructionTraceArtifact, context),
      { message },
    );
  }
});

test("runtime trace import marks a complete lossless recording certain", (t) => {
  const lossless = structuredClone(artifact());
  lossless.chunks = [{ sequenceStart: 1, addresses: [0x808000], droppedEvents: 0, active: false }];
  const imported = importRuntimeInstructionTrace(lossless, {
    projectRomContentSha256: romContentSha256,
    sourceName: "lossless.trace.json",
  });
  t.is(imported.batch.evidence?.[0]?.confidence, "certain");
  t.deepEqual(imported.report.unsupported, []);
  t.deepEqual(imported.report.warnings, []);

  const empty = structuredClone(artifact());
  empty.chunks = [];
  const emptyImport = importRuntimeInstructionTrace(empty, {
    projectRomContentSha256: romContentSha256,
    sourceName: "empty.trace.json",
  });
  t.is(emptyImport.droppedEvents, 0);
  t.deepEqual(emptyImport.batch.runtime, []);
  t.deepEqual(emptyImport.report.warnings, [
    "Trace artifact ended while capture was still active.",
  ]);

  t.throws(
    () =>
      importRuntimeInstructionTrace(lossless, {
        projectRomContentSha256: romContentSha256,
        sourceName: "",
      }),
    { message: /source name/ },
  );
});
