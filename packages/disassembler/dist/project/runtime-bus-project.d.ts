import { type RuntimeBusTraceSource, type RuntimeBusTraceImportContext, type RuntimeBusTraceImportResult } from "../runtime/runtime-bus-trace.js";
import type { RuntimeTraceProjectImportOptions, RuntimeTraceProjectImportResult } from "./runtime-trace-project.js";
/** Compact bus import response. Distinct facts remain in the project store and raw history in the source capture. */
export interface RuntimeBusProjectImportResult extends Omit<RuntimeBusTraceImportResult, "batch"> {
    /** Global storage accounting before and after publication, plus the post-commit WAL checkpoint state. */
    readonly storage: RuntimeTraceProjectImportResult["storage"];
    /** Post-commit maintenance notices; none indicate a failed import. */
    readonly warnings: readonly string[];
    /** Whether runtime facts or provenance were published; false leaves the revision and pointer untouched. */
    readonly changed: boolean;
    /** Runtime records and evidence entries new to the project in this import. */
    readonly added: {
        readonly runtime: number;
        readonly evidence: number;
    };
}
/**
 * Stage counters off heap and atomically publish only after the entire lossless stream validates.
 * Owns and closes its SQLite connection, but does not own or delete the caller's source archive.
 * Cancellation is checked between chunks and records. Facts and requested storage limits roll back
 * together before commit. A pointer-file failure can reject after commit, so reopen before retrying.
 * @param source Bounded reader that rejects incomplete or changed captures.
 * @param directory Destination SQLite project root.
 * @param context Expected ROM identity and distinct-fact budget.
 * @param options Cancellation, progress and storage limits.
 * @returns Committed counts and bounded channel/phase activity.
 */
export declare const importRuntimeBusTraceSourceIntoProject: (source: RuntimeBusTraceSource, directory: string, context: RuntimeBusTraceImportContext, options?: RuntimeTraceProjectImportOptions) => Promise<RuntimeBusProjectImportResult>;
//# sourceMappingURL=runtime-bus-project.d.ts.map