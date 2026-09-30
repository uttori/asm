/** Indexed, bounded editor projections. Full analysis/export APIs retain their complete views. */
import type { DatabaseSync } from "node:sqlite";
import type { AnalysisProjectManifest, AnalysisProjectShards, AnalysisControlFlowNodeRecord } from "../model/project-types.js";
/** Exact logical/output coordinates from a validated debug map. Ranges are half-open. */
export interface AnnotationQueryRange {
    readonly architecture?: string;
    readonly addressSpace: string;
    readonly start: number;
    readonly end: number;
    readonly outputStart?: number;
    readonly outputEnd?: number;
}
/** A small semantic view plus explicit notice when an editor detail budget was reached. */
export interface SqliteAnnotationView {
    readonly shards: AnalysisProjectShards;
    readonly executionCounts: ReadonlyMap<string, number>;
    readonly limited: boolean;
}
/** Minimal persisted instruction contract needed for ROM/source validation and emission. */
export type InstructionExportRecord = Pick<AnalysisControlFlowNodeRecord, "id" | "kind" | "addressSpace" | "address" | "fileOffset" | "size" | "opcode" | "specificationId" | "incomingState" | "evidence">;
/**
 * Avoid acquiring a writer lock for ordinary viewport reads after indexes are current.
 * @param {DatabaseSync} database Open analysis connection.
 * @returns {boolean} Whether every persisted node/execution offset is indexed.
 */
export declare const annotationQueryIndexesReady: (database: DatabaseSync) => boolean;
/**
 * Install additive query indexes and incrementally extract explicit output offsets.
 * Triggers invalidate only changed rows, including writes from older clients. Authoritative
 * payloads, storage format version, and publication revision are untouched. The caller owns a writer lock.
 * @param {DatabaseSync} database Existing analysis database in a write transaction.
 */
export declare const ensureAnnotationQueryIndexes: (database: DatabaseSync) => void;
/**
 * Read requested instructions and their evidence, never a whole-project annotation projection.
 * Hot PCs have a bounded preview of variants/state/memory facts. Execution totals remain exact.
 * @param {DatabaseSync} database Connection with initialized indexes, inside a read transaction.
 * @param {AnalysisProjectManifest} manifest Authoritative manifest for this read snapshot.
 * @param {readonly AnnotationQueryRange[]} ranges At most 2000 validated source/debugger ranges.
 * @returns {SqliteAnnotationView} Bounded records suitable for the ordinary semantic annotation builder.
 */
export declare const readSqliteAnnotationView: (database: DatabaseSync, manifest: AnalysisProjectManifest, ranges: readonly AnnotationQueryRange[]) => SqliteAnnotationView;
/** Exact count at a qualified location, with explicit file offsets for mirror attribution. */
export interface InstructionExecutionSummary {
    readonly addressSpace: string;
    readonly address: number;
    readonly outputOffsets: readonly number[];
    readonly executionCount: number;
}
/** One requested span; counts are exact even when the number of displayed locations is bounded. */
export interface InstructionExecutionSummaryRow {
    readonly rangeIndex: number;
    readonly locations: readonly InstructionExecutionSummary[];
    readonly limited: boolean;
}
/**
 * Read only indexed coordinates and aggregate execution counts. No state, CFG payloads, memory,
 * or evidence records are decoded. Aliases retain separate counts instead of being summed.
 * @param {DatabaseSync} database Prepared project connection in the caller's read transaction.
 * @param {AnalysisProjectManifest} manifest Supplies file identities; no mapper inference is performed.
 * @param {readonly AnnotationQueryRange[]} ranges At most 2000 current source spans.
 * @returns {readonly InstructionExecutionSummaryRow[]} Exact counts with bounded, qualified locations.
 */
export declare const readInstructionExecutionSummary: (database: DatabaseSync, manifest: AnalysisProjectManifest, ranges: readonly AnnotationQueryRange[]) => readonly InstructionExecutionSummaryRow[];
//# sourceMappingURL=sqlite-annotation-query.d.ts.map