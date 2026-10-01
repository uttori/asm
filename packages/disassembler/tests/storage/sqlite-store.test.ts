import { createHash } from "node:crypto";
import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

import { test } from "../../../../tests/ava-helper.js";
import {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  ANALYSIS_PROJECT_SQLITE_FILE,
  RomImage,
  SqliteAnalysisStore,
  loadAnalysisProject,
  loadAnalysisProjectView,
  publishAnalysisProject,
  type AnalysisProject,
  type RuntimeEvidenceRecord,
  openAnalysisProjectStore,
  loadAnalysisProjectSnapshot,
  commitAnalysisProjectTransaction,
  buildRomCoverageMap,
} from "../../src/index.js";
import { compareRuntimeRecordIds, runtimeColumns } from "../../src/storage/sqlite-records.js";
import { RUNTIME_TRACE_BATCH_OBSERVATIONS_SQL } from "../../src/storage/sqlite-runtime-batch.js";
import { RUNTIME_RECORD_STREAM_SQL } from "../../src/storage/sqlite-runtime-storage.js";
import { runtimeSummaryInputSql } from "../../src/storage/sqlite-runtime-summary.js";
import { RUNTIME_RECORD_LOOKUP_SQL } from "../../src/storage/sqlite-store.js";
import { DatabaseSync } from "../helpers/sqlite-connection.js";

test("synchronous transactions reject promises and roll back their writes and revision", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-async-transaction-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  publishAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(32768))));
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

test("evidence validation rejects removal used by retained observations and permits unused dictionary entries", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-evidence-integrity-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  publishAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(32768))));
  const store = openAnalysisProjectStore(directory);
  try {
    t.throws(
      () =>
        store.transaction(() => {
          store.replaceTables({ evidence: [] });
          store.validateRuntimeEvidence();
        }),
      { message: /Runtime history refers to missing evidence 'manual-1'/ },
    );
    t.is(store.loadTable("evidence").length, 1);
    store.transaction(() => {
      store.replaceTables({ runtime: [], evidence: [] });
      store.validateRuntimeEvidence();
    });
    t.is(store.loadTable("evidence").length, 0);
  } finally {
    store.close();
  }
});

test("trace cache eviction retains exact counts and lazy payload creation for arbitrary keys", async (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  publishAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
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
  publishAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
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

test("bulk trace observation joins probe retained indexes without rebuilding a history-sized index", (t) => {
  const directory = temporary();
  publishAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
  const db = new DatabaseSync(path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE));
  t.teardown(() => {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  db.exec(`CREATE TEMP TABLE runtime_trace_batch(
    position INTEGER PRIMARY KEY,fingerprint BLOB,identity_value,prefix_id,evidence_id,count,state_prefix_id,query_ready
  )`);
  const plan = db
    .prepare(`EXPLAIN QUERY PLAN ${RUNTIME_TRACE_BATCH_OBSERVATIONS_SQL}`)
    .all()
    .map((row) => String(row.detail));
  t.true(plan.some((detail) => detail.includes("runtime_fact_fingerprint")));
  t.true(plan.some((detail) => detail.includes("runtime_identity_key")));
  t.false(plan.some((detail) => detail.includes("AUTOMATIC")));
  t.false(plan.some((detail) => /SCAN (f|i)(\s|$)/.test(detail)));
});

test("instruction variants avoid materializing the complete runtime history", (t) => {
  const directory = temporary();
  const store = new SqliteAnalysisStore(path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE));
  const db = new DatabaseSync(store.file);
  t.teardown(() => {
    db.close();
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  // Planning needs the scalar function's arity, but must never evaluate any payload.
  db.function("analysis_instruction_variant", (payload) => {
    t.fail("EXPLAIN QUERY PLAN must not decode runtime payloads");
    return String(payload);
  });
  const plan = db
    .prepare(`EXPLAIN QUERY PLAN ${runtimeSummaryInputSql(false)}`)
    .all("snes.65816", "snes.cpu")
    .map((row) => String(row.detail));
  // Copying the UNION ALL view and its automatic index can exceed free disk space even
  // when the grouped result is small. Representatives must use physical primary keys.
  t.false(
    plan.some((detail) => /MATERIALIZE runtime|AUTOMATIC.*INDEX/.test(detail)),
    plan.join("\n"),
  );
  // Full reconstruction follows physical observation order to reuse compressed history blocks.
  t.true(
    plan.some((detail) => /^SCAN o$/.test(detail)),
    plan.join("\n"),
  );
  db.exec("CREATE TEMP TABLE query_runtime_variant_pending (oid INTEGER PRIMARY KEY)");
  const incremental = db
    .prepare(`EXPLAIN QUERY PLAN ${runtimeSummaryInputSql(true)}`)
    .all("snes.65816", "snes.cpu")
    .map((row) => String(row.detail));
  t.true(
    incremental.some((detail) => /SEARCH o USING INTEGER PRIMARY KEY/.test(detail)),
    incremental.join("\n"),
  );
});

test("instruction variants preserve shared facts, paired states, payload codecs and exact source counts", (t) => {
  const directory = temporary();
  const store = new SqliteAnalysisStore(path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE));
  const db = new DatabaseSync(store.file);
  t.teardown(() => {
    db.close();
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const trace = `runtime:instruction-trace:${"a".repeat(64)}`;
  const instruction: Extract<RuntimeEvidenceRecord, { kind: "runtime-instruction" }> = {
    id: `${trace}:code:${"b".repeat(64)}`,
    kind: "runtime-instruction",
    architecture: "snes.65816",
    addressSpace: "snes.cpu",
    address: 0x7e1000,
    bytes: [0xa9, 1],
    state: { p: 0x20, e: false, a: 1 },
    count: 2,
    evidence: ["capture:one"],
  };
  store.transaction(() => {
    store.insertRuntime(instruction);
    store.insertRuntime({
      ...instruction,
      kind: "runtime-cpu-state",
      id: `${trace}:state:${"b".repeat(64)}`,
    });
    store.insertRuntime({ ...instruction, id: "shared", count: 7 });
    store.insertRuntime({
      ...instruction,
      id: "masked",
      state: { p: 0x21, e: false, a: 2 },
      count: 3,
    });
    store.insertRuntime({ ...instruction, id: "source", evidence: ["capture:two"], count: 11 });
    store.insertRuntime({ ...instruction, id: "address", address: 0x7e1001, count: 13 });
    store.insertRuntime({ ...instruction, id: "bytes", bytes: [0xa9, 2], count: 17 });
    store.insertRuntime({ ...instruction, id: "alias", state: { P: 0x20, e: false }, count: 19 });
    store.insertRuntime({
      ...instruction,
      id: "compressed",
      state: { ...instruction.state, unused: "x".repeat(4096) },
      count: 23,
    });
    store.insertRuntime({ ...instruction, id: "number", state: { p: 0x20, e: 0 }, count: 29 });
    store.insertRuntime({ ...instruction, id: "missing", state: { p: 0x20 }, count: 31 });
    store.insertRuntime({ ...instruction, id: "other-cpu", architecture: "other", count: 37 });
    store.insertRuntime({ ...instruction, id: "other-space", addressSpace: "other", count: 41 });
  });
  // Direct SQL inserts can use TEXT; the reader also supports JSONB and packed payloads.
  db.prepare("UPDATE runtime_facts SET payload=? WHERE fid=1").run(
    JSON.stringify({ bytes: instruction.bytes, state: instruction.state }),
  );
  t.is(
    db
      .prepare("SELECT count(*) AS n FROM runtime_observations WHERE state_prefix_id IS NOT NULL")
      .get()!.n,
    1,
  );
  const fields = ["p", "P", "e"];
  const masks = { p: { max: 255, mask: 0x30 } };
  const variants = () => [
    ...store.runtimeInstructionVariants("snes.65816", "snes.cpu", fields, masks),
  ];
  const expected: RuntimeEvidenceRecord[] = [
    { ...instruction, state: { p: 0x20, e: false }, count: 35 },
    {
      ...instruction,
      id: "source",
      state: { p: 0x20, e: false },
      evidence: ["capture:two"],
      count: 11,
    },
    { ...instruction, id: "address", state: { p: 0x20, e: false }, address: 0x7e1001, count: 13 },
    { ...instruction, id: "bytes", state: { p: 0x20, e: false }, bytes: [0xa9, 2], count: 17 },
    { ...instruction, id: "alias", state: { P: 0x20, e: false }, count: 19 },
    { ...instruction, id: "number", state: { p: 0x20, e: 0 }, count: 29 },
    { ...instruction, id: "missing", state: { p: 0x20 }, count: 31 },
  ];
  const projected = variants();
  t.deepEqual(
    projected.toSorted(compareRuntimeRecordIds),
    expected.toSorted(compareRuntimeRecordIds),
  );
  t.deepEqual(variants(), projected, "cached results retain their order and contents");
  store.transaction(() => store.insertRuntime({ ...instruction, id: "later", count: 5 }));
  expected[0] = { ...expected[0], count: 40 };
  t.deepEqual(
    variants().toSorted(compareRuntimeRecordIds),
    expected.toSorted(compareRuntimeRecordIds),
    "new observations invalidate the projection",
  );
});

test("initial metadata insertion rejects duplicate IDs atomically and remains retryable", (t) => {
  const directory = temporary();
  publishAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
  const store = openAnalysisProjectStore(directory);
  t.teardown(() => {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const comment = {
    id: "first",
    addressSpace: "rom.file",
    address: 0,
    text: "Initial comment",
    evidence: ["manual-1"],
  };
  const revision = store.revision();
  t.throws(() => store.transaction(() => store.replaceTables({ comments: [comment, comment] })));
  t.deepEqual(store.loadTable("comments"), []);
  t.is(store.revision(), revision);
  store.transaction(() => store.replaceTables({ comments: [comment] }));
  t.deepEqual(store.loadTable("comments"), [comment]);
});

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
  publishAnalysisProject(directory, { ...project, shards: { ...project.shards, comments } });
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
    publishAnalysisProject(directory, project);
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
    publishAnalysisProject(directory, projectFor(rom));
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
  publishAnalysisProject(directory, { ...project, shards: { ...project.shards, runtime } });
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

test("missing, unsupported and corrupt SQLite files are rejected without silently creating a database", (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  publishAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
  const file = path.join(directory, "analysis.sqlite");
  const database = new DatabaseSync(file);
  database.exec("PRAGMA user_version=99");
  t.throws(() => new SqliteAnalysisStore(file), {
    message: /Unsupported analysis storage format 99/,
  });
  t.is(database.prepare("PRAGMA user_version").get()!.user_version, 99);
  database.close();
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
  publishAnalysisProject(directory, project);
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
  publishAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
  const database = new DatabaseSync(path.join(directory, "analysis.sqlite"));
  database.exec("PRAGMA foreign_keys=OFF; DELETE FROM runtime_evidence");
  database.close();
  t.throws(() => loadAnalysisProject(directory), { message: /dictionary entry/ });
});

test("missing identity dictionary entries fail reads instead of hiding observations", (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  publishAnalysisProject(directory, projectFor(new RomImage(new Uint8Array(0x8000))));
  const database = new DatabaseSync(path.join(directory, "analysis.sqlite"));
  database.exec("PRAGMA foreign_keys=OFF; DELETE FROM runtime_identities");
  database.close();
  t.throws(() => loadAnalysisProject(directory), { message: /runtime ID suffix/ });
});

test("runtime identity lookup probes both complete observation keys before reading payloads", (t) => {
  const directory = temporary();
  const store = new SqliteAnalysisStore(path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE));
  const db = new DatabaseSync(store.file);
  try {
    for (const suffix of ["text-identity", Buffer.alloc(32, 1)]) {
      const plan = db
        .prepare(`EXPLAIN QUERY PLAN ${RUNTIME_RECORD_LOOKUP_SQL}`)
        .all("runtime:probe:", suffix)
        .map((row) => String(row.detail));
      // A prefix-only index search is still linear in capture size. Both branches must
      // constrain identity_id too, then decode only the matched positive/negative rowids.
      const observations = plan.filter((detail) => /SEARCH runtime_observations /.test(detail));
      t.true(observations.some((detail) => /\(prefix_id=\? AND identity_id=\?\)/.test(detail)));
      t.true(
        observations.some((detail) => /\(state_prefix_id=\? AND identity_id=\?\)/.test(detail)),
      );
      t.true(observations.every((detail) => /identity_id=\?/.test(detail)));
      t.false(
        plan.some((detail) => /SCAN (o|runtime_observations|runtime_identities)\b/.test(detail)),
      );
      t.false(plan.some((detail) => /SEARCH o .*\((?:state_)?prefix_id=\?\)/.test(detail)));
      t.true(
        plan.some((detail) =>
          /SEARCH runtime_identities USING INDEX runtime_identity_key/.test(detail),
        ),
      );
      t.true(plan.some((detail) => /SEARCH o USING INTEGER PRIMARY KEY/.test(detail)));
      t.true(plan.some((detail) => /SEARCH o USING INDEX runtime_state_row/.test(detail)));
    }
  } finally {
    db.close();
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("runtime lookup distinguishes colliding hash keys, shared suffixes, and text identities", (t) => {
  const directory = temporary();
  const project = projectFor(new RomImage(new Uint8Array(0x8000)));
  publishAnalysisProject(directory, project);
  const store = openAnalysisProjectStore(directory);
  const suffix = "a".repeat(16);
  const ids = [
    `capture:one:${suffix}${"b".repeat(48)}`,
    `capture:one:${suffix}${"c".repeat(48)}`,
    `capture:two:${suffix}${"b".repeat(48)}`,
    "capture:one:text-identity",
    "capture:one:text-identity-longer",
  ];
  const records = ids.map((id, index) => ({ ...project.shards.runtime[0]!, id, count: index + 1 }));
  try {
    store.transaction(() => {
      for (const record of records) {
        t.true(store.insertRuntime(record));
      }
    });
    store.transaction(() => {
      for (const record of records) {
        t.false(store.insertRuntime(record));
      }
    });
    for (const record of records) {
      t.throws(() => store.transaction(() => store.insertRuntime({ ...record, count: 99 })), {
        message: /changed content/,
      });
      t.deepEqual(store.evidenceChoices({ runtime: [record.id] }).runtime, [record]);
    }
    t.deepEqual(
      store.evidenceChoices({ runtime: [`capture:one:${suffix}${"d".repeat(48)}`] }).runtime,
      [],
    );
  } finally {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("runtime streaming stays ordered without sorting expanded payloads during full-history reads", (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "analysis.sqlite");
  const store = new SqliteAnalysisStore(file);
  const db = new DatabaseSync(file);
  try {
    for (const sql of RUNTIME_RECORD_STREAM_SQL) {
      const plan = db
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all()
        .map((row) => String(row.detail));
      t.false(
        plan.some((detail) => /TEMP B-TREE|MATERIALIZE|AUTOMATIC.*INDEX/.test(detail)),
        plan.join("\n"),
      );
    }
  } finally {
    db.close();
    store.close();
  }
});

test("state-first pairing survives identity collection and preserves full register values", (t) => {
  const directory = temporary();
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = projectFor(new RomImage(new Uint8Array(0x8000)));
  publishAnalysisProject(directory, { ...project, shards: { ...project.shards, runtime: [] } });
  const store = openAnalysisProjectStore(directory);
  const code: Extract<RuntimeEvidenceRecord, { kind: "runtime-instruction" }> = {
    id: `runtime:instruction-trace:${"a".repeat(64)}:code:${"b".repeat(64)}`,
    kind: "runtime-instruction",
    architecture: "snes.65816",
    addressSpace: "rom.file",
    address: 0,
    bytes: [0xea],
    state: { a: 65535, x: 32768, y: 0, s: 511, p: 255, e: 1 },
    count: 7,
    evidence: ["manual-1"],
  };
  const state: RuntimeEvidenceRecord = {
    id: code.id.replace(":code:", ":state:"),
    kind: "runtime-cpu-state",
    architecture: code.architecture,
    addressSpace: code.addressSpace,
    address: code.address,
    state: code.state,
    count: code.count,
    evidence: code.evidence,
  };
  const db = new DatabaseSync(store.file);
  try {
    store.transaction(() => {
      store.insertRuntime(state);
      store.insertRuntime(code);
    });
    t.deepEqual([...store.runtimeRecords()], [state, code]);
    t.is(store.storageSnapshot().pairedStates, 1);
    t.is(db.prepare("SELECT COUNT(*) AS n FROM runtime_identities").get()!.n, 1);
    store.transaction(() => {
      t.false(store.insertRuntime(code));
      t.false(store.insertRuntime(state));
    });
    t.throws(() => store.transaction(() => store.insertRuntime({ ...state, count: 99 })), {
      message: /changed content/,
    });
    t.deepEqual(store.evidenceChoices({ runtime: [state.id, code.id] }).runtime, [state, code]);
    // Removing the instruction detaches a standalone state without losing its shared identity.
    db.exec("DELETE FROM runtime WHERE kind='runtime-instruction'");
    t.deepEqual([...store.runtimeRecords()], [state]);
    t.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
    store.close();
  }
});

test("runtime replacement rejects repeated IDs even when changed content would get a new rowid", (t) => {
  const directory = temporary();
  try {
    const project = projectFor(new RomImage(new Uint8Array(0x8000)));
    const first = project.shards.runtime[0]!;
    const second = { ...first, id: "second-runtime-id" };
    publishAnalysisProject(directory, {
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
