import type { DatabaseSync } from "node:sqlite";

import type {
  RomCoverageMap,
  RomCoverageSegment,
  RomCoverageSummary,
} from "../analysis/coverage-map.js";
import type {
  AnalysisProjectManifest,
  AnalysisConflictRecord,
  IntervalAnnotation,
} from "../model/project-types.js";
import { decodeSqlitePayload } from "./sqlite-payload.js";
import { readQueryCache } from "./sqlite-query-cache.js";

/** Compact cache header. Segment/detail bodies stay paged in SQLite. */
export type SqliteCoverageSummary = Omit<
  RomCoverageMap,
  "segments" | "unprojected" | "diagnostics"
> & {
  readonly segments: readonly never[];
  readonly unprojected: readonly never[];
  readonly diagnostics: readonly never[];
  readonly detailCount: number;
};
const decode = <T>(value: unknown): T => JSON.parse(decodeSqlitePayload(value)) as T;
export const coverageSignature = (manifest: AnalysisProjectManifest): string =>
  JSON.stringify([1, manifest.rom, manifest.addressSpaces]);
/** Read a current header without acquiring a writer lock.
 * @param {DatabaseSync} db Project connection.
 * @param {AnalysisProjectManifest} manifest Snapshot identity.
 * @returns {SqliteCoverageSummary | undefined} Header if all dependencies still match.
 */
export const cachedCoverage = (
  db: DatabaseSync,
  manifest: AnalysisProjectManifest,
): SqliteCoverageSummary | undefined => readQueryCache(db, "coverage", coverageSignature(manifest));

/** Build disk-backed events and sweep them with only the active interval identities in memory.
 * Explicit offsets are used. CPU bus addresses are never guessed to be ROM offsets.
 * @param {DatabaseSync} db Read transaction with prepared instruction/offset indexes. Writes stay in temporary tables.
 * @param {AnalysisProjectManifest} manifest Validated ROM identity and address spaces.
 * @returns {SqliteCoverageSummary} Exact totals. Records and diagnostics remain SQL-paged.
 */
export const prepareCoverage = (
  db: DatabaseSync,
  manifest: AnalysisProjectManifest,
): SqliteCoverageSummary => {
  db.exec(`CREATE TEMP TABLE query_coverage_segments (start INTEGER PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TEMP TABLE query_coverage_details (kind TEXT, id TEXT, reason TEXT, payload TEXT NOT NULL);
    CREATE INDEX temp.query_coverage_detail_order ON query_coverage_details(kind,id,reason);
    DELETE FROM query_coverage_segments; DELETE FROM query_coverage_details;
    CREATE TEMP TABLE coverage_events (pos INTEGER NOT NULL, category TEXT NOT NULL, id TEXT NOT NULL, delta INTEGER NOT NULL);`);
  const fileAddressSpaces = manifest.addressSpaces
    .filter((s) => s.kind === "file")
    .map((s) => s.id)
    .sort((a, b) => a.localeCompare(b));
  const files = new Set(fileAddressSpaces);
  const size = manifest.rom.contentSize;
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error("Invalid ROM coverage size.");
  }
  const event = db.prepare("INSERT INTO temp.coverage_events VALUES(?,?,?,?)");
  const detail = db.prepare("INSERT INTO query_coverage_details VALUES(?,?,?,?)");
  const unprojected = (kind: string, id: string, reason: string): void => {
    detail.run(
      kind,
      id,
      reason,
      JSON.stringify({
        id: `${kind}:${id}:${reason}`,
        label: id,
        description: reason,
        icon: "debug-disconnect",
      }),
    );
  };
  const add = (
    kind: string,
    id: string,
    start: number,
    end: number,
    categories: readonly (readonly [string, string])[],
  ): boolean => {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) {
      unprojected(kind, id, "invalid-range");
      return false;
    }
    if (start >= size || size === 0) {
      unprojected(kind, id, "outside-rom");
      return false;
    }
    const clipped = Math.min(end, size);
    if (clipped !== end) {
      detail.run(
        "z-diagnostic",
        id,
        "clipped",
        JSON.stringify({
          id: `diagnostic:${id}:${start}:${end}`,
          label: id,
          description: "clipped",
          tooltip: `Clipped coverage range [${start}, ${end}) to ROM content [${start}, ${clipped}).`,
          icon: "warning",
        }),
      );
    }
    for (const [category, identity] of categories) {
      event.run(start, category, identity, 1);
      event.run(clipped, category, identity, -1);
    }
    return true;
  };
  try {
    for (const row of db
      .prepare("SELECT * FROM annotations WHERE classification != 'unreached'")
      .iterate()) {
      const record = decode<IntervalAnnotation>(row.payload);
      if (!files.has(record.addressSpace)) {
        unprojected("annotation", record.id, "non-file-address-space");
        continue;
      }
      let classification = "data";
      if (["opcode", "operand"].includes(record.classification)) {
        classification = record.classification;
      }
      if (["graphics", "music", "compressed", "asset"].includes(record.classification)) {
        classification = "asset";
      }
      add("annotation", record.id, record.start, record.end, [
        ["classification", classification],
        ["annotationIds", record.id],
      ]);
    }
    for (const row of db.prepare("SELECT id,address_space,start,end FROM regions").iterate()) {
      const id = String(row.id);
      if (!files.has(String(row.address_space))) {
        unprojected("region", id, "non-file-address-space");
        continue;
      }
      add("region", id, Number(row.start), Number(row.end), [["regionIds", id]]);
    }
    // Indexed offsets avoid decoding CFG contexts and runtime register histories.
    for (const row of db
      .prepare(
        "SELECT a.id,q.file_offset,q.size FROM analysis a JOIN query_instruction_nodes q ON q.row_id=a.rowid WHERE a.kind='cfg-node'",
      )
      .iterate()) {
      const id = String(row.id);
      if (row.file_offset === null) {
        unprojected("analysis", id, "missing-file-offset");
        continue;
      }
      const start = Number(row.file_offset);
      add("analysis", id, start, start + 1, [
        ["classification", "opcode"],
        ["analysisIds", id],
      ]);
      if (Number(row.size) > 1) {
        add("analysis", id, start + 1, start + Number(row.size), [
          ["classification", "operand"],
          ["analysisIds", id],
        ]);
      }
    }
    const node = db.prepare(
      "SELECT a.id,q.file_offset,q.size FROM analysis a JOIN query_instruction_nodes q ON q.row_id=a.rowid WHERE a.id=? AND a.kind='cfg-node'",
    );
    for (const row of db.prepare("SELECT payload FROM analysis WHERE kind='conflict'").iterate()) {
      const record = decode<AnalysisConflictRecord>(row.payload);
      if (files.has(record.addressSpace)) {
        add("analysis", record.id, record.address, record.end ?? record.address + 1, [
          ["conflictIds", record.id],
        ]);
        continue;
      }
      let projected = false;
      for (const id of record.nodes) {
        const target = node.get(id);
        if (!target || target.file_offset === null) {
          continue;
        }
        projected =
          add(
            "analysis",
            record.id,
            Number(target.file_offset),
            Number(target.file_offset) + Number(target.size),
            [
              ["conflictIds", record.id],
              ["analysisIds", id],
            ],
          ) || projected;
      }
      if (!projected) {
        unprojected("analysis", record.id, "missing-file-offset");
      }
    }
    const identity = "p.value || CASE typeof(r.id) WHEN 'blob' THEN lower(hex(r.id)) ELSE r.id END";
    for (const row of db
      .prepare(
        `SELECT ${identity} AS id,q.file_offset,q.size FROM runtime r JOIN query_execution_offsets q ON q.row_id=r.rowid JOIN runtime_prefixes p ON p.id=r.prefix_id WHERE r.kind='runtime-execution'`,
      )
      .iterate()) {
      const id = String(row.id);
      if (row.file_offset === null) {
        unprojected("runtime", id, "missing-file-offset");
        continue;
      }
      const start = Number(row.file_offset);
      add("runtime", id, start, start + 1, [
        ["runtime", "executed"],
        ["runtimeIds", id],
      ]);
      if (Number(row.size) > 1) {
        add("runtime", id, start + 1, start + Number(row.size), [
          ["runtime", "operand"],
          ["runtimeIds", id],
        ]);
      }
    }
    for (const row of db
      .prepare(
        `SELECT ${identity} AS id,r.address_space,r.start,r.end,r.coverage FROM runtime r JOIN runtime_prefixes p ON p.id=r.prefix_id WHERE r.kind='runtime-coverage'`,
      )
      .iterate()) {
      const id = String(row.id);
      if (!files.has(String(row.address_space))) {
        unprojected("runtime", id, "non-file-address-space");
        continue;
      }
      add("runtime", id, Number(row.start), Number(row.end), [
        ["runtime", String(row.coverage)],
        ["runtimeIds", id],
      ]);
    }
    // Memory outside file spaces is intentionally excluded, matching the conservative in-memory map.
    for (const row of db
      .prepare(`SELECT ${identity} AS id,r.accessed_address,r.payload FROM runtime r JOIN runtime_prefixes p ON p.id=r.prefix_id
      WHERE r.kind='runtime-memory-access' AND r.accessed_address_space IN (SELECT value FROM json_each(?))`)
      .iterate(JSON.stringify(fileAddressSpaces))) {
      const id = String(row.id);
      const payload = decode<{ access: string; width: number }>(row.payload);
      for (const [access, classification] of [
        ["read", "read"],
        ["write", "written"],
      ]) {
        if (payload.access === access || payload.access === "read-write") {
          add(
            "runtime",
            id,
            Number(row.accessed_address),
            Number(row.accessed_address) + payload.width,
            [
              ["runtime", classification],
              ["runtimeIds", id],
            ],
          );
        }
      }
    }
    // Group equal identity deltas first: adjoining overlays with identical provenance coalesce.
    event.run(0, "boundary", "", 0);
    event.run(size, "boundary", "", 0);
    const active = new Map<string, Map<string, number>>();
    const ids = (category: string): string[] =>
      [...(active.get(category)?.keys() ?? [])].sort((a, b) => a.localeCompare(b));
    const put = db.prepare("INSERT INTO query_coverage_segments VALUES(?,?)");
    const summary: RomCoverageSummary = {
      totalBytes: size,
      classifiedBytes: 0,
      unknownBytes: 0,
      conflictBytes: 0,
      segmentCount: 0,
      bytesByClassification: { opcode: 0, operand: 0, data: 0, asset: 0, unknown: 0 },
      bytesByRuntimeCoverage: { executed: 0, operand: 0, read: 0, written: 0 },
    };
    // Local mutable counters are finalized once. No segment array accumulates in this process.
    let classifiedBytes = 0,
      unknownBytes = 0,
      conflictBytes = 0,
      segmentCount = 0;
    const classificationTotals = { ...summary.bytesByClassification };
    const runtimeTotals = { ...summary.bytesByRuntimeCoverage };
    let previous = 0;
    let pending: RomCoverageSegment | undefined;
    let pendingKey: string | undefined;
    const savePending = (): void => {
      if (pending) {
        put.run(pending.start, JSON.stringify(pending));
        segmentCount++;
      }
    };
    const flush = (end: number): void => {
      if (end <= previous) {
        return;
      }
      const classifications = (["opcode", "operand", "data", "asset"] as const).filter((c) =>
        active.get("classification")?.has(c),
      );
      const runtime = (["executed", "operand", "read", "written"] as const).filter((c) =>
        active.get("runtime")?.has(c),
      );
      const conflictIds = ids("conflictIds");
      let status: RomCoverageSegment["status"] = "classified";
      if (classifications.length === 0) {
        status = "unknown";
      }
      if (classifications.length > 1 || conflictIds.length) {
        status = "conflict";
      }
      const segment: RomCoverageSegment = {
        start: previous,
        end,
        status,
        classifications: classifications.length ? classifications : ["unknown"],
        runtime,
        annotationIds: ids("annotationIds"),
        analysisIds: ids("analysisIds"),
        runtimeIds: ids("runtimeIds"),
        conflictIds,
        regionIds: ids("regionIds"),
      };
      const { start: _start, end: _end, ...identity } = segment;
      const key = JSON.stringify(identity);
      // Overlapping copies can change an identity's multiplicity without changing its visible set.
      if (pending && key === pendingKey) {
        pending = { ...pending, end };
      } else {
        savePending();
        pending = segment;
        pendingKey = key;
      }
      const bytes = end - previous;
      for (const c of segment.classifications) {
        classificationTotals[c] += bytes;
      }
      for (const c of runtime) {
        runtimeTotals[c] += bytes;
      }
      if (status === "classified") {
        classifiedBytes += bytes;
      } else if (status === "conflict") {
        conflictBytes += bytes;
      } else {
        unknownBytes += bytes;
      }
      previous = end;
    };
    for (const row of db
      .prepare(
        "SELECT pos,category,id,SUM(delta) AS delta FROM temp.coverage_events GROUP BY pos,category,id HAVING SUM(delta) != 0 OR category='boundary' ORDER BY pos,category,id",
      )
      .iterate()) {
      flush(Number(row.pos));
      if (row.category === "boundary") {
        continue;
      }
      const category = String(row.category),
        id = String(row.id);
      let values = active.get(category);
      if (!values) {
        values = new Map();
        active.set(category, values);
      }
      const count = (values.get(id) ?? 0) + Number(row.delta);
      if (count === 0) {
        values.delete(id);
      } else {
        values.set(id, count);
      }
    }
    savePending();
    const result: SqliteCoverageSummary = {
      contentSize: size,
      fileAddressSpaces,
      segments: [],
      unprojected: [],
      diagnostics: [],
      detailCount: Number(db.prepare("SELECT count(*) AS n FROM query_coverage_details").get()!.n),
      summary: {
        ...summary,
        classifiedBytes,
        unknownBytes,
        conflictBytes,
        segmentCount,
        bytesByClassification: classificationTotals,
        bytesByRuntimeCoverage: runtimeTotals,
      },
    };
    return result;
  } finally {
    db.exec("DROP TABLE temp.coverage_events");
  }
};

/** Publish complete segment/detail tables under a short writer lock.
 * @param {DatabaseSync} db Connection retaining the completed temporary projection.
 */
export const publishCoverage = (db: DatabaseSync): void => {
  db.exec(`CREATE TABLE IF NOT EXISTS main.query_coverage_segments(start INTEGER PRIMARY KEY,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS main.query_coverage_details(kind TEXT,id TEXT,reason TEXT,payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS main.query_coverage_detail_order ON query_coverage_details(kind,id,reason);
    DELETE FROM main.query_coverage_segments;INSERT INTO main.query_coverage_segments SELECT * FROM temp.query_coverage_segments;
    DELETE FROM main.query_coverage_details;INSERT INTO main.query_coverage_details SELECT * FROM temp.query_coverage_details;`);
};

/** Select a bounded persisted page. Callers ensure the header is current first.
 * @param {DatabaseSync} db Connection in a read snapshot.
 * @param {"segments" | "details"} kind Page collection.
 * @param {number} offset Nonnegative row offset.
 * @returns {unknown[]} At most 200 rows.
 */
export const coveragePage = (
  db: DatabaseSync,
  kind: "segments" | "details",
  offset: number,
): unknown[] => {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Invalid analysis page offset.");
  }
  const table = kind === "segments" ? "query_coverage_segments" : "query_coverage_details";
  const order = kind === "segments" ? "start" : "kind,id,reason";
  return db
    .prepare(`SELECT payload FROM ${table} ORDER BY ${order} LIMIT 200 OFFSET ?`)
    .all(offset)
    .map((row) => JSON.parse(String(row.payload)) as unknown);
};
