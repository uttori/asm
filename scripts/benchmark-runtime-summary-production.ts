/**
 * Warm the production decoder summary, evaluate VACUUM INTO, then replay one capture's observations
 * on the disposable copy. The source receives derived cache rows only. No copy replaces the source.
 * Run: node --conditions=uttori-source --import=tsx scripts/benchmark-runtime-summary-production.ts DB REPORT
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { parseSqlitePayload } from "../packages/disassembler/src/sqlite-payload.js";
import { SqliteAnalysisStore } from "../packages/disassembler/src/sqlite-store.js";

const file = path.resolve(process.argv[2] ?? "secret-of-mana/disassembly/analysis/analysis.sqlite");
const reportFile = process.argv[3];
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-summary-production-"));
const copyFile = path.join(directory, "analysis.sqlite");
const store = new SqliteAnalysisStore(file, false);
const db = new DatabaseSync(file, { readOnly: true });
const fields = ["p", "P", "e", "E", "db", "DB", "d", "D"];
const masks = { p: { max: 255, mask: 0x30 }, P: { max: 255, mask: 0x30 } };
const timings: Record<string, number> = {};
const report: Record<string, unknown> = { source: file, timingsMs: timings };

/** Persist partial measurements so an interrupted experiment does not lose completed phases. */
const save = (): void => {
  if (reportFile) {
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  }
};

/** Measure one synchronous phase, including public-record hydration when the callback consumes it.
 * @param {string} name Report key.
 * @param {Function} action Work to measure.
 * @returns {T} Callback result, after recording wall-clock milliseconds.
 */
const measure = <T>(name: string, action: () => T): T => {
  console.log(`Starting ${name}.`);
  const start = performance.now();
  const result = action();
  timings[name] = performance.now() - start;
  console.log(`${name}: ${timings[name].toFixed(1)} ms`);
  save();
  return result;
};

/** Consume API records in one snapshot without retaining the entire result in memory.
 * @param {SqliteAnalysisStore} connection Store whose cache has already been prepared.
 * @returns {object} Exact group/event counts.
 */
const scan = (connection: SqliteAnalysisStore) => {
  const cursor = connection.runtimeInstructionVariants("snes.65816", "snes.cpu", fields, masks);
  return connection.transaction(() => {
    let groups = 0;
    let events = 0;
    for (const row of cursor) {
      groups++;
      events += row.count;
    }
    return { groups, events };
  }, false);
};

/** Account for internal slack as well as wholly free pages; both can matter to repacking.
 * @param {DatabaseSync} connection Read snapshot to inspect.
 * @returns {object[]} Table/index allocation including unused bytes within allocated pages.
 */
const allocations = (connection: DatabaseSync) =>
  connection
    .prepare(
      "SELECT name,SUM(pgsize) bytes,SUM(unused) unused FROM dbstat GROUP BY name ORDER BY bytes DESC",
    )
    .all();

try {
  const initial = store.storageSnapshot();
  const revision = store.revision();
  const receipts = store.captureCatalog();
  report.before = initial;
  measure("prepareSummary", () =>
    store.runtimeInstructionVariants("snes.65816", "snes.cpu", fields, masks),
  );
  report.baseline = measure("hydrateSummary", () => scan(store));
  report.warm = measure("warmHydrateSummary", () => scan(store));
  assert.deepEqual(report.baseline, report.warm);
  report.cacheBytes = store.storageCacheBytes();
  report.maintenance = store.maintainStorage();
  report.afterSummary = store.storageSnapshot();
  report.beforeRepackAllocation = measure("allocationBeforeRepack", () => allocations(db));
  const free = fs.statfsSync(directory);
  // INTO needs one destination, not an in-place rewrite plus its rollback/WAL workspace.
  assert(
    free.bavail * free.bsize > fs.statSync(file).size + 1024 ** 3,
    "Insufficient experiment workspace",
  );
  measure("vacuumInto", () => db.prepare("VACUUM INTO ?").run(copyFile));
  const copy = new SqliteAnalysisStore(copyFile, false);
  const sql = new DatabaseSync(copyFile);
  try {
    report.repacked = copy.storageSnapshot();
    report.afterRepackAllocation = measure("allocationAfterRepack", () => allocations(sql));
    measure("integrityCheck", () => {
      assert.deepEqual(
        sql
          .prepare("PRAGMA integrity_check")
          .all()
          .map((r) => r.integrity_check),
        ["ok"],
      );
      assert.equal(sql.prepare("PRAGMA foreign_key_check").get(), undefined);
    });
    assert.equal(copy.revision(), revision);
    assert.deepEqual(copy.captureCatalog(), receipts);
    assert.deepEqual(
      measure("repackedHydrateSummary", () => scan(copy)),
      report.baseline,
    );
    assert.equal(copy.storageSnapshot().observations, initial.observations);
    assert.equal(copy.storageSnapshot().pairedStates, initial.pairedStates);
    report.repackVerified = true;
    // Copy the full baseline summary before synthetic replay; no baseline register history is removed.
    sql.exec(`CREATE TEMP TABLE expected AS SELECT * FROM query_runtime_variant_sources;
      CREATE UNIQUE INDEX temp.expected_key ON expected(variant,evidence);`);
    const selected = sql
      .prepare(`SELECT p.id,c.source_name FROM runtime_prefixes p JOIN capture_catalog c
      ON p.value='runtime:instruction-trace:'||c.sha256||':code:' ORDER BY c.imported_at DESC,p.id DESC LIMIT 1`)
      .get();
    assert(selected, "No native capture to replay");
    report.replayedCapture = selected;
    measure("appendObservationReplay", () => {
      sql.exec("BEGIN IMMEDIATE");
      try {
        const prefix = sql
          .prepare("INSERT INTO runtime_prefixes(value) VALUES(?)")
          .run("benchmark:replayed-code:").lastInsertRowid;
        sql
          .prepare(`INSERT INTO runtime_observations(fact_id,prefix_id,identity_id,evidence_id,count,query_ready)
          SELECT fact_id,?,identity_id,evidence_id,count,1 FROM runtime_observations WHERE prefix_id=?`)
          .run(prefix, selected.id);
        sql.exec("COMMIT");
      } catch (error) {
        if (sql.isTransaction) {
          sql.exec("ROLLBACK");
        }
        throw error;
      }
    });
    report.pendingObservations = sql
      .prepare("SELECT COUNT(*) n FROM query_runtime_variant_pending")
      .get()!.n;
    measure("incrementalSummary", () =>
      copy.runtimeInstructionVariants("snes.65816", "snes.cpu", fields, masks),
    );
    report.incrementalBuild = JSON.parse(
      String(
        sql.prepare("SELECT payload FROM query_cache WHERE name='instruction_variants'").get()!
          .payload,
      ),
    );
    report.afterReplay = measure("incrementalHydrateSummary", () => scan(copy));
    // Independent reference grouping of the replayed capture verifies every total and representative
    // against the saved baseline. It never reuses the production pending journal or its delta result.
    sql.function("reference_key", (value) => {
      const payload = parseSqlitePayload<{ bytes: number[]; state: Record<string, unknown> }>(
        value,
      );
      const state: Record<string, unknown> = {};
      for (const key of fields) {
        const value = payload.state[key];
        if (
          (key === "p" || key === "P") &&
          typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 255
        ) {
          state[key] = value & 0x30;
        } else if (value !== undefined) {
          state[key] = value;
        }
      }
      return JSON.stringify([payload.bytes, state]);
    });
    measure("verifyIncrementalGroups", () => {
      const update = sql.prepare(
        "UPDATE temp.expected SET total=total+?,observations=observations+? WHERE variant=(SELECT id FROM query_runtime_variant_keys WHERE address=? AND key=?) AND evidence=?",
      );
      for (const row of sql
        .prepare(`SELECT f.address,reference_key(CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END) key,
          o.evidence_id evidence,SUM(o.count) total,COUNT(*) observations
        FROM runtime_observations o CROSS JOIN runtime_facts f ON f.fid=o.fact_id
        WHERE o.prefix_id=? AND f.kind='runtime-instruction' GROUP BY f.address,key,o.evidence_id`)
        .iterate(selected.id)) {
        assert.equal(
          update.run(row.total, row.observations, row.address, row.key, row.evidence).changes,
          1,
        );
      }
      assert.equal(
        sql
          .prepare(`SELECT COUNT(*) n FROM temp.expected e LEFT JOIN query_runtime_variant_sources s
        ON s.variant=e.variant AND s.evidence=e.evidence WHERE s.variant IS NULL
          OR e.total<>s.total OR e.observations<>s.observations OR e.sample<>s.sample`)
          .get()!.n,
        0,
      );
      assert.equal(
        sql.prepare("SELECT COUNT(*) n FROM temp.expected").get()!.n,
        sql.prepare("SELECT COUNT(*) n FROM query_runtime_variant_sources").get()!.n,
      );
      assert.equal(sql.prepare("SELECT COUNT(*) n FROM query_runtime_variant_pending").get()!.n, 0);
    });
    report.incrementalVerified = true;
    assert.deepEqual(store.captureCatalog(), receipts);
    assert.equal(store.revision(), revision);
    const final = store.storageSnapshot();
    assert.equal(final.observations, initial.observations);
    assert.equal(final.facts, initial.facts);
    assert.equal(final.pairedStates, initial.pairedStates);
    report.sourceRevision = revision;
    report.sourceAfter = final;
    report.status = "complete";
    save();
  } finally {
    sql.close();
    copy.close();
  }
} finally {
  db.close();
  store.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
