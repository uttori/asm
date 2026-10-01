import { type RuntimeTraceFileOptions } from "./runtime-trace-file.js";
import { type RuntimeTraceSource } from "./runtime-trace.js";
/**
 * Select JSON or ACT2 by its magic bytes. ACT2 instructions pass straight from the decoder to the
 * consumer, retaining only one bounded chunk. The durable archive remains the replayable source.
 * @param {string} file Selected capture, including older .json.act2 archives.
 * @param {RuntimeTraceFileOptions} options Input byte budget, cancellation and progress.
 * @returns {Promise<RuntimeTraceSource>} Identity plus a reader that rejects incomplete archives.
 */
export declare const createRuntimeCaptureSource: (file: string, options?: RuntimeTraceFileOptions) => Promise<RuntimeTraceSource>;
//# sourceMappingURL=capture-instruction-source.d.ts.map