import type { ImportReport } from "./project-types.js";
import type { RuntimeEvidenceBatch } from "./runtime-evidence.js";
/** Native, emulator-neutral on-disk identity for an explicitly recorded instruction trace. */
export declare const RUNTIME_INSTRUCTION_TRACE_FORMAT: "uttori-asm-instruction-trace";
/** Initial trace-artifact schema. The project is unreleased, so this remains version 1. */
export declare const RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION: 1;
/** One bounded producer pull stored in a native instruction-trace artifact. */
export interface RuntimeInstructionTraceChunk {
    readonly sequenceStart: number;
    readonly addresses: readonly number[];
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
}
/** Native evidence plus deterministic diagnostics produced without mutating a project. */
export interface RuntimeInstructionTraceImportResult {
    readonly batch: RuntimeEvidenceBatch;
    readonly report: ImportReport;
    readonly sourceSha256: string;
    readonly observedEvents: number;
    readonly droppedEvents: number;
}
/**
 * Converts one explicitly supplied native trace artifact into merge-ready runtime evidence.
 * This function is pure: callers must separately invoke `mergeRuntimeEvidence` and persist the project.
 * @param {RuntimeInstructionTraceArtifact} value Untrusted native trace artifact.
 * @param {RuntimeInstructionTraceImportContext} context Selected project and source identity.
 * @returns {RuntimeInstructionTraceImportResult} Deterministic batch and loss diagnostics.
 */
export declare const importRuntimeInstructionTrace: (value: RuntimeInstructionTraceArtifact, context: RuntimeInstructionTraceImportContext) => RuntimeInstructionTraceImportResult;
//# sourceMappingURL=runtime-trace.d.ts.map