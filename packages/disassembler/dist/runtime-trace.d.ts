import type { ImportReport, RuntimeEvidenceRecord, RuntimeStateValue } from "./project-types.js";
import type { RuntimeEvidenceBatch } from "./runtime-evidence.js";
import { type RuntimeInstructionDetail } from "./trace-detail.js";
/** Native, emulator-neutral on-disk identity for an explicitly recorded instruction trace. */
export declare const RUNTIME_INSTRUCTION_TRACE_FORMAT: "uttori-asm-instruction-trace";
/** Initial trace-artifact schema. The project is unreleased, so this remains version 1. */
export declare const RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION: 1;
/** One bounded producer pull stored in a native instruction-trace artifact. */
export interface RuntimeInstructionTraceChunk {
    readonly sequenceStart: number;
    readonly addresses: readonly number[];
    /** Optional execution-time detail; legacy PC-only chunks remain valid. */
    readonly details?: readonly RuntimeInstructionDetail[];
    /** Cumulative bus operations outside a captured CPU instruction (interrupt/wait periods). */
    readonly unattributedMemoryAccesses?: number;
    readonly droppedEvents: number;
    readonly active: boolean;
}
/**
 * Immutable recording artifact created only by an explicit recorder.
 * Chunks preserve observed order and producer loss; project facts are aggregated during import.
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
    readonly projectRomContentSha256: string;
    readonly sourceName: string;
    /** Defaults to full snapshots; compact mode changes only the index, never the capture or its hash. */
    readonly indexMode?: RuntimeTraceIndexMode;
    /**
     * Maximum emitted runtime facts: one per PC, two per byte/state variant, one per bus variant.
     * Defaults to 2M in compact mode or 8M in full mode; accepts 1 through 8,000,000. Not a byte/heap limit.
     */
    readonly maxIndexRecords?: number;
}
/**
 * Full keeps all supplied registers. Compact preserves the joint 65816 decoding state and
 * execution counts; A/X/Y/S history remains in the capture and is unavailable from this index.
 */
export type RuntimeTraceIndexMode = "full" | "65816-disassembly";
/** Compact-index default; full snapshots retain a larger compatibility budget. */
export declare const DEFAULT_RUNTIME_TRACE_MAX_INDEX_RECORDS = 2000000;
/** Native evidence plus deterministic diagnostics produced without mutating a project. */
export interface RuntimeInstructionTraceImportResult {
    readonly batch: RuntimeEvidenceBatch;
    readonly report: ImportReport;
    /** Canonical identity of all validated input, including registers omitted from a compact index. */
    readonly sourceSha256: string;
    readonly observedEvents: number;
    readonly droppedEvents: number;
}
/** Identity shared by all chunks of one trace. */
export type RuntimeInstructionTraceMetadata = Omit<RuntimeInstructionTraceArtifact, "chunks">;
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
/** One distinct indexed fact; byte/state pairs expand into two persisted records at finalization. */
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
/** Counter storage owned by the caller; disk implementations keep distinct facts off the JS heap. */
export interface RuntimeTraceFactIndex {
    /** Increment a fact, constructing its payload only on first insertion; return whether it was new. */
    add(key: string, create: () => RuntimeTraceIndexedFact): boolean;
    /** Yield each distinct fact once, with its exact aggregate observation count. */
    values(): Iterable<{
        readonly fact: RuntimeTraceIndexedFact;
        readonly count: number;
    }>;
    /** Release indexed facts after completion or failure. */
    clear(): void;
}
/** Optional external storage and record sink; sink output is provisional until finish returns. */
export interface RuntimeTraceImporterStorage {
    readonly index: RuntimeTraceFactIndex;
    /** Final records are emitted individually; batch.runtime is omitted when this sink is supplied. */
    readonly onRecord?: (record: RuntimeEvidenceRecord) => void;
}
/** Incremental aggregation; any failed push permanently invalidates the pending import. */
export interface RuntimeInstructionTraceImporter {
    /** Accept the next ordered chunk; invalid data or an exceeded record budget prevents finalization. */
    push(value: unknown): void;
    /** Consume the importer once, only after the caller has validated the entire file and its tail. */
    finish(): RuntimeInstructionTraceImportResult;
}
/**
 * Aggregate a trace one validated chunk at a time, preserving canonical import identities.
 * The default memory index grows with distinct facts; callers can supply a disk index and sink.
 * Paired code/state facts share one accumulator until finalization; record budgets do not bound bytes.
 * @param {RuntimeInstructionTraceMetadata} value Trace identity.
 * @param {RuntimeInstructionTraceImportContext} context Destination identity.
 * @param {RuntimeTraceImporterStorage} [storage] Caller-owned counter index and optional bounded record sink.
 * @returns {RuntimeInstructionTraceImporter} Incremental importer; finish only after the file validates.
 */
export declare const createRuntimeInstructionTraceImporter: (value: RuntimeInstructionTraceMetadata, context: RuntimeInstructionTraceImportContext, storage?: RuntimeTraceImporterStorage) => RuntimeInstructionTraceImporter;
//# sourceMappingURL=runtime-trace.d.ts.map