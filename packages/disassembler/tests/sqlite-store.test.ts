import { createHash } from "node:crypto";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { test } from "../../../tests/ava-helper.js";
import { canonicalJson } from "../src/canonical-json.js";
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
import { installQueryCache } from "../src/sqlite-query-cache.js";
import { runtimeColumns } from "../src/sqlite-records.js";

test("synchronous transactions reject promises and roll back their writes and revision", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-async-transaction-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(32768))));
  const before = loadAnalysisProjectSnapshot(directory);
  const store = openAnalysisProjectStore(directory);
  try {
    // Simulate an untyped JavaScript caller. An async callback cannot own this synchronous lock.
    const action = async () => {
      store.replaceTables({ labels: [] });
      store.publishManifest(before.manifest);
      await Promise.resolve();
      return true;
    };
    t.throws(() => store.transaction(action as unknown as () => boolean), {
      instanceOf: TypeError,
      message: /synchronous/,
    });
    await Promise.resolve();
    t.deepEqual(loadAnalysisProjectSnapshot(directory), before);
  } finally {
    store.close();
  }
});

test("writer upgrades legacy cache keys atomically and keeps unrelated large cached payloads", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-cache-layout-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(32768))));
  const db = new DatabaseSync(path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE));
  t.teardown(() => db.close());
  db.exec(
    "CREATE TABLE query_cache(name TEXT PRIMARY KEY,signature TEXT NOT NULL,payload TEXT NOT NULL) WITHOUT ROWID",
  );
  const graph = JSON.stringify({ nodes: "x".repeat(12 * 1024 * 1024) });
  db.prepare("INSERT INTO query_cache VALUES(?,?,?)").run("graph", "v1", graph);
  db.prepare("INSERT INTO query_cache VALUES(?,?,?)").run("coverage", "v1", "{}");
  installQueryCache(db, "coverage", ["runtime"]);
  const store = openAnalysisProjectStore(directory);
  t.teardown(() => store.close());
  const withoutRowid = () =>
    String(
      db.prepare("SELECT sql FROM sqlite_schema WHERE name='query_cache'").get()!.sql,
    ).includes("WITHOUT ROWID");
  store.transaction(() => store.manifest(), false);
  t.true(withoutRowid(), "readers leave legacy layout untouched");
  t.throws(
    () =>
      store.transaction(() => {
        throw new Error("rollback");
      }),
    { message: "rollback" },
  );
  t.true(withoutRowid(), "failed publication rolls the schema upgrade back too");
  store.transaction(() =>
    store.insertRuntime({
      id: "new-execution",
      kind: "runtime-execution",
      architecture: "65816",
      addressSpace: "rom.file",
      address: 4,
      count: 1,
      evidence: ["manual-1"],
    }),
  );
  t.false(withoutRowid());
  t.is(db.prepare("SELECT payload FROM query_cache WHERE name='graph'").get()!.payload, graph);
  t.falsy(
    db.prepare("SELECT 1 FROM query_cache WHERE name='coverage'").get(),
    "existing invalidation triggers still work after the table replacement",
  );
  const plan = db
    .prepare("EXPLAIN QUERY PLAN DELETE FROM query_cache WHERE name=?")
    .all("coverage");
  t.true(
    plan.some((row) => String(row.detail).includes("USING INDEX")),
    "invalidation uses the payload-free name index",
  );
});

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

test("trace cache eviction retains exact counts and lazy payload creation for arbitrary keys", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
  const store = openAnalysisProjectStore(directory);
  const metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    peakEntries: 0,
    sqlStatements: 0,
    payloads: 0,
  };
  try {
    await store.indexTrace(async (index) => {
      let created = 0;
      for (let i = 0; i < 15000; i++) {
        const address = i % 5000;
        // Index keys are opaque strings, including repeats whose cache entries
        // were evicted. Payload construction belongs only to the first insertion.
        const added = index.add(`${address}:nonhex`, () => {
          created++;
          return { kind: "execution", address };
        });
        t.is(added, i < 5000);
      }
      const values = [...index.values()];
      t.is(values.length, 5000);
      t.true(values.every((entry) => entry.count === 3));
      t.is(created, 5000);
      index.clear();
      t.true(index.add("0:nonhex", () => ({ kind: "execution", address: 7 })));
      t.deepEqual([...index.values()], [{ fact: { kind: "execution", address: 7 }, count: 1 }]);
    }, metrics);
    t.is(metrics.payloads, 5001);
    t.is(metrics.peakEntries, 4096);
    t.true(metrics.evictions > 0);
  } finally {
    store.close();
  }
});

test("runtime batch insertion keeps namespace, uniqueness and existing-record collision checks", (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  writeAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
  const store = openAnalysisProjectStore(directory);
  const record: RuntimeEvidenceRecord = {
    id: "runtime:batch:a",
    kind: "runtime-execution",
    architecture: "fixture",
    addressSpace: "rom.file",
    address: 0,
    count: 2,
    evidence: ["manual-1"],
  };
  try {
    // A failed batch must roll back its accepted prefix, including new namespaces.
    t.throws(
      () =>
        store.transaction(() => {
          const duplicate = store.runtimeBatchInserter("runtime:batch:");
          duplicate(record);
          duplicate(record);
        }),
      { message: /UNIQUE/ },
    );
    let insert: ReturnType<typeof store.runtimeBatchInserter>;
    store.transaction(() => {
      insert = store.runtimeBatchInserter("runtime:batch:");
      t.true(insert(record));
    });
    t.throws(() => insert(record), { message: /transaction/ });
    t.throws(
      () =>
        store.transaction(() => {
          store.runtimeBatchInserter("runtime:batch:")({ ...record, id: "runtime:other:a" });
        }),
      { message: /escaped/ },
    );
    store.transaction(() => {
      const existing = store.runtimeBatchInserter("runtime:batch:");
      t.false(existing(record));
    });
    t.throws(
      () =>
        store.transaction(() => {
          store.runtimeBatchInserter("runtime:batch:")({ ...record, count: 3 });
        }),
      { message: /changed content/ },
    );
  } finally {
    store.close();
  }
});

const temporary = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "uttori-sqlite-store-"));

test("metadata replacement preserves identical and reordered records without invalidating stored rows", (t) => {
  const directory = temporary();
  const project = projectFor(new RomImage(new Uint8Array(0x8000)));
  const comments = [
    { id: "short", addressSpace: "rom.file", address: 0, text: "Brief", evidence: ["manual-1"] },
    {
      id: "compressed",
      addressSpace: "rom.file",
      address: 1,
      text: "Long comment. ".repeat(100),
      evidence: ["manual-1"],
    },
  ];
  writeAnalysisProject(directory, { ...project, shards: { ...project.shards, comments } });
  const store = openAnalysisProjectStore(directory);
  const database = new DatabaseSync(store.file);
  t.teardown(() => {
    database.close();
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const before = database.prepare("SELECT id,payload FROM comments ORDER BY id").all();
  t.is(typeof before.find((row) => row.id === "short")!.payload, "string");
  t.true(before.find((row) => row.id === "compressed")!.payload instanceof Uint8Array);
  // A no-op must preserve the physical row and its dependent caches, including reordered JSON keys.
  database.exec(
    "CREATE TRIGGER protect_unchanged BEFORE DELETE ON comments BEGIN SELECT RAISE(ABORT,'unexpected rewrite'); END",
  );
  store.transaction(() => store.replaceTables({ comments }));
  const reordered = comments.map(({ evidence, text, address, addressSpace, id }) => ({
    evidence,
    text,
    address,
    addressSpace,
    id,
  }));
  store.transaction(() => store.replaceTables({ comments: reordered }));
  t.deepEqual(database.prepare("SELECT id,payload FROM comments ORDER BY id").all(), before);
  database.exec("DROP TRIGGER protect_unchanged");
  store.transaction(() => store.replaceTables({ comments: [{ ...comments[0], text: "Changed" }] }));
  t.deepEqual(store.loadTable("comments"), [{ ...comments[0], text: "Changed" }]);
});

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
  const physical = new DatabaseSync(path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE));
  try {
    // Existing projects retain the v2 canonical fingerprint algorithm. A faster
    // writer must reuse those facts rather than create a second copy after upgrade.
    for (const record of runtime) {
      const columns = runtimeColumns(record);
      const payload = columns.payload === null ? null : canonicalJson(JSON.parse(columns.payload));
      const fingerprint = createHash("sha256")
        .update(
          canonicalJson({
            kind: record.kind,
            architecture: record.architecture,
            ...columns,
            payload,
          }),
        )
        .digest();
      t.truthy(
        physical.prepare("SELECT fid FROM runtime_facts WHERE fingerprint=?").get(fingerprint),
      );
    }
  } finally {
    physical.close();
  }
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
      "CREATE TRIGGER fail_fact BEFORE INSERT ON runtime_observations BEGIN SELECT RAISE(ROLLBACK, 'fact rollback'); END",
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
