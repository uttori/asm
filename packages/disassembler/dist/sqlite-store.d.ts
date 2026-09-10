import { type AnalysisProjectManifest, type AnalysisProjectShards, type RuntimeEvidenceRecord, type ShardKind } from "./project-types.js";
import type { RuntimeTraceFactIndex } from "./runtime-trace.js";
/** On-disk sqlite filename stored in `analysis.json` `db`. */
export declare const ANALYSIS_PROJECT_SQLITE_FILE = "analysis.sqlite";
/**
 * Resolves the sqlite file for a project pointer.
 * @param {string} directory Project root containing analysis.json.
 * @param {Pick<AnalysisProjectManifest, "db">} manifest Validated pointer.
 * @returns {string} Absolute sqlite path.
 */
export declare const analysisProjectSqlitePath: (directory: string, manifest: Pick<AnalysisProjectManifest, "db">) => string;
/**
 * Columnar sqlite working store for one analysis project.
 */
export declare class SqliteAnalysisStore {
    #private;
    readonly file: string;
    /**
     * Opens or creates a project database.
     * @param {string} file Absolute sqlite path.
     * @param {boolean} [createSchema] Whether to apply DDL.
     */
    constructor(file: string, createSchema?: boolean);
    /**
     * Preserve the triggering error when SQLite has already aborted (for example SQLITE_FULL).
     * A cleanup error must never replace the original failure reported to the user.
     */
    rollback(): void;
    /**
     * Run a synchronous unit against one SQLite snapshot. Writers acquire their lock before reading
     * the revision so a competing process cannot slip between the stale check and publication.
     * @param {Function} action Synchronous work; cursors must be consumed before returning.
     * @param {boolean} [write] Acquire the writer lock immediately; false creates a read snapshot.
     * @returns {T} Callback result after a successful commit.
     */
    transaction<T>(action: () => T, write?: boolean): T;
    /**
     * Index trace chunks in a connection-local disk table. This transaction never reads or writes
     * main, allowing other project writers to proceed during asynchronous capture parsing.
     * @param {Function} action Async parser using only the supplied temporary counter index.
     * @returns {Promise} Parser result after temporary counters commit; the index lives until connection close.
     */
    indexTrace<T>(action: (index: RuntimeTraceFactIndex) => Promise<T>): Promise<T>;
    /**
     * Replace only supplied tables, retaining byte-identical rows. The temporary ID set bounds
     * memory and deletes removed rows without rewriting unchanged metadata or runtime history.
     * Semantic validation belongs to the project publication API; this method must run in its transaction.
     * @param {Partial<AnalysisProjectShards>} shards Validated replacements for explicitly named tables.
     */
    replaceTables(shards: Partial<AnalysisProjectShards>): void;
    /**
     * Insert a content-addressed runtime fact once; an ID collision with different content is an
     * error, never a silent no-op. Count values are already aggregated within the source capture.
     * @param {RuntimeEvidenceRecord} record Fully aggregated fact with a source-derived stable ID.
     * @returns {boolean} True when inserted; identical facts return false and conflicting facts throw.
     */
    insertRuntime(record: RuntimeEvidenceRecord): boolean;
    /** Reject evidence removal that would leave retained runtime facts orphaned, without loading them. */
    validateRuntimeEvidence(): void;
    /**
     * Store manifest and counter in the same transaction as the changed records.
     * @param {object} manifest Semantic project identity for this publication.
     * @returns {AnalysisProjectManifest} Manifest containing the incremented counter.
     */
    publishManifest(manifest: Omit<AnalysisProjectManifest, "shards">): AnalysisProjectManifest;
    /**
     * Current publication counter.
     * @returns {number} Stored revision.
     */
    revision(): number;
    /**
     * Manifest stored in meta, including sqlite pointer fields.
     * @returns {AnalysisProjectManifest} Pointer manifest.
     */
    manifest(): AnalysisProjectManifest;
    /**
     * Stream only requested runtime kinds, avoiding raw-row and decoded-row arrays on the JS heap.
     * @param {Array} kinds Runtime discriminators to include; empty selects nothing.
     * @returns {IterableIterator} Cursor consumed within the owning read transaction.
     * @yields {RuntimeEvidenceRecord} One matching decoded fact.
     */
    runtimeRecordsByKinds(kinds: readonly RuntimeEvidenceRecord["kind"][]): IterableIterator<RuntimeEvidenceRecord>;
    /**
     * Read runtime observations at a selected location, including containing coverage ranges.
     * @param {string} addressSpace Logical address-space ID.
     * @param {number} address Nonnegative address in that space.
     * @returns {IterableIterator} Cursor over matching point and interval facts.
     * @yields {RuntimeEvidenceRecord} A fact associated with the selected location.
     */
    runtimeAt(addressSpace: string, address: number): IterableIterator<RuntimeEvidenceRecord>;
    /**
     * Stream runtime facts without retaining the complete table.
     * @returns {IterableIterator<RuntimeEvidenceRecord>} One reconstructed runtime row at a time.
     * @yields {RuntimeEvidenceRecord} One runtime fact.
     */
    runtimeRecords(): IterableIterator<RuntimeEvidenceRecord>;
    /**
     * Read one metadata table directly; Sources must not load unrelated CFG or runtime tables.
     * @param {string} kind Metadata table name from the semantic collection contract.
     * @returns {Array} Decoded metadata in deterministic display order.
     */
    loadTable<K extends Exclude<ShardKind, "runtime">>(kind: K): AnalysisProjectShards[K];
    /**
     * Materialize metadata once; full runtime history is opt-in for callers that need it.
     * @param {boolean} [runtime] Include complete runtime history; false keeps it on disk.
     * @returns {AnalysisProjectShards} Decoded record arrays owned by the caller.
     */
    loadShards(runtime?: boolean): AnalysisProjectShards;
    /**
     * Table counts for reports.
     * @returns {Readonly<Record<string, number>>} Row counts.
     */
    counts(): Readonly<Record<string, number>>;
    /**
     * Atomically refresh the watcher hint after commit. SQLite is authoritative: a failed hint write
     * is reported as a warning, never as a failed import that could cause an unsafe retry.
     * @param {string} directory Project root for the watcher hint.
     */
    writePointer(directory: string): void;
    /** Checkpoint and reclaim unused SQLite pages; run only during explicit storage maintenance. */
    compact(): void;
    /** Close prepared statements and the database. */
    close(): void;
}
//# sourceMappingURL=sqlite-store.d.ts.map