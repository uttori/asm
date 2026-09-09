import type { AnalysisProjectShards } from "./project-types.js";
import { type RuntimeInstructionTraceArtifact, type RuntimeInstructionTraceMetadata, type RuntimeInstructionTraceChunk } from "./runtime-trace.js";
/** One statically evidenced routine observed during an explicit trace window. */
export interface ExecutedRoutineSummary {
    readonly functionId: string;
    readonly addressSpace: string;
    readonly address: number;
    readonly name: string;
    readonly labels: readonly string[];
    readonly source: string;
    readonly firstSequence: number;
    readonly lastSequence: number;
    readonly instructionEvents: number;
    readonly uniqueInstructionAddresses: number;
    /** Contiguous attributed runs, useful as an approximation rather than a call count. */
    readonly executionSpans: number;
}
/** Dynamic-PC coverage attributed to persisted function candidates without inventing ownership. */
export interface ExecutionWindowSummary {
    readonly architecture: string;
    readonly addressSpace: string;
    readonly complete: boolean;
    readonly observedEvents: number;
    readonly droppedEvents: number;
    readonly uniqueInstructionAddresses: number;
    readonly attributedEvents: number;
    readonly unownedEvents: number;
    readonly ambiguousEvents: number;
    readonly unownedAddresses: readonly number[];
    readonly ambiguousAddresses: readonly number[];
    readonly routines: readonly ExecutedRoutineSummary[];
}
/**
 * Attributes the ordered PC events in one explicit start/stop window to persisted routines.
 * An address is attributed only when all context-specific CFG nodes agree on one owner.
 * Unknown and ambiguous addresses remain explicit instead of becoming inferred functions.
 * @param {RuntimeInstructionTraceArtifact} value Validated or untrusted trace artifact.
 * @param {AnalysisProjectShards} shards Native analysis records after trace-driven regeneration.
 * @returns {ExecutionWindowSummary} Ordered routine coverage and unattributed-PC diagnostics.
 */
export declare const summarizeExecutionWindow: (value: RuntimeInstructionTraceArtifact, shards: AnalysisProjectShards) => ExecutionWindowSummary;
/** Ordered routine attribution without retaining the event stream. */
export interface ExecutionWindowAccumulator {
    push(chunk: RuntimeInstructionTraceChunk): void;
    finish(): ExecutionWindowSummary;
}
/**
 * Prepare routine attribution for incrementally supplied, validated trace chunks.
 * @param {RuntimeInstructionTraceMetadata} trace Recording identity.
 * @param {AnalysisProjectShards} shards Saved analysis.
 * @returns {ExecutionWindowAccumulator} Chunk consumer and final report.
 */
export declare const createExecutionWindowAccumulator: (trace: RuntimeInstructionTraceMetadata, shards: AnalysisProjectShards) => ExecutionWindowAccumulator;
//# sourceMappingURL=execution-window.d.ts.map