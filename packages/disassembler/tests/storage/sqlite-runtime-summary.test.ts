import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ExecutionContext } from "ava";

import { test } from "../../../../tests/ava-helper.js";
import { SqliteAnalysisStore, type RuntimeInstructionRecord } from "../../src/index.js";
import {
  RUNTIME_SUMMARY_ROWS_SQL,
  runtimeInstructionSummary,
  runtimeSummaryInputSql,
} from "../../src/storage/sqlite-runtime-summary.js";
import { DatabaseSync } from "../helpers/sqlite-connection.js";

const fields = ["p", "P", "e", "E", "db", "DB", "d", "D"];
const masks = { p: { max: 255, mask: 0x30 }, P: { max: 255, mask: 0x30 } };
const instruction = (id: string, count = 3): RuntimeInstructionRecord => ({
  id,
  count,
  kind: "runtime-instruction",
  architecture: "snes.65816",
  addressSpace: "snes.cpu",
  address: 0x8000,
  bytes: [0xea],
  state: { p: 0x31, e: 0, a: 123, x: 456 },
  evidence: ["capture:first"],
});

/** Separate connections exercise persisted triggers, not connection-local import bookkeeping. */
const fixture = (t: ExecutionContext) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-runtime-summary-"));
  const file = path.join(directory, "analysis.sqlite");
  const store = new SqliteAnalysisStore(file);
  const db = new DatabaseSync(file);
  t.teardown(() => {
    db.close();
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const read = () => [...store.runtimeInstructionVariants("snes.65816", "snes.cpu", fields, masks)];
  const stats = () =>
    JSON.parse(
      String(
        db.prepare("SELECT payload FROM query_cache WHERE name='instruction_variants'").get()!
          .payload,
      ),
    );
  const pending = () =>
    Number(db.prepare("SELECT COUNT(*) n FROM query_runtime_variant_pending").get()!.n);
  return { store, db, file, read, stats, pending };
};

test("summary appends only new observations, preserves provenance and full evidence, and survives reopen", (t) => {
  const { store, db, file, read, stats, pending } = fixture(t);
  const first = instruction("first");
  store.transaction(() => store.insertRuntime(first));
  t.is(read()[0].count, 3);
  t.deepEqual(stats(), { incremental: false, observations: 1 });
  store.transaction(() => {
    t.false(store.insertRuntime(first));
    store.insertRuntime({ ...instruction("second", 7), state: { p: 0x30, e: 0, a: 99 } });
    store.insertRuntime({ ...instruction("third", 11), evidence: ["capture:second"] });
  });
  t.is(pending(), 2);
  const reopened = new SqliteAnalysisStore(file, false);
  try {
    const rows = [...reopened.runtimeInstructionVariants("snes.65816", "snes.cpu", fields, masks)];
    t.deepEqual(
      rows.map((r) => [r.id, r.count, r.evidence]),
      [
        ["first", 10, ["capture:first"]],
        ["third", 11, ["capture:second"]],
      ],
    );
    t.deepEqual(stats(), { incremental: true, observations: 2 });
    t.is(pending(), 0);
    t.deepEqual(
      [...store.runtimeRecords()].find((r) => r.id === "first"),
      first,
    );
    t.deepEqual(read(), rows);
    t.deepEqual(stats(), { incremental: true, observations: 2 }, "a warm read performs no regroup");
  } finally {
    reopened.close();
  }
  db.function("analysis_instruction_variant", (payload) => String(payload));
  const plan = db
    .prepare(`EXPLAIN QUERY PLAN ${runtimeSummaryInputSql(true)}`)
    .all("snes.65816", "snes.cpu");
  t.regex(String(plan[0].detail), /SCAN pending/);
  t.true(plan.some((r) => /SEARCH o USING INTEGER PRIMARY KEY/.test(String(r.detail))));
  t.false(plan.some((r) => /MATERIALIZE|AUTOMATIC/.test(String(r.detail))));
});

test("pairing and query metadata do not recount instructions; failed appends roll back their journal", (t) => {
  const { store, db, read, stats, pending } = fixture(t);
  const prefix = `runtime:instruction-trace:${"a".repeat(64)}`;
  const first = instruction(`${prefix}:code:${"b".repeat(64)}`);
  store.transaction(() => store.insertRuntime(first));
  const before = read();
  store.transaction(() =>
    store.insertRuntime({
      ...first,
      id: `${prefix}:state:${"b".repeat(64)}`,
      kind: "runtime-cpu-state",
    }),
  );
  db.exec("UPDATE runtime_observations SET query_ready=1,query_file_offset=0");
  t.deepEqual(read(), before);
  t.is(pending(), 0);
  t.deepEqual(stats(), { incremental: false, observations: 1 });
  t.throws(
    () =>
      store.transaction(() => {
        store.insertRuntime(instruction("rolled-back", 19));
        throw new Error("abort import");
      }),
    { message: "abort import" },
  );
  t.is(pending(), 0);
  t.deepEqual(read(), before);
  // A state-first pair can collect and reuse a suffix row; rebuilding must still count it once.
  const next = instruction(`${prefix}:code:${"c".repeat(64)}`, 5);
  store.transaction(() =>
    store.insertRuntime({
      ...next,
      id: `${prefix}:state:${"c".repeat(64)}`,
      kind: "runtime-cpu-state",
    }),
  );
  store.transaction(() => store.insertRuntime(next));
  t.is(read()[0].count, 8);
  t.is(store.storageSnapshot().pairedStates, 2);
});

test("summary input yields after each decode instead of retaining a capture inside one SQLite step", (t) => {
  const { store, db, read } = fixture(t);
  store.transaction(() => store.insertRuntime(instruction("base")));
  read();
  store.transaction(() => {
    for (let index = 0; index < 3; index++) {
      store.insertRuntime({ ...instruction(`next-${index}`), state: { p: index } });
    }
  });
  let decoded = 0;
  db.function("analysis_instruction_variant", (payload) => {
    decoded++;
    return String(payload);
  });
  for (const incremental of [false, true]) {
    const statement = db.prepare(runtimeSummaryInputSql(incremental));
    const cursor = statement.iterate("snes.65816", "snes.cpu");
    let rows = 0;
    for (;;) {
      const before = decoded;
      const next = cursor.next();
      if (next.done) {
        break;
      }
      t.is(decoded - before, 1, "each native step must release its decoded input before advancing");
      rows++;
    }
    t.is(rows, incremental ? 3 : 4);
    const plan = db
      .prepare(`EXPLAIN QUERY PLAN ${runtimeSummaryInputSql(incremental)}`)
      .all("snes.65816", "snes.cpu");
    t.false(plan.some((row) => /TEMP B-TREE|MATERIALIZE/.test(String(row.detail))));
    if (!incremental) {
      t.is(plan[0].detail, "SCAN o", "full rebuild preserves compressed-history locality");
    }
  }
});

test("grouping progress can interrupt staging without publishing partial counts; retries stay exact", (t) => {
  const { store, db, read, stats } = fixture(t);
  store.transaction(() => {
    for (let index = 0; index < 4100; index++) {
      store.insertRuntime({ ...instruction(`row-${index}`), state: { p: 0x30, a: index } });
    }
  });
  const progress: number[] = [];
  t.throws(
    () =>
      store.runtimeInstructionVariants("snes.65816", "snes.cpu", fields, masks, (count) => {
        progress.push(count);
        throw new Error("cancel grouping");
      }),
    { message: "cancel grouping" },
  );
  t.deepEqual(progress, [4096]);
  t.is(db.prepare("SELECT COUNT(*) n FROM query_runtime_variant_sources").get()!.n, 0);
  t.is(
    db.prepare("SELECT COUNT(*) n FROM query_cache WHERE name LIKE 'instruction_variants%'").get()!
      .n,
    0,
  );
  progress.length = 0;
  const rows = [
    ...store.runtimeInstructionVariants("snes.65816", "snes.cpu", fields, masks, (count) =>
      progress.push(count),
    ),
  ];
  t.deepEqual(progress, [4096, 4100]);
  t.is(rows.length, 1);
  t.is(rows[0].count, 12300);
  t.is(rows[0].id, "row-0");
  t.deepEqual(stats(), { incremental: false, observations: 4100 });
  t.deepEqual(read(), rows);
});

test("deletion, rowid reuse, and edits rebuild instead of applying an ambiguous delta", (t) => {
  const { store, db, read, stats } = fixture(t);
  store.transaction(() => {
    store.insertRuntime(instruction("first"));
    store.insertRuntime(instruction("second", 7));
  });
  t.is(read()[0].count, 10);
  db.exec("DELETE FROM runtime_observations WHERE oid=1");
  t.is(read()[0].id, "second");
  t.is(read()[0].count, 7);
  t.deepEqual(stats(), { incremental: false, observations: 1 });
  store.transaction(() => store.insertRuntime(instruction("third", 13)));
  db.exec("UPDATE runtime_observations SET oid=1 WHERE oid=3");
  t.is(read()[0].id, "third", "the minimum representative may change after an explicit rowid edit");
  t.is(read()[0].count, 20);
  db.exec("UPDATE runtime_observations SET count=17 WHERE oid=1");
  t.is(read()[0].count, 24);
  db.exec('UPDATE runtime_facts SET payload=jsonb(\'{"bytes":[234],"state":{"p":0,"e":0}}\')');
  const edited = read()[0];
  if (edited.kind !== "runtime-instruction") {
    throw new Error("Expected an instruction observation.");
  }
  t.deepEqual(edited.state, { p: 0, e: 0 });
  t.is(stats().incremental, false);
});

for (const recursive of ["OFF", "ON"]) {
  test(`SQL REPLACE invalidates shared facts and observation identities with recursive triggers ${recursive}`, (t) => {
    const { store, db, read, stats } = fixture(t);
    db.exec(`PRAGMA recursive_triggers=${recursive}`);
    store.transaction(() => {
      store.insertRuntime(instruction("one:shared"));
      store.insertRuntime(instruction("two:shared"));
    });
    t.is(read()[0].count, 6);
    db.exec(`INSERT OR REPLACE INTO runtime_observations(oid,fact_id,prefix_id,identity_id,evidence_id,count)
      SELECT 99,fact_id,prefix_id,identity_id,evidence_id,9 FROM runtime_observations WHERE oid=1`);
    t.is(read()[0].count, 12);
    t.is(stats().incremental, false);
    db.exec(`INSERT OR REPLACE INTO runtime_facts(fid,fingerprint,kind,architecture,address_space,address,payload)
      SELECT fid,fingerprint,kind,architecture,address_space,address,jsonb('{"bytes":[234],"state":{"p":0}}') FROM runtime_facts`);
    const replaced = read()[0];
    if (replaced.kind !== "runtime-instruction") {
      throw new Error("Expected an instruction observation.");
    }
    t.deepEqual(replaced.state, { p: 0 });
    t.is(stats().incremental, false);
  });
}

test("decoder changes, dictionary edits, and eviction invalidate the summary without changing evidence", (t) => {
  const { store, db, read, stats } = fixture(t);
  store.transaction(() => {
    store.insertRuntime(instruction("first"));
    store.insertRuntime({ ...instruction("second", 7), state: { p: 0x30, e: 0 } });
  });
  t.is(read().length, 1);
  t.is([...store.runtimeInstructionVariants("snes.65816", "snes.cpu", fields)].length, 2);
  t.is(stats().incremental, false);
  t.is(read().length, 1);
  db.exec("UPDATE runtime_evidence SET value='[\"renamed\"]'");
  t.deepEqual(read()[0].evidence, ["renamed"]);
  db.exec("UPDATE runtime_identities SET value='earliest' WHERE iid=1");
  t.is(read()[0].id, "earliest");
  store.transaction(() => store.insertRuntime(instruction("pending-at-eviction", 5)));
  const before = [...store.runtimeRecords()];
  store.transaction(() => store.setStoragePolicy({ cacheMaxBytes: 0 }));
  t.true(store.maintainStorage().evicted.includes("instruction_variants"));
  t.is(
    read().reduce((total, row) => total + row.count, 0),
    15,
  );
  t.deepEqual([...store.runtimeRecords()], before);
  t.is(stats().incremental, false);
});

test("concurrent writes discard staged results; interrupted publication leaves a retryable pending set", (t) => {
  const { store, db, read, stats, pending } = fixture(t);
  store.transaction(() => store.insertRuntime(instruction("first")));
  read();
  store.transaction(() => store.insertRuntime(instruction("second", 7)));
  let changed = false;
  const transaction = (action: () => void, write = true) => {
    db.exec(write ? "BEGIN IMMEDIATE" : "BEGIN");
    try {
      action();
      if (!write && !changed) {
        changed = true;
        store.transaction(() => store.setStoragePolicy({ cacheMaxBytes: 0 }));
        t.false(
          store.maintainStorage().evicted.includes("instruction_variants"),
          "an in-flight build owns its base and journal",
        );
        store.transaction(() => store.insertRuntime(instruction("concurrent", 11)));
      }
      db.exec("COMMIT");
    } catch (error) {
      if (db.isTransaction) {
        db.exec("ROLLBACK");
      }
      throw error;
    }
  };
  t.throws(
    () => runtimeInstructionSummary(db, transaction, "snes.65816", "snes.cpu", fields, masks),
    { message: /Runtime changed/ },
  );
  t.is(pending(), 2);
  t.is(read()[0].count, 21);
  t.deepEqual(stats(), { incremental: true, observations: 2 });
  store.transaction(() => store.insertRuntime(instruction("retry", 13)));
  for (const action of ["ABORT", "ROLLBACK"]) {
    db.exec(
      `CREATE TRIGGER fail_summary BEFORE UPDATE ON query_runtime_variant_sources BEGIN SELECT RAISE(${action},'interrupted'); END`,
    );
    t.throws(read, { message: "interrupted" });
    t.is(pending(), 1);
    db.exec("DROP TRIGGER fail_summary");
  }
  // A persisted token from a killed process is superseded; it cannot discard pending observations.
  db.exec("INSERT INTO query_cache VALUES('instruction_variants_build','pending:crashed','null')");
  t.is(read()[0].count, 34);
  t.is(pending(), 0);
  t.deepEqual(stats(), { incremental: true, observations: 1 });
});

test("an iterator prepared before a mutation refuses to mix old totals with new representatives", (t) => {
  const { store } = fixture(t);
  store.transaction(() => store.insertRuntime(instruction("first")));
  const rows = store.runtimeInstructionVariants("snes.65816", "snes.cpu", fields, masks);
  store.transaction(() => store.insertRuntime(instruction("second")));
  t.throws(() => [...rows], { message: /Runtime changed before reading/ });
});

test("incremental keys retain address/evidence/key iteration order without sorting hydrated payloads", (t) => {
  const { store, db, read, stats } = fixture(t);
  store.transaction(() => {
    store.insertRuntime({ ...instruction("later-address"), address: 0x9000 });
    store.insertRuntime({
      ...instruction("later-key"),
      bytes: [0xeb],
      evidence: ["capture:second"],
    });
  });
  read();
  store.transaction(() => {
    store.insertRuntime({ ...instruction("earlier-address"), address: 0x7000 });
    store.insertRuntime(instruction("earlier-evidence"));
    store.insertRuntime({ ...instruction("earlier-key"), evidence: ["capture:second"] });
  });
  const incremental = read();
  t.is(stats().incremental, true);
  t.deepEqual(
    incremental.map((row) => row.id),
    ["earlier-address", "earlier-evidence", "earlier-key", "later-key", "later-address"],
  );
  db.exec("DELETE FROM query_cache WHERE name='instruction_variants'");
  t.deepEqual(
    read(),
    incremental,
    "full regroup and incremental publication must agree in order too",
  );
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${RUNTIME_SUMMARY_ROWS_SQL}`).all();
  t.true(plan.some((row) => /CO-ROUTINE grouped/.test(String(row.detail))));
  const sort = plan.find((row) => /TEMP B-TREE/.test(String(row.detail)))!;
  const source = plan.find((row) => /SEARCH o USING INTEGER PRIMARY KEY/.test(String(row.detail)))!;
  t.truthy(sort);
  t.truthy(source);
  t.not(
    sort.parent,
    source.parent,
    "sorting happens inside the compact subquery before payload lookup",
  );
});
