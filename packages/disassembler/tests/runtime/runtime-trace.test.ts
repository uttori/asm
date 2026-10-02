import { test } from "../../../../tests/ava-helper.js";
import {
  RUNTIME_INSTRUCTION_TRACE_FORMAT,
  RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
  importRuntimeInstructionTrace,
  validateRuntimeInstructionTrace,
  mergeRuntimeEvidence,
  createRuntimeInstructionTraceImporter,
  type AnalysisProjectShards,
  type RuntimeInstructionTraceArtifact,
} from "../../src/index.js";
import {
  runtimeTraceIndexRecordLimit,
  type RuntimeTraceFactIndex,
} from "../../src/runtime/runtime-trace.js";

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

function isTraceRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTraceChunkList(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isTraceRecord);
}

function isNumberList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function traceChunk(value: Record<string, unknown>): Record<string, unknown> {
  if (!isTraceChunkList(value.chunks) || !value.chunks[0]) {
    throw new Error("Expected a trace chunk.");
  }
  return value.chunks[0];
}

function traceAddresses(chunk: Record<string, unknown>): number[] {
  if (!isNumberList(chunk.addresses)) {
    throw new Error("Expected trace addresses.");
  }
  return chunk.addresses;
}

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

test("instruction budgets lift the memory ceiling only with a disk index and record sink", (t) => {
  // Budget selection must not inspect or consume the index. Actual SQLite publication is
  // covered by runtime-trace-project tests, including rollback at an explicit small budget.
  const index: RuntimeTraceFactIndex = {
    diskBacked: true,
    add: () => t.fail("Budget selection consumed a fact"),
    values: () => {
      throw new Error("Budget selection read facts");
    },
    clear: () => t.fail("Budget selection cleared facts"),
  };
  const onRecord = () => t.fail("Budget selection emitted a record");
  const mode = "full";
  const memoryLimit = 8_000_000;
  t.is(runtimeTraceIndexRecordLimit(mode, undefined), memoryLimit);
  t.is(runtimeTraceIndexRecordLimit(mode, undefined, { index }), memoryLimit);
  t.is(
    runtimeTraceIndexRecordLimit(mode, undefined, {
      index: { ...index, diskBacked: false },
      onRecord,
    }),
    memoryLimit,
  );
  t.is(
    runtimeTraceIndexRecordLimit(mode, undefined, {
      index: { ...index, diskBacked: undefined },
      onRecord,
    }),
    memoryLimit,
  );
  t.is(runtimeTraceIndexRecordLimit(mode, undefined, { index, onRecord }), Number.MAX_SAFE_INTEGER);
  t.is(runtimeTraceIndexRecordLimit(mode, 8_000_001, { index, onRecord }), 8_000_001);
  t.is(runtimeTraceIndexRecordLimit(mode, 1, { index, onRecord }), 1);
  for (const storage of [
    undefined,
    { index },
    { index: { ...index, diskBacked: false }, onRecord },
  ]) {
    t.throws(() => runtimeTraceIndexRecordLimit(mode, 8_000_001, storage), {
      message: "Trace index record limit must not exceed 8000000.",
    });
  }
  for (const limit of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    t.throws(() => runtimeTraceIndexRecordLimit(mode, limit, { index, onRecord }), {
      message: /safe integer/,
    });
  }
});

test("default full indexing retains register variants, status bits and exact observations", (t) => {
  const details = Array.from({ length: 1000 }, (_, x) => ({
    bytes: [0xa9, 1],
    state: { a: x, x, y: x, s: 1024 - x, p: 0x31, e: 0, db: 0x7e, d: 0, pb: 0x7e, pc: 0x2000 },
  }));
  const trace = {
    ...artifact(),
    chunks: [
      {
        sequenceStart: 1,
        addresses: details.map(() => 0x7e2000),
        details,
        droppedEvents: 0,
        active: false,
      },
    ],
  };
  const context = { projectRomContentSha256: romContentSha256, sourceName: "full.json" };
  const imported = importRuntimeInstructionTrace(trace, context);
  t.deepEqual(imported, importRuntimeInstructionTrace(trace, { ...context, indexMode: "full" }));
  const instructions = imported.batch.runtime.filter((r) => r.kind === "runtime-instruction");
  t.is(instructions.length, 1000);
  t.true(
    instructions.every(
      (r) => r.count === 1 && r.state.p === 0x31 && "a" in r.state && "s" in r.state,
    ),
  );
  t.deepEqual(
    instructions.map((r) => r.state.x).toSorted((a, b) => Number(a) - Number(b)),
    details.map((r) => r.state.x),
  );
  t.is(imported.report.indexProfile, undefined);
  const merged = mergeRuntimeEvidence(emptyShards(), imported.batch);
  t.false(mergeRuntimeEvidence(merged.shards, imported.batch).changed);
  // Runtime callers can bypass TypeScript. Reject unsupported modes before consuming a trace.
  t.throws(() => importRuntimeInstructionTrace(trace, { ...context, indexMode: "sample" }), {
    message: /Only full/,
  });
});

test("trace indexes fail at an explicit record budget without sampling or exhausting a Map", (t) => {
  const context = {
    projectRomContentSha256: romContentSha256,
    sourceName: "bounded.json",
    indexMode: "full" as const,
    maxIndexRecords: 3,
  };
  const importer = createRuntimeInstructionTraceImporter(artifact(), context);
  const chunk = {
    sequenceStart: 1,
    addresses: [0x808000],
    details: [{ bytes: [0xea], state: { p: 0x30, x: 1 } }],
    droppedEvents: 0,
    active: false,
  };
  importer.push(chunk);
  t.throws(
    () =>
      importer.push({
        ...chunk,
        sequenceStart: 2,
        details: [{ bytes: [0xea], state: { p: 0x30, x: 2 } }],
      }),
    { message: /Trace index exceeds 3 records.*No partial import/ },
  );
  t.throws(() => importer.finish(), { message: /Trace index exceeds 3 records/ });
});

test("rich traces retain byte variants, state, bus actors and explicit loss without double counting PCs", (t) => {
  const base = artifact();
  const access = {
    addressSpace: "snes.cpu",
    address: 0x2118,
    access: "write" as const,
    width: 1,
    value: 7,
    actor: "dma" as const,
    channel: 7,
  };
  const detail = {
    bytes: [0xea],
    state: { e: 0, p: 0x30 },
    memoryAccesses: [
      access,
      { ...access, access: "fetch" as const, actor: "cpu" as const, channel: undefined },
    ],
    droppedMemoryAccesses: 10,
  };
  const trace = {
    ...base,
    chunks: [
      {
        sequenceStart: 1,
        addresses: [0x7e2000, 0x7e2000],
        details: [detail, { ...detail, bytes: [0x60] }],
        droppedEvents: 0,
        unattributedMemoryAccesses: 3,
        active: false,
      },
    ],
  };
  const imported = importRuntimeInstructionTrace(trace, {
    projectRomContentSha256: romContentSha256,
    sourceName: "rich.json",
  });
  const runtime = imported.batch.runtime;
  t.is(runtime.find((record) => record.kind === "runtime-execution")?.count, 2);
  t.is(runtime.filter((record) => record.kind === "runtime-instruction").length, 2);
  t.is(runtime.filter((record) => record.kind === "runtime-cpu-state").length, 2);
  const memory = runtime.filter((record) => record.kind === "runtime-memory-access");
  t.is(memory.length, 1);
  t.is(memory[0]?.count, 2);
  t.is(memory[0]?.actor, "dma");
  t.is(memory[0]?.channel, 7);
  t.true(imported.report.warnings.some((warning) => warning.includes("20 memory operations")));
  t.true(imported.report.warnings.some((warning) => warning.includes("3 bus operations")));
  const merged = mergeRuntimeEvidence(emptyShards(), imported.batch);
  t.false(mergeRuntimeEvidence(merged.shards, imported.batch).changed);
  for (const details of [
    [],
    [{ ...detail, bytes: [256] }],
    [{ ...detail, state: { p: NaN } }],
    [{ ...detail, memoryAccesses: [{ ...access, channel: 8 }] }],
  ]) {
    t.throws(() =>
      validateRuntimeInstructionTrace({
        ...trace,
        chunks: [{ ...trace.chunks[0], addresses: [0x7e2000], details }],
      }),
    );
  }
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
  t.true(imported.report.warnings.includes("Trace artifact ended while capture was still active."));
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
      mutate: (value) => {
        traceChunk(value).addresses = null;
      },
      message: /addresses must be an array/,
    },
    {
      mutate: (value) => {
        traceChunk(value).active = "yes";
      },
      message: /active must be boolean/,
    },
    {
      mutate: (value) => {
        traceChunk(value).sequenceStart = 0;
      },
      message: /sequenceStart/,
    },
    {
      mutate: (value) => {
        const list = traceAddresses(traceChunk(value));
        list[0] = -1;
      },
      message: /address 0/,
    },
    {
      mutate: (value) => {
        traceChunk(value).droppedEvents = -1;
      },
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
    const value: unknown = structuredClone(artifact());
    if (!isTraceRecord(value)) {
      throw new Error("Expected a trace object.");
    }
    mutate(value);
    t.throws(() => importRuntimeInstructionTrace(value, context), { message });
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
  t.true(imported.report.warnings.some((warning) => warning.includes("no captured bytes/state")));

  const empty = structuredClone(artifact());
  empty.chunks = [];
  const emptyImport = importRuntimeInstructionTrace(empty, {
    projectRomContentSha256: romContentSha256,
    sourceName: "empty.trace.json",
    indexMode: "full",
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
