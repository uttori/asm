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
    /** Program counter addresses delivered in this chunk, in observation order. */
    readonly addresses: readonly number[];
    /** Optional execution-time detail. Legacy PC-only chunks remain valid. */
    readonly details?: readonly RuntimeInstructionDetail[];
    /** Cumulative bus operations outside a captured CPU instruction (interrupt/wait periods). */
    readonly unattributedMemoryAccesses?: number;
    /** Cumulative producer loss, not the loss in this chunk. Counts must never decrease. */
    readonly droppedEvents: number;
    /** False when the producer closed the stream before the chunk ended. */
    readonly active: boolean;
}
/**
 * Immutable recording artifact created only by an explicit recorder.
 * Chunks preserve observed order and producer loss. Project facts are aggregated during import.
 */
export interface RuntimeInstructionTraceArtifact {
    /** On-disk trace artifact discriminator. */
    readonly format: typeof RUNTIME_INSTRUCTION_TRACE_FORMAT;
    /** Schema version readers accept for instruction traces. */
    readonly schemaVersion: typeof RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION;
    /** Instruction architecture recorded in the trace envelope. */
    readonly architecture: string;
    /** Named address space for every PC in the trace. */
    readonly addressSpace: string;
    /** Headerless ROM content hash binding the trace to one cartridge image. */
    readonly romContentSha256: string;
    /** Complete cartridge identity, including iNES mapper/header bytes. */
    readonly romFileSha256?: string;
    /** Recorder identity recorded in the trace envelope. */
    readonly producer: {
        /** Recorder or emulator id that emitted the trace. */
        readonly id: string;
        /** Producer revision string recorded with the trace. */
        readonly revision: string;
    };
    /** Ordered instruction chunks preserving producer loss and sequencing. */
    readonly chunks: readonly RuntimeInstructionTraceChunk[];
}
/** Project identity and user-visible source name required for an explicit trace import. */
export interface RuntimeInstructionTraceImportContext {
    /** Lowercase SHA-256 of headerless ROM content. A mismatch rejects the import. */
    readonly projectRomContentSha256: string;
    /** User-visible source name stored on the import report. */
    readonly sourceName: string;
    /** Full retains supplied registers. Analysis retains SNES decoder state and all memory facts. Defaults to full. */
    readonly indexMode?: string;
    /**
     * Maximum emitted runtime facts: one per PC, two per byte/state variant, one per bus variant.
     * In-memory imports default to 8M records, with an 8M ceiling.
     * Disk indexes with a record sink default to Number.MAX_SAFE_INTEGER and accept any positive
     * safe integer budget. Explicit budgets apply to both paths. Not a byte/heap limit.
     */
    readonly maxIndexRecords?: number;
}
/** Full preserves registers; analysis consolidates SNES snapshots by decoder state and opcode bytes. */
export type RuntimeTraceIndexMode = "full" | "analysis";
/** Default and maximum distinct-fact budget when counters or output records remain on the heap. */
export declare const DEFAULT_RUNTIME_TRACE_MAX_INDEX_RECORDS = 8000000;
/** Native evidence plus deterministic diagnostics produced without mutating a project. */
export interface RuntimeInstructionTraceImportResult {
    /** Shard batch ready to merge into the analysis project. */
    readonly batch: RuntimeEvidenceBatch;
    /** Import report describing the validated trace artifact. */
    readonly report: ImportReport;
    /** Canonical identity of all validated input, including every supplied register. */
    readonly sourceSha256: string;
    /** Count of instruction events observed across the validated stream. */
    readonly observedEvents: number;
    /** Cumulative producer loss reported by the trace envelope. */
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
    /** Validated trace envelope identity shared by every chunk. */
    readonly metadata: RuntimeInstructionTraceMetadata;
    /** Stream chunks to the importer after validating envelope integrity. */
    readonly read: (accept: (chunk: unknown) => void) => Promise<void>;
    /** Recheck external companions when a content-matched, previously validated index replaces read(). */
    readonly verifyRetained?: () => Promise<void>;
    /** Available after a successful opt-in prefix read; absent for terminally verified captures. */
    readonly recovery?: {
        readonly chunkThrough: string;
        readonly eventThrough: string;
        readonly reason: string;
    };
}
/**
 * Validate the small trace envelope independently of its event stream.
 * @param value Untrusted metadata.
 * @returns Normalized identity.
 */
export declare const validateRuntimeInstructionTraceMetadata: (value: unknown) => RuntimeInstructionTraceMetadata;
/**
 * Create validation state spanning chunk boundaries without retaining earlier events.
 * @returns Next-chunk validator.
 */
export declare const createRuntimeTraceChunkValidator: () => ((value: unknown) => RuntimeInstructionTraceChunk);
/**
 * Validates untrusted trace data without importing project facts.
 * @param value Untrusted trace.
 * @returns Normalized trace.
 */
export declare const validateRuntimeInstructionTrace: (value: unknown) => RuntimeInstructionTraceArtifact;
/**
 * Converts one explicitly supplied native trace artifact into merge-ready runtime evidence.
 * This function is pure: callers must separately invoke `mergeRuntimeEvidence` and persist the project.
 * @param value Untrusted native trace artifact.
 * @param context Selected project and source identity.
 * @returns Deterministic batch and loss diagnostics.
 */
export declare const importRuntimeInstructionTrace: (value: unknown, context: RuntimeInstructionTraceImportContext) => RuntimeInstructionTraceImportResult;
/** One distinct indexed fact. Byte/state pairs expand into two persisted records at finalization. */
export type RuntimeTraceIndexedFact = {
    readonly kind: "execution";
    readonly address: number;
    readonly identity?: string;
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
    /** Caller-owned fact index receiving distinct trace observations. */
    readonly index: RuntimeTraceFactIndex;
    /** Complete parser summary paired atomically with this index; never resume a partial parse. */
    readonly checkpoint?: RuntimeTraceCheckpoint;
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
 * @param mode Full snapshots or compact analysis state.
 * @param requested Explicit caller budget, if any.
 * @param storage Optional counter storage and final record sink.
 * @returns Positive safe integer limit, or throws for an invalid or unsafe memory budget.
 */
export declare const runtimeTraceIndexRecordLimit: (mode: string, requested: number | undefined, storage?: RuntimeTraceImporterStorage) => number;
/** Incremental aggregation. Any failed push permanently invalidates the pending import. */
export interface RuntimeInstructionTraceImporter {
    /** Accept the next ordered chunk. Invalid data or an exceeded record budget prevents finalization. */
    push(this: void, value: unknown): void;
    /** Seal the validated stream for retry, retaining counters on disk until publication succeeds. */
    checkpoint(recovery?: RuntimeTraceSource["recovery"]): RuntimeTraceCheckpoint;
    /** Consume once after verifying a complete capture or an explicitly allowed checkpointed prefix. */
    finish(recovery?: RuntimeTraceSource["recovery"]): RuntimeInstructionTraceImportResult;
}
/** Small sealed parser state. The owning cache binds it to archive, ROM, importer and index identities. */
export interface RuntimeTraceCheckpoint {
    /** Canonical hash over validated input accepted into the checkpoint. */
    readonly sourceSha256: string;
    /** Execution runtime records emitted before sealing the checkpoint. */
    readonly executionRecords: number;
    /** Memory runtime records emitted before sealing the checkpoint. */
    readonly memoryRecords: number;
    /** Distinct indexed facts retained in the importer index. */
    readonly indexRecords: number;
    /** Instruction events observed before sealing the checkpoint. */
    readonly observedEvents: number;
    /** Producer loss accumulated before sealing the checkpoint. */
    readonly droppedEvents: number;
    /** True when the validated stream ended at a terminal producer boundary. */
    readonly complete: boolean;
    /** Bus operations outside captured CPU instructions accumulated so far. */
    readonly unattributed: number;
    /** Instruction events carrying execution-time detail fields. */
    readonly detailedEvents: number;
    /** Memory facts dropped by indexing policy before sealing. */
    readonly memoryLoss: number;
    /** Optional partial-stream recovery bounds when importing a checkpointed prefix. */
    readonly recovery?: RuntimeTraceSource["recovery"];
}
/**
 * Aggregate a trace one validated chunk at a time, preserving canonical import identities.
 * The default memory index grows with distinct facts. Callers can supply a disk index and sink.
 * Paired code/state facts share one accumulator until finalization. Record budgets do not bound bytes.
 * @param value Trace identity.
 * @param context Destination identity.
 * @param [storage] Caller-owned counter index and optional bounded record sink.
 * @returns Incremental importer. Finish only after the file validates.
 */
export declare const createRuntimeInstructionTraceImporter: (value: RuntimeInstructionTraceMetadata, context: RuntimeInstructionTraceImportContext, storage?: RuntimeTraceImporterStorage) => RuntimeInstructionTraceImporter;
//# sourceMappingURL=runtime-trace.d.ts.map