import type { ShardKind } from "./project-types.js";
/** Migration stages are cancellable until publication; reported record counts are per table. */
export interface SqliteMigrationProgress {
    readonly phase: "project" | "copy" | "verify" | "indexes" | "publish";
    readonly table?: ShardKind;
    readonly records?: number;
}
/** The original stays at backupFile until explicitly removed after operational checks. */
export interface SqliteMigrationResult {
    readonly changed: boolean;
    readonly recovered: boolean;
    readonly storageVersion: number;
    readonly beforeBytes: number;
    readonly afterBytes: number;
    readonly backupFile?: string;
    readonly tables: Readonly<Record<string, {
        readonly records: number;
        readonly sha256: string;
    }>>;
    readonly warnings: readonly string[];
    /** Expected conversion notices; these do not indicate a failed migration. */
    readonly notes?: readonly string[];
    /** Non-overlapping copy, projection, validation and index costs in wall-clock milliseconds. */
    readonly timings?: readonly {
        readonly step: string;
        readonly durationMs: number;
    }[];
}
/** Callbacks report progress only; cancellation is observed between bounded copy/verification batches. */
export interface SqliteMigrationOptions {
    /** Explicitly discard full register-index detail after retaining the original database as backup. */
    readonly convertRuntime?: boolean;
    readonly signal?: AbortSignal;
    readonly onProgress?: (progress: SqliteMigrationProgress) => void;
}
/**
 * Convert supported SQLite layouts with per-table content digests; optional runtime projection is explicit.
 * The process gate blocks new clients; switching WAL to DELETE under exclusive locking also requires
 * existing SQLite readers to release the source. No source row or logical revision is changed.
 * @param {string} directory Existing project root, on a filesystem supporting same-directory hard links.
 * @param {SqliteMigrationOptions} [options] Cancellation and progress reporting.
 * @returns {Promise<SqliteMigrationResult>} Published sizes, content digests, and retained original path.
 */
export declare const migrateAnalysisProjectStorage: (directory: string, options?: SqliteMigrationOptions) => Promise<SqliteMigrationResult>;
//# sourceMappingURL=sqlite-migration.d.ts.map