import { type AnalysisProjectShards, type RuntimeExecutionRecord } from "../model/project-types.js";
import type { ResearchSnapshot } from "../research-inputs/inputs.js";
import { type RuntimeEvidenceBatch } from "../runtime/runtime-evidence.js";
import { type RuntimeTraceFileOptions } from "../runtime/runtime-trace-file.js";
import { type RuntimeInstructionTraceImportContext, type RuntimeInstructionTraceImportResult, type RuntimeTraceSource, type RuntimeTraceImporterStorage } from "../runtime/runtime-trace.js";
import type { AnalysisStoragePolicy, AnalysisStorageSnapshot } from "../storage/sqlite-storage-policy.js";
import { type AnalysisProjectRevision } from "./project-transaction.js";
/** File validation limits plus named progress phases for indexing and atomic publication. */
export interface RuntimeTraceProjectImportOptions extends RuntimeTraceFileOptions {
    /** Selected Git authoring snapshot, already indexed before asynchronous capture parsing. */
    readonly research?: ResearchSnapshot;
    /** Recheck branch/file selection under the publication lock; a throw publishes no capture facts. */
    readonly assertResearchCurrent?: () => void;
    /** Instruction imports save this before indexing. Bus imports save it with the final publication. */
    readonly storagePolicy?: Partial<AnalysisStoragePolicy>;
    /** Synchronous status callback. A throw before commit aborts the import, after commit it is a warning. */
    readonly onStage?: (message: string) => void;
    /** Counts validated records merged so far. All remain provisional until publication commits. */
    readonly onMergeProgress?: RuntimeTraceImporterStorage["onMergeProgress"];
    /**
     * Optional complete-archive cache identity, including companion manifest and importer version.
     * verify must recheck that identity after parsing; cached reuse also rechecks present companions.
     * Prefix recovery is never cached. Counters are disposable and removed after successful publication.
     */
    readonly validatedIndex?: {
        /** Private disposable storage, normally under the source project's .uttori-local directory. */
        readonly directory: string;
        readonly identity: string;
        readonly verify: () => Promise<void>;
    };
}
/** Compact import result. Complete runtime records remain in the SQLite working store. */
export interface RuntimeTraceProjectImportResult extends Omit<RuntimeInstructionTraceImportResult, "batch"> {
    /** Global storage accounting before and after publication, plus the post-commit WAL checkpoint state. */
    readonly storage: {
        readonly before: AnalysisStorageSnapshot;
        readonly after: AnalysisStorageSnapshot;
        readonly newFacts: number;
        readonly reusedFacts: number;
        readonly checkpointBusy: boolean;
    };
    /** Post-commit maintenance, prefix-recovery and reduced-index notices; none indicate a failed import. */
    readonly warnings: readonly string[];
    /** Execution records from this capture, sorted by address, for seeding analysis. */
    readonly execution: readonly RuntimeExecutionRecord[];
    /** Whether runtime facts or provenance were published; false leaves the revision and pointer untouched. */
    readonly changed: boolean;
    /** Runtime records and evidence entries new to the project in this import. */
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
 * @param file Native instruction trace path.
 * @param directory Destination SQLite project root.
 * @param context Required ROM identity and requested indexing profile.
 * @param [options] Input budget, progress callbacks and cancellation signal.
 * @returns Committed counts, execution seeds, and maintenance warnings.
 */
export declare const importRuntimeTraceIntoProject: (file: string, directory: string, context: RuntimeInstructionTraceImportContext, options?: RuntimeTraceProjectImportOptions) => Promise<RuntimeTraceProjectImportResult>;
/** Same committed evidence and exact per-import counts, without scanning all historical storage rows. */
type CompactRuntimeTraceProjectImportResult = Omit<RuntimeTraceProjectImportResult, "storage">;
/**
 * Import decoded producer chunks without an intermediate JSON artifact. Chunk memory is released
 * after each push. Distinct facts use the existing SQLite index and atomic publication path.
 * The caller owns the source and its cancellation behavior. This function closes its SQLite connection.
 * Cancellation is cooperative at read/merge boundaries, not preemptive during synchronous finalization.
 * Storage-policy changes and post-commit pointer failures follow importRuntimeTraceIntoProject.
 * storageStatistics:false omits global storage accounting; validation and exact per-import counts remain.
 * @param source Ordered reader that verifies completion or supplies explicit prefix recovery metadata.
 * @param directory Destination SQLite project root.
 * @param context Expected ROM, source name and index budget.
 * @param options Cancellation and progress. Byte limits belong to the source.
 * @returns Committed facts and requested storage accounting. Reader failures publish nothing.
 */
export declare function importRuntimeTraceSourceIntoProject(source: RuntimeTraceSource, directory: string, context: RuntimeInstructionTraceImportContext, options: RuntimeTraceProjectImportOptions & {
    readonly storageStatistics: false;
}): Promise<CompactRuntimeTraceProjectImportResult>;
export declare function importRuntimeTraceSourceIntoProject(source: RuntimeTraceSource, directory: string, context: RuntimeInstructionTraceImportContext, options?: RuntimeTraceProjectImportOptions & {
    readonly storageStatistics?: true;
}): Promise<RuntimeTraceProjectImportResult>;
export declare function importRuntimeTraceSourceIntoProject(source: RuntimeTraceSource, directory: string, context: RuntimeInstructionTraceImportContext, options: RuntimeTraceProjectImportOptions & {
    readonly storageStatistics: boolean;
}): Promise<RuntimeTraceProjectImportResult | CompactRuntimeTraceProjectImportResult>;
/**
 * Publish a combined offline batch without expanding the destination runtime history.
 * @param directory Existing SQL project root.
 * @param expected Revision used to verify the import ROM/mapper.
 * @param batch Validated importer output. Stable-ID conflicts roll back the entire batch.
 * @returns Atomic import changes and counts.
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
export {};
//# sourceMappingURL=runtime-trace-project.d.ts.map