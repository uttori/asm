import type { RuntimeBusTraceSource } from "./runtime-bus-trace.js";
import type { RuntimeTraceFileOptions } from "./runtime-trace-file.js";
import type { RuntimeTraceSource } from "./runtime-trace.js";
/** The archive's validated scope selects its importer; filenames and UI menu choices are not authority. */
export type RuntimeCaptureSource = {
    readonly kind: "instructions";
    readonly source: RuntimeTraceSource;
} | {
    readonly kind: "bus";
    readonly source: RuntimeBusTraceSource;
};
/** Select JSON instructions or ACT2 instruction/bus scopes. All readers still validate the complete stream. */
export declare function openRuntimeCaptureSource(file: string, options?: RuntimeTraceFileOptions): Promise<RuntimeCaptureSource>;
//# sourceMappingURL=capture-source.d.ts.map