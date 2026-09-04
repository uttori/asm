import { type AnalysisProject, type AnalysisProjectManifest, type ShardKind } from "./project-types.js";
import { type LoadedAnalysisProject } from "./project-store.js";
/** Format marker for optimistic project revisions passed between readers and writers. */
export declare const ANALYSIS_PROJECT_REVISION_FORMAT = "uttori-asm-analysis-revision";
/** Current optimistic revision contract. */
export declare const ANALYSIS_PROJECT_REVISION_VERSION = 1;
/** Cooperative lock directory used by project-editing processes. */
export declare const ANALYSIS_PROJECT_LOCK_DIRECTORY = ".uttori-asm-analysis.lock";
/** Default age after which a lock owned by a dead process may be recovered. */
export declare const DEFAULT_ANALYSIS_PROJECT_LOCK_STALE_MS: number;
/** One shard identity included in an observed project revision. */
export interface AnalysisProjectShardRevision {
    readonly id: string;
    readonly kind: ShardKind;
    readonly path: string;
    readonly sha256: string;
    readonly records: number;
}
/**
 * Optimistic-concurrency token for one fully validated project snapshot.
 * The manifest hash detects every descriptor change; shard identities remain explicit for auditing.
 */
export interface AnalysisProjectRevision {
    readonly format: typeof ANALYSIS_PROJECT_REVISION_FORMAT;
    readonly version: typeof ANALYSIS_PROJECT_REVISION_VERSION;
    readonly manifestSha256: string;
    readonly shards: readonly AnalysisProjectShardRevision[];
}
/** A validated project and the exact manifest/shard revision observed while loading it. */
export interface AnalysisProjectSnapshot extends LoadedAnalysisProject {
    readonly revision: AnalysisProjectRevision;
}
/** Immutable shard generation prepared without changing the active project manifest. */
export interface PreparedAnalysisProjectTransaction {
    readonly format: "uttori-asm-analysis-transaction";
    readonly version: 1;
    readonly generation: string;
    readonly manifest: AnalysisProjectManifest;
}
/** Result of atomically publishing a prepared transaction. */
export interface CommittedAnalysisProjectTransaction {
    readonly manifest: AnalysisProjectManifest;
    readonly revision: AnalysisProjectRevision;
}
/** Lock tuning and deterministic seams used by hosts and crash-safety tests. */
export interface AnalysisProjectLockOptions {
    readonly staleLockMilliseconds?: number;
    readonly recoveryAttempts?: number;
    readonly now?: () => number;
    readonly processIsAlive?: (processId: number) => boolean;
}
/** A cooperative writer already owns the project lock. */
export declare class AnalysisProjectLockedError extends Error {
    readonly ownerProcessId?: number;
    constructor(directory: string, ownerProcessId?: number);
}
/** The active manifest changed after a caller loaded its project snapshot. */
export declare class AnalysisProjectStaleError extends Error {
    readonly expected: AnalysisProjectRevision;
    readonly actual: AnalysisProjectRevision;
    constructor(expected: AnalysisProjectRevision, actual: AnalysisProjectRevision);
}
/**
 * Loads one stable project snapshot. A manifest changing during validation is retried rather than
 * pairing records from one generation with the revision of another.
 * @param {string} directory Native analysis-project directory.
 * @returns {AnalysisProjectSnapshot} Validated project plus its optimistic revision.
 */
export declare const loadAnalysisProjectSnapshot: (directory: string) => AnalysisProjectSnapshot;
/**
 * Writes and fsyncs a canonical content-addressed shard generation. The active manifest is not
 * touched, so an interruption after this step leaves the previously committed project loadable.
 * @param {string} directory Native analysis-project directory.
 * @param {AnalysisProject} project Complete replacement project to prepare.
 * @returns {PreparedAnalysisProjectTransaction} Immutable generation ready for publication.
 */
export declare const prepareAnalysisProjectTransaction: (directory: string, project: AnalysisProject) => PreparedAnalysisProjectTransaction;
/**
 * Publishes a prepared generation under an exclusive cooperative lock. The observed revision is
 * checked only after acquiring the lock, and `analysis.json` is the sole atomic replacement.
 * @param {string} directory Native analysis-project directory.
 * @param {AnalysisProjectRevision} expected Revision observed by the editing client.
 * @param {PreparedAnalysisProjectTransaction} prepared Immutable generation to publish.
 * @param {AnalysisProjectLockOptions} [options] Lock recovery policy and host seams.
 * @returns {CommittedAnalysisProjectTransaction} Published manifest and new revision.
 */
export declare const commitPreparedAnalysisProjectTransaction: (directory: string, expected: AnalysisProjectRevision, prepared: PreparedAnalysisProjectTransaction, options?: AnalysisProjectLockOptions) => CommittedAnalysisProjectTransaction;
/**
 * Prepares and atomically commits a complete project replacement.
 * @param {string} directory Native analysis-project directory.
 * @param {AnalysisProjectRevision} expected Revision observed by the editing client.
 * @param {AnalysisProject} project Complete replacement project.
 * @param {AnalysisProjectLockOptions} [options] Lock recovery policy and host seams.
 * @returns {CommittedAnalysisProjectTransaction} Published manifest and new revision.
 */
export declare const commitAnalysisProjectTransaction: (directory: string, expected: AnalysisProjectRevision, project: AnalysisProject, options?: AnalysisProjectLockOptions) => CommittedAnalysisProjectTransaction;
//# sourceMappingURL=project-transaction.d.ts.map