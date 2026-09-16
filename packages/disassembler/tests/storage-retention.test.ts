import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { test } from "../../../tests/ava-helper.js";
import {
  RomImage,
  writeAnalysisProject,
  openAnalysisProjectStore,
  loadAnalysisProject,
  importRuntimeInstructionTrace,
  importRuntimeTraceIntoProject,
  importRuntimeTraceSourceIntoProject,
  validateRuntimeInstructionTraceMetadata,
  mergeRuntimeEvidence,
  migrateAnalysisProjectStorage,
  project65816AnalysisState,
  expireCaptureArchives,
  type AnalysisProject,
  type RuntimeInstructionTraceArtifact,
} from "../src/index.js";

const project = (): AnalysisProject => ({
  manifest: {
    format: "uttori-asm-analysis",
    schemaVersion: 3,
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
    imports: [],
    evidence: [],
    runtime: [],
  },
});
const trace = (revision = "1"): RuntimeInstructionTraceArtifact => ({
  format: "uttori-asm-instruction-trace",
  schemaVersion: 1,
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  romContentSha256: project().manifest.rom.contentSha256,
  producer: { id: "fixture", revision },
  chunks: [
    {
      sequenceStart: 1,
      addresses: [0x8000, 0x8000, 0x8000],
      droppedEvents: 0,
      active: false,
      details: [
        { bytes: [0xea], state: { p: 0x31, e: 0, db: 0, d: 0, a: 1 } },
        { bytes: [0xea], state: { p: 0x30, e: 0, db: 0, d: 0, a: 2 } },
        { bytes: [0xea], state: { P: 0x30, E: 0, DB: 0, D: 0, A: 3 } },
      ],
    },
  ],
});
const context = {
  projectRomContentSha256: project().manifest.rom.contentSha256,
  sourceName: "capture.json",
};
const source = (artifact: RuntimeInstructionTraceArtifact) => ({
  metadata: validateRuntimeInstructionTraceMetadata(artifact),
  read: async (accept: (chunk: unknown) => void) => {
    for (const chunk of artifact.chunks) accept(chunk);
  },
});
const temporary = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "uttori-retention-"));

test("default decoder profile preserves joint width/bank unknowns and normalizes aliases without inventing state", (t) => {
  t.deepEqual(project65816AnalysisState({ p: 0x31, P: 0, e: 0, d: 0, db: 255, a: 9 }), {
    p: 0x30,
    e: 0,
    d: 0,
    db: 255,
  });
  t.deepEqual(project65816AnalysisState({ p: 256, P: 0x30, e: true, db: -1, d: 65536 }), {});
  t.deepEqual(project65816AnalysisState({ p: "unknown", e: 1 }), { p: 0x30, e: 1 });
  t.deepEqual(project65816AnalysisState({ E: 0, P: 0, D: 0, DB: 0 }), { e: 0, p: 0, d: 0, db: 0 });
  const imported = importRuntimeInstructionTrace(trace(), context);
  t.is(imported.report.indexProfile, "65816-analysis-v2");
  const instructions = imported.batch.runtime!.filter((r) => r.kind === "runtime-instruction");
  t.is(instructions.length, 1);
  t.is(instructions[0].count, 3);
  t.is(
    imported.sourceSha256,
    importRuntimeInstructionTrace(trace(), { ...context, indexMode: "full" }).sourceSha256,
  );
});

test("shared facts and virtual state pairs keep exact per-capture counts and detach independent mutations", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, project());
  const first = await importRuntimeTraceSourceIntoProject(source(trace()), directory, context);
  const second = await importRuntimeTraceSourceIntoProject(source(trace("2")), directory, context);
  t.is(first.storage.newFacts, 2);
  t.is(second.storage.newFacts, 0);
  t.is(second.storage.reusedFacts, 2);
  const store = openAnalysisProjectStore(directory);
  const db = new DatabaseSync(store.file);
  try {
    t.is(store.storageSnapshot().pairedStates, 2);
    t.is(store.storageSnapshot().observations, 4);
    t.is(store.counts().runtime, 6);
    t.is(store.runtimeExecutionCounts().events, 6);
    // A point lookup must use both physical IDs and the virtual-state expression index.
    // Otherwise each execution-offset update can scan the entire paired-state history.
    const plan = db.prepare("EXPLAIN QUERY PLAN SELECT payload FROM runtime WHERE rowid=?").all(1);
    t.true(plan.some((row) => String(row.detail).includes("runtime_state_row")));
    const code = db
      .prepare("SELECT rowid FROM runtime WHERE kind='runtime-instruction' LIMIT 1")
      .get()!;
    db.prepare("UPDATE runtime SET count=9 WHERE rowid=?").run(code.rowid);
    t.deepEqual(
      [...store.runtimeRecordsByKinds(["runtime-cpu-state"])].map((r) => r.count),
      [3, 3],
    );
    t.deepEqual(
      [...store.runtimeRecordsByKinds(["runtime-instruction"])]
        .map((r) => r.count)
        .sort((a, b) => a - b),
      [3, 9],
    );
    db.exec("DELETE FROM runtime WHERE kind='runtime-cpu-state'");
    t.is([...store.runtimeRecordsByKinds(["runtime-cpu-state"])].length, 0);
    t.is([...store.runtimeRecordsByKinds(["runtime-instruction"])].length, 2);
    db.exec("DELETE FROM runtime");
    t.is(store.storageSnapshot().observations, 0);
    t.is(store.storageSnapshot().facts, 0);
  } finally {
    db.close();
    store.close();
  }
});

test("expired detail can be restored from an original file without recounting evidence", async (t) => {
  const root = temporary();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "analysis");
  writeAnalysisProject(directory, project());
  const file = path.join(root, "trace.json");
  fs.writeFileSync(file, JSON.stringify(trace()));
  const first = await importRuntimeTraceIntoProject(file, directory, context);
  const store = openAnalysisProjectStore(directory);
  try {
    const archive = path.join(
      directory,
      "archives",
      String(store.captureReceipt(first.sourceSha256)!.archive_name),
    );
    fs.unlinkSync(archive);
  } finally {
    store.close();
  }
  const repaired = await importRuntimeTraceIntoProject(file, directory, context);
  t.true(repaired.archive.archived);
  t.false(repaired.changed);
  t.is(repaired.storage.after.captures, 1);
  t.is(repaired.observedEvents, 3);
});

test("cache eviction invalidates disposable projections and rebuilds them without touching facts", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, project());
  await importRuntimeTraceSourceIntoProject(source(trace()), directory, context);
  const store = openAnalysisProjectStore(directory);
  try {
    const before = [
      ...store.runtimeInstructionVariants("snes.65816", "snes.cpu", ["p", "e", "d", "db"]),
    ];
    t.true(store.storageCacheBytes() > 0);
    store.transaction(() => store.setStoragePolicy({ cacheMaxBytes: 0 }));
    t.true(store.maintainStorage().evicted.includes("instruction_variants"));
    t.deepEqual(
      [...store.runtimeInstructionVariants("snes.65816", "snes.cpu", ["p", "e", "d", "db"])],
      before,
    );
    t.is(store.runtimeExecutionCounts().events, 3);
  } finally {
    store.close();
  }
});

test("format-one conversion preserves counts/provenance, narrows only paired native state, and cannot recount a full reimport", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const base = project();
  const full = importRuntimeInstructionTrace(trace(), { ...context, indexMode: "full" });
  const merged = mergeRuntimeEvidence(base.shards, full.batch);
  const independent = {
    id: "standalone",
    kind: "runtime-cpu-state" as const,
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: 0x8000,
    count: 1,
    evidence: [],
    state: { a: 99 },
  };
  writeAnalysisProject(directory, {
    ...base,
    shards: { ...merged.shards, runtime: [...merged.shards.runtime, independent] },
  });
  const db = new DatabaseSync(path.join(directory, "analysis.sqlite"));
  // Reconstruct the preceding physical layout so this covers dictionary-based legacy reads too.
  db.exec(`CREATE TABLE old_runtime AS SELECT prefix_id,id,kind,architecture,count,address_space,address,start,"end",from_address_space,from_address,
    to_address_space,to_address,instruction_address_space,instruction_address,accessed_address_space,accessed_address,coverage,evidence_id,payload FROM runtime;
    DROP VIEW runtime; DROP TABLE runtime_observations; DROP TABLE runtime_facts; ALTER TABLE old_runtime RENAME TO runtime;
    CREATE UNIQUE INDEX old_identity ON runtime(prefix_id,id); PRAGMA user_version=1;`);
  db.close();
  const migration = await migrateAnalysisProjectStorage(directory, { convertRuntime: true });
  t.true(migration.changed);
  t.true(fs.existsSync(migration.backupFile!));
  const loaded = loadAnalysisProject(directory);
  t.deepEqual(loaded.shards.evidence, merged.shards.evidence);
  t.deepEqual(
    loaded.shards.runtime.find((r) => r.id === "standalone"),
    independent,
  );
  t.is(loaded.shards.runtime.filter((r) => r.kind === "runtime-instruction").length, 1);
  t.is(loaded.shards.runtime.filter((r) => r.kind === "runtime-instruction")[0].count, 3);
  t.is(loaded.shards.imports[0].indexProfile, "65816-analysis-v2");
  const again = await importRuntimeTraceSourceIntoProject(source(trace()), directory, {
    ...context,
    indexMode: "full",
  });
  t.false(again.changed);
  t.is(again.added.runtime, 0);
  t.true(again.warnings.some((warning) => warning.includes("different profile")));
  const store = openAnalysisProjectStore(directory);
  try {
    t.is(store.runtimeExecutionCounts().events, 3);
    t.is(store.captureCatalog().length, 1);
  } finally {
    store.close();
  }
});

test("archive byte expiry respects pins, preserves original files and receipts, and stays idempotent", async (t) => {
  const root = temporary();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "analysis");
  writeAnalysisProject(directory, project());
  const firstFile = path.join(root, "first.json"),
    secondFile = path.join(root, "second.json");
  fs.writeFileSync(firstFile, JSON.stringify(trace()));
  fs.writeFileSync(secondFile, JSON.stringify(trace("2")));
  const first = await importRuntimeTraceIntoProject(firstFile, directory, context);
  const second = await importRuntimeTraceIntoProject(secondFile, directory, context);
  t.true(first.archive.archived);
  t.true(second.archive.archived);
  const store = openAnalysisProjectStore(directory);
  try {
    store.transaction(() => {
      store.pinCapture(first.sourceSha256, true);
      store.setStoragePolicy({ archiveMaxBytes: 0 });
    });
    const before = store.runtimeExecutionCounts();
    t.deepEqual(expireCaptureArchives(store).expired, [second.sourceSha256]);
    t.deepEqual(store.runtimeExecutionCounts(), before);
    t.is(store.captureReceipt(first.sourceSha256)?.availability, "managed");
    t.is(store.captureReceipt(second.sourceSha256)?.availability, "expired");
    t.true(fs.existsSync(firstFile));
    t.true(fs.existsSync(secondFile));
    t.is(store.captureCatalog().length, 2);
  } finally {
    store.close();
  }
  const again = await importRuntimeTraceIntoProject(secondFile, directory, context);
  t.false(again.changed);
  t.is(again.added.runtime, 0);
  t.false(again.archive.archived);
});

test("project byte ceiling rolls back a complete new publication and its capture receipt", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, project());
  const store = openAnalysisProjectStore(directory);
  const revision = store.revision();
  store.transaction(() => store.setStoragePolicy({ databaseMaxBytes: 1 }));
  store.close();
  await t.throwsAsync(importRuntimeTraceSourceIntoProject(source(trace()), directory, context), {
    message: /storage budget/,
  });
  const after = openAnalysisProjectStore(directory);
  try {
    t.is(after.revision(), revision);
    t.is(after.counts().runtime, 0);
    t.is(after.captureCatalog().length, 0);
  } finally {
    after.close();
  }
});

test("conversion rejects malformed originals before equivalent variants can hide an invalid count", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const base = project();
  const full = importRuntimeInstructionTrace(trace(), { ...context, indexMode: "full" });
  writeAnalysisProject(directory, {
    ...base,
    shards: mergeRuntimeEvidence(base.shards, full.batch).shards,
  });
  const db = new DatabaseSync(path.join(directory, "analysis.sqlite"));
  db.exec(
    "UPDATE runtime SET count=-1 WHERE rowid=(SELECT rowid FROM runtime WHERE kind='runtime-instruction' LIMIT 1)",
  );
  db.close();
  const error = await t.throwsAsync(
    migrateAnalysisProjectStorage(directory, { convertRuntime: true }),
  );
  t.regex(error!.message, /count/i);
  t.false(fs.existsSync(path.join(directory, "analysis.sqlite.pre-retention.backup")));
});
