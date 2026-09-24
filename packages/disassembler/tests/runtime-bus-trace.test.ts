import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  RomImage,
  createRuntimeBusTraceImporter,
  importRuntimeBusTraceSourceIntoProject,
  loadAnalysisProject,
  openAnalysisProjectStore,
  validateRuntimeBusTraceMetadata,
  writeAnalysisProject,
  type AnalysisProject,
  type RuntimeBusAccess,
  type RuntimeBusTraceSource,
} from "../src/index.js";
import { DatabaseSync } from "./sqlite-connection.js";

const project: AnalysisProject = {
  manifest: {
    format: "uttori-asm-analysis",
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture",
    rom: new RomImage(new Uint8Array(0x8000)).identity,
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
const context = {
  projectRomContentSha256: project.manifest.rom.contentSha256,
  sourceName: "bus.act2",
};
const metadata = validateRuntimeBusTraceMetadata({
  format: "uttori-asm-bus-trace",
  schemaVersion: 1,
  scope: "snes.cpu-bus",
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256: context.projectRomContentSha256,
  producer: { id: "test", revision: "1" },
  session: "a".repeat(32),
  clock: { id: "snes.master", numerator: "236250000", denominator: "11" },
});
const event = (sequence: number, patch: Partial<RuntimeBusAccess> = {}): RuntimeBusAccess => ({
  sequence: String(sequence),
  ordinal: "9007199254740993",
  cycle: String(9007199254740993n + BigInt(sequence)),
  address: 0x7e0010,
  pc: 0x808000,
  value: 0x42,
  direction: "read",
  actor: "dma",
  channel: 0,
  phase: "dma",
  context: "instruction",
  hcounter: 100,
  vcounter: 200,
  ...patch,
});
const events = [
  event(1),
  event(2),
  event(3, { actor: "cpu", channel: null, phase: "cpu", context: "interrupt", ordinal: "0" }),
  event(4, { actor: "hdma", channel: 2, phase: "hdma-table" }),
  event(5, { actor: "hdma", channel: 2, phase: "hdma-indirect" }),
  event(6, { actor: "hdma", channel: 2, phase: "hdma-transfer", direction: "write" }),
];
const source = (accesses = events): RuntimeBusTraceSource => ({
  metadata,
  read: async (accept) => {
    accept({ accesses });
  },
});

test("bus facts preserve attribution, exact u64 clocks, and chunk-independent capture identity", (t) => {
  const whole = createRuntimeBusTraceImporter(metadata, context);
  whole.push({ accesses: events });
  const result = whole.finish();
  const split = createRuntimeBusTraceImporter(metadata, context);
  for (const access of events) {
    split.push({ accesses: [access] });
  }
  t.deepEqual(split.finish(), result);
  t.is(result.observedEvents, 6);
  t.is(result.report.imported.busRecords, 5);
  t.is(result.summary.contexts.interrupt, 1);
  t.is(result.summary.firstCycle, "9007199254740994");
  t.is(result.summary.lastCycle, "9007199254740999");
  t.is(result.summary.activity.length, 5);
  t.is(result.summary.activity.find((row) => row.actor === "dma")?.reads, 2);
  t.is(
    result.batch.runtime?.find(
      (fact) => fact.kind === "runtime-bus-access" && fact.context === "interrupt",
    )?.count,
    1,
  );
  t.true(result.batch.runtime?.every((fact) => fact.kind === "runtime-bus-access"));
  t.throws(whole.finish, { message: /cannot be finalized/ });
  const changed = createRuntimeBusTraceImporter(metadata, context);
  changed.push({ accesses: events.map((access) => ({ ...access, hcounter: 101 })) });
  t.not(changed.finish().sourceSha256, result.sourceSha256);
});

test("invalid bus streams latch failure and cannot publish an accepted prefix", (t) => {
  const invalid: Partial<RuntimeBusAccess>[] = [
    { sequence: "3" },
    { sequence: "02" },
    { ordinal: "0" },
    { ordinal: "9007199254740992" },
    { ordinal: "18446744073709551616" },
    { pc: 0x808001 },
    { cycle: "0" },
    { cycle: "1.5" },
    { address: 0x1000000 },
    { value: 256 },
    { channel: null },
    { channel: 8 },
    { phase: "cpu" },
    { actor: "cpu", phase: "cpu", channel: 0 },
    { context: "interrupt" },
    { hcounter: 1368 },
    { vcounter: 313 },
    { actor: "hdma", phase: "hdma-table", direction: "write" },
    { actor: "hdma", phase: "hdma-indirect", direction: "write" },
  ];
  for (const patch of invalid) {
    const importer = createRuntimeBusTraceImporter(metadata, context);
    importer.push({ accesses: [event(1)] });
    t.throws(() => importer.push({ accesses: [event(2, patch)] }));
    t.throws(importer.finish, { message: /after failure/ });
    t.throws(() => importer.push({ accesses: [event(2)] }), { message: /no longer writable/ });
  }
  const budget = createRuntimeBusTraceImporter(metadata, { ...context, maxIndexRecords: 1 });
  t.throws(() => budget.push({ accesses: events }), { message: /distinct-fact budget/ });
  t.throws(budget.finish);
  t.throws(
    () =>
      createRuntimeBusTraceImporter(metadata, {
        ...context,
        projectRomContentSha256: "b".repeat(64),
      }),
    { message: /ROM\/project mismatch/ },
  );
  t.throws(
    () =>
      createRuntimeBusTraceImporter(
        { ...metadata, clock: { ...metadata.clock, denominator: "0" } },
        context,
      ),
    { message: /positive/ },
  );
  const empty = createRuntimeBusTraceImporter(metadata, context).finish();
  t.is(empty.observedEvents, 0);
  t.is(empty.summary.firstCycle, null);
  t.deepEqual(empty.batch.runtime, []);
});

test("bus integer validation stays exact across number and bigint boundaries", (t) => {
  const clocks = [
    "999999999999999",
    "1000000000000000",
    "9007199254740991",
    "9007199254740992",
    "9007199254740993",
    "18446744073709551615",
  ];
  const importer = createRuntimeBusTraceImporter(metadata, context);
  for (const [i, clock] of clocks.entries()) {
    importer.push({ accesses: [event(i + 1, { cycle: clock, ordinal: clock })] });
  }
  t.is(importer.finish().summary.lastCycle, clocks.at(-1));
  for (const clock of ["-0", "00", " 1", "1e3", "18446744073709551616"]) {
    const invalid = createRuntimeBusTraceImporter(metadata, context);
    t.throws(() => invalid.push({ accesses: [event(1, { cycle: clock })] }));
  }
  const decreasing = createRuntimeBusTraceImporter(metadata, context);
  decreasing.push({ accesses: [event(1, { cycle: "9007199254740993" })] });
  t.throws(() => decreasing.push({ accesses: [event(2, { cycle: "9007199254740992" })] }), {
    message: /backwards/,
  });
});

test("falsy and malformed native PPU annotations cannot bypass fact validation", (t) => {
  for (const ppu of [null, false, 0, "", "invalid", {}, []]) {
    const importer = createRuntimeBusTraceImporter(
      { ...metadata, scope: "snes.cpu-bus-ppu" },
      context,
    );
    const access = { ...event(1), address: 0x2118, direction: "write", ppu };
    t.throws(() => importer.push({ accesses: [access] }));
    t.throws(importer.finish, { message: /after failure/ });
  }
});

test("bounded fact caches preserve exact counts across eviction and SQLite flushes", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bus-cache-eviction-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, project);
  const reference = createRuntimeBusTraceImporter(metadata, context);
  const trace: RuntimeBusTraceSource = {
    metadata,
    read: async (accept) => {
      for (let start = 0; start < 10000; start += 1000) {
        const chunk = {
          accesses: Array.from({ length: 1000 }, (_, i) =>
            event(start + i + 1, { address: 0x7e0000 + ((start + i) % 5000) }),
          ),
        };
        reference.push(chunk);
        accept(chunk);
      }
    },
  };
  const result = await importRuntimeBusTraceSourceIntoProject(trace, directory, context);
  const expected = reference.finish();
  t.is(result.sourceSha256, expected.sourceSha256);
  const runtime = loadAnalysisProject(directory).shards.runtime;
  t.is(runtime.length, 5000);
  t.true(runtime.every((record) => record.count === 2));
  t.is(result.observedEvents, 10000);
});

test("SQLite bus import survives reopen, deduplicates renamed captures and leaves execution counts empty", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-bus-project-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  writeAnalysisProject(root, project);
  const expected = createRuntimeBusTraceImporter(metadata, context);
  expected.push({ accesses: events });
  const first = await importRuntimeBusTraceSourceIntoProject(source(), root, context);
  t.is(first.added.runtime, 5);
  t.deepEqual(loadAnalysisProject(root).shards.runtime, expected.finish().batch.runtime);
  const duplicate = await importRuntimeBusTraceSourceIntoProject(source(), root, {
    ...context,
    sourceName: "renamed.act2",
  });
  t.false(duplicate.changed);
  t.is(duplicate.added.runtime, 0);
  t.is(duplicate.report.sourceName, "bus.act2");
  const store = openAnalysisProjectStore(root);
  try {
    t.deepEqual(store.runtimeExecutionCounts(), { records: 0, events: 0 });
    const receipt = store.captureReceipt(first.sourceSha256);
    t.is(receipt?.profile, "bus-access-v1");
    t.is(receipt?.observed_events, 6);
    t.is([...store.runtimeRecordsByKinds(["runtime-bus-access"])].length, 5);
  } finally {
    store.close();
  }
  // Inspect searchable coordinates as well as semantic round trips: unowned PCs are not owners.
  const dbFile = fs.readdirSync(root).find((name) => name.endsWith(".sqlite"))!;
  const db = new DatabaseSync(path.join(root, dbFile));
  try {
    const rows = db
      .prepare(
        "SELECT address, instruction_address FROM runtime_facts WHERE kind='runtime-bus-access'",
      )
      .all();
    t.true(rows.every((row) => row.address === null));
    t.is(rows.filter((row) => row.instruction_address === null).length, 1);
  } finally {
    db.close();
  }
});

test("bus reimport repairs a partial namespace and still rejects altered surviving observations", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bus-repair-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, project);
  await importRuntimeBusTraceSourceIntoProject(source(), directory, context);
  const original = loadAnalysisProject(directory).shards.runtime;
  const modify = (runtime: typeof original) => {
    const store = openAnalysisProjectStore(directory);
    try {
      store.transaction(() => store.replaceTables({ runtime }));
    } finally {
      store.close();
    }
  };
  modify(original.slice(1));
  const repaired = await importRuntimeBusTraceSourceIntoProject(source(), directory, context);
  t.is(repaired.added.runtime, 1);
  t.deepEqual(loadAnalysisProject(directory).shards.runtime, original);
  modify(original.map((record, i) => (i === 0 ? { ...record, count: record.count + 1 } : record)));
  await t.throwsAsync(importRuntimeBusTraceSourceIntoProject(source(), directory, context), {
    message: /changed content/,
  });
  // Removing every observation also remains repairable even though the import
  // report and prefix dictionary still exist. Neither alone proves completeness.
  modify([]);
  const all = await importRuntimeBusTraceSourceIntoProject(source(), directory, context);
  t.is(all.added.runtime, original.length);
  t.deepEqual(loadAnalysisProject(directory).shards.runtime, original);
});

test("late failure, cancellation and stale revisions publish no bus facts or retention changes", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-bus-atomic-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  writeAnalysisProject(root, project);
  const before = loadAnalysisProject(root);
  const failing = {
    ...source(),
    read: async (accept: (chunk: unknown) => void) => {
      await source().read(accept);
      throw new Error("torn tail");
    },
  };
  await t.throwsAsync(
    importRuntimeBusTraceSourceIntoProject(failing, root, context, {
      storagePolicy: { cacheMaxBytes: 1 },
    }),
    { message: "torn tail" },
  );
  t.deepEqual(loadAnalysisProject(root), before);
  for (const phase of ["Indexing", "Publishing"]) {
    const controller = new AbortController();
    await t.throwsAsync(
      importRuntimeBusTraceSourceIntoProject(source(), root, context, {
        signal: controller.signal,
        onStage: (message) => {
          if (message.startsWith(phase)) {
            controller.abort();
          }
        },
      }),
      { name: "AbortError" },
    );
    t.deepEqual(loadAnalysisProject(root), before);
  }
  const stale = {
    ...source(),
    read: async (accept: (chunk: unknown) => void) => {
      await source().read(accept);
      const concurrent = openAnalysisProjectStore(root);
      try {
        concurrent.transaction(() =>
          concurrent.publishManifest({ ...concurrent.manifest(), target: "concurrent edit" }),
        );
      } finally {
        concurrent.close();
      }
    },
  };
  await t.throwsAsync(importRuntimeBusTraceSourceIntoProject(stale, root, context), {
    message: /changed|revision|stale/i,
  });
  t.is(loadAnalysisProject(root).manifest.target, "concurrent edit");
  t.deepEqual(loadAnalysisProject(root).shards, before.shards);
});

test("large repeated bus streams use bounded chunks and retain exact aggregate counts", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-bus-large-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  writeAnalysisProject(root, project);
  const total = 1_000_000;
  const large = {
    metadata,
    read: async (accept: (chunk: unknown) => void) => {
      for (let first = 1; first <= total; first += 1000) {
        accept({
          accesses: Array.from({ length: Math.min(1000, total - first + 1) }, (_, i) =>
            event(first + i),
          ),
        });
      }
    },
  };
  const result = await importRuntimeBusTraceSourceIntoProject(large, root, {
    ...context,
    maxIndexRecords: 1,
  });
  t.is(result.observedEvents, total);
  t.is(result.added.runtime, 1);
  t.is(result.summary.activity.length, 1);
  t.is(loadAnalysisProject(root).shards.runtime[0]?.count, total);
});

test("separate sessions share bus facts while conflicting provenance rolls back new rows", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-bus-provenance-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  writeAnalysisProject(root, project);
  await importRuntimeBusTraceSourceIntoProject(source(), root, context);
  const secondSource = { ...source(), metadata: { ...metadata, session: "b".repeat(32) } };
  const second = await importRuntimeBusTraceSourceIntoProject(secondSource, root, context);
  t.is(second.added.runtime, 5);
  t.is(second.storage.newFacts, 0);
  t.is(second.storage.reusedFacts, 5);
  t.is(
    loadAnalysisProject(root).shards.runtime.reduce((total, record) => total + record.count, 0),
    12,
  );

  const thirdSource = { ...source(), metadata: { ...metadata, session: "c".repeat(32) } };
  const importer = createRuntimeBusTraceImporter(thirdSource.metadata, context);
  importer.push({ accesses: events });
  const expected = importer.finish();
  const store = openAnalysisProjectStore(root);
  let policy;
  try {
    policy = store.storagePolicy();
    store.transaction(() => {
      store.replaceTables({
        imports: [
          ...store.loadTable("imports"),
          { ...expected.report, imported: { busEvents: 99 } },
        ],
      });
      store.publishManifest(store.manifest());
    });
  } finally {
    store.close();
  }
  const before = loadAnalysisProject(root);
  await t.throwsAsync(
    importRuntimeBusTraceSourceIntoProject(thirdSource, root, context, {
      storagePolicy: { cacheMaxBytes: 1 },
    }),
    { message: /conflict|changed|different/i },
  );
  t.deepEqual(loadAnalysisProject(root), before);
  const reopened = openAnalysisProjectStore(root);
  try {
    t.deepEqual(reopened.storagePolicy(), policy);
  } finally {
    reopened.close();
  }
});
