import type { ImportReport, RuntimeEvidenceRecord, RuntimeStateValue } from "../model/project-types.js";
import { type RuntimeInstructionDetail } from "../model/trace-detail.js";
import type { RuntimeEvidenceBatch } from "./runtime-evidence.js";
/** Native, emulator-neutral on-disk identity for an explicitly recorded instruction trace. */
export declare const RUNTIME_INSTRUCTION_TRACE_FORMAT: "uttori-asm-instruction-trace";
/** Supported trace-artifact schema. Readers reject other revisions. */
export declare const RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION: 1;
/** One bounded producer pull stored in a native instruction-trace artifact. */
export interface RuntimeInstructionTraceChunk {
    /** Nonnegative producer sequence of the first address, including positions lost before delivery. */
    readonly sequenceStart: number;
    readonly addresses: readonly number[];
    /** Optional execution-time detail. Legacy PC-only chunks remain valid. */
    readonly details?: readonly RuntimeInstructionDetail[];
    /** Cumulative bus operations outside a captured CPU instruction (interrupt/wait periods). */
    readonly unattributedMemoryAccesses?: number;
    /** Cumulative producer loss, not the loss in this chunk. Counts must never decrease. */
    readonly droppedEvents: number;
    readonly active: boolean;
}
/**
 * Immutable recording artifact created only by an explicit recorder.
 * Chunks preserve observed order and producer loss. Project facts are aggregated during import.
 */
export interface RuntimeInstructionTraceArtifact {
    readonly format: typeof RUNTIME_INSTRUCTION_TRACE_FORMAT;
    readonly schemaVersion: typeof RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION;
    readonly architecture: string;
    readonly addressSpace: string;
    readonly romContentSha256: string;
    readonly producer: {
        readonly id: string;
        readonly revision: string;
    };
    readonly chunks: readonly RuntimeInstructionTraceChunk[];
}
/** Project identity and user-visible source name required for an explicit trace import. */
export interface RuntimeInstructionTraceImportContext {
    /** Lowercase SHA-256 of headerless ROM content. A mismatch rejects the import. */
    readonly projectRomContentSha256: string;
    readonly sourceName: string;
    /** Full indexing retains every supplied register; other modes are rejected. */
    readonly indexMode?: RuntimeTraceIndexMode;
    /**
     * Maximum emitted runtime facts: one per PC, two per byte/state variant, one per bus variant.
     * In-memory imports default to 8M records, with an 8M ceiling.
     * Disk indexes with a record sink default to Number.MAX_SAFE_INTEGER and accept any positive
     * safe integer budget. Explicit budgets apply to both paths. Not a byte/heap limit.
     */
    readonly maxIndexRecords?: number;
}
/** Instruction imports retain all supplied registers, bytes, counts and bus observations. */
export type RuntimeTraceIndexMode = "full";
/** Default and maximum distinct-fact budget when counters or output records remain on the heap. */
export declare const DEFAULT_RUNTIME_TRACE_MAX_INDEX_RECORDS = 8000000;
/** Native evidence plus deterministic diagnostics produced without mutating a project. */
export interface RuntimeInstructionTraceImportResult {
    readonly batch: RuntimeEvidenceBatch;
    readonly report: ImportReport;
    /** Canonical identity of all validated input, including every supplied register. */
    readonly sourceSha256: string;
    readonly observedEvents: number;
    readonly droppedEvents: number;
}
/** Identity shared by all chunks of one trace. */
export type RuntimeInstructionTraceMetadata = Omit<RuntimeInstructionTraceArtifact, "chunks">;
/**
 * Ordered chunks supplied directly by a producer or a bounded file reader. The reader must finish
 * each synchronous consumer call and reject on incomplete envelopes or integrity failures. Chunks are
 * provisional until read() resolves. Consumers validate chunk contents and must not retain them.
 */
export interface RuntimeTraceSource {
    readonly metadata: RuntimeInstructionTraceMetadata;
    readonly read: (accept: (chunk: unknown) => void) => Promise<void>;
}
/**
 * Validate the small trace envelope independently of its event stream.
 * @param {unknown} value Untrusted metadata.
 * @returns {RuntimeInstructionTraceMetadata} Normalized identity.
 */
export declare const validateRuntimeInstructionTraceMetadata: (value: unknown) => RuntimeInstructionTraceMetadata;
/**
 * Create validation state spanning chunk boundaries without retaining earlier events.
 * @returns {(value: unknown) => RuntimeInstructionTraceChunk} Next-chunk validator.
 */
export declare const createRuntimeTraceChunkValidator: () => ((value: unknown) => RuntimeInstructionTraceChunk);
/**
 * Validates untrusted trace data without importing project facts.
 * @param {unknown} value Untrusted trace.
 * @returns {RuntimeInstructionTraceArtifact} Normalized trace.
 */
export declare const validateRuntimeInstructionTrace: (value: unknown) => RuntimeInstructionTraceArtifact;
/**
 * Converts one explicitly supplied native trace artifact into merge-ready runtime evidence.
 * This function is pure: callers must separately invoke `mergeRuntimeEvidence` and persist the project.
 * @param {RuntimeInstructionTraceArtifact} value Untrusted native trace artifact.
 * @param {RuntimeInstructionTraceImportContext} context Selected project and source identity.
 * @returns {RuntimeInstructionTraceImportResult} Deterministic batch and loss diagnostics.
 */
export declare const importRuntimeInstructionTrace: (value: RuntimeInstructionTraceArtifact, context: RuntimeInstructionTraceImportContext) => RuntimeInstructionTraceImportResult;
/** One distinct indexed fact. Byte/state pairs expand into two persisted records at finalization. */
export type RuntimeTraceIndexedFact = {
    readonly kind: "execution";
    readonly address: number;
} | {
    readonly kind: "instruction";
    readonly identity: string;
    readonly address: number;
    readonly bytes: readonly number[];
    readonly state: Readonly<Record<string, RuntimeStateValue>>;
} | {
    readonly kind: "memory";
    readonly record: RuntimeEvidenceRecord;
};
/** Counter storage owned by the caller. Disk implementations keep distinct facts off the JS heap. */
export interface RuntimeTraceFactIndex {
    /** True when distinct fact payloads live on disk. Omitted means the index may grow on the JS heap. */
    readonly diskBacked?: boolean;
    /** Increment a fact, constructing its payload only on first insertion. Return whether it was new. */
    add(key: string, create: () => RuntimeTraceIndexedFact): boolean;
    /** Yield each distinct fact once, with its exact aggregate observation count. */
    values(): Iterable<{
        readonly fact: RuntimeTraceIndexedFact;
        readonly count: number;
    }>;
    /** Release indexed facts after completion or failure. */
    clear(): void;
}
/** Optional external storage and record sink. Sink output is provisional until finish returns. */
export interface RuntimeTraceImporterStorage {
    readonly index: RuntimeTraceFactIndex;
    /** Called after complete source validation, before emitting any provisional records. */
    readonly onSource?: (sha256: string, profile: string) => void;
    /**
     * Final records are emitted individually; batch.runtime is omitted. With diskBacked indexing,
     * the sink must bound its own memory because the importer's default record ceiling is lifted.
     */
    readonly onRecord?: (record: RuntimeEvidenceRecord) => void;
    /** Throttled provisional merge counts. Reaching the total does not mean the transaction committed. */
    readonly onMergeProgress?: (processedRecords: number, totalRecords: number) => void;
}
/**
 * Resolve the instruction record budget before consuming any chunks. The memory ceiling still
 * applies if either counters or final records accumulate on the heap; a disk index alone is insufficient.
 * @param {RuntimeTraceIndexMode} mode Validated retention profile.
 * @param {number} requested Explicit caller budget, if any.
 * @param {RuntimeTraceImporterStorage} storage Optional counter storage and final record sink.
 * @returns {number} Positive safe integer limit, or throws for an invalid or unsafe memory budget.
 */
export declare const runtimeTraceIndexRecordLimit: (mode: RuntimeTraceIndexMode, requested: number | undefined, storage?: RuntimeTraceImporterStorage) => number;
/** Incremental aggregation. Any failed push permanently invalidates the pending import. */
export interface RuntimeInstructionTraceImporter {
    /** Accept the next ordered chunk. Invalid data or an exceeded record budget prevents finalization. */
    push(this: void, value: unknown): void;
    /** Consume the importer once, only after the caller has validated the entire file and its tail. */
    finish(): RuntimeInstructionTraceImportResult;
}
/**
 * Aggregate a trace one validated chunk at a time, preserving canonical import identities.
 * The default memory index grows with distinct facts. Callers can supply a disk index and sink.
 * Paired code/state facts share one accumulator until finalization. Record budgets do not bound bytes.
 * @param {RuntimeInstructionTraceMetadata} value Trace identity.
 * @param {RuntimeInstructionTraceImportContext} context Destination identity.
 * @param {RuntimeTraceImporterStorage} [storage] Caller-owned counter index and optional bounded record sink.
 * @returns {RuntimeInstructionTraceImporter} Incremental importer. Finish only after the file validates.
 */
export declare const createRuntimeInstructionTraceImporter: (value: RuntimeInstructionTraceMetadata, context: RuntimeInstructionTraceImportContext, storage?: RuntimeTraceImporterStorage) => RuntimeInstructionTraceImporter;
//# sourceMappingURL=runtime-trace.d.ts.map