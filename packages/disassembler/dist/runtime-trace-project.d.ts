import { type AnalysisProjectRevision } from "./project-transaction.js";
import { type AnalysisProjectShards, type RuntimeExecutionRecord } from "./project-types.js";
import { type RuntimeEvidenceBatch } from "./runtime-evidence.js";
import { type RuntimeTraceFileOptions } from "./runtime-trace-file.js";
import { type RuntimeInstructionTraceImportContext, type RuntimeInstructionTraceImportResult, type RuntimeTraceSource, type RuntimeTraceImporterStorage } from "./runtime-trace.js";
import type { AnalysisStoragePolicy, AnalysisStorageSnapshot } from "./sqlite-storage-policy.js";
/** File validation limits plus named progress phases for indexing and atomic publication. */
export interface RuntimeTraceProjectImportOptions extends RuntimeTraceFileOptions {
    /** Instruction imports save this before indexing. Bus imports save it with the final publication. */
    readonly storagePolicy?: Partial<AnalysisStoragePolicy>;
    /** Synchronous status callback. A throw before commit aborts the import, after commit it is a warning. */
    readonly onStage?: (message: string) => void;
    /** Counts validated records merged so far. All remain provisional until publication commits. */
    readonly onMergeProgress?: RuntimeTraceImporterStorage["onMergeProgress"];
}
/** Compact import result. Complete runtime records remain in the SQLite working store. */
export interface RuntimeTraceProjectImportResult extends Omit<RuntimeInstructionTraceImportResult, "batch"> {
    readonly storage: {
        readonly before: AnalysisStorageSnapshot;
        readonly after: AnalysisStorageSnapshot;
        readonly newFacts: number;
        readonly reusedFacts: number;
        readonly checkpointBusy: boolean;
    };
    readonly warnings: readonly string[];
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
 * ROM mismatch and conflicting stable IDs leave previously published facts and revision unchanged.
 * An explicit storage policy is saved separately before import. The input file is never moved or deleted.
 * A pointer-file error can reject after SQLite has committed. Reopen the project before retrying.
 * @param {string} file Native instruction trace path.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeInstructionTraceImportContext} context Required ROM identity and requested indexing profile.
 * @param {RuntimeTraceProjectImportOptions} [options] Input budget, progress callbacks and cancellation signal.
 * @returns {Promise<RuntimeTraceProjectImportResult>} Committed counts, execution seeds, and maintenance warnings.
 */
export declare const importRuntimeTraceIntoProject: (file: string, directory: string, context: RuntimeInstructionTraceImportContext, options?: RuntimeTraceProjectImportOptions) => Promise<RuntimeTraceProjectImportResult>;
/**
 * Import decoded producer chunks without an intermediate JSON artifact. Chunk memory is released
 * after each push. Distinct facts use the existing SQLite index and atomic publication path.
 * The caller owns the source and its cancellation behavior. This function closes its SQLite connection.
 * Cancellation is cooperative at read/merge boundaries, not preemptive during synchronous finalization.
 * Storage-policy changes and post-commit pointer failures follow importRuntimeTraceIntoProject.
 * @param {RuntimeTraceSource} source Ordered reader that rejects any invalid or incomplete envelope.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeInstructionTraceImportContext} context Expected ROM, source name and index budget.
 * @param {RuntimeTraceProjectImportOptions} options Cancellation and progress. Byte limits belong to the source.
 * @returns {Promise<RuntimeTraceProjectImportResult>} Committed facts. Reader failures publish nothing.
 */
export declare const importRuntimeTraceSourceIntoProject: (source: RuntimeTraceSource, directory: string, context: RuntimeInstructionTraceImportContext, options?: RuntimeTraceProjectImportOptions) => Promise<RuntimeTraceProjectImportResult>;
/** Publish a combined offline batch without expanding the destination runtime history.
 * @param {string} directory Existing SQL project root.
 * @param {AnalysisProjectRevision} expected Revision used to verify the import ROM/mapper.
 * @param {RuntimeEvidenceBatch} batch Validated importer output. Stable-ID conflicts roll back the entire batch.
 * @returns {object} Atomic import changes and counts.
 */
export declare const commitRuntimeEvidenceBatch: (directory: string, expected: AnalysisProjectRevision, batch: RuntimeEvidenceBatch) => {
    changed: boolean;
    added: {
        runtime: number;
        analysis: number;
        annotations: number;
        comments: number;
        evidence: number;
        imports: number;
        labels: number;
        regions: number;
    };
    updated: Readonly<Record<keyof AnalysisProjectShards, number>>;
};
//# sourceMappingURL=runtime-trace-project.d.ts.map