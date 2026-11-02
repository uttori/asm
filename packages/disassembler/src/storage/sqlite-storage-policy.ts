import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";

function errorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
}

/** Budgets use bytes. Zero disables the database ceiling. A zero cache budget evicts optional projections. */
export interface AnalysisStoragePolicy {
  readonly cacheMaxBytes: number;
  readonly databaseMaxBytes: number;
}

/** Default cache allocation and unlimited durable database storage. */
export const DEFAULT_ANALYSIS_STORAGE_POLICY: AnalysisStoragePolicy = {
  cacheMaxBytes: 256 * 1024 ** 2,
  databaseMaxBytes: 0,
};

/** Physical capture_catalog columns in CREATE TABLE order. */
export const CAPTURE_CATALOG_COLUMNS = [
  "sha256",
  "profile",
  "source_name",
  "imported_at",
  "last_seen_at",
  "observed_events",
  "dropped_events",
] as const;

/** Small, durable import receipts outlive both raw files and derived caches. */
export const CAPTURE_CATALOG_SCHEMA = `CREATE TABLE capture_catalog (
  sha256 TEXT PRIMARY KEY, profile TEXT NOT NULL, source_name TEXT NOT NULL,
  imported_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
  observed_events INTEGER NOT NULL, dropped_events INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;`;

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isPolicyRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Stored and displayed independently of semantic edit revisions. Invalid persisted limits fail closed.
 * @param {DatabaseSync} db Open project connection.
 * @returns {AnalysisStoragePolicy} Validated persisted limits merged with defaults.
 */
export const readStoragePolicy = (db: DatabaseSync): AnalysisStoragePolicy => {
  const value = db.prepare("SELECT v FROM meta WHERE k='storage-policy'").get()?.v;
  return validateStoragePolicy(value ? JSON.parse(String(value)) : {});
};

/** Merge explicit overrides with defaults. All limits must be finite, nonnegative safe integers.
 * @param {unknown} value Explicit policy fields. Unknown fields are rejected.
 * @returns {AnalysisStoragePolicy} Complete validated byte limits.
 */
export const validateStoragePolicy = (value: unknown): AnalysisStoragePolicy => {
  if (!isPolicyRecord(value)) {
    throw new Error("Storage policy must be an object containing explicit limits.");
  }
  let cacheMaxBytes = DEFAULT_ANALYSIS_STORAGE_POLICY.cacheMaxBytes;
  let databaseMaxBytes = DEFAULT_ANALYSIS_STORAGE_POLICY.databaseMaxBytes;
  for (const [key, count] of Object.entries(value)) {
    if (
      !Object.hasOwn(DEFAULT_ANALYSIS_STORAGE_POLICY, key) ||
      !(isSafeInteger(count) && count >= 0)
    ) {
      throw new Error(`Invalid storage limit '${key}'. Use nonnegative integer byte limits.`);
    }
    if (key === "cacheMaxBytes") {
      cacheMaxBytes = count;
    } else if (key === "databaseMaxBytes") {
      databaseMaxBytes = count;
    }
  }
  return { cacheMaxBytes, databaseMaxBytes };
};

/** Lightweight accounting for final reports. Bytes allocated to freelist pages are separately visible. */
export interface AnalysisStorageSnapshot {
  readonly databaseBytes: number;
  readonly walBytes: number;
  readonly livePageBytes: number;
  readonly freePageBytes: number;
  readonly facts: number;
  readonly observations: number;
  readonly pairedStates: number;
  readonly captures: number;
}

/** Read bounded SQL aggregates. File sizes include allocated WAL capacity, not additional retained evidence.
 * @param {DatabaseSync} db Project connection inside the owning read snapshot.
 * @param {string} file Absolute database path used for allocation accounting.
 * @returns {AnalysisStorageSnapshot} Physical allocation, deduplication and receipt totals.
 */
export const storageSnapshot = (db: DatabaseSync, file: string): AnalysisStorageSnapshot => {
  const size = Number(db.prepare("PRAGMA page_size").get()!.page_size);
  const pages = Number(db.prepare("PRAGMA page_count").get()!.page_count);
  const free = Number(db.prepare("PRAGMA freelist_count").get()!.freelist_count);
  const rows = db
    .prepare("SELECT COUNT(*) AS n,COUNT(state_prefix_id) AS paired FROM runtime_observations")
    .get()!;
  const captures = db.prepare("SELECT COUNT(*) AS n FROM capture_catalog").get()!;
  let walBytes = 0;
  try {
    walBytes = fs.statSync(`${file}-wal`).size;
  } catch (error) {
    if (errorCode(error) !== "ENOENT") {
      throw error;
    }
  }
  return {
    databaseBytes: fs.statSync(file).size,
    walBytes,
    livePageBytes: (pages - free) * size,
    freePageBytes: free * size,
    // Count the owning rows directly; the logical view would join every shared descriptor.
    facts: Number(db.prepare("SELECT COUNT(*) AS n FROM runtime_fact_rows").get()!.n),
    observations: Number(rows.n),
    pairedStates: Number(rows.paired),
    captures: Number(captures.n),
  };
};

/** Reject the owning publication before COMMIT. Retained facts are never truncated to meet a quota.
 * @param {DatabaseSync} db Writer transaction whose publication has not committed.
 */
export const enforceDatabaseBudget = (db: DatabaseSync): void => {
  const budget = readStoragePolicy(db).databaseMaxBytes;
  if (!budget) {
    return;
  }
  const pages =
    Number(db.prepare("PRAGMA page_count").get()!.page_count) -
    Number(db.prepare("PRAGMA freelist_count").get()!.freelist_count);
  const bytes = pages * Number(db.prepare("PRAGMA page_size").get()!.page_size);
  if (bytes > budget) {
    throw new Error(
      `Analysis database exceeds its ${Math.ceil(budget / 1024 ** 2)} MiB storage budget. Publication rolled back. Increase the budget or run storage maintenance.`,
    );
  }
};

/** Disposable projections, ordered by eviction preference. Core editor/export indexes stay available. */
const CACHES = [
  { key: "source_export", tables: ["query_source_export_rows", "query_source_export_evidence"] },
  { key: "graph", tables: ["query_graph_nodes", "query_graph_edges"] },
  {
    key: "instruction_variants",
    tables: [
      "query_runtime_variant_keys",
      "query_runtime_variant_sources",
      "query_runtime_variant_pending",
    ],
  },
  { key: "evidence_links", tables: ["query_evidence_links"] },
] as const;

/** Retired product projections remain accounted for until explicit maintenance drops them. */
const RETIRED_CACHES = [
  { key: "coverage", tables: ["query_coverage_segments", "query_coverage_details"] },
  { key: "snes_roles", tables: [] },
  { key: "runtime_architectures", tables: ["query_runtime_architectures"] },
] as const;

/** Remove only known disposable product caches; never runs while merely opening a project.
 * @param {DatabaseSync} db Connection inside the caller's maintenance writer transaction.
 * @returns {string[]} Retired keys whose persisted state was removed.
 */
const retireStorageCaches = (db: DatabaseSync): string[] => {
  const removed: string[] = [];
  const dependencies = [
    "analysis",
    "annotations",
    "labels",
    "comments",
    "regions",
    "imports",
    "evidence",
    "runtime_fact_rows",
    "runtime_observations",
    "runtime_identities",
  ];
  for (const cache of RETIRED_CACHES) {
    let found = Boolean(db.prepare("SELECT 1 FROM query_cache WHERE name=?").get(cache.key));
    // Names come from fixed internal inventories, so retirement cannot drop user-selected objects.
    for (const table of dependencies) {
      for (const event of ["INSERT", "UPDATE", "DELETE"]) {
        const name = `cache_${cache.key}_${table}_${event}`;
        found ||= Boolean(
          db.prepare("SELECT 1 FROM sqlite_schema WHERE type='trigger' AND name=?").get(name),
        );
        db.exec(`DROP TRIGGER IF EXISTS ${name}`);
      }
    }
    for (const table of cache.tables) {
      found ||= Boolean(
        db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(table),
      );
      db.exec(`DROP TABLE IF EXISTS ${table}`);
    }
    db.prepare("DELETE FROM query_cache WHERE name=?").run(cache.key);
    if (found) {
      removed.push(cache.key);
    }
  }
  return removed;
};

/** Include secondary indexes when budgeting a disposable table.
 * @param {DatabaseSync} db Open project connection.
 * @param {string} table Internal table name from the fixed cache inventory.
 * @returns {number} Allocated SQLite bytes for the table and all its indexes.
 */
const cacheTableBytes = (db: DatabaseSync, table: string): number => {
  const allocation = db.prepare("SELECT COALESCE(SUM(pgsize),0) AS bytes FROM dbstat WHERE name=?");
  return db
    .prepare("SELECT name FROM sqlite_schema WHERE tbl_name=? AND type IN ('table','index')")
    .all(table)
    .reduce((bytes, row) => bytes + Number(allocation.get(row.name)!.bytes), 0);
};

/** Explicit accounting for optional caches. Editor/export indexes are excluded from this budget.
 * @param {DatabaseSync} db Open project connection.
 * @returns {number} Allocated bytes including projection indexes and cache result payloads.
 */
export const optionalCacheBytes = (db: DatabaseSync): number =>
  [...CACHES, ...RETIRED_CACHES].reduce(
    (bytes, cache) => bytes + cache.tables.reduce((n, table) => n + cacheTableBytes(db, table), 0),
    cacheTableBytes(db, "query_cache"),
  );

/** Evict stale or over-budget optional projections under a writer lock, after an operation completes.
 * Cache tokens are removed with their tables' rows, forcing a complete rebuild on next demand.
 * @param {DatabaseSync} db Writer transaction after the consuming operation has finished.
 * @returns {object} Evicted projection keys and remaining optional cache allocation.
 */
export const maintainStorageCaches = (
  db: DatabaseSync,
): { readonly evicted: readonly string[]; readonly cacheBytes: number } => {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_cache'").get()) {
    return { evicted: [], cacheBytes: 0 };
  }
  const budget = readStoragePolicy(db).cacheMaxBytes;
  const evicted = retireStorageCaches(db);
  const entries = CACHES.map((cache) =>
    Object.assign({}, cache, {
      bytes: cache.tables.reduce((n, table) => n + cacheTableBytes(db, table), 0),
    }),
  );
  let cacheBytes =
    entries.reduce((n, cache) => n + cache.bytes, 0) + cacheTableBytes(db, "query_cache");
  for (const cache of entries) {
    const token = db.prepare("SELECT signature FROM query_cache WHERE name=?").get(cache.key);
    // A builder reads the base summary and pending IDs under one snapshot. Eviction must not
    // remove that base before it can publish; its separate ownership token protects the whole set.
    const summaryBuilder =
      cache.key === "instruction_variants" &&
      db.prepare("SELECT 1 FROM query_cache WHERE name='instruction_variants_build'").get();
    if (summaryBuilder) {
      continue;
    }
    // Another process may be computing this projection. Its token must survive ordinary cleanup.
    if (String(token?.signature).startsWith("pending:")) {
      continue;
    }
    if (token && cacheBytes <= budget) {
      continue;
    }
    for (const table of cache.tables) {
      if (db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(table)) {
        db.exec(`DELETE FROM ${table}`);
      }
    }
    db.prepare("DELETE FROM query_cache WHERE name=?").run(cache.key);
    if (cache.bytes) {
      evicted.push(cache.key);
    }
    cacheBytes -= cache.bytes;
  }
  return { evicted, cacheBytes: optionalCacheBytes(db) };
};
