import { type AnalysisProject, type AnalysisProjectManifest, type AnalysisProjectShards, type LoadedAnalysisProject, type LoadedAnalysisProjectView, type RuntimeRecordProjection } from "../model/project-types.js";
import { SqliteAnalysisStore } from "../storage/sqlite-store.js";
/** Identity marker for optimistic project revision tokens. */
export declare const ANALYSIS_PROJECT_REVISION_FORMAT = "uttori-asm-analysis-revision";
/** Revision token contract. The hash now covers the authoritative database manifest and counter. */
export declare const ANALYSIS_PROJECT_REVISION_VERSION = 1;
/**
 * Opaque optimistic token for a saved project, not a ROM hash or schema version.
 * Publications advance the counter even when the semantic records are unchanged.
 */
export interface AnalysisProjectRevision {
    readonly format: typeof ANALYSIS_PROJECT_REVISION_FORMAT;
    readonly version: typeof ANALYSIS_PROJECT_REVISION_VERSION;
    readonly manifestSha256: string;
}
/** Complete records and the revision read in the same SQLite snapshot. */
export interface AnalysisProjectSnapshot extends LoadedAnalysisProject {
    readonly revision: AnalysisProjectRevision;
}
/** Projected records and the revision of their complete backing store. */
export interface AnalysisProjectViewSnapshot extends LoadedAnalysisProjectView {
    readonly revision: AnalysisProjectRevision;
}
/** Validation result retaining the caller's project reference. No copy, lock, or revision reservation. */
export interface PreparedAnalysisProjectTransaction {
    readonly project: AnalysisProject;
}
/** Explicit SQLite maintenance result. Ordinary commits return zero removed bytes and no warnings. */
export interface AnalysisProjectMaintenanceResult {
    /** Reduction in main database file size. Excludes WAL and source capture files. */
    readonly removedBytes: number;
    readonly warnings: readonly string[];
}
/**
 * Manifest and revision published atomically with the changed records.
 * A later watcher-pointer refresh failure emits a process warning and does not undo the commit.
 */
export interface CommittedAnalysisProjectTransaction {
    readonly manifest: AnalysisProjectManifest;
    readonly revision: AnalysisProjectRevision;
    readonly maintenance: AnalysisProjectMaintenanceResult;
}
/**
 * The expected revision is stale and nothing was committed. Reload and reapply the user's intent.
 * Substituting a fresh token on the old replacement can overwrite another writer's work.
 */
export declare class AnalysisProjectStaleError extends Error {
    readonly expected: AnalysisProjectRevision;
    readonly actual: AnalysisProjectRevision;
    constructor(expected: AnalysisProjectRevision, actual: AnalysisProjectRevision);
}
/**
 * Derive an optimistic identity from the database, never the potentially stale watcher file.
 * @param {AnalysisProjectManifest} manifest Authoritative manifest read inside a SQLite transaction.
 * @returns {AnalysisProjectRevision} Stable token including the publication counter.
 */
export declare const analysisProjectRevision: (manifest: AnalysisProjectManifest) => AnalysisProjectRevision;
/**
 * Check a caller's revision inside the transaction that will consume its snapshot.
 * @param {SqliteAnalysisStore} store Connection holding a read or write transaction.
 * @param {AnalysisProjectRevision} expected Revision observed by the editing client.
 */
export declare const assertAnalysisProjectRevision: (store: SqliteAnalysisStore, expected: AnalysisProjectRevision) => void;
/**
 * Read complete validated records and their revision in one snapshot.
 * @param {string} directory Existing project root.
 * @returns {AnalysisProjectSnapshot} Complete validated records and their optimistic token.
 */
export declare const loadAnalysisProjectSnapshot: (directory: string) => AnalysisProjectSnapshot;
/**
 * Read metadata and an optional streamed runtime projection from one database snapshot.
 * @param {string} directory Existing project root.
 * @param {Function} [createProjection] Optional runtime reducer. The default omits runtime.
 * @returns {AnalysisProjectViewSnapshot} Metadata or projection and its optimistic token.
 */
export declare const loadAnalysisProjectViewSnapshot: (directory: string, createProjection?: () => RuntimeRecordProjection) => AnalysisProjectViewSnapshot;
/**
 * Validate a complete replacement without changing persistent state. Commit validates it again.
 * Holds the same project reference. Preparation neither binds a destination nor reserves a revision.
 * @param {string} _directory Destination root, retained for the preparation API contract.
 * @param {AnalysisProject} project Caller-owned complete replacement.
 * @returns {PreparedAnalysisProjectTransaction} Validated replacement. The caller retains ownership.
 */
export declare const prepareAnalysisProjectTransaction: (_directory: string, project: AnalysisProject) => PreparedAnalysisProjectTransaction;
/**
 * Commit a complete prepared replacement against the revision observed by its caller.
 * @param {string} directory Destination project root.
 * @param {AnalysisProjectRevision | undefined} expected Observed revision. Undefined permits initial creation only.
 * @param {PreparedAnalysisProjectTransaction} prepared Caller-owned replacement, revalidated at commit.
 * @returns {CommittedAnalysisProjectTransaction} Committed manifest and revision.
 */
export declare const commitPreparedAnalysisProjectTransaction: (directory: string, expected: AnalysisProjectRevision | undefined, prepared: PreparedAnalysisProjectTransaction) => CommittedAnalysisProjectTransaction;
/**
 * Atomically replace all records after rejecting stale readers under the SQLite writer lock.
 * Validation, revision, or SQLite failures leave the previous publication intact. These synchronous
 * APIs have no AbortSignal. Check cancellation before calling, or throw inside a low-level transaction.
 * @param {string} directory Existing project root.
 * @param {AnalysisProjectRevision} expected Revision observed by the editing client.
 * @param {AnalysisProject} project Complete replacement. Runtime is replaced too.
 * @returns {CommittedAnalysisProjectTransaction} Committed manifest and revision.
 */
export declare const commitAnalysisProjectTransaction: (directory: string, expected: AnalysisProjectRevision, project: AnalysisProject) => CommittedAnalysisProjectTransaction;
/**
 * Replace explicitly supplied metadata tables and preserve omitted tables and all runtime history.
 * Each supplied array is the entire replacement table, including an empty array to clear it.
 * @param {string} directory Existing project root.
 * @param {AnalysisProjectViewSnapshot} snapshot Original metadata view and revision.
 * @param {object} updates Metadata table replacements. Any runtime property is rejected.
 * @returns {CommittedAnalysisProjectTransaction} Committed identity with complete runtime preserved.
 */
export declare const commitAnalysisProjectViewUpdate: (directory: string, snapshot: AnalysisProjectViewSnapshot, updates: Partial<Omit<AnalysisProjectShards, "runtime">>) => CommittedAnalysisProjectTransaction;
/**
 * Create a project, or explicitly replace it against a caller-observed revision.
 * Omitting expected permits creation only; it never samples a newer revision on the caller's behalf.
 * Prefer metadata updates for ordinary edits so retained runtime history cannot be replaced accidentally.
 */
export declare const publishAnalysisProject: (directory: string, project: AnalysisProject, expected?: AnalysisProjectRevision) => CommittedAnalysisProjectTransaction;
/**
 * Explicitly checkpoint and VACUUM the current SQLite file without changing its logical revision.
 * Requires temporary free space for a second database copy. Active readers can delay checkpoints.
 * @param {string} directory Existing SQLite project root.
 * @returns {CommittedAnalysisProjectTransaction} Unchanged logical identity and reclaimed byte count.
 */
export declare const compactAnalysisProject: (directory: string) => CommittedAnalysisProjectTransaction;
//# sourceMappingURL=project-transaction.d.ts.map