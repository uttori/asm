import { type RuntimeInstructionTraceChunk, type RuntimeInstructionTraceImportContext, type RuntimeInstructionTraceImportResult, type RuntimeInstructionTraceMetadata, type RuntimeTraceSource } from "./runtime-trace.js";
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
 * Read and normalize ordered chunks for callers that need standalone validated data.
 * @param {string} file Trace JSON path.
 * @param {RuntimeInstructionTraceMetadata} metadata Expected envelope identity.
 * @param {RuntimeTraceFileOptions} options Input limits, cancellation and progress.
 * @yields {RuntimeInstructionTraceChunk} One normalized chunk; the tail is checked on exhaustion.
 */
export declare function readRuntimeTraceFileChunks(file: string, metadata: RuntimeInstructionTraceMetadata, options?: RuntimeTraceFileOptions): AsyncGenerator<RuntimeInstructionTraceChunk>;
/**
 * Open a bounded JSON source for an importer that already validates every chunk. Keeping validation
 * at the consumer avoids cloning all addresses, bytes, registers and bus accesses twice per read.
 * @param {string} file Trace JSON path.
 * @param {RuntimeTraceFileOptions} options Input limits, cancellation and progress.
 * @returns {Promise<RuntimeTraceSource>} Metadata plus a reader that checks the complete envelope.
 */
export declare const createRuntimeTraceFileSource: (file: string, options?: RuntimeTraceFileOptions) => Promise<RuntimeTraceSource>;
/**
 * Import a native trace without allocating a file-sized string or retaining earlier chunks.
 * @param {string} file Trace path.
 * @param {RuntimeInstructionTraceImportContext} context Selected project identity.
 * @param {RuntimeTraceFileOptions} options Read budget and progress.
 * @returns {Promise<RuntimeInstructionTraceImportResult>} Merge-ready facts after full validation.
 */
export declare const importRuntimeInstructionTraceFile: (file: string, context: RuntimeInstructionTraceImportContext, options?: RuntimeTraceFileOptions) => Promise<RuntimeInstructionTraceImportResult>;
//# sourceMappingURL=runtime-trace-file.d.ts.map