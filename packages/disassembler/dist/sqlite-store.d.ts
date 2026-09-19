import { type AnalysisSourceGroup } from "./analysis-sources.js";
import { type ProjectEvidenceExplanation } from "./project-edit.js";
import { type AnalysisProjectManifest, type AnalysisProjectShards, type AnalysisRecord, type ImportReport, type RuntimeEvidenceRecord, type ShardKind } from "./project-types.js";
import { type RuntimeEvidenceBatch, type RuntimeEvidenceConflict } from "./runtime-evidence.js";
import type { RuntimeTraceFactIndex } from "./runtime-trace.js";
import { type AnnotationQueryRange, type SqliteAnnotationView, type InstructionExportRecord } from "./sqlite-annotation-query.js";
import { type AnalysisStoragePolicy } from "./sqlite-storage-policy.js";
import { type TraceIndexMetrics } from "./trace-cache.js";
/** On-disk sqlite filename stored in `analysis.json` `db`. */
export declare const ANALYSIS_PROJECT_SQLITE_FILE = "analysis.sqlite";
/** Physical SQLite layout version, independent of semantic manifest schema and edit revisions. */
export declare const ANALYSIS_SQLITE_STORAGE_VERSION = 2;
/**
 * Resolves the sqlite file for a project pointer.
 * @param {string} directory Project root containing analysis.json.
 * @param {Pick<AnalysisProjectManifest, "db">} manifest Validated pointer.
 * @returns {string} Joined sqlite path; relative directories remain relative to process cwd.
 */
export declare const analysisProjectSqlitePath: (directory: string, manifest: Pick<AnalysisProjectManifest, "db">) => string;
/**
 * Owned synchronous SQLite connection for one project. Close it once in finally; do not share a
 * connection across overlapping operations. Queries decode records but do not all validate them.
 * Use project snapshot/publication helpers for semantic validation and revision-checked edits.
 * Low-level mutations require a transaction and do not publish a revision or refresh the pointer
 * automatically. WAL readers can retain old snapshots and delay checkpoint/truncation.
 */
export declare class SqliteAnalysisStore {
    #private;
    /** Database path as supplied at construction; resolves relative to cwd when not absolute. */
    readonly file: string;
    /**
     * Opens or creates a project database.
     * Opening validates physical format, not every semantic record, and may create SQLite journal files.
     * Connections use a 5,000 ms busy timeout; lock contention can still throw a SQLite error.
     * @param {string} file SQLite path; parent directory must already exist.
     * @param {boolean} [createSchema] Defaults to true; permit initialization of an empty database, never upgrade an existing one.
     * @param {boolean} [deferIndexes] Defaults to false; migration-only bulk load, completed by finishMigration.
     */
    constructor(file: string, createSchema?: boolean, deferIndexes?: boolean);
    /**
     * Preserve the triggering error when SQLite has already aborted (for example SQLITE_FULL).
     * A cleanup error must never replace the original failure reported to the user.
     */
    rollback(): void;
    /**
     * Run a synchronous unit against one SQLite snapshot. Writers acquire their lock before reading
     * the revision so a competing process cannot slip between the stale check and publication.
     * Throwing rolls back records and manifest changes. Promise/thenable results are rejected; perform
     * async preparation before entering. Transactions cannot nest. Low-level callbacks must publish
     * the manifest themselves when changing semantic records; prefer the commitAnalysisProject APIs.
     * @param {Function} action Synchronous work; cursors must be consumed before returning.
     * @param {boolean} [write] Defaults to true (BEGIN IMMEDIATE); false uses deferred BEGIN for reads, not an enforced read-only connection.
     * @returns {T} Callback result after a successful commit.
     */
    transaction<T>(action: () => T & (T extends PromiseLike<unknown> ? never : unknown), write?: boolean): T;
    /**
     * Index trace chunks in a connection-local disk table. This transaction never reads or writes
     * main, allowing other project writers to proceed during asynchronous capture parsing.
     * @param {Function} action Async parser using only the supplied temporary counter index.
     * @param {TraceIndexMetrics} metrics Optional caller-owned diagnostic counters.
     * @returns {Promise} Parser result after temporary counters commit; the index lives until connection close.
     */
    indexTrace<T>(action: (index: RuntimeTraceFactIndex) => Promise<T>, metrics?: TraceIndexMetrics): Promise<T>;
    /** Apply a selected metadata edit by stable ID; omitted records are never deleted.
     * Validation and optimistic revision checks belong to the publication API.
     * @param {AnalysisProjectShards} before Original selected view.
     * @param {AnalysisProjectShards} after Edited selected view.
     */
    patchMetadata(before: AnalysisProjectShards, after: AnalysisProjectShards): void;
    /**
     * Replace only supplied tables, retaining byte-identical rows. The temporary ID set bounds
     * memory and deletes removed rows without rewriting unchanged metadata or runtime history.
     * Semantic validation belongs to the project publication API; this method must run in its transaction.
     * @param {Partial<AnalysisProjectShards>} shards Validated replacements for explicitly named tables.
     */
    replaceTables(shards: Partial<AnalysisProjectShards>): void;
    /**
     * Append validated migration rows without materializing a complete table. Runtime IDs are checked
     * through the logical view because paired states share physical storage with an instruction.
     * @param {ShardKind} kind Destination semantic table.
     * @param {Iterable} records Bounded batch or lazy cursor; uniqueness is enforced by SQLite.
     */
    appendRecords<K extends ShardKind>(kind: K, records: Iterable<AnalysisProjectShards[K][number]>): void;
    /**
     * Insert a content-addressed runtime fact once; an ID collision with different content is an
     * error, never a silent no-op. Count values are already aggregated within the source capture.
     * @param {RuntimeEvidenceRecord} record Fully aggregated fact with a source-derived stable ID.
     * @returns {boolean} True when inserted; identical facts return false and conflicting facts throw.
     */
    insertRuntime(record: RuntimeEvidenceRecord): boolean;
    /** Prepare a unique-record batch in one source namespace, inside the publication transaction.
     * New namespaces need no per-record existence query; SQL uniqueness still rejects repeated IDs.
     * Existing/partially pruned sources use full idempotency and collision checks for every record.
     * The callback must not escape its transaction; any insertion error must abort the whole batch.
     * @param {string} prefix Exact ID prefix including its final colon.
     * @returns {Function} Transaction-scoped inserter for validated records with unique suffixes.
     */
    runtimeBatchInserter(prefix: string): (record: RuntimeEvidenceRecord) => boolean;
    /** Reject evidence removal that would leave retained runtime facts orphaned, without loading them. */
    validateRuntimeEvidence(): void;
    /**
     * Store manifest and counter in the same transaction as the changed records.
     * @param {object} manifest Semantic project identity for this publication.
     * @returns {AnalysisProjectManifest} Manifest containing the incremented counter.
     */
    publishManifest(manifest: Omit<AnalysisProjectManifest, "shards">): AnalysisProjectManifest;
    /**
     * Current publication counter, or zero before initial publication. It is not a schema version.
     * Read it with related records inside transaction to retain one consistent snapshot.
     * @returns {number} Stored revision.
     */
    revision(): number;
    /**
     * Authoritative manifest stored in SQLite, including pointer fields. Throws before initial publication.
     * Use a transaction when combining it with other reads; this does not validate the entire project.
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
     * Stream runtime facts without retaining the complete table. Consume before the owning transaction
     * returns or the connection closes; an escaped iterator does not preserve its original snapshot.
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
    /** Validate a query view against this read snapshot, including every included provenance reference.
     * @param {AnalysisProjectShards} shards Selected records, with unused collections empty.
     */
    validateView(shards: AnalysisProjectShards): void;
    /** Merge an already-parsed offline batch by stable IDs without loading saved runtime history.
     * The caller owns revision checking and publication in the surrounding writer transaction.
     * @param {RuntimeEvidenceBatch} batch Imported facts and metadata.
     * @returns {object} Whether anything changed and per-collection additions/updates.
     */
    mergeEvidenceBatch(batch: RuntimeEvidenceBatch): {
        changed: boolean;
        added: {
            runtime: number;
            analysis: number;
            annotations: number;
            comments: number;
            evidence: number;
            imports: number;
            labels: number;
            regions: number;
        };
        updated: Readonly<Record<keyof AnalysisProjectShards, number>>;
    };
    /** Produce an explicit complete evidence report one qualified PC at a time.
     * Only report output accumulates; unused instruction/memory histories and CFG contexts are never loaded.
     * @returns {object} Runtime record count, conflicts, and metadata explanations.
     */
    inspectEvidence(): {
        runtimeRecords: number;
        conflicts: RuntimeEvidenceConflict[];
        explanations: readonly import("./runtime-evidence.js").RuntimeEvidenceExplanation[];
    };
    /** Select record choices before decoding; explicit IDs bypass unrelated history entirely.
     * @param {Partial<Record<ShardKind, readonly string[]>>} [selected] Exact context record IDs; omitted lists the first 200 records per collection.
     * @returns {AnalysisProjectShards} Bounded choice view and complete small provenance catalog.
     */
    evidenceChoices(selected?: Partial<Record<ShardKind, readonly string[]>>): AnalysisProjectShards;
    /** Explain one record with an exact reference count and a bounded reverse-reference preview.
     * @param {ShardKind} kind Selected collection.
     * @param {string} id Stable semantic record ID.
     * @returns {ProjectEvidenceExplanation} Full direct provenance/conflicts, at most 200 reverse links.
     */
    explainEvidence(kind: ShardKind, id: string): ProjectEvidenceExplanation;
    /** Exact coverage totals; build only when classifications, code, or runtime facts changed.
     * @returns {object} Persisted summary and detail count.
     */
    coverageSummary(): import("./sqlite-coverage-query.js").SqliteCoverageSummary;
    /** Read at most 200 coverage rows from a current projection.
     * @param {"segments" | "details"} kind Collection to page.
     * @param {number} offset Nonnegative row offset.
     * @returns {unknown[]} Persisted rows, never the full ROM map.
     */
    coveragePage(kind: "segments" | "details", offset?: number): unknown[];
    /** Persisted call graph plus current labels, without retaining CFG contexts between requests.
     * @returns {object} Functions, calls, unresolved sites, and ownership.
     */
    callGraph(): {
        calls: readonly import("./analysis-graph.ts").AnalysisCallGraphEdge[];
        unresolved: readonly import("./analysis-graph.ts").AnalysisCallGraphUnresolved[];
        orphanCallIds: readonly string[];
        orphanUnresolvedIds: readonly string[];
        functions: {
            id: string;
            addressSpace: string;
            address: number;
            source: string;
            nodeIds: readonly string[];
            outputOffsets: readonly number[];
            incomingCallIds: readonly string[];
            outgoingCallIds: readonly string[];
            unresolvedIds: readonly string[];
            evidence: readonly string[];
            labels: {
                id: string;
                name: string;
            }[];
        }[];
    };
    /** Cache a compact target-specific result; callers declare every persisted input it consumes.
     * Computation uses a deferred transaction so expensive analysis does not hold the writer lock.
     * Concurrent input changes discard cache publication; results still belong to one read snapshot.
     * @param {string} key Internal stable query name.
     * @param {string} signature Layout/configuration fingerprint.
     * @param {readonly ShardKind[]} dependencies Source collections.
     * @param {Function} compute Synchronous reader; must not open another transaction.
     * @param {Function} [publish] Optional short SQL publication for derived rows built in temporary tables.
     * @returns {T} Current projected value.
     */
    cachedProjection<T>(key: string, signature: string, dependencies: readonly ShardKind[], compute: () => T & (T extends PromiseLike<unknown> ? never : unknown), publish?: () => void): T;
    /** CPU architectures at one PC from indexed scalar columns; register payloads are untouched.
     * @param {string} space Exact logical address space.
     * @param {number} address Instruction address.
     * @returns {string[]} Distinct observed architecture IDs.
     */
    runtimeArchitecturesAt(space: string, address: number): string[];
    /** Build distinct processor/location hints once instead of rescanning hot-PC register rows per function. */
    prepareRuntimeArchitectures(): void;
    /** Select a bounded CFG navigation window through its address index.
     * @param {string} space Exact logical address space.
     * @param {number} address Selected PC.
     * @param {readonly string[]} architectures Optional specification prefixes.
     * @returns {AnalysisRecord[]} Four preceding and 28 following variants, in address order.
     */
    navigationNodes(space: string, address: number, architectures: readonly string[]): AnalysisRecord[];
    /** Explicit known-code intervals, grouped in SQL for the incomplete-analysis preservation guard.
     * @returns {Array} Half-open ROM-content intervals.
     */
    codeRanges(): {
        start: number;
        end: number;
    }[];
    /** Select processor MMIO observations before decoding payloads.
     * @param {string} architecture Exact runtime architecture.
     * @param {string} space Instruction and accessed logical space.
     * @param {readonly number[]} addresses Exact hardware addresses, including target-approved mirrors.
     * @returns {IterableIterator<RuntimeEvidenceRecord>} SQL-grouped observations; counts/provenance stay exact.
     * @yields {RuntimeEvidenceRecord} One role-relevant access variant.
     */
    runtimeMemoryAtAddresses(architecture: string, space: string, addresses: readonly number[]): IterableIterator<RuntimeEvidenceRecord>;
    /** Decode-state variants aggregated in SQL; raw register histories never become a JS array.
     * The signature includes the ordered state fields and architecture. Aliases remain distinct so
     * the target decoder retains its original precedence and validation rules.
     * @param {string} architecture Exact instruction architecture.
     * @param {string} space Exact instruction address space.
     * @param {readonly string[]} stateFields Only fields the target decoder consumes, including aliases.
     * @param {Readonly<Record>} masks Optional decoder bit masks, applied only to valid nonnegative integers up to max.
     * @returns {IterableIterator<RuntimeEvidenceRecord>} SQL cursor over compact variants with exact per-evidence counts.
     * Prepare before starting the consuming read transaction.
     */
    runtimeInstructionVariants(architecture: string, space: string, stateFields: readonly string[], masks?: Readonly<Record<string, {
        readonly max: number;
        readonly mask: number;
    }>>): IterableIterator<RuntimeEvidenceRecord>;
    /** Exact execution seed totals grouped by PC and provenance, without decoding execution payloads.
     * @param {string} architecture Target processor.
     * @param {string} space Logical CPU address space.
     * @returns {RuntimeEvidenceRecord[]} Execution facts reduced to the fields used for seed selection.
     */
    runtimeExecutionSeeds(architecture: string, space: string): RuntimeEvidenceRecord[];
    /** Build additive query indexes once, then refresh only rows invalidated by project writes. */
    prepareAnnotationQueries(): void;
    /** Prepare direct source attribution indexes without decoding runtime payloads. */
    prepareSourceQueries(): void;
    /** Validated source identities from small catalog tables in the caller's read snapshot.
     * @returns {object} Manifest and sources ordered by their most recent successful import.
     */
    sourceCatalog(): {
        manifest: AnalysisProjectManifest;
        sources: readonly import("./analysis-sources.js").AnalysisEvidenceSource[];
    };
    /** Exact SQL counts for a catalog source; no baseline or inferred static execution.
     * @param {string} sourceId Catalog source ID.
     * @returns {object} Manifest and source counts.
     */
    sourceSummary(sourceId: string): {
        manifest: AnalysisProjectManifest;
        summary: import("./analysis-sources.js").AnalysisSourceSummary;
    };
    /** At most 200 SQL-selected contribution rows, decoded within the caller's read transaction.
     * @param {string} sourceId Catalog source ID.
     * @param {AnalysisSourceGroup} group Contribution category.
     * @param {number} offset Nonnegative page offset.
     * @returns {Array} Bounded source records.
     */
    sourcePage(sourceId: string, group: AnalysisSourceGroup, offset?: number): import("./analysis-sources.js").AnalysisSourceEntry[];
    /**
     * Read names, comments and provenance for editing without materializing instruction variants.
     * @returns {object} Validated editing metadata from the caller's read transaction.
     */
    annotationEditView(): {
        manifest: AnalysisProjectManifest;
        shards: AnalysisProjectShards;
    };
    /** Small export metadata; instruction candidates are supplied separately by an ordered SQL cursor.
     * @returns {object} Validated manifest, metadata, and an empty runtime collection.
     */
    sourceExportView(): {
        manifest: AnalysisProjectManifest;
        shards: AnalysisProjectShards;
    };
    /**
     * Stream one file-offset group at a time; do not retain the complete CFG to plan source.
     * The caller prepares annotation indexes first and owns a read transaction until iteration ends.
     * @returns {IterableIterator<readonly InstructionExportRecord[]>} All variants at each explicit output offset.
     * @yields {readonly InstructionExportRecord[]} One complete group, without clipping variants.
     */
    instructionExportGroups(): IterableIterator<readonly InstructionExportRecord[]>;
    /**
     * Read and validate only the requested instruction metadata and bounded runtime details.
     * @param {readonly AnnotationQueryRange[]} ranges Exact visible source/debugger coordinates.
     * @returns {SqliteAnnotationView} Small view; consume inside the caller's read transaction.
     */
    instructionAnnotationView(ranges: readonly AnnotationQueryRange[]): SqliteAnnotationView;
    /**
     * Read selected metadata kinds through the address index instead of loading the complete CFG.
     * @param {readonly AnalysisRecord["kind"][]} kinds Analysis discriminators to include.
     * @returns {AnalysisRecord[]} Matching rows in stable ID order.
     */
    analysisByKinds(kinds: readonly AnalysisRecord["kind"][]): AnalysisRecord[];
    /**
     * Resolve an edit boundary to representative CFG nodes, one per qualified location.
     * Call after preparing query indexes and consume inside a read transaction.
     * @param {string} addressSpace Exact debug-map/native address space.
     * @param {number} address Instruction start in that space.
     * @param {number} [outputOffset] Optional explicit file offset, never an inferred mapper alias.
     * @returns {AnalysisProjectShards["analysis"]} Location representatives; state variants need not be loaded to edit a comment.
     */
    annotationNodesAt(addressSpace: string, address: number, outputOffset?: number): AnalysisProjectShards["analysis"];
    /**
     * Stream decoded records in insertion order for migration digest verification.
     * @param {ShardKind} kind Semantic table to traverse.
     * @returns {IterableIterator} Cursor retaining only the current decoded record.
     * @yields {object} Original semantic record.
     */
    records<K extends ShardKind>(kind: K): IterableIterator<AnalysisProjectShards[K][number]>;
    /**
     * Initialize a migrated project's unchanged logical identity once, inside its first publication.
     * @param {AnalysisProjectManifest} manifest Validated authoritative source manifest and revision.
     */
    initializeMigratedManifest(manifest: AnalysisProjectManifest): void;
    /**
     * Build deferred indexes and check all physical structures before closing a staged migration file.
     * Switching through DELETE verifies that no staging reader retains a WAL dependency; the closed
     * file retains WAL mode for ordinary clients, with all committed pages checkpointed into main.
     */
    finishMigration(): void;
    /**
     * Materialize complete record arrays without semantic validation. Run inside a read transaction.
     * @param {boolean} [runtime] Defaults to true; false omits runtime and must not be treated as a complete replacement.
     * @returns {AnalysisProjectShards} Decoded record arrays owned by the caller.
     */
    loadShards(runtime?: boolean): AnalysisProjectShards;
    /**
     * Table counts for reports.
     * @returns {Readonly<Record<string, number>>} Row counts.
     */
    counts(): Readonly<Record<string, number>>;
    /**
     * Count analysis kinds without inflating or parsing their compressed payloads.
     * @returns {Readonly<Record<string, number>>} Counts by analysis record discriminator.
     */
    analysisCounts(): Readonly<Record<string, number>>;
    /**
     * Summarize per-PC execution facts using stored columns, without reading register history.
     * @returns {object} Fact count and total observed executions in the owning transaction.
     */
    runtimeExecutionCounts(): {
        records: number;
        events: number;
    };
    /**
     * Atomically refresh the watcher hint after commit. SQLite is authoritative: a failed hint write
     * is reported as a warning, never as a failed import that could cause an unsafe retry.
     * @param {string} directory Project root for the watcher hint.
     */
    writePointer(directory: string): void;
    /** Checkpoint and reclaim unused SQLite pages; run only during explicit storage maintenance. */
    compact(): void;
    /** Current persisted policy; defaults do not write or change the semantic revision.
     * @returns {AnalysisStoragePolicy} Validated defaults and persisted overrides.
     */
    storagePolicy(): AnalysisStoragePolicy;
    /** Update only explicit policy fields in the caller's writer transaction.
     * @param {Partial<AnalysisStoragePolicy>} patch Explicit limits, in bytes/days/counts.
     * @returns {AnalysisStoragePolicy} Complete policy saved without changing the edit revision.
     */
    setStoragePolicy(patch: Partial<AnalysisStoragePolicy>): AnalysisStoragePolicy;
    /** Storage accounting avoids decoding runtime or analysis payloads.
     * @returns {object} Physical allocation and logical retention counts.
     */
    storageSnapshot(): import("./sqlite-storage-policy.js").AnalysisStorageSnapshot;
    /** Optional projection allocation, including secondary indexes; reserved for explicit accounting.
     * @returns {number} Allocated cache bytes, excluding permanent editor/export indexes.
     */
    storageCacheBytes(): number;
    /** Durable receipt lookup survives source-file removal and cache eviction.
     * @param {string} sha256 Canonical capture identity.
     * @returns {object | undefined} Retained import identity and counts.
     */
    captureReceipt(sha256: string): Record<string, import("node:sqlite").SQLOutputValue> | undefined;
    /** Catalog rows contain small import provenance metadata, never capture contents.
     * @returns {object[]} Small capture metadata rows in import order.
     */
    captureCatalog(): Record<string, import("node:sqlite").SQLOutputValue>[];
    /** Record the first successful import atomically with its facts; reimports only refresh last-seen time.
     * @param {ImportReport} report Successfully validated native trace import.
     */
    recordCaptureReceipt(report: ImportReport): void;
    /** Drop disposable projections after publication, then recycle WAL without waiting on active readers.
     * @returns {object} Cache eviction totals and whether readers delayed WAL truncation.
     */
    maintainStorage(): {
        evicted: readonly string[];
        cacheBytes: number;
        checkpointBusy: boolean;
    };
    /** Close once in finally, releasing statements and any active transaction. Further use throws. */
    close(): void;
}
//# sourceMappingURL=sqlite-store.d.ts.map