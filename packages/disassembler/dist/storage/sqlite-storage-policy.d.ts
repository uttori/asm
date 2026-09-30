import type { DatabaseSync } from "node:sqlite";
/** Budgets use bytes. Zero disables the database ceiling. A zero cache budget evicts optional projections. */
export interface AnalysisStoragePolicy {
    readonly cacheMaxBytes: number;
    readonly databaseMaxBytes: number;
}
/** Default cache allocation and unlimited durable database storage. */
export declare const DEFAULT_ANALYSIS_STORAGE_POLICY: AnalysisStoragePolicy;
/** Physical capture_catalog columns in CREATE TABLE order. */
export declare const CAPTURE_CATALOG_COLUMNS: readonly ["sha256", "profile", "source_name", "imported_at", "last_seen_at", "observed_events", "dropped_events"];
/** Small, durable import receipts outlive both raw files and derived caches. */
export declare const CAPTURE_CATALOG_SCHEMA = "CREATE TABLE capture_catalog (\n  sha256 TEXT PRIMARY KEY, profile TEXT NOT NULL, source_name TEXT NOT NULL,\n  imported_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL,\n  observed_events INTEGER NOT NULL, dropped_events INTEGER NOT NULL DEFAULT 0\n) WITHOUT ROWID;";
/** Stored and displayed independently of semantic edit revisions. Invalid persisted limits fail closed.
 * @param {DatabaseSync} db Open project connection.
 * @returns {AnalysisStoragePolicy} Validated persisted limits merged with defaults.
 */
export declare const readStoragePolicy: (db: DatabaseSync) => AnalysisStoragePolicy;
/** Merge explicit overrides with defaults. All limits must be finite, nonnegative safe integers.
 * @param {Partial<AnalysisStoragePolicy>} value Explicit policy fields. Unknown fields are rejected.
 * @returns {AnalysisStoragePolicy} Complete validated byte limits.
 */
export declare const validateStoragePolicy: (value: Partial<AnalysisStoragePolicy>) => AnalysisStoragePolicy;
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
export declare const storageSnapshot: (db: DatabaseSync, file: string) => AnalysisStorageSnapshot;
/** Reject the owning publication before COMMIT. Retained facts are never truncated to meet a quota.
 * @param {DatabaseSync} db Writer transaction whose publication has not committed.
 */
export declare const enforceDatabaseBudget: (db: DatabaseSync) => void;
/** Explicit accounting for optional caches. Editor/export indexes are excluded from this budget.
 * @param {DatabaseSync} db Open project connection.
 * @returns {number} Allocated bytes including projection indexes and cache result payloads.
 */
export declare const optionalCacheBytes: (db: DatabaseSync) => number;
/** Evict stale or over-budget optional projections under a writer lock, after an operation completes.
 * Cache tokens are removed with their tables' rows, forcing a complete rebuild on next demand.
 * @param {DatabaseSync} db Writer transaction after the consuming operation has finished.
 * @returns {object} Evicted projection keys and remaining optional cache allocation.
 */
export declare const maintainStorageCaches: (db: DatabaseSync) => {
    readonly evicted: readonly string[];
    readonly cacheBytes: number;
};
//# sourceMappingURL=sqlite-storage-policy.d.ts.map