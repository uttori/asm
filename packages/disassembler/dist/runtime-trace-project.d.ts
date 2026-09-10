import { type RuntimeExecutionRecord } from "./project-types.js";
import { type RuntimeTraceFileOptions } from "./runtime-trace-file.js";
import { type RuntimeInstructionTraceImportContext, type RuntimeInstructionTraceImportResult } from "./runtime-trace.js";
/** File validation limits plus named progress phases for indexing and atomic publication. */
export interface RuntimeTraceProjectImportOptions extends RuntimeTraceFileOptions {
    readonly onStage?: (message: string) => void;
}
/** Compact import result; complete runtime records remain in the SQLite working store. */
export interface RuntimeTraceProjectImportResult extends Omit<RuntimeInstructionTraceImportResult, "batch"> {
    readonly execution: readonly RuntimeExecutionRecord[];
    readonly changed: boolean;
    readonly added: {
        readonly runtime: number;
        readonly evidence: number;
    };
}
/**
 * Stream capture chunks into connection-local counters, then publish final runtime facts,
 * provenance and revision in one write transaction. Failed parsing, cancellation, stale readers,
 * ROM mismatch and conflicting stable IDs leave the entire project unchanged.
 * @param {string} file Native instruction trace path.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeInstructionTraceImportContext} context Required ROM identity and requested indexing profile.
 * @param {RuntimeTraceProjectImportOptions} [options] Input budget, progress callbacks and cancellation signal.
 * @returns {Promise<RuntimeTraceProjectImportResult>} Committed counts and execution seeds; failures publish nothing.
 */
export declare const importRuntimeTraceIntoProject: (file: string, directory: string, context: RuntimeInstructionTraceImportContext, options?: RuntimeTraceProjectImportOptions) => Promise<RuntimeTraceProjectImportResult>;
//# sourceMappingURL=runtime-trace-project.d.ts.map