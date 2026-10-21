import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

import type { RuntimeEvidenceRecord } from "../model/project-types.js";
import { isFiniteNumber, isRecord } from "../model/record-shape.js";
import { parseSqlitePayload } from "./sqlite-payload.js";
import { installQueryCache, readQueryCache, writeQueryCache } from "./sqlite-query-cache.js";
import { runtimeInstructionFields, runtimeFromRow } from "./sqlite-records.js";
import { runtimeIdentityKey } from "./sqlite-runtime-facts.js";

/** Masks affect grouping only. The representative keeps its original, unmasked register values. */
type StateMasks = Readonly<
  Partial<Record<string, { readonly max: number; readonly mask: number }>>
>;
/** The store owns file-identity checks, rollback and connection-local transaction state. */
type Transaction = (action: () => void, write?: boolean) => void;

const KEY = "instruction_variants";
const BUILD = "instruction_variants_build";
const INVALIDATE = `DELETE FROM query_cache WHERE name IN ('${KEY}','${BUILD}');`;

/**
 * Decode each shared representative fact once in storage order. GROUP BY receives only integer
 * references; LIMIT and CROSS JOIN keep history payloads outside the compact sort. The TEMP table
 * is keyed by ascending fact ID, avoiding random writes of large, provenance-expanded records.
 */
export const RUNTIME_SUMMARY_ROWS_SQL = `SELECT f.fid,
    CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END AS payload
  FROM (SELECT o.fact_id
    FROM query_runtime_variant_sources s
    CROSS JOIN runtime_observations o ON o.oid=s.sample
    GROUP BY o.fact_id ORDER BY o.fact_id LIMIT -1) grouped
  CROSS JOIN runtime_facts f ON f.fid=grouped.fact_id`;

/** Restore the historical address/evidence/key tie-breaking while sorting only sample references. */
const ORDERED_STAGED_ROWS_SQL = `SELECT i.value AS id,f.kind,f.architecture,f.address_space,f.address,
    ordered.total AS count,rows.payload,p.value AS id_prefix,e.value AS evidence
  FROM (SELECT s.sample,s.total FROM query_runtime_variant_keys k
    CROSS JOIN query_runtime_variant_sources s ON s.variant=k.id
    ORDER BY k.address,s.evidence,k.key LIMIT -1) ordered
  CROSS JOIN runtime_observations o ON o.oid=ordered.sample
  CROSS JOIN runtime_fact_locations f ON f.fid=o.fact_id
  CROSS JOIN temp.runtime_summary_rows rows ON rows.fact=o.fact_id
  LEFT JOIN runtime_identities i ON i.iid=o.identity_id
  LEFT JOIN runtime_prefixes p ON p.id=o.prefix_id
  LEFT JOIN runtime_evidence e ON e.id=o.evidence_id`;

/**
 * Install a disposable projection and SQL-only change tracking under the caller's writer lock.
 * Every connection with the runtime-history codec participates; change tracking itself is SQL-only.
 * The pending set contains observation IDs, never another copy of register snapshots.
 * @param {DatabaseSync} db Current-format project connection in a write transaction.
 */
const installSummary = (db: DatabaseSync): void => {
  installQueryCache(db, KEY, []);
  db.exec(`${INVALIDATE}
    CREATE TABLE query_runtime_variant_keys(
      id INTEGER PRIMARY KEY,address INTEGER NOT NULL,key TEXT NOT NULL,UNIQUE(address,key));
    CREATE TABLE query_runtime_variant_sources(
      variant INTEGER NOT NULL,evidence INTEGER NOT NULL,total INTEGER NOT NULL,
      observations INTEGER NOT NULL,sample INTEGER NOT NULL,
      PRIMARY KEY(variant,evidence)) WITHOUT ROWID;
    CREATE TABLE query_runtime_variant_pending(oid INTEGER PRIMARY KEY);
    CREATE TRIGGER summary_observation_insert AFTER INSERT ON runtime_observations BEGIN
      DELETE FROM query_cache WHERE name='${BUILD}';
      INSERT OR IGNORE INTO query_runtime_variant_pending
        SELECT NEW.oid WHERE EXISTS(SELECT 1 FROM query_cache WHERE name='${KEY}')
        AND EXISTS(SELECT 1 FROM runtime_fact_locations WHERE fid=NEW.fact_id AND kind='runtime-instruction');
    END;
    CREATE TRIGGER summary_observation_update AFTER UPDATE OF
      oid,fact_id,prefix_id,identity_id,evidence_id,count ON runtime_observations
      WHEN OLD.oid IS NOT NEW.oid OR OLD.fact_id IS NOT NEW.fact_id
        OR OLD.prefix_id IS NOT NEW.prefix_id OR OLD.identity_id IS NOT NEW.identity_id
        OR OLD.evidence_id IS NOT NEW.evidence_id OR OLD.count IS NOT NEW.count
      BEGIN ${INVALIDATE} END;
    CREATE TRIGGER summary_observation_delete AFTER DELETE ON runtime_observations
      BEGIN ${INVALIDATE} END;
    CREATE TRIGGER summary_observation_replace BEFORE INSERT ON runtime_observations
      WHEN EXISTS(SELECT 1 FROM query_cache WHERE name IN ('${KEY}','${BUILD}')) AND (
        EXISTS(SELECT 1 FROM runtime_observations WHERE oid=NEW.oid) OR
        EXISTS(SELECT 1 FROM runtime_observations WHERE prefix_id=NEW.prefix_id AND identity_id=NEW.identity_id) OR
        EXISTS(SELECT 1 FROM runtime_observations WHERE state_prefix_id=NEW.state_prefix_id AND identity_id=NEW.identity_id))
      BEGIN ${INVALIDATE} END;`);
  // REPLACE does not reliably fire DELETE triggers when recursive_triggers is off. Check conflicts
  // before insertion so rowid reuse and replacement of shared facts cannot masquerade as appends.
  for (const [table, primary, unique] of [
    ["runtime_fact_rows", "fid", "fingerprint"],
    ["runtime_identities", "iid", "value"],
    ["runtime_prefixes", "id", "value"],
    ["runtime_evidence", "id", "value"],
  ]) {
    // Sealing immutable blocks does not change the logical fact represented by this row.
    const condition =
      table === "runtime_fact_rows"
        ? "WHEN OLD.fid IS NOT NEW.fid OR OLD.fingerprint IS NOT NEW.fingerprint OR OLD.descriptor_id IS NOT NEW.descriptor_id OR NEW.history_id IS NULL"
        : "";
    let uniqueMatch = `${unique}=NEW.${unique}`;
    if (table === "runtime_fact_rows") {
      uniqueMatch = `substr(fingerprint,1,8)=substr(NEW.fingerprint,1,8) AND ${uniqueMatch}`;
    } else if (table === "runtime_identities") {
      uniqueMatch = `(${runtimeIdentityKey("value")})=(${runtimeIdentityKey("NEW.value")}) AND ${uniqueMatch}`;
    }
    db.exec(`CREATE TRIGGER summary_${table}_replace BEFORE INSERT ON ${table}
      WHEN EXISTS(SELECT 1 FROM query_cache WHERE name IN ('${KEY}','${BUILD}')) AND (
        EXISTS(SELECT 1 FROM ${table} WHERE ${primary}=NEW.${primary}) OR
        EXISTS(SELECT 1 FROM ${table} WHERE ${uniqueMatch}))
      BEGIN ${INVALIDATE} END;
      CREATE TRIGGER summary_${table}_update AFTER UPDATE ON ${table} ${condition} BEGIN ${INVALIDATE} END;
      CREATE TRIGGER summary_${table}_delete AFTER DELETE ON ${table} BEGIN ${INVALIDATE} END;`);
  }
};

/** Stream compact keys, counts and representatives without a blocking sort or aggregate.
 * Pending IDs drive incremental joins so an append does not scan unrelated observations. Sort only
 * their compact coordinates by fact ID before decoding, reusing shared compressed history blocks.
 * A full rebuild walks observation storage order to retain locality in compressed history blocks.
 * @param {boolean} incremental Whether to select pending observations instead of all history.
 * @returns {string} Input cursor SQL binding architecture and address space, in that order.
 */
export const runtimeSummaryInputSql = (incremental: boolean): string => {
  const from = incremental
    ? `(SELECT o.fact_id,o.evidence_id,o.count,o.oid FROM query_runtime_variant_pending pending
      CROSS JOIN runtime_observations o ON o.oid=pending.oid
      CROSS JOIN runtime_fact_locations f ON f.fid=o.fact_id
      WHERE f.kind='runtime-instruction' AND f.architecture=? AND f.address_space=?
      ORDER BY o.fact_id LIMIT -1) o CROSS JOIN runtime_facts f ON f.fid=o.fact_id`
    : // The address index visits the same compressed history blocks repeatedly, once per observed PC.
      // A sequential physical scan trades coordinate filtering for bounded, reusable decoder buffers;
      // payload decoding still happens only after the architecture/kind predicate. Appends stay indexed.
      "runtime_observations o NOT INDEXED CROSS JOIN runtime_facts f ON f.fid=o.fact_id";
  return `SELECT f.address,analysis_instruction_variant(
      CASE WHEN json_valid(f.payload,8) THEN json(f.payload) ELSE f.payload END) AS key,
      o.evidence_id AS evidence,o.count AS total,o.oid AS sample
    FROM ${from}
    ${incremental ? "" : "WHERE f.kind='runtime-instruction' AND f.architecture=? AND f.address_space=?"}`;
};

/** Normalize only decoder inputs, preserving aliases, invalid values, null and missing fields.
 * @param {DatabaseSync} db Connection that will evaluate the grouping query.
 * @param {readonly string[]} fields Ordered decoder fields, including supported aliases.
 * @param {StateMasks} masks Bit masks applied only to valid numeric values.
 */
const registerVariantKey = (
  db: DatabaseSync,
  fields: readonly string[],
  masks: StateMasks,
): void => {
  db.function("analysis_instruction_variant", { deterministic: true }, (payload) => {
    const record = parseSqlitePayload(payload);
    if (!isRecord(record) || !isByteList(record.bytes) || !isRecord(record.state)) {
      throw new Error("Invalid instruction variant payload.");
    }
    const state: Record<string, unknown> = {};
    for (const key of fields) {
      const value = record.state[key];
      const mask = masks[key];
      // Unknown and invalid values must remain distinct for the decoder's own fallback rules.
      if (
        mask &&
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= mask.max
      ) {
        state[key] = value & mask.mask;
      } else if (value !== undefined) {
        state[key] = value;
      }
    }
    return JSON.stringify([record.bytes, state]);
  });
};

function isByteList(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}

/** A base token survives append-only changes; the pending set distinguishes it from a current result.
 * @param {DatabaseSync} db Connection holding the consuming snapshot.
 * @param {string} signature Exact decoder configuration and summary layout.
 * @returns {boolean} Whether every retained instruction is reflected in this configuration.
 */
const isCurrent = (db: DatabaseSync, signature: string): boolean =>
  readQueryCache(db, KEY, signature) !== undefined &&
  !db.prepare("SELECT 1 FROM query_runtime_variant_pending LIMIT 1").get();

/**
 * Prepare a single decoder configuration. A new configuration or mutation rebuilds from evidence;
 * ordinary appends aggregate only pending observations. Temporary grouping holds a read snapshot,
 * then a short write publishes only if no input or competing builder changed its ownership token.
 * Failure, cancellation by connection close, or process death leaves the base/pending work retryable.
 * The cursor reuses an existing read transaction or owns one until it closes.
 * @param {DatabaseSync} db Owned current-format project connection.
 * @param {Transaction} transaction Store transaction wrapper; write defaults to true.
 * @param {string} architecture Exact target processor ID.
 * @param {string} space Exact instruction address space.
 * @param {readonly string[]} fields Ordered decoder fields; other registers remain in full evidence.
 * @param {StateMasks} masks Grouping-only masks for valid numeric fields.
 * @param {Function} [onProgress] Cumulative and total observations in this build snapshot; throwing aborts it.
 * @param {Function} [onReadProgress] Representatives staged so far; throwing releases TEMP rows and aborts reading.
 * @param {Function} [resetSnapshot] Clear connection-owned codec/dictionary caches at owned snapshot boundaries.
 * @returns {IterableIterator<RuntimeEvidenceRecord>} One representative per decoder key and evidence list.
 */
export const runtimeInstructionSummary = (
  db: DatabaseSync,
  transaction: Transaction,
  architecture: string,
  space: string,
  fields: readonly string[],
  masks: StateMasks,
  onProgress?: (observations: number, totalObservations: number) => void,
  onReadProgress?: (representatives: number) => void,
  resetSnapshot?: () => void,
): IterableIterator<RuntimeEvidenceRecord> => {
  if (fields.some((field) => !/^\w+$/.test(field))) {
    throw new Error("Invalid instruction state field.");
  }
  const signature = JSON.stringify([4, architecture, space, fields, masks]);
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_runtime_variant_keys'").get()) {
    transaction(() => {
      // A second connection may have installed it while this connection waited for the writer lock.
      if (
        !db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_runtime_variant_keys'").get()
      ) {
        installSummary(db);
      }
    });
  }
  if (!isCurrent(db, signature)) {
    const pending = `pending:${randomUUID()}`;
    let incremental = false;
    transaction(() => {
      incremental = readQueryCache(db, KEY, signature) !== undefined;
      writeQueryCache(db, BUILD, pending, null);
    });
    let completed = false;
    let cleanupError: Error | undefined;
    try {
      registerVariantKey(db, fields, masks);
      transaction(() => {
        db.exec(`CREATE TEMP TABLE runtime_summary_groups(
          address INTEGER NOT NULL,key TEXT NOT NULL,evidence INTEGER NOT NULL,
          total INTEGER NOT NULL,observations INTEGER NOT NULL,sample INTEGER NOT NULL,
          PRIMARY KEY(address,key,evidence)) WITHOUT ROWID`);
        const accumulate = db.prepare(`INSERT INTO temp.runtime_summary_groups
          VALUES(?,?,?,?,1,?) ON CONFLICT(address,key,evidence) DO UPDATE SET
          total=total+excluded.total,observations=observations+1,sample=MIN(sample,excluded.sample)`);
        // Count compact location rows in the same snapshot, without invoking the payload decoder.
        const source = incremental
          ? "query_runtime_variant_pending p CROSS JOIN runtime_observations o ON o.oid=p.oid"
          : "runtime_observations o NOT INDEXED";
        const totalObservations = Number(
          db
            .prepare(`SELECT count(*) AS n FROM ${source}
          CROSS JOIN runtime_fact_locations f ON f.fid=o.fact_id
          WHERE f.kind='runtime-instruction' AND f.architecture=? AND f.address_space=?`)
            .get(architecture, space)!.n,
        );
        let observations = 0;
        // SQLite callbacks can retain native buffer handles until the outer statement returns.
        // GROUP BY/INSERT SELECT would inflate the whole capture in one step, defeating the bounded
        // history cache. Each next() below returns after one input, releasing those temporary handles;
        // only decoder keys and counters cross into JS, and SQLite owns the accumulated groups.
        for (const row of db
          .prepare(runtimeSummaryInputSql(incremental))
          .iterate(architecture, space)) {
          accumulate.run(row.address, row.key, row.evidence, row.total, row.sample);
          observations++;
          if (observations % 4096 === 0) {
            onProgress?.(observations, totalObservations);
          }
        }
        onProgress?.(observations, totalObservations);
      }, false);
      transaction(() => {
        if (
          db.prepare("SELECT signature FROM query_cache WHERE name=?").get(BUILD)?.signature !==
          pending
        ) {
          throw new Error("Runtime changed while building instruction variants. Retry reanalysis.");
        }
        // A stale base cannot accept deltas. Replace only its derived rows, retaining full evidence.
        if (!incremental) {
          db.exec(
            "DELETE FROM query_runtime_variant_sources; DELETE FROM query_runtime_variant_keys;",
          );
        }
        // Totals and journal consumption commit together; retrying cannot apply an append twice.
        db.exec(`INSERT OR IGNORE INTO query_runtime_variant_keys(address,key)
          SELECT address,key FROM temp.runtime_summary_groups;
          INSERT INTO query_runtime_variant_sources
            SELECT k.id,g.evidence,g.total,g.observations,g.sample FROM temp.runtime_summary_groups g
            JOIN query_runtime_variant_keys k ON k.address=g.address AND k.key=g.key WHERE true
          ON CONFLICT(variant,evidence) DO UPDATE SET
            total=total+excluded.total,observations=observations+excluded.observations,
            sample=MIN(sample,excluded.sample);
          DELETE FROM query_runtime_variant_pending;`);
        const observations = Number(
          db
            .prepare("SELECT COALESCE(SUM(observations),0) AS n FROM temp.runtime_summary_groups")
            .get()!.n,
        );
        writeQueryCache(db, KEY, signature, { incremental, observations });
        db.prepare("DELETE FROM query_cache WHERE name=?").run(BUILD);
      });
      completed = true;
    } finally {
      try {
        db.exec("DROP TABLE IF EXISTS temp.runtime_summary_groups");
        // Clear only our token. A competing builder's ownership must survive this cleanup.
        transaction(() => {
          db.prepare("DELETE FROM query_cache WHERE name=? AND signature=?").run(BUILD, pending);
        });
      } catch (error) {
        // SQLITE_FULL or connection loss can also break cleanup. Preserve the original failure;
        // reopening discards TEMP rows and a later build supersedes an abandoned ownership token.
        if (completed) {
          cleanupError =
            error instanceof Error
              ? error
              : new Error("Instruction summary cleanup failed.", { cause: error });
        }
      }
    }
    if (cleanupError !== undefined) {
      throw cleanupError;
    }
  }
  const transactionActive = (): boolean => db.isTransaction;
  return (function* () {
    // A standalone cursor needs the same snapshot across staging and ordered hydration. Joining
    // fresh main rows after the staging SELECT ends could otherwise mix counts or drop new facts.
    const ownsSnapshot = !transactionActive();
    if (ownsSnapshot) {
      resetSnapshot?.();
      db.exec("BEGIN");
    }
    try {
      if (!isCurrent(db, signature)) {
        throw new Error("Runtime changed before reading instruction variants. Retry reanalysis.");
      }
      // Decoder order is deliberately unrelated to history storage order. Stage only the selected,
      // unmasked fields on disk; sorting hydrated histories would retain native buffers and thrash
      // the bounded history cache. Each next() releases SQLite's temporary buffer handles.
      db.exec(
        "CREATE TEMP TABLE runtime_summary_rows(fact INTEGER PRIMARY KEY,payload TEXT NOT NULL)",
      );
      try {
        let staged = 0;
        const insert = db.prepare("INSERT INTO temp.runtime_summary_rows VALUES(?,?)");
        for (const row of db.prepare(RUNTIME_SUMMARY_ROWS_SQL).iterate()) {
          const parsed = parseSqlitePayload(row.payload);
          const record = runtimeInstructionFields(isRecord(parsed) ? parsed : undefined);
          insert.run(
            row.fid,
            JSON.stringify({
              ...record,
              state: Object.fromEntries(
                Object.entries(record.state).filter(([key]) => fields.includes(key)),
              ),
            }),
          );
          staged++;
          if (staged % 4096 === 0) {
            onReadProgress?.(staged);
          }
        }
        onReadProgress?.(staged);
        for (const row of db.prepare(ORDERED_STAGED_ROWS_SQL).iterate()) {
          const record = runtimeFromRow(row);
          if (record.kind !== "runtime-instruction") {
            throw new Error("Invalid instruction summary representative.");
          }
          yield record;
        }
      } finally {
        db.exec("DROP TABLE IF EXISTS temp.runtime_summary_rows");
      }
    } finally {
      // TEMP rows belong only to this cursor. Release its snapshot and transaction-local codec
      // caches on success, error or early return, including when SQLite already rolled it back.
      if (ownsSnapshot) {
        try {
          if (transactionActive()) {
            db.exec("ROLLBACK");
          }
        } finally {
          resetSnapshot?.();
        }
      }
    }
  })();
};
