/** Indexed source membership and paginated observations. Runtime history stays in SQLite. */
import type { DatabaseSync } from "node:sqlite";

import type {
  AnalysisEvidenceSource,
  AnalysisSourceEntry,
  AnalysisSourceGroup,
  AnalysisSourceSummary,
} from "../analysis/analysis-sources.js";
import { decodeSqlitePayload } from "./sqlite-payload.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  if (!Object.hasOwn(record, key)) {
    return undefined;
  }
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error("Invalid source metadata record.");
  }
  return value;
}

function optionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  if (!Object.hasOwn(record, key)) {
    return undefined;
  }
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Invalid source metadata record.");
  }
  return value;
}
import { runtimeFromRow } from "./sqlite-records.js";

const collections = ["labels", "comments", "annotations", "regions"] as const;
const sourceEvidence = `WITH source_evidence AS (
  SELECT DISTINCT e.id FROM runtime_evidence e, json_each(e.value) member
  WHERE member.value IN (SELECT value FROM json_each(?)))`;
const sourceRuntime = "r.evidence_id IN (SELECT id FROM source_evidence)";
const sourceObservations = "o.evidence_id IN (SELECT id FROM source_evidence)";
const instructionKinds = "f.kind IN ('runtime-execution','runtime-instruction')";
// Source counts need physical observations only. The compatibility union also synthesizes paired
// CPU states, which can force a scan of the entire captured register history for these projections.
const observationLocations =
  "runtime_observations o JOIN runtime_fact_locations f ON f.fid=o.fact_id";
const hex = (address: number): string => `$${address.toString(16).toUpperCase().padStart(6, "0")}`;

/** Whether source membership indexes exist and have no changed metadata to process.
 * @param {DatabaseSync} db Project connection.
 * @returns {boolean} True when direct source queries can run immediately.
 */
export const sourceQueriesReady = (db: DatabaseSync): boolean =>
  Boolean(db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_source_rows'").get()) &&
  !db.prepare("SELECT 1 FROM query_source_rows WHERE ready=0 LIMIT 1").get();

/**
 * Extract metadata evidence membership once, then process only changed rows under a writer transaction.
 * Runtime membership already lives in its evidence dictionary. The covering index avoids payload reads.
 * @param {DatabaseSync} db Connection owned by the caller's write transaction.
 */
export const prepareSourceQueries = (db: DatabaseSync): void => {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_source_rows'").get()) {
    db.exec(`CREATE INDEX IF NOT EXISTS runtime_source ON runtime_observations(evidence_id,fact_id);
      CREATE TABLE query_source_rows(collection TEXT NOT NULL,id TEXT NOT NULL,ready INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(collection,id)) WITHOUT ROWID;
      CREATE INDEX query_source_pending ON query_source_rows(ready) WHERE ready=0;
      CREATE TABLE query_source_links(evidence_id TEXT NOT NULL,collection TEXT NOT NULL,id TEXT NOT NULL,PRIMARY KEY(evidence_id,collection,id)) WITHOUT ROWID;
      CREATE INDEX query_source_record ON query_source_links(collection,id);`);
    for (const table of collections) {
      db.exec(`INSERT INTO query_source_rows(collection,id) SELECT '${table}',id FROM ${table};
        CREATE TRIGGER query_source_${table}_insert AFTER INSERT ON ${table} BEGIN
          INSERT OR REPLACE INTO query_source_rows(collection,id) VALUES('${table}',NEW.id); END;
        CREATE TRIGGER query_source_${table}_delete AFTER DELETE ON ${table} BEGIN
          DELETE FROM query_source_links WHERE collection='${table}' AND id=OLD.id;
          DELETE FROM query_source_rows WHERE collection='${table}' AND id=OLD.id; END;
        CREATE TRIGGER query_source_${table}_update AFTER UPDATE ON ${table} BEGIN
          DELETE FROM query_source_links WHERE collection='${table}' AND id=OLD.id;
          DELETE FROM query_source_rows WHERE collection='${table}' AND id=OLD.id;
          INSERT OR REPLACE INTO query_source_rows(collection,id) VALUES('${table}',NEW.id); END;`);
    }
  }
  const remove = db.prepare("DELETE FROM query_source_links WHERE collection=? AND id=?");
  const insert = db.prepare(
    "INSERT OR IGNORE INTO query_source_links(evidence_id,collection,id) VALUES(?,?,?)",
  );
  const ready = db.prepare("UPDATE query_source_rows SET ready=1 WHERE collection=? AND id=?");
  for (const table of collections) {
    const pending = db.prepare(
      `SELECT q.id,t.payload FROM query_source_rows q JOIN ${table} t ON t.id=q.id WHERE q.collection=? AND q.ready=0 LIMIT 1024`,
    );
    for (let rows = pending.all(table); rows.length; rows = pending.all(table)) {
      for (const row of rows) {
        const parsed: unknown = JSON.parse(decodeSqlitePayload(row.payload));
        if (!isRecord(parsed) || !isStringArray(parsed.evidence)) {
          throw new Error("Invalid source metadata evidence membership.");
        }
        remove.run(table, row.id);
        for (const id of parsed.evidence) {
          insert.run(id, table, row.id);
        }
        ready.run(table, row.id);
      }
    }
  }
};

/**
 * Count direct observations in SQL without interpreting register or memory payloads.
 * @param {DatabaseSync} db Connection inside a consistent read transaction.
 * @param {AnalysisEvidenceSource} source Catalog identity and immutable evidence membership.
 * @returns {AnalysisSourceSummary} Exact source counts, without baseline subtraction.
 */
export const readSourceSummary = (
  db: DatabaseSync,
  source: AnalysisEvidenceSource,
): AnalysisSourceSummary => {
  const evidence = JSON.stringify(source.evidenceIds);
  const instructionCount = Number(
    db
      .prepare(`${sourceEvidence} SELECT count(*) AS n FROM (
    SELECT f.architecture,f.address_space,f.address FROM ${observationLocations}
    WHERE ${sourceObservations} AND ${instructionKinds}
    GROUP BY f.architecture,f.address_space,f.address)`)
      .get(evidence)?.n ?? 0,
  );
  const memoryCount = Number(
    db
      .prepare(`${sourceEvidence} SELECT count(*) AS n FROM ${observationLocations}
    WHERE ${sourceObservations} AND f.kind='runtime-memory-access'`)
      .get(evidence)?.n ?? 0,
  );
  const contributionCount = Number(
    db
      .prepare(`SELECT count(*) AS n FROM (
    SELECT DISTINCT collection,id FROM query_source_links WHERE evidence_id IN (SELECT value FROM json_each(?)))`)
      .get(evidence)?.n ?? 0,
  );
  return { source, instructionCount, memoryCount, contributionCount };
};

/**
 * Decode at most one page after SQL filtering, grouping, ordering and pagination.
 * @param {DatabaseSync} db Read snapshot with prepared source and annotation indexes.
 * @param {AnalysisEvidenceSource} source Validated catalog entry.
 * @param {AnalysisSourceGroup} group Direct observations or attributed metadata.
 * @param {number} offset Nonnegative row offset. Pages contain at most 200 entries.
 * @returns {AnalysisSourceEntry[]} Compact navigable entries, never the complete trace history.
 */
export const readSourcePage = (
  db: DatabaseSync,
  source: AnalysisEvidenceSource,
  group: AnalysisSourceGroup,
  offset = 0,
): AnalysisSourceEntry[] => {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Invalid source page offset.");
  }
  const evidence = JSON.stringify(source.evidenceIds);
  if (group === "instructions") {
    const rows = db
      .prepare(`${sourceEvidence} SELECT f.architecture,f.address_space,f.address,
      SUM(CASE WHEN f.kind='runtime-execution' THEN o.count ELSE 0 END) AS executions
      FROM ${observationLocations} WHERE ${sourceObservations} AND ${instructionKinds}
      GROUP BY f.architecture,f.address_space,f.address ORDER BY f.architecture,f.address_space,f.address LIMIT 200 OFFSET ?`)
      .all(evidence, offset);
    // Probe the qualified PC before its observations. Joining two compatibility views materialized
    // the global execution history once per row of a source page, even for a tiny capture.
    const offsets = db.prepare(`${sourceEvidence} SELECT DISTINCT o.query_file_offset AS file_offset
      FROM runtime_fact_locations f CROSS JOIN runtime_observations o ON o.fact_id=f.fid
      WHERE ${sourceObservations} AND f.kind='runtime-execution'
      AND f.architecture=? AND f.address_space=? AND f.address=?
      AND o.query_file_offset IS NOT NULL ORDER BY o.query_file_offset`);
    return rows.map((row) => ({
      id: JSON.stringify([row.architecture, row.address_space, row.address]),
      label: hex(Number(row.address)),
      description: `${String(row.executions)} recorded executions`,
      detail:
        "Directly observed instruction address. CPU-state variants do not inflate the address count. Execution counts exclude duplicate fetched-instruction facts.",
      architecture: String(row.architecture),
      addressSpace: String(row.address_space),
      address: Number(row.address),
      outputOffsets: offsets
        .all(evidence, row.architecture, row.address_space, row.address)
        .map((entry) => Number(entry.file_offset)),
      recordIds: [],
    }));
  }
  if (group === "memory") {
    return db
      .prepare(`${sourceEvidence} SELECT r.*,p.value AS id_prefix,e.value AS evidence
      FROM runtime r JOIN runtime_prefixes p ON p.id=r.prefix_id JOIN runtime_evidence e ON e.id=r.evidence_id
      WHERE ${sourceRuntime} AND r.kind='runtime-memory-access' ORDER BY r.evidence_id,r.kind,r.rowid LIMIT 200 OFFSET ?`)
      .all(evidence, offset)
      .map((row) => {
        const record = runtimeFromRow(row);
        if (record.kind !== "runtime-memory-access") {
          throw new Error("Invalid memory observation.");
        }
        const detail = `${record.access} ${record.accessedAddressSpace}:${hex(record.accessedAddress)} · ${record.width} byte(s) · ${record.count} observations`;
        return {
          id: record.id,
          label: hex(record.instructionAddress),
          description: detail,
          detail,
          architecture: record.architecture,
          addressSpace: record.instructionAddressSpace,
          address: record.instructionAddress,
          outputOffsets: [],
          recordIds: [record.id],
        };
      });
  }
  const select = collections
    .map(
      (table) =>
        `SELECT '${table}' AS collection,t.id AS id,t.payload AS payload FROM ${table} t JOIN matched m ON m.collection='${table}' AND m.id=t.id`,
    )
    .join(" UNION ALL ");
  return db
    .prepare(`WITH matched AS (SELECT DISTINCT collection,id FROM query_source_links WHERE evidence_id IN (SELECT value FROM json_each(?)))
    ${select} ORDER BY collection,id LIMIT 200 OFFSET ?`)
    .all(evidence, offset)
    .map((row) => {
      const parsed: unknown = JSON.parse(decodeSqlitePayload(row.payload));
      if (!isRecord(parsed) || typeof parsed.id !== "string") {
        throw new Error("Invalid source metadata record.");
      }
      const addressSpace = optionalString(parsed, "addressSpace");
      if (addressSpace === undefined) {
        throw new Error("Invalid source metadata record.");
      }
      const address = optionalNumber(parsed, "address") ?? optionalNumber(parsed, "start");
      const label =
        optionalString(parsed, "name") ??
        optionalString(parsed, "text") ??
        optionalString(parsed, "classification") ??
        parsed.id;
      return {
        id: `${String(row.collection)}:${parsed.id}`,
        label,
        description: String(row.collection),
        detail: `Attributed to ${source.name}: ${parsed.id}`,
        addressSpace,
        address,
        architecture: optionalString(parsed, "architecture"),
        outputOffsets: [],
        recordIds: [parsed.id],
      };
    });
};
