import { type AnalysisSourceGroup } from "../analysis/analysis-sources.js";
import { type ProjectEvidenceExplanation } from "../analysis/project-evidence.js";
import { type TraceIndexMetrics } from "../internal/trace-cache.js";
import { type AnalysisProjectManifest, type AnalysisProjectShards, type AnalysisRecord, type ImportReport, type RuntimeEvidenceRecord, type ShardKind } from "../model/project-types.js";
import { type ResearchSnapshot } from "../research-inputs/inputs.js";
import { type RuntimeEvidenceBatch, type RuntimeEvidenceConflict } from "../runtime/runtime-evidence.js";
import type { RuntimeTraceFactIndex } from "../runtime/runtime-trace.js";
import { type InstructionExecutionSummaryRow, type AnnotationQueryRange, type SqliteAnnotationView, type InstructionExportRecord } from "./sqlite-annotation-query.js";
import { type GraphicsEvidenceQuery } from "./sqlite-graphics-query.js";
import { type RuntimeTracePublicationSink } from "./sqlite-runtime-batch.js";
import { type AnalysisStoragePolicy } from "./sqlite-storage-policy.js";
import type { SqliteTraceStage } from "./sqlite-trace-stage.js";
/** On-disk sqlite filename stored in `analysis.json` `db`. */
export declare const ANALYSIS_PROJECT_SQLITE_FILE = "analysis.sqlite";
/** Physical SQLite layout version, independent of semantic manifest schema and edit revisions. */
export declare const ANALYSIS_SQLITE_STORAGE_VERSION = 4;
/**
 * Lookup parameters are the external prefix and binary/text suffix. Resolve both dictionaries
 * before probing observations: filtering the logical view by external ID otherwise scans every
 * observation in that capture, making a growing import quadratic. Full suffix equality protects
 * against truncated hash-key collisions. Signed rowids retain paired-state and deletion semantics.
 */
export declare const RUNTIME_RECORD_LOOKUP_SQL: string;
/**
 * Resolves the sqlite file for a project pointer.
 * @param directory Project root containing analysis.json.
 * @param manifest Validated pointer.
 * @returns Joined sqlite path. Relative directories remain relative to process cwd.
 */
export declare const analysisProjectSqlitePath: (directory: string, manifest: Pick<AnalysisProjectManifest, "db">) => string;
/**
 * Owned synchronous SQLite connection for one project. Close it once in finally. Do not share a
 * connection across overlapping operations. Queries decode records but do not all validate them.
 * Use project snapshot/publication helpers for semantic validation and revision-checked edits.
 * Low-level mutations require a transaction and do not publish a revision or refresh the pointer
 * automatically. WAL readers can retain old snapshots and delay checkpoint/truncation.
 */
export declare class SqliteAnalysisStore {
    #private;
    /** Database path as supplied at construction. Resolves relative to cwd when not absolute. */
    readonly file: string;
    /**
     * Opens or creates a project database.
     * Opening validates physical format, not every semantic record, and may create SQLite journal files.
     * Connections use a 5,000 ms busy timeout. Lock contention can still throw a SQLite error.
     * @param file SQLite path. Parent directory must already exist.
     * @param [createSchema] Defaults to true. Permit initialization of an empty database, never upgrade an existing one.
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
     * Throwing rolls back records and manifest changes. Promise/thenable results are rejected. Perform
     * async preparation before entering. Transactions cannot nest. Low-level callbacks must publish
     * the manifest themselves when changing semantic records. Prefer the commitAnalysisProject APIs.
     * @param action Synchronous work. Cursors must be consumed before returning.
     * @param [write] Defaults to true (BEGIN IMMEDIATE). False uses deferred BEGIN for reads, not an enforced read-only connection.
     * @returns Callback result after a successful commit.
     */
    transaction<T>(action: () => T, write?: boolean): T;
    /**
     * Index trace chunks in temporary or privately staged disk counters. This transaction never
     * reads or writes the destination project, allowing other writers during asynchronous parsing.
     * @param action Async parser using only the supplied counter index.
     * @param metrics Optional caller-owned diagnostic counters.
     * @param stage Optional private counters retained across publication failures.
     * @returns Parser result after counters commit. Staged counters survive connection close.
     */
    indexTrace<T>(action: (index: RuntimeTraceFactIndex) => Promise<T>, metrics?: TraceIndexMetrics, stage?: SqliteTraceStage): Promise<T>;
    /**
     * Apply a selected metadata edit by stable ID. Omitted records are never deleted.
     * Validation and optimistic revision checks belong to the publication API.
     * @param before Original selected view.
     * @param after Edited selected view.
     */
    patchMetadata(before: AnalysisProjectShards, after: AnalysisProjectShards): void;
    /**
     * Rebuild the selected Git research index, without loading runtime history or the CFG. A matching
     * revision is a constant-time no-op. Call inside a transaction and publish the watcher afterward.
     * Research files remain authoritative if the process exits before this cache is refreshed.
     */
    synchronizeResearchInputs(snapshot: ResearchSnapshot): boolean;
    /** Selected Git decision identity for callers pinning a consistent evidence/read snapshot. */
    researchInputsIdentity(): string | undefined;
    /** Cheap read-only cache check; callers recheck identity/revision after consuming query results. */
    researchInputsAreCurrent(sha256: string): boolean;
    /** Observations stay usable while derived code is stale; generation and graph views require reanalysis. */
    assertCurrentAnalysis(): void;
    /** Invalidate derived code within the same transaction that adds new observations. */
    invalidateAnalysis(): void;
    /** Restore observations inside an import transaction; reapply the selected research before commit. */
    suspendResearchInputs(): void;
    /**
     * Publish analyzer output computed from the projected view without adopting Git decisions as
     * imported facts. Overridden IDs retain their observation shadows; removing a decision on a
     * later branch therefore restores the original record. Return the exact projected replacements
     * for validation without reparsing a million-row graph into a second set of JS objects.
     * An optional base view must belong to the revision checked under this writer lock. Its unchanged
     * collections combine with the projected replacements for the same complete publication validation.
     */
    replaceResearchAnalysis(snapshot: ResearchSnapshot, updates: Partial<Pick<AnalysisProjectShards, "analysis" | "annotations" | "comments" | "evidence">>, onProgress?: (collection: string) => void, baseView?: AnalysisProjectShards): Partial<Pick<AnalysisProjectShards, "analysis" | "annotations" | "comments" | "evidence">>;
    /**
     * Replace only supplied tables, retaining byte-identical rows. The temporary ID set bounds
     * memory and deletes removed rows without rewriting unchanged metadata or runtime history.
     * Semantic validation belongs to the project publication API. This method must run in its transaction.
     * @param shards Validated replacements for explicitly named tables.
     */
    replaceTables(shards: Partial<AnalysisProjectShards>): void;
    /**
     * Insert a content-addressed runtime fact once. An ID collision with different content is an
     * error, never a silent no-op. Count values are already aggregated within the source capture.
     * @param record Fully aggregated fact with a source-derived stable ID.
     * @returns True when inserted. Identical facts return false and conflicting facts throw.
     */
    insertRuntime(record: RuntimeEvidenceRecord): boolean;
    /**
     * Prepare a unique-record batch in one source namespace, inside the publication transaction.
     * New namespaces need no per-record existence query. SQL uniqueness still rejects repeated IDs.
     * Existing/partially pruned sources use full idempotency and collision checks for every record.
     * The callback must not escape its transaction. Any insertion error must abort the whole batch.
     * @param prefix Exact ID prefix including its final colon.
     * @returns Transaction-scoped inserter for validated records with unique suffixes.
     */
    runtimeBatchInserter(prefix: string): (record: RuntimeEvidenceRecord) => boolean;
    /**
     * Prepare bounded bulk publication for a validated distinct instruction trace. All four source
     * namespaces must be empty; receipts cannot prove this after pruning. Retained/partial sources
     * use exact per-record comparisons and repair. Call finish() before the writer transaction commits.
     * The sink and its pending buffers belong to this transaction and must not escape it.
     */
    runtimeTracePublicationSink(sourceSha256: string): RuntimeTracePublicationSink;
    /** Reject evidence removal that would leave retained runtime facts orphaned, without loading them. */
    validateRuntimeEvidence(): void;
    /**
     * Store manifest and counter in the same transaction as the changed records.
     * @param manifest Semantic project identity for this publication.
     * @returns Manifest containing the incremented counter.
     */
    publishManifest(manifest: Omit<AnalysisProjectManifest, "shards">): AnalysisProjectManifest;
    /**
     * Current publication counter, or zero before initial publication. It is not a schema version.
     * Read it with related records inside transaction to retain one consistent snapshot.
     * @returns Stored revision.
     */
    revision(): number;
    /**
     * Authoritative manifest stored in SQLite, including pointer fields. Throws before initial publication.
     * Use a transaction when combining it with other reads. This does not validate the entire project.
     * @returns Pointer manifest.
     */
    manifest(): AnalysisProjectManifest;
    /**
     * Stream only requested runtime kinds, avoiding raw-row and decoded-row arrays on the JS heap.
     * @param kinds Runtime discriminators to include. Empty selects nothing.
     * @returns Cursor consumed within the owning read transaction.
     * @yields {RuntimeEvidenceRecord} One matching decoded fact.
     */
    runtimeRecordsByKinds(kinds: readonly RuntimeEvidenceRecord["kind"][]): IterableIterator<RuntimeEvidenceRecord>;
    /**
     * Stream runtime facts without retaining the complete table. Consume before the owning transaction
     * returns or the connection closes. An escaped iterator does not preserve its original snapshot.
     * @returns One reconstructed runtime row at a time.
     * @yields {RuntimeEvidenceRecord} One runtime fact.
     */
    runtimeRecords(): IterableIterator<RuntimeEvidenceRecord>;
    /**
     * Read one metadata table directly. Sources must not load unrelated CFG or runtime tables.
     * @param kind Metadata table name from the semantic collection contract.
     * @returns Decoded metadata in deterministic display order.
     */
    loadTable(kind: "labels"): AnalysisProjectShards["labels"];
    loadTable(kind: "comments"): AnalysisProjectShards["comments"];
    loadTable(kind: "regions"): AnalysisProjectShards["regions"];
    loadTable(kind: "annotations"): AnalysisProjectShards["annotations"];
    loadTable(kind: "analysis"): AnalysisProjectShards["analysis"];
    loadTable(kind: "evidence"): AnalysisProjectShards["evidence"];
    loadTable(kind: "imports"): AnalysisProjectShards["imports"];
    /** Read at most 200 metadata records by stable ID. The cursor belongs to the caller's read snapshot. */
    metadataPage<Kind extends Exclude<ShardKind, "runtime">>(kind: Kind, after: string | undefined, limit?: number): {
        records: readonly AnalysisProjectShards[Kind][number][];
        next?: string;
    };
    /**
     * Validate a query view against this read snapshot, including every included provenance reference.
     * @param shards Selected records, with unused collections empty.
     */
    validateView(shards: AnalysisProjectShards): void;
    /**
     * Merge an already-parsed offline batch by stable IDs without loading saved runtime history.
     * The caller owns revision checking and publication in the surrounding writer transaction.
     * @param batch Imported facts and metadata.
     * @returns Whether anything changed and per-collection additions/updates.
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
    /**
     * Produce an explicit complete evidence report one qualified PC at a time.
     * Only report output accumulates. Unused instruction/memory histories and CFG contexts are never loaded.
     * @returns Runtime record count, conflicts, and metadata explanations.
     */
    inspectEvidence(): {
        runtimeRecords: number;
        conflicts: RuntimeEvidenceConflict[];
        explanations: readonly import("../runtime/runtime-evidence.js").RuntimeEvidenceExplanation[];
    };
    /**
     * Select record choices before decoding. Explicit IDs bypass unrelated history entirely.
     * @param [selected] Exact context record IDs. Omitted lists the first 200 records per collection.
     * @returns Bounded choice view and complete small provenance catalog.
     */
    evidenceChoices(selected?: Partial<Record<ShardKind, readonly string[]>>): AnalysisProjectShards;
    /**
     * Find candidate evidence IDs still owned by retained runtime observations.
     * Reads the small provenance dictionary and physical observation rows without decoding histories.
     * Caller holds the same read snapshot as the metadata being used for a replacement publication.
     * @param ids Evidence candidates; empty input performs no query.
     * @returns Referenced candidate IDs in stable order, bounded by the input size.
     */
    runtimeEvidenceReferences(ids: readonly string[]): string[];
    /**
     * Explain one record with an exact reference count and a bounded reverse-reference preview.
     * @param kind Selected collection.
     * @param id Stable semantic record ID.
     * @returns Full direct provenance/conflicts, at most 200 reverse links.
     */
    explainEvidence(kind: ShardKind, id: string): ProjectEvidenceExplanation;
    /**
     * Persisted call graph plus current labels, without retaining CFG contexts between requests.
     * @returns Functions, calls, unresolved sites, and ownership.
     */
    callGraph(): {
        calls: readonly import("../index.ts").AnalysisCallGraphEdge[];
        unresolved: readonly import("../index.ts").AnalysisCallGraphUnresolved[];
        orphanCallIds: readonly string[];
        orphanUnresolvedIds: readonly string[];
        functions: (import("../index.ts").AnalysisCallGraphFunction & {
            labels: {
                id: string;
                name: string;
            }[];
        })[];
    };
    /**
     * Cache a compact target-specific result. Callers declare every persisted input it consumes.
     * Computation uses a deferred transaction so expensive analysis does not hold the writer lock.
     * Concurrent input changes discard cache publication. Results still belong to one read snapshot.
     * @param key Internal stable query name.
     * @param signature Layout/configuration fingerprint.
     * @param dependencies Source collections.
     * @param compute Synchronous reader. Must not open another transaction.
     * @param [publish] Optional short SQL publication for derived rows built in temporary tables.
     * @returns Current projected value.
     */
    cachedProjection<T>(key: string, signature: string, dependencies: readonly ShardKind[], compute: () => T & (T extends PromiseLike<unknown> ? never : unknown), publish?: () => void, restore?: (value: unknown) => T): T;
    /**
     * Select a bounded CFG navigation window through its address index.
     * @param space Exact logical address space.
     * @param address Selected PC.
     * @param architectures Optional specification prefixes.
     * @returns Four preceding and 28 following variants, in address order.
     */
    navigationNodes(space: string, address: number, architectures: readonly string[]): AnalysisRecord[];
    /**
     * Explicit known-code intervals, grouped in SQL for the incomplete-analysis preservation guard.
     * @returns Half-open ROM-content intervals.
     */
    codeRanges(): {
        start: number;
        end: number;
    }[];
    /**
     * Select processor MMIO observations before decoding payloads.
     * @param architecture Exact runtime architecture.
     * @param space Instruction and accessed logical space.
     * @param addresses Exact hardware addresses, including target-approved mirrors.
     * @returns SQL-grouped observations. Counts/provenance stay exact.
     * @yields {RuntimeEvidenceRecord} One role-relevant access variant.
     */
    runtimeMemoryAtAddresses(architecture: string, space: string, addresses: readonly number[]): IterableIterator<RuntimeEvidenceRecord>;
    /**
     * Decode-state variants aggregated in SQL. Raw register histories never become a JS array.
     * The signature includes the ordered state fields and architecture. Aliases remain distinct so
     * the target decoder retains its original precedence and validation rules.
     * @param architecture Exact instruction architecture.
     * @param space Exact instruction address space.
     * @param stateFields Only fields the target decoder consumes, including aliases.
     * @param masks Optional decoder bit masks, applied only to valid nonnegative integers up to max.
     * @param [onProgress] Cumulative and total observations when rebuilding; throwing aborts the build.
     * @param [onReadProgress] Representatives staged in storage order; throwing aborts the cursor.
     * @returns SQL cursor over compact variants with exact per-evidence counts.
     * Preparation precedes the consuming read transaction. Standalone iteration owns a snapshot;
     * close a partially consumed cursor to release it.
     */
    runtimeInstructionVariants(architecture: string, space: string, stateFields: readonly string[], masks?: Readonly<Record<string, {
        readonly max: number;
        readonly mask: number;
    }>>, onProgress?: (observations: number, totalObservations: number) => void, onReadProgress?: (representatives: number) => void): IterableIterator<RuntimeEvidenceRecord>;
    /**
     * Exact execution seed totals grouped by PC, without decoding execution payloads.
     * Stream per-provenance SQL totals into one seed per PC; capture attribution remains in runtime
     * storage. Static seed selection needs their union, not millions of duplicate PC records.
     * @param architecture Target processor.
     * @param space Logical CPU address space.
     * @returns Execution facts reduced to the fields used for seed selection.
     */
    runtimeExecutionSeeds(architecture: string, space: string): RuntimeEvidenceRecord[];
    /** Build additive query indexes once, then refresh only rows invalidated by project writes. */
    prepareAnnotationQueries(): void;
    /** Prepare direct source attribution indexes without decoding runtime payloads. */
    prepareSourceQueries(): void;
    /**
     * Validated source identities from small catalog tables in the caller's read snapshot.
     * @returns Manifest and sources ordered by their most recent successful import.
     */
    sourceCatalog(): {
        manifest: AnalysisProjectManifest;
        sources: readonly import("../analysis/analysis-sources.js").AnalysisEvidenceSource[];
    };
    /**
     * Exact SQL counts for a catalog source. No baseline or inferred static execution.
     * @param sourceId Catalog source ID.
     * @returns Manifest and source counts.
     */
    sourceSummary(sourceId: string): {
        manifest: AnalysisProjectManifest;
        summary: import("../analysis/analysis-sources.js").AnalysisSourceSummary;
    };
    /**
     * At most 200 SQL-selected contribution rows, decoded within the caller's read transaction.
     * @param sourceId Catalog source ID.
     * @param group Contribution category.
     * @param offset Nonnegative page offset.
     * @returns Bounded source records.
     */
    sourcePage(sourceId: string, group: AnalysisSourceGroup, offset?: number): import("../analysis/analysis-sources.js").AnalysisSourceEntry[];
    /**
     * Read names, comments and provenance for editing without materializing instruction variants.
     * @returns Validated editing metadata from the caller's read transaction.
     */
    annotationEditView(): {
        manifest: AnalysisProjectManifest;
        shards: AnalysisProjectShards;
    };
    /**
     * Small export metadata. Instruction candidates are supplied separately by an ordered SQL cursor.
     * @returns Validated manifest, metadata, and an empty runtime collection.
     */
    sourceExportView(): {
        manifest: AnalysisProjectManifest;
        shards: AnalysisProjectShards;
    };
    /**
     * Prepare an optional, lossless export projection before opening the rendering read transaction.
     * Dependency triggers reject publication after intervening analysis/provenance edits. Cache misses
     * still use the authoritative ordered cursor; no manifest revision or Git files are changed.
     */
    prepareSourceExport(signal?: AbortSignal): void;
    /**
     * Render inside one read snapshot, staging a lossless projection during the first cursor pass.
     * The callback must synchronously consume all groups. Only a surviving dependency token can
     * publish the staged cache after rendering releases its read lock; concurrent edits win.
     */
    sourceExportSnapshot<T>(render: (groups: Iterable<readonly InstructionExportRecord[]>) => T, signal?: AbortSignal): T;
    /**
     * Stream one file-offset group at a time. Do not retain the complete CFG to plan source.
     * The caller prepares annotation indexes first and owns a read transaction until iteration ends.
     * @returns All variants at each explicit output offset.
     * @yields {readonly InstructionExportRecord[]} One complete group, without clipping variants.
     */
    instructionExportGroups(): IterableIterator<readonly InstructionExportRecord[]>;
    /**
     * Read and validate only the requested instruction metadata and bounded runtime details.
     * @param ranges Exact visible source/debugger coordinates.
     * @returns Small view. Consume inside the caller's read transaction.
     */
    instructionAnnotationView(ranges: readonly AnnotationQueryRange[]): SqliteAnnotationView;
    /**
     * Exact viewport counts without materializing the detailed instruction projection.
     * @param ranges Current mapped coordinates, validated by the query.
     * @returns Bounded locations with exact execution totals.
     */
    instructionExecutionSummary(ranges: readonly AnnotationQueryRange[]): readonly InstructionExecutionSummaryRow[];
    /**
     * Read selected metadata kinds through the address index instead of loading the complete CFG.
     * @param kinds Analysis discriminators to include.
     * @returns Matching rows in stable ID order.
     */
    analysisByKinds(kinds: readonly AnalysisRecord["kind"][]): AnalysisRecord[];
    /**
     * Resolve an edit boundary to representative CFG nodes, one per qualified location.
     * Call after preparing query indexes and consume inside a read transaction.
     * @param addressSpace Exact debug-map/native address space.
     * @param address Instruction start in that space.
     * @param [outputOffset] Optional explicit file offset, never an inferred mapper alias.
     * @returns Location representatives. State variants need not be loaded to edit a comment.
     */
    annotationNodesAt(addressSpace: string, address: number, outputOffset?: number): AnalysisProjectShards["analysis"];
    /**
     * Materialize complete record arrays without semantic validation. Run inside a read transaction.
     * @param [runtime] Defaults to true. False omits runtime and must not be treated as a complete replacement.
     * @returns Decoded record arrays owned by the caller.
     */
    loadShards(runtime?: boolean): AnalysisProjectShards;
    /**
     * Table counts for reports.
     * @returns Row counts.
     */
    counts(): Readonly<Record<string, number>>;
    /**
     * Count analysis kinds without inflating or parsing their compressed payloads.
     * @returns Counts by analysis record discriminator.
     */
    analysisCounts(): Readonly<Record<string, number>>;
    /**
     * Summarize per-PC execution facts using stored columns, without reading register history.
     * @returns Fact count and total observed executions in the owning transaction.
     */
    runtimeExecutionCounts(): {
        records: number;
        events: number;
    };
    /**
     * Atomically refresh the watcher hint after commit. SQLite is authoritative: a failed hint write
     * is reported as a warning, never as a failed import that could cause an unsafe retry.
     * @param directory Project root for the watcher hint.
     */
    writePointer(directory: string): void;
    /** Checkpoint and reclaim unused SQLite pages. Run only during explicit storage maintenance. */
    compact(): void;
    /**
     * Explicitly consolidate full SNES snapshots into counted decoder variants. A bounded staging
     * database is verified first; one transaction swaps physical runtime tables, avoiding millions
     * of deletion triggers and a database-sized WAL. Metadata, memory facts and research shadows
     * retain their exact payloads. Refresh the portable capture catalog and compact() afterward.
     */
    retainSnesAnalysisEvidence(onProgress?: (message: string) => void): void;
    /**
     * Current persisted policy. Defaults do not write or change the semantic revision.
     * @returns Validated defaults and persisted overrides.
     */
    storagePolicy(): AnalysisStoragePolicy;
    /**
     * Update only explicit policy fields in the caller's writer transaction.
     * @param patch Explicit limits, in bytes/days/counts.
     * @returns Complete policy saved without changing the edit revision.
     */
    setStoragePolicy(patch: Partial<AnalysisStoragePolicy>): AnalysisStoragePolicy;
    /**
     * Storage accounting avoids decoding runtime or analysis payloads.
     * @returns Physical allocation and logical retention counts.
     */
    storageSnapshot(): import("./sqlite-storage-policy.js").AnalysisStorageSnapshot;
    /**
     * Optional projection allocation, including secondary indexes. Reserved for explicit accounting.
     * @returns Allocated cache bytes, excluding permanent editor/export indexes.
     */
    storageCacheBytes(): number;
    /**
     * Durable receipt lookup survives source-file removal and cache eviction.
     * @param sha256 Canonical capture identity.
     * @returns Retained import identity and counts.
     */
    captureReceipt(sha256: string): Record<string, import("node:sqlite").SQLOutputValue> | undefined;
    /** Bounded physical-code joins; graphics never imply that a CPU instruction executed. */
    graphicsEvidence(query: GraphicsEvidenceQuery): readonly import("./sqlite-graphics-query.js").GraphicsEvidenceRow[];
    /** Small durable import receipts in import order. */
    captureCatalog(): Record<string, import("node:sqlite").SQLOutputValue>[];
    /**
     * Record the first successful import atomically with its facts. Reimports only refresh last-seen time.
     * @param report Successfully validated native trace import.
     */
    recordCaptureReceipt(report: ImportReport): void;
    /**
     * Drop disposable projections after publication, then recycle WAL without waiting on active readers.
     * @returns Cache eviction totals and whether readers delayed WAL truncation.
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