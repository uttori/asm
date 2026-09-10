import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { test } from "../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  ANALYSIS_PROJECT_SQLITE_FILE,
  RomImage,
  SqliteAnalysisStore,
  loadAnalysisProject,
  loadAnalysisProjectView,
  writeAnalysisProject,
  type AnalysisProject,
  type RuntimeEvidenceRecord,
  openAnalysisProjectStore,
  loadAnalysisProjectSnapshot,
  commitAnalysisProjectTransaction,
  buildRomCoverageMap,
} from "../src/index.js";

const projectFor = (rom: RomImage): AnalysisProject => ({
  manifest: {
    format: ANALYSIS_PROJECT_FORMAT,
    schemaVersion: ANALYSIS_PROJECT_SCHEMA_VERSION,
    target: "fixture.target",
    rom: rom.identity,
    mapping: { mapper: "fixture", source: "override", candidates: [] },
    addressSpaces: [{ id: "rom.file", name: "ROM", addressBits: 24, kind: "file" }],
  },
  shards: {
    analysis: [],
    annotations: [
      {
        id: "annotation-1",
        addressSpace: "rom.file",
        start: 0,
        end: 4,
        classification: "data8",
        architecture: "fixture.architecture",
        evidence: ["manual-1"],
      },
    ],
    labels: [
      {
        id: "label-entry",
        addressSpace: "rom.file",
        address: 0,
        name: "Entry",
        evidence: ["manual-1"],
      },
    ],
    comments: [],
    regions: [],
    runtime: [
      {
        id: "runtime-exec-1",
        kind: "runtime-execution",
        architecture: "65816",
        count: 3,
        evidence: ["manual-1"],
        addressSpace: "rom.file",
        address: 0,
      },
    ],
    evidence: [
      {
        id: "manual-1",
        source: "manual",
        sourceId: "fixture.editor",
        confidence: "certain",
      },
    ],
    imports: [],
  },
});

const temporary = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sqlite-store-"));

test("sqlite preserves the original failure when SQLite already rolled back the transaction", (t) => {
  const directory = temporary();
  try {
    const project = projectFor(new RomImage(new Uint8Array(0x8000)));
    writeAnalysisProject(directory, project);
    const file = path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE);
    const database = new DatabaseSync(file);
    // RAISE(ROLLBACK) reproduces SQLite's automatic abort without exhausting the host's disk.
    database.exec(`CREATE TRIGGER abort_label BEFORE INSERT ON labels
      BEGIN SELECT RAISE(ROLLBACK, 'simulated storage failure'); END`);
    database.close();
    const store = new SqliteAnalysisStore(file, false);
    try {
      t.throws(
        () =>
          store.transaction(() =>
            store.replaceTables({
              labels: project.shards.labels.map((label) => ({ ...label, name: "Changed" })),
            }),
          ),
        { message: "simulated storage failure" },
      );
      t.is(store.loadShards().labels[0]?.name, "Entry");
      t.is(store.revision(), 1);
    } finally {
      store.close();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("sqlite creation preserves records and serves interval queries", (t) => {
  const directory = temporary();
  try {
    const rom = new RomImage(new Uint8Array(0x8000));
    writeAnalysisProject(directory, projectFor(rom));
    t.true(fs.existsSync(path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE)));
    t.false(fs.existsSync(path.join(directory, "analysis")));
    const loaded = loadAnalysisProject(directory);
    t.is(loaded.manifest.db, "analysis.sqlite");
    t.is(loaded.shards.labels[0]?.name, "Entry");
    t.is(loaded.shards.runtime[0]?.kind, "runtime-execution");
    const view = loadAnalysisProjectView(directory);
    t.is(view.view.runtime.length, 0);
    t.is(view.view.labels.length, 1);
    const store = new SqliteAnalysisStore(
      path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE),
      false,
    );
    try {
      t.is(store.loadTable("annotations")[0]?.classification, "data8");
      store.transaction(() => {
        store.replaceTables({
          labels: projectFor(rom).shards.labels.map((label) => ({ ...label, name: "Reset" })),
        });
        store.publishManifest(store.manifest());
      });
    } finally {
      store.close();
    }
    t.is(loadAnalysisProjectView(directory).view.labels[0]?.name, "Reset");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("SQLite round trips every runtime variant including optional and zero-valued fields", (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = projectFor(new RomImage(new Uint8Array(0x8000)));
  const base = { architecture: "fixture", count: 2, evidence: ["manual-1"] };
  const runtime: RuntimeEvidenceRecord[] = [
    {
      ...base,
      id: "a",
      kind: "runtime-execution",
      addressSpace: "rom.file",
      address: 0,
      fileOffset: 0,
      size: 1,
      opcode: 0,
    },
    {
      ...base,
      id: "b",
      kind: "runtime-instruction",
      addressSpace: "rom.file",
      address: 1,
      bytes: [0, 255],
      state: { e: false, a: 0, name: "日本語" },
    },
    {
      ...base,
      id: "c",
      kind: "runtime-cpu-state",
      addressSpace: "rom.file",
      address: 2,
      state: { a: 0, e: false },
    },
    {
      ...base,
      id: "d",
      kind: "runtime-memory-access",
      instructionAddressSpace: "rom.file",
      instructionAddress: 0,
      accessedAddressSpace: "rom.file",
      accessedAddress: 3,
      actor: "dma",
      channel: 0,
      access: "write",
      width: 1,
      value: 0,
    },
    {
      ...base,
      id: "e",
      kind: "runtime-coverage",
      addressSpace: "rom.file",
      start: 4,
      end: 8,
      coverage: "executed",
    },
    {
      ...base,
      id: "f",
      kind: "runtime-control-target",
      fromAddressSpace: "rom.file",
      fromAddress: 0,
      toAddressSpace: "rom.file",
      toAddress: 1,
      flowKind: "branch",
      indirect: false,
    },
    { ...base, id: "g", kind: "runtime-execution", addressSpace: "rom.file", address: 9 },
    {
      ...base,
      id: "h",
      kind: "runtime-memory-access",
      instructionAddressSpace: "rom.file",
      instructionAddress: 0,
      accessedAddressSpace: "rom.file",
      accessedAddress: 3,
      access: "read",
      width: 1,
    },
  ];
  writeAnalysisProject(directory, { ...project, shards: { ...project.shards, runtime } });
  const loaded = loadAnalysisProject(directory);
  t.deepEqual(loaded.shards.runtime, runtime);
  const store = openAnalysisProjectStore(directory);
  try {
    const streamed = store.transaction(
      () =>
        buildRomCoverageMap(
          loaded.manifest,
          { ...loaded.shards, runtime: [] },
          store.runtimeRecords(),
        ),
      false,
    );
    t.deepEqual(streamed, buildRomCoverageMap(loaded.manifest, loaded.shards));
    t.deepEqual([...store.runtimeRecordsByKinds(["runtime-coverage"])], [runtime[4]]);
  } finally {
    store.close();
  }
  const snapshot = loadAnalysisProjectSnapshot(directory);
  commitAnalysisProjectTransaction(directory, snapshot.revision, {
    ...snapshot,
    shards: { ...snapshot.shards, runtime: [] },
  });
  t.deepEqual(loadAnalysisProject(directory).shards.runtime, []);
});

test("missing and corrupt SQLite files are rejected without silently creating a database", (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
  const file = path.join(directory, "analysis.sqlite");
  fs.unlinkSync(file);
  t.throws(() => loadAnalysisProject(directory), { message: /does not exist/ });
  t.false(fs.existsSync(file));
  fs.writeFileSync(file, "not a SQLite database");
  t.throws(() => loadAnalysisProject(directory), { message: /not a database/ });
});

test("dictionary inserts roll back atomically and a retained connection can retry after automatic rollback", (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = projectFor(new RomImage(new Uint8Array(0x8000)));
  writeAnalysisProject(directory, project);
  const store = openAnalysisProjectStore(directory);
  const database = new DatabaseSync(store.file);
  const record = {
    ...project.shards.runtime[0],
    id: `new:prefix:${"f".repeat(64)}`,
    evidence: ["manual-1", "manual-1"],
  };
  try {
    database.exec(
      "CREATE TRIGGER fail_fact BEFORE INSERT ON runtime BEGIN SELECT RAISE(ROLLBACK, 'fact rollback'); END",
    );
    t.throws(() => store.transaction(() => store.insertRuntime(record)), {
      message: "fact rollback",
    });
    t.is(database.prepare("SELECT count(*) AS n FROM runtime_prefixes").get()?.n, 1);
    t.is(database.prepare("SELECT count(*) AS n FROM runtime_evidence").get()?.n, 1);
    database.exec("DROP TRIGGER fail_fact");
    t.true(store.transaction(() => store.insertRuntime(record)));
    t.false(store.transaction(() => store.insertRuntime(record)));
    t.throws(() => store.transaction(() => store.insertRuntime({ ...record, count: 99 })), {
      message: /changed content/,
    });
    t.is(database.prepare("SELECT count(*) AS n FROM runtime_prefixes").get()?.n, 2);
    t.is(database.prepare("SELECT count(*) AS n FROM runtime_evidence").get()?.n, 2);
  } finally {
    database.close();
    store.close();
  }
});

test("missing normalized dictionaries cannot silently hide retained runtime records", (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
  const database = new DatabaseSync(path.join(directory, "analysis.sqlite"));
  database.exec("PRAGMA foreign_keys=OFF; DELETE FROM runtime_evidence");
  database.close();
  t.throws(() => loadAnalysisProject(directory), { message: /dictionary entry/ });
});

test("runtime replacement rejects repeated IDs even when changed content would get a new rowid", (t) => {
  const directory = temporary();
  try {
    const project = projectFor(new RomImage(new Uint8Array(0x8000)));
    const first = project.shards.runtime[0]!;
    const second = { ...first, id: "second-runtime-id" };
    writeAnalysisProject(directory, {
      ...project,
      shards: { ...project.shards, runtime: [first, second] },
    });
    const store = openAnalysisProjectStore(directory);
    try {
      for (const replacement of [first, { ...first, count: first.count + 1 }]) {
        t.throws(
          () => store.transaction(() => store.replaceTables({ runtime: [first, replacement] })),
          {
            message: /Duplicate runtime record ID/,
          },
        );
        t.deepEqual(store.loadShards().runtime, [first, second]);
        t.is(store.revision(), 1);
      }
    } finally {
      store.close();
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
