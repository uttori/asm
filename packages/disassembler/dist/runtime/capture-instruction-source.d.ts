import { type RuntimeTraceFileOptions } from "./runtime-trace-file.js";
import { type RuntimeTraceSource } from "./runtime-trace.js";
/**
 * Select JSON or ACT2 by its magic bytes. ACT2 instructions pass straight from the decoder to the
 * consumer, retaining only one bounded chunk. The file is needed until this reader finishes;
 * imported project facts and provenance must remain usable after the input is removed.
 * @param file Selected capture, including older .json.act2 archives.
 * @param options Input byte budget, cancellation and progress.
 * @returns Identity plus a reader that rejects incomplete archives.
 */
export declare const createRuntimeCaptureSource: (file: string, options?: RuntimeTraceFileOptions) => Promise<RuntimeTraceSource>;
//# sourceMappingURL=capture-instruction-source.d.ts.map