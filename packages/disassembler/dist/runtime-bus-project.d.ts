import { type CaptureArchiveResult } from "./capture-archives.js";
import { type RuntimeBusTraceSource, type RuntimeBusTraceImportContext, type RuntimeBusTraceImportResult } from "./runtime-bus-trace.js";
import type { RuntimeTraceProjectImportOptions, RuntimeTraceProjectImportResult } from "./runtime-trace-project.js";
/** Compact bus import response; distinct facts and raw history remain in the project store/archive. */
export interface RuntimeBusProjectImportResult extends Omit<RuntimeBusTraceImportResult, "batch"> {
    readonly storage: RuntimeTraceProjectImportResult["storage"];
    readonly archive: CaptureArchiveResult;
    readonly warnings: readonly string[];
    readonly changed: boolean;
    readonly added: {
        readonly runtime: number;
        readonly evidence: number;
    };
}
/** Stage counters off heap and atomically publish only after the entire lossless stream validates.
 * @param {RuntimeBusTraceSource} source Bounded reader that rejects incomplete or changed captures.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeBusTraceImportContext} context Expected ROM identity and distinct-fact budget.
 * @param {RuntimeTraceProjectImportOptions} options Cancellation, progress and optional archive retention.
 * @returns {Promise<RuntimeBusProjectImportResult>} Committed counts and bounded channel/phase activity.
 */
export declare const importRuntimeBusTraceSourceIntoProject: (source: RuntimeBusTraceSource, directory: string, context: RuntimeBusTraceImportContext, options?: RuntimeTraceProjectImportOptions) => Promise<RuntimeBusProjectImportResult>;
//# sourceMappingURL=runtime-bus-project.d.ts.map