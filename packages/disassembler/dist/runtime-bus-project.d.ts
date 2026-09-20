import { type RuntimeBusTraceSource, type RuntimeBusTraceImportContext, type RuntimeBusTraceImportResult } from "./runtime-bus-trace.js";
import type { RuntimeTraceProjectImportOptions, RuntimeTraceProjectImportResult } from "./runtime-trace-project.js";
/** Compact bus import response. Distinct facts remain in the project store and raw history in the source capture. */
export interface RuntimeBusProjectImportResult extends Omit<RuntimeBusTraceImportResult, "batch"> {
    readonly storage: RuntimeTraceProjectImportResult["storage"];
    readonly warnings: readonly string[];
    readonly changed: boolean;
    readonly added: {
        readonly runtime: number;
        readonly evidence: number;
    };
}
/** Stage counters off heap and atomically publish only after the entire lossless stream validates.
 * Owns and closes its SQLite connection, but does not own or delete the caller's source archive.
 * Cancellation is checked between chunks and records. Facts and requested storage limits roll back
 * together before commit. A pointer-file failure can reject after commit, so reopen before retrying.
 * @param {RuntimeBusTraceSource} source Bounded reader that rejects incomplete or changed captures.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeBusTraceImportContext} context Expected ROM identity and distinct-fact budget.
 * @param {RuntimeTraceProjectImportOptions} options Cancellation, progress and storage limits.
 * @returns {Promise<RuntimeBusProjectImportResult>} Committed counts and bounded channel/phase activity.
 */
export declare const importRuntimeBusTraceSourceIntoProject: (source: RuntimeBusTraceSource, directory: string, context: RuntimeBusTraceImportContext, options?: RuntimeTraceProjectImportOptions) => Promise<RuntimeBusProjectImportResult>;
//# sourceMappingURL=runtime-bus-project.d.ts.map