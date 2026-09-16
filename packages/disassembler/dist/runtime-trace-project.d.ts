import { type CaptureArchiveResult } from "./capture-archives.js";
import { type AnalysisProjectRevision } from "./project-transaction.js";
import { type AnalysisProjectShards, type RuntimeExecutionRecord } from "./project-types.js";
import { type RuntimeEvidenceBatch } from "./runtime-evidence.js";
import { type RuntimeTraceFileOptions } from "./runtime-trace-file.js";
import { type RuntimeInstructionTraceImportContext, type RuntimeInstructionTraceImportResult, type RuntimeTraceSource, type RuntimeTraceImporterStorage } from "./runtime-trace.js";
import type { AnalysisStoragePolicy, AnalysisStorageSnapshot } from "./sqlite-storage-policy.js";
/** File validation limits plus named progress phases for indexing and atomic publication. */
export interface RuntimeTraceProjectImportOptions extends RuntimeTraceFileOptions {
    /** Optional original file for a managed archive; decoded in-memory sources may omit it. */
    readonly archiveSourceFile?: string;
    readonly storagePolicy?: Partial<AnalysisStoragePolicy>;
    readonly onStage?: (message: string) => void;
    /** Counts validated records merged so far; all remain provisional until publication commits. */
    readonly onMergeProgress?: RuntimeTraceImporterStorage["onMergeProgress"];
}
/** Compact import result; complete runtime records remain in the SQLite working store. */
export interface RuntimeTraceProjectImportResult extends Omit<RuntimeInstructionTraceImportResult, "batch"> {
    readonly storage: {
        readonly before: AnalysisStorageSnapshot;
        readonly after: AnalysisStorageSnapshot;
        readonly newFacts: number;
        readonly reusedFacts: number;
        readonly checkpointBusy: boolean;
    };
    readonly archive: CaptureArchiveResult;
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
 * ROM mismatch and conflicting stable IDs leave the entire project unchanged.
 * @param {string} file Native instruction trace path.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeInstructionTraceImportContext} context Required ROM identity and requested indexing profile.
 * @param {RuntimeTraceProjectImportOptions} [options] Input budget, progress callbacks and cancellation signal.
 * @returns {Promise<RuntimeTraceProjectImportResult>} Committed counts and execution seeds; failures publish nothing.
 */
export declare const importRuntimeTraceIntoProject: (file: string, directory: string, context: RuntimeInstructionTraceImportContext, options?: RuntimeTraceProjectImportOptions) => Promise<RuntimeTraceProjectImportResult>;
/**
 * Import decoded producer chunks without an intermediate JSON artifact. Chunk memory is released
 * after each push; distinct facts use the existing SQLite index and atomic publication path.
 * @param {RuntimeTraceSource} source Ordered reader that rejects any invalid or incomplete envelope.
 * @param {string} directory Destination SQLite project root.
 * @param {RuntimeInstructionTraceImportContext} context Expected ROM, source name and index budget.
 * @param {RuntimeTraceProjectImportOptions} options Cancellation and progress; byte limits belong to the source.
 * @returns {Promise<RuntimeTraceProjectImportResult>} Committed facts; reader failures publish nothing.
 */
export declare const importRuntimeTraceSourceIntoProject: (source: RuntimeTraceSource, directory: string, context: RuntimeInstructionTraceImportContext, options?: RuntimeTraceProjectImportOptions) => Promise<RuntimeTraceProjectImportResult>;
/** Publish a combined offline batch without expanding the destination runtime history.
 * @param {string} directory Existing SQL project root.
 * @param {AnalysisProjectRevision} expected Revision used to verify the import ROM/mapper.
 * @param {RuntimeEvidenceBatch} batch Validated importer output; stable-ID conflicts roll back the entire batch.
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