import { type RuntimeInstructionTraceChunk, type RuntimeInstructionTraceImportContext, type RuntimeInstructionTraceImportResult, type RuntimeInstructionTraceMetadata, type RuntimeTraceSource } from "./runtime-trace.js";
export { DEFAULT_RUNTIME_TRACE_MAX_BYTES } from "../internal/capture-limits.js";
/** File import limits, cancellation and incremental progress. */
export interface RuntimeTraceFileOptions {
    /** Explicit ACT2-only recovery of checkpointed instructions after physical EOF; defaults to false. */
    readonly recoverPartial?: boolean;
    /** Positive safe integer byte limit for the whole input file. Defaults to 32 GiB, independently of heap/work budgets. */
    readonly maxBytes?: number;
    /** Checked between reads and after the final progress callback. Aborting rejects with signal.reason. */
    readonly signal?: AbortSignal;
    /** Synchronous byte progress. Throwing stops the read, and totalBytes is the initial file size. */
    readonly onProgress?: (readBytes: number, totalBytes: number) => void;
}
/**
 * Read identity before selecting a matching project. Normal recorder headers require one block.
 * @param file Trace path.
 * @param options Read budget and cancellation.
 * @returns Validated envelope (body checked on import).
 */
export declare const readRuntimeTraceFileMetadata: (file: string, options?: RuntimeTraceFileOptions) => Promise<RuntimeInstructionTraceMetadata>;
/**
 * Read and normalize ordered chunks for callers that need standalone validated data.
 * @param file Trace JSON path.
 * @param metadata Expected envelope identity.
 * @param options Input limits, cancellation and progress.
 * @yields {RuntimeInstructionTraceChunk} One normalized chunk. The tail is checked on exhaustion.
 */
export declare function readRuntimeTraceFileChunks(file: string, metadata: RuntimeInstructionTraceMetadata, options?: RuntimeTraceFileOptions): AsyncGenerator<RuntimeInstructionTraceChunk>;
/**
 * Open a bounded JSON source for an importer that already validates every chunk. Keeping validation
 * at the consumer avoids cloning all addresses, bytes, registers and bus accesses twice per read.
 * @param file Trace JSON path.
 * @param options Input limits, cancellation and progress.
 * @returns Metadata plus a reader that checks the complete envelope.
 */
export declare const createRuntimeTraceFileSource: (file: string, options?: RuntimeTraceFileOptions) => Promise<RuntimeTraceSource>;
/**
 * Import a native trace without allocating a file-sized string or retaining earlier chunks.
 * @param file Trace path.
 * @param context Selected project identity.
 * @param options Read budget and progress.
 * @returns Merge-ready facts after full validation.
 */
export declare const importRuntimeInstructionTraceFile: (file: string, context: RuntimeInstructionTraceImportContext, options?: RuntimeTraceFileOptions) => Promise<RuntimeInstructionTraceImportResult>;
//# sourceMappingURL=runtime-trace-file.d.ts.map