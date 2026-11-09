import { type RuntimeBusTraceSource } from "./runtime-bus-trace.js";
import { type RuntimeTraceFileOptions } from "./runtime-trace-file.js";
/**
 * Decode checkpointed ACT2 bus chunks without an intermediate JSON file or instruction projection.
 * @param file Complete lossless bus archive.
 * @param options Byte budget, progress and cancellation.
 * @returns Provisional stream. Read rejects torn tails or changed identity.
 */
export declare const createRuntimeBusCaptureSource: (file: string, options?: RuntimeTraceFileOptions) => Promise<RuntimeBusTraceSource>;
//# sourceMappingURL=capture-bus-source.d.ts.map