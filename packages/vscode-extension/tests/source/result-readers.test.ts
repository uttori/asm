import { test } from "../../../../tests/ava-helper.js";
import {
  readSourceStatus,
  readResearchResult,
  readGraphicsSelection,
  readSourceRepresentation,
  readConversionPlan,
  readGenerationCommit,
  readBuildOutput,
  readMergePreview,
} from "../../src/source/result-readers.js";

test("status preserves unknown catalog readiness when local evidence is absent", (t) => {
  const status = {
    phase: "idle",
    head: "a".repeat(40),
    conflicts: [],
    dirty: false,
    unstaged: false,
    candidateAccepted: false,
    candidateStale: false,
    analysisReady: false,
    analysisReason: "Local evidence is unavailable.",
  };
  t.deepEqual(readSourceStatus(status), status);
  t.throws(() => readSourceStatus({ ...status, head: 123 }), { message: /Invalid source status/ });
  t.throws(() => readSourceStatus({ ...status, catalogReady: "yes" }), {
    message: /Invalid source status/,
  });
});

/** IPC fixtures retain meaningful payloads so nested validation is exercised before any UI edit. */
const analysis = {
  kind: "analysis",
  documents: [{ path: "research/native.json", sha256: "a".repeat(64) }],
  addressSpaces: [{ id: "snes.cpu", name: "CPU", addressBits: 24, kind: "cpu" }],
  records: [
    {
      path: "research/native.json",
      collection: "annotations",
      value: {
        id: "code",
        addressSpace: "snes.cpu",
        evidence: ["capture"],
        architecture: "snes.65816",
        classification: "opcode",
        start: 0xc00000,
        end: 0xc00001,
      },
    },
    {
      path: "research/native.json",
      collection: "analysis",
      value: {
        id: "targets",
        addressSpace: "snes.cpu",
        evidence: [],
        kind: "target-set",
        name: "Dispatch",
        targets: [0xc00000],
      },
    },
    {
      path: "research/native.json",
      collection: "analysis",
      value: {
        id: "override",
        addressSpace: "snes.cpu",
        evidence: [],
        kind: "target-override",
        address: 0xc00001,
        targets: [],
      },
    },
  ],
};
const symbol = {
  id: "start",
  name: "Start",
  path: "research/native.json",
  addressSpace: "snes.cpu",
  address: 0xc00000,
  aliases: ["Boot"],
  suppressed: false,
  entryPoint: true,
};
const edit = {
  kind: "edit",
  path: "research/native.json",
  beforeSha256: "a".repeat(64),
  before: "{}",
  after: '{"version":1}',
};

test("research IPC preserves edits, original identities, target sets and target overrides", (t) => {
  for (const value of [analysis, edit, { kind: "symbols", symbols: [symbol] }]) {
    t.true(Object.is(readResearchResult(value), value));
  }
});

test("malformed research payloads fail before they reach native editing", (t) => {
  const invalid: unknown[] = [
    null,
    [],
    {},
    { kind: "edit" },
    { ...edit, after: null },
    { kind: "symbols", symbols: {} },
    { kind: "symbols", symbols: [null] },
    { kind: "symbols", symbols: [{ ...symbol, aliases: [12] }] },
    { kind: "symbols", symbols: [{ ...symbol, address: "$C00000" }] },
    { kind: "symbols", symbols: [{ ...symbol, entryPoint: "yes" }] },
    { ...analysis, documents: null },
    { ...analysis, records: [null] },
    { ...analysis, documents: [{ path: 1, sha256: "a" }] },
    { ...analysis, addressSpaces: [{ ...analysis.addressSpaces[0], kind: "rom-ish" }] },
    { ...analysis, addressSpaces: [{ ...analysis.addressSpaces[0], addressBits: "24" }] },
  ];
  for (const record of analysis.records) {
    for (const change of [
      { path: 0 },
      { collection: "runtime" },
      { value: null },
      { value: { ...record.value, evidence: "capture" } },
    ]) {
      invalid.push({ ...analysis, records: [{ ...record, ...change }] });
    }
  }
  for (const change of [
    { start: "0" },
    { end: null },
    { architecture: false },
    { classification: null },
  ]) {
    invalid.push({
      ...analysis,
      records: [{ ...analysis.records[0], value: { ...analysis.records[0].value, ...change } }],
    });
  }
  for (const change of [
    { kind: "unknown" },
    { targets: {} },
    { targets: ["$C00000"] },
    { name: null },
  ]) {
    invalid.push({
      ...analysis,
      records: [{ ...analysis.records[1], value: { ...analysis.records[1].value, ...change } }],
    });
  }
  invalid.push({
    ...analysis,
    records: [{ ...analysis.records[2], value: { ...analysis.records[2].value, address: null } }],
  });
  for (const value of invalid) {
    t.throws(() => readResearchResult(value), { message: /Invalid source research/ });
  }
});

test("status projects every recovery phase without exposing the worker journal", (t) => {
  const base = {
    head: "a".repeat(40),
    conflicts: ["source/main.asm"],
    dirty: true,
    unstaged: false,
    candidateAccepted: false,
    candidateStale: true,
    analysisReady: true,
    catalogReady: false,
    catalogReason: "Rebuild catalog.",
    journal: { private: "worker-owned" },
  };
  for (const phase of [
    "idle",
    "merging",
    "checkpoint",
    "committed",
    "verified",
    "diverged",
  ] as const) {
    const source = { ...base, phase };
    const result = readSourceStatus(source);
    t.false(Object.hasOwn(result, "journal"));
    t.true(Object.hasOwn(source, "journal"));
    t.is(result.phase, phase);
  }
  for (const value of [
    null,
    { ...base, phase: "applying" },
    { ...base, phase: "idle", conflicts: [1] },
    { ...base, phase: "idle", dirty: 1 },
    { ...base, phase: "idle", catalogReason: false },
  ]) {
    t.throws(() => readSourceStatus(value), { message: /Invalid source status/ });
  }
});

test("capture selection validates retained archive identities without requiring archive paths", (t) => {
  const capture = {
    sha256: "a".repeat(64),
    sourceName: "capture",
    profile: "snes",
    observedEvents: 9,
    droppedEvents: 2,
    archives: [
      { name: "primary.act2", sha256: "b".repeat(64), bytes: 128 },
      { name: "graphics.act2", sha256: "c".repeat(64), bytes: 64, companionSha256: "d".repeat(64) },
    ],
  };
  t.deepEqual(readGraphicsSelection({ captures: [capture], private: true }), {
    captures: [capture],
  });
  for (const value of [
    null,
    { captures: {} },
    { captures: [null] },
    { captures: [{ ...capture, observedEvents: "9" }] },
    { captures: [{ ...capture, archives: [{ ...capture.archives[0], bytes: "128" }] }] },
    { captures: [{ ...capture, archives: [{ ...capture.archives[0], companionSha256: null }] }] },
  ]) {
    t.throws(() => readGraphicsSelection(value), { message: /Invalid graphics capture/ });
  }
});

test("source conversion validates creates, deletes and replacements with byte ownership intact", (t) => {
  const bytes = Uint8Array.of(0, 128, 255);
  const plan = {
    source: "source/a.png",
    destination: "source/a.bin",
    outputSha256: "a".repeat(64),
    changes: [
      { path: "new.bin", before: null, after: bytes },
      { path: "old.bin", before: bytes, after: null },
      { path: "edit.bin", before: bytes, after: bytes },
    ],
    snapshots: [{ path: "source/a.png", sha256: "b".repeat(64) }],
    affected: [{ file: "main.asm", line: 2, format: "binary" }],
    retained: ["research/native.json"],
    unresolvedDeclarations: [],
    assemblyInventory: ["main.asm"],
  };
  t.is(readConversionPlan(plan), plan);
  t.is(readConversionPlan({ ...plan, transaction: "pending" }).transaction, "pending");
  for (const value of [
    null,
    { ...plan, transaction: false },
    { ...plan, destination: null },
    { ...plan, changes: [{ path: "a", before: [], after: bytes }] },
    { ...plan, changes: [{ path: "a", before: bytes, after: [] }] },
    { ...plan, snapshots: [{ path: "a", sha256: 1 }] },
    { ...plan, affected: [{ file: "main.asm", line: "2", format: "binary" }] },
    { ...plan, retained: [false] },
    { ...plan, assemblyInventory: {} },
  ]) {
    t.throws(() => readConversionPlan(value), { message: /Invalid source conversion/ });
  }
});

test("small worker projections reject malformed envelopes and discard unused fields", (t) => {
  t.is(readSourceRepresentation(undefined), undefined);
  t.deepEqual(readSourceRepresentation({ representation: "raw", extra: true }), {
    representation: "raw",
  });
  const menu = { representation: "raw", inputs: [{ path: "asset.bin", sha256: "a".repeat(64) }] };
  t.deepEqual(readSourceRepresentation(menu), menu);
  const indexed = {
    ...menu,
    menus: [{ file: "main.asm", line: 2, endLine: 4, representation: "raw" }],
  };
  t.deepEqual(readSourceRepresentation(indexed), indexed);
  t.throws(() =>
    readSourceRepresentation({ ...indexed, menus: [{ ...indexed.menus[0], endLine: 1 }] }),
  );
  t.throws(() =>
    readSourceRepresentation({ ...menu, inputs: [{ path: "asset.bin", sha256: "short" }] }),
  );
  t.throws(() =>
    readSourceRepresentation({
      ...menu,
      inputs: [{ path: "../asset.bin", sha256: "a".repeat(64) }],
    }),
  );
  const generation = {
    generation: { commit: "a".repeat(40), descriptor: { inputs: { romSha256: "b".repeat(64) } } },
    verification: { outputSha256: "b".repeat(64) },
  };
  t.deepEqual(readGenerationCommit({ ...generation, private: true }), generation);
  for (const value of [
    null,
    {},
    { ...generation, verification: {} },
    { generation: { commit: 0 } },
    { ...generation, generation: { commit: "a", descriptor: {} } },
    { ...generation, generation: { commit: "a", descriptor: { inputs: { romSha256: 0 } } } },
  ]) {
    t.throws(() => readGenerationCommit(value), { message: /Invalid generation/ });
  }
  t.deepEqual(readBuildOutput({ outputFile: "/build/program.sfc", snapshots: [] }), {
    outputFile: "/build/program.sfc",
  });
  t.deepEqual(
    readMergePreview({ conflicts: ["main.asm"], resultTree: "a".repeat(40), private: true }),
    { conflicts: ["main.asm"], resultTree: "a".repeat(40) },
  );
  for (const value of [null, {}, []]) {
    t.throws(() => readSourceRepresentation(value), { message: /Invalid source representation/ });
    t.throws(() => readBuildOutput(value), { message: /Invalid build output/ });
    t.throws(() => readMergePreview(value), { message: /Invalid merge preview/ });
  }
  t.throws(() => readMergePreview({ conflicts: [1], resultTree: "a" }), {
    message: /Invalid merge preview/,
  });
});
