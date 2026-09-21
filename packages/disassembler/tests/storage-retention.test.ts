import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { test } from "../../../tests/ava-helper.js";
import {
  RomImage,
  writeAnalysisProject,
  openAnalysisProjectStore,
  importRuntimeInstructionTrace,
  importRuntimeTraceIntoProject,
  importRuntimeTraceSourceIntoProject,
  validateRuntimeInstructionTraceMetadata,
  project65816AnalysisState,
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
    for (const chunk of artifact.chunks) {
      accept(chunk);
    }
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
    t.is(db.prepare("SELECT COUNT(*) AS n FROM runtime_identities").get()!.n, 2);
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
    t.is(db.prepare("SELECT COUNT(*) AS n FROM runtime_identities").get()!.n, 0);
  } finally {
    db.close();
    store.close();
  }
});

test("file imports retain receipts and exact counts without copying the source", async (t) => {
  const root = temporary();
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, "analysis");
  writeAnalysisProject(directory, project());
  const file = path.join(root, "trace.json");
  const contents = JSON.stringify(trace());
  fs.writeFileSync(file, contents);
  const first = await importRuntimeTraceIntoProject(file, directory, context);
  const again = await importRuntimeTraceIntoProject(file, directory, context);
  t.false(again.changed);
  t.is(again.storage.after.captures, 1);
  t.is(again.observedEvents, 3);
  t.is(fs.readFileSync(file, "utf8"), contents);
  t.deepEqual(fs.readdirSync(directory).sort(), ["analysis.json", "analysis.sqlite"]);
  // Receipts and facts remain useful after the caller removes the original recording.
  fs.unlinkSync(file);
  const store = openAnalysisProjectStore(directory);
  try {
    t.is(store.captureReceipt(first.sourceSha256)?.observed_events, 3);
    t.is(store.runtimeExecutionCounts().events, 3);
  } finally {
    store.close();
  }
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

test("full-profile capture imports increment summaries once and no-op reimports preserve the warm cache", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, project());
  const options = { ...context, indexMode: "full" as const };
  await importRuntimeTraceSourceIntoProject(source(trace()), directory, options);
  const store = openAnalysisProjectStore(directory);
  const db = new DatabaseSync(store.file);
  try {
    const variants = () => [
      ...store.runtimeInstructionVariants("snes.65816", "snes.cpu", ["p", "e", "d", "db"]),
    ];
    const stats = () =>
      JSON.parse(
        String(
          db.prepare("SELECT payload FROM query_cache WHERE name='instruction_variants'").get()!
            .payload,
        ),
      );
    const before = variants();
    t.deepEqual(stats(), { incremental: false, observations: 3 });
    const again = await importRuntimeTraceSourceIntoProject(source(trace()), directory, options);
    t.false(again.changed);
    t.deepEqual(variants(), before);
    t.deepEqual(stats(), { incremental: false, observations: 3 });
    await importRuntimeTraceSourceIntoProject(source(trace("second")), directory, options);
    t.is(
      variants().reduce((count, row) => count + row.count, 0),
      6,
    );
    t.deepEqual(stats(), { incremental: true, observations: 3 });
    t.is(store.storageSnapshot().pairedStates, 6);
    t.is(store.captureCatalog().length, 2);
    t.true(
      [...store.runtimeRecordsByKinds(["runtime-instruction"])].every(
        (row) => row.kind === "runtime-instruction" && ("a" in row.state || "A" in row.state),
      ),
    );
  } finally {
    db.close();
    store.close();
  }
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
