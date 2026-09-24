import fs from "node:fs";
/** Default cache allocation and unlimited durable database storage. */
export const DEFAULT_ANALYSIS_STORAGE_POLICY = {
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
];
/** Small, durable import receipts outlive both raw files and derived caches. */
export const CAPTURE_CATALOG_SCHEMA = `CREATE TABLE capture_catalog (
  sha256 TEXT PRIMARY KEY, profile TEXT NOT NULL, source_name TEXT NOT NULL,
  imported_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,
  observed_events INTEGER NOT NULL, dropped_events INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;`;
/** Stored and displayed independently of semantic edit revisions. Invalid persisted limits fail closed.
 * @param {DatabaseSync} db Open project connection.
 * @returns {AnalysisStoragePolicy} Validated persisted limits merged with defaults.
 */
export const readStoragePolicy = (db) => {
    const value = db.prepare("SELECT v FROM meta WHERE k='storage-policy'").get()?.v;
    return validateStoragePolicy(value ? JSON.parse(String(value)) : {});
};
/** Merge explicit overrides with defaults. All limits must be finite, nonnegative safe integers.
 * @param {Partial<AnalysisStoragePolicy>} value Explicit policy fields. Unknown fields are rejected.
 * @returns {AnalysisStoragePolicy} Complete validated byte limits.
 */
export const validateStoragePolicy = (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Storage policy must be an object containing explicit limits.");
    }
    const policy = { ...DEFAULT_ANALYSIS_STORAGE_POLICY, ...value };
    for (const [key, count] of Object.entries(policy)) {
        if (!Object.hasOwn(DEFAULT_ANALYSIS_STORAGE_POLICY, key) ||
            !Number.isSafeInteger(count) ||
            count < 0) {
            throw new Error(`Invalid storage limit '${key}'. Use nonnegative integer byte limits.`);
        }
    }
    return policy;
};
/** Read bounded SQL aggregates. File sizes include allocated WAL capacity, not additional retained evidence.
 * @param {DatabaseSync} db Project connection inside the owning read snapshot.
 * @param {string} file Absolute database path used for allocation accounting.
 * @returns {AnalysisStorageSnapshot} Physical allocation, deduplication and receipt totals.
 */
export const storageSnapshot = (db, file) => {
    const size = Number(db.prepare("PRAGMA page_size").get().page_size);
    const pages = Number(db.prepare("PRAGMA page_count").get().page_count);
    const free = Number(db.prepare("PRAGMA freelist_count").get().freelist_count);
    const rows = db
        .prepare("SELECT COUNT(*) AS n,COUNT(state_prefix_id) AS paired FROM runtime_observations")
        .get();
    const captures = db.prepare("SELECT COUNT(*) AS n FROM capture_catalog").get();
    let walBytes = 0;
    try {
        walBytes = fs.statSync(`${file}-wal`).size;
    }
    catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
    return {
        databaseBytes: fs.statSync(file).size,
        walBytes,
        livePageBytes: (pages - free) * size,
        freePageBytes: free * size,
        // Count the owning rows directly; the logical view would join every shared descriptor.
        facts: Number(db.prepare("SELECT COUNT(*) AS n FROM runtime_fact_rows").get().n),
        observations: Number(rows.n),
        pairedStates: Number(rows.paired),
        captures: Number(captures.n),
    };
};
/** Reject the owning publication before COMMIT. Retained facts are never truncated to meet a quota.
 * @param {DatabaseSync} db Writer transaction whose publication has not committed.
 */
export const enforceDatabaseBudget = (db) => {
    const budget = readStoragePolicy(db).databaseMaxBytes;
    if (!budget) {
        return;
    }
    const pages = Number(db.prepare("PRAGMA page_count").get().page_count) -
        Number(db.prepare("PRAGMA freelist_count").get().freelist_count);
    const bytes = pages * Number(db.prepare("PRAGMA page_size").get().page_size);
    if (bytes > budget) {
        throw new Error(`Analysis database exceeds its ${Math.ceil(budget / 1024 ** 2)} MiB storage budget. Publication rolled back. Increase the budget or run storage maintenance.`);
    }
};
/** Disposable projections, ordered by eviction preference. Core editor/export indexes stay available. */
const CACHES = [
    { key: "coverage", tables: ["query_coverage_segments", "query_coverage_details"] },
    { key: "graph", tables: ["query_graph_nodes", "query_graph_edges"] },
    {
        key: "instruction_variants",
        tables: [
            "query_runtime_variant_keys",
            "query_runtime_variant_sources",
            "query_runtime_variant_pending",
        ],
    },
    { key: "runtime_architectures", tables: ["query_runtime_architectures"] },
    { key: "evidence_links", tables: ["query_evidence_links"] },
];
/** Include secondary indexes when budgeting a disposable table.
 * @param {DatabaseSync} db Open project connection.
 * @param {string} table Internal table name from the fixed cache inventory.
 * @returns {number} Allocated SQLite bytes for the table and all its indexes.
 */
const cacheTableBytes = (db, table) => {
    const allocation = db.prepare("SELECT COALESCE(SUM(pgsize),0) AS bytes FROM dbstat WHERE name=?");
    return db
        .prepare("SELECT name FROM sqlite_schema WHERE tbl_name=? AND type IN ('table','index')")
        .all(table)
        .reduce((bytes, row) => bytes + Number(allocation.get(row.name).bytes), 0);
};
/** Explicit accounting for optional caches. Editor/export indexes are excluded from this budget.
 * @param {DatabaseSync} db Open project connection.
 * @returns {number} Allocated bytes including projection indexes and cache result payloads.
 */
export const optionalCacheBytes = (db) => CACHES.reduce((bytes, cache) => bytes + cache.tables.reduce((n, table) => n + cacheTableBytes(db, table), 0), cacheTableBytes(db, "query_cache"));
/** Evict stale or over-budget optional projections under a writer lock, after an operation completes.
 * Cache tokens are removed with their tables' rows, forcing a complete rebuild on next demand.
 * @param {DatabaseSync} db Writer transaction after the consuming operation has finished.
 * @returns {object} Evicted projection keys and remaining optional cache allocation.
 */
export const maintainStorageCaches = (db) => {
    if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_cache'").get()) {
        return { evicted: [], cacheBytes: 0 };
    }
    const budget = readStoragePolicy(db).cacheMaxBytes;
    const entries = CACHES.map((cache) => ({
        ...cache,
        bytes: cache.tables.reduce((n, table) => n + cacheTableBytes(db, table), 0),
    }));
    let cacheBytes = entries.reduce((n, cache) => n + cache.bytes, 0) + cacheTableBytes(db, "query_cache");
    const evicted = [];
    for (const cache of entries) {
        const token = db.prepare("SELECT signature FROM query_cache WHERE name=?").get(cache.key);
        // A builder reads the base summary and pending IDs under one snapshot. Eviction must not
        // remove that base before it can publish; its separate ownership token protects the whole set.
        const summaryBuilder = cache.key === "instruction_variants" &&
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
//# sourceMappingURL=sqlite-storage-policy.js.map