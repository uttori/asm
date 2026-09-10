import { type ExecutionWindowSummary } from "./execution-window.js";
import type { AnalysisProjectShards } from "./project-types.js";
import { type RuntimeInstructionTraceChunk, type RuntimeInstructionTraceImportContext, type RuntimeInstructionTraceImportResult, type RuntimeInstructionTraceMetadata } from "./runtime-trace.js";
/** Default file-size budget, independent of static-analysis work. */
export declare const DEFAULT_RUNTIME_TRACE_MAX_BYTES: number;
/** File import limits, cancellation and incremental progress. */
export interface RuntimeTraceFileOptions {
    readonly maxBytes?: number;
    readonly signal?: AbortSignal;
    readonly onProgress?: (readBytes: number, totalBytes: number) => void;
}
/**
 * Read identity before selecting a matching project; normal recorder headers require one block.
 * @param {string} file Trace path.
 * @param {RuntimeTraceFileOptions} options Read budget and cancellation.
 * @returns {Promise<RuntimeInstructionTraceMetadata>} Validated envelope (body checked on import).
 */
export declare const readRuntimeTraceFileMetadata: (file: string, options?: RuntimeTraceFileOptions) => Promise<RuntimeInstructionTraceMetadata>;
/**
 * Yield validated chunks and check the complete JSON envelope before successful completion.
 * @param {string} file Trace path.
 * @param {RuntimeInstructionTraceMetadata} metadata Expected recording identity.
 * @param {RuntimeTraceFileOptions} options Read limits and cancellation.
 * @returns {AsyncGenerator<RuntimeInstructionTraceChunk>} Validated ordered events.
 * @yields {RuntimeInstructionTraceChunk} One validated trace chunk.
 */
export declare function readRuntimeTraceFileChunks(file: string, metadata: RuntimeInstructionTraceMetadata, options?: RuntimeTraceFileOptions): AsyncGenerator<RuntimeInstructionTraceChunk>;
/**
 * Import a native trace without allocating a file-sized string or retaining earlier chunks.
 * @param {string} file Trace path.
 * @param {RuntimeInstructionTraceImportContext} context Selected project identity.
 * @param {RuntimeTraceFileOptions} options Read budget and progress.
 * @returns {Promise<RuntimeInstructionTraceImportResult>} Merge-ready facts after full validation.
 */
export declare const importRuntimeInstructionTraceFile: (file: string, context: RuntimeInstructionTraceImportContext, options?: RuntimeTraceFileOptions) => Promise<RuntimeInstructionTraceImportResult>;
/**
 * Attribute a large recording to saved routines using the same bounded file reader.
 * @param {string} file Trace path.
 * @param {AnalysisProjectShards} shards Analysis after regeneration (or preserved analysis).
 * @param {RuntimeTraceFileOptions} options Read budget and cancellation.
 * @returns {Promise<ExecutionWindowSummary>} Routine report without retaining the recording.
 */
export declare const summarizeExecutionWindowFile: (file: string, shards: AnalysisProjectShards, options?: RuntimeTraceFileOptions) => Promise<ExecutionWindowSummary>;
//# sourceMappingURL=runtime-trace-file.d.ts.map