/** Indexed, bounded editor projections. Full analysis/export APIs retain their complete views. */
import type { DatabaseSync } from "node:sqlite";
import type { AnalysisProjectManifest, AnalysisProjectShards, AnalysisControlFlowNodeRecord } from "../model/project-types.js";
/** Exact logical/output coordinates from a validated debug map. Ranges are half-open. */
export interface AnnotationQueryRange {
    /** Restricts runtime facts to one architecture; undefined matches any architecture. */
    readonly architecture?: string;
    /** Logical address space of the source span. */
    readonly addressSpace: string;
    /** Inclusive logical start address. */
    readonly start: number;
    /** Exclusive logical end address; must exceed `start`. */
    readonly end: number;
    /** Inclusive output file offset; set together with `outputEnd` or not at all. */
    readonly outputStart?: number;
    /** Exclusive output file offset; must exceed `outputStart`. */
    readonly outputEnd?: number;
}
/** A small semantic view plus explicit notice when an editor detail budget was reached. */
export interface SqliteAnnotationView {
    /** Bounded analysis and runtime records for the requested ranges. */
    readonly shards: AnalysisProjectShards;
    /** Exact SQL execution totals keyed by `space:address`, independent of the detail budget. */
    readonly executionCounts: ReadonlyMap<string, number>;
    /** True when any location or record budget truncated the detail view. */
    readonly limited: boolean;
}
/** Minimal persisted instruction contract needed for ROM/source validation and emission. */
export type InstructionExportRecord = Pick<AnalysisControlFlowNodeRecord, "id" | "kind" | "addressSpace" | "address" | "fileOffset" | "size" | "opcode" | "specificationId" | "incomingState" | "evidence">;
/**
 * Avoid acquiring a writer lock for ordinary viewport reads after indexes are current.
 * @param database Open analysis connection.
 * @returns Whether every persisted node/execution offset is indexed.
 */
export declare const annotationQueryIndexesReady: (database: DatabaseSync) => boolean;
/**
 * Install additive query indexes and incrementally extract explicit output offsets.
 * Triggers invalidate only changed rows, including writes from older clients. Authoritative
 * payloads, storage format version, and publication revision are untouched. The caller owns a writer lock.
 * @param database Existing analysis database in a write transaction.
 */
export declare const ensureAnnotationQueryIndexes: (database: DatabaseSync) => void;
/**
 * Read requested instructions and their evidence, never a whole-project annotation projection.
 * Hot PCs have a bounded preview of variants/state/memory facts. Execution totals remain exact.
 * @param database Connection with initialized indexes, inside a read transaction.
 * @param manifest Authoritative manifest for this read snapshot.
 * @param ranges At most 2000 validated source/debugger ranges.
 * @returns Bounded records suitable for the ordinary semantic annotation builder.
 */
export declare const readSqliteAnnotationView: (database: DatabaseSync, manifest: AnalysisProjectManifest, ranges: readonly AnnotationQueryRange[]) => SqliteAnnotationView;
/** Exact count at a qualified location, with explicit file offsets for mirror attribution. */
export interface InstructionExecutionSummary {
    /** Qualified address space of the executed location; mirrors keep their own space. */
    readonly addressSpace: string;
    /** Instruction start within `addressSpace`. */
    readonly address: number;
    /** Output file offsets observed for this location; empty when none were recorded. */
    readonly outputOffsets: readonly number[];
    /** Exact summed observation count at this location. */
    readonly executionCount: number;
}
/** One requested span; counts are exact even when the number of displayed locations is bounded. */
export interface InstructionExecutionSummaryRow {
    /** Index of the originating entry in the requested ranges. */
    readonly rangeIndex: number;
    /** At most 64 distinct qualified locations. */
    readonly locations: readonly InstructionExecutionSummary[];
    /** True when more locations existed than were returned. */
    readonly limited: boolean;
}
/**
 * Read only indexed coordinates and aggregate execution counts. No state, CFG payloads, memory,
 * or evidence records are decoded. Aliases retain separate counts instead of being summed.
 * @param database Prepared project connection in the caller's read transaction.
 * @param manifest Supplies file identities; no mapper inference is performed.
 * @param ranges At most 2000 current source spans.
 * @returns Exact counts with bounded, qualified locations.
 */
export declare const readInstructionExecutionSummary: (database: DatabaseSync, manifest: AnalysisProjectManifest, ranges: readonly AnnotationQueryRange[]) => readonly InstructionExecutionSummaryRow[];
//# sourceMappingURL=sqlite-annotation-query.d.ts.map