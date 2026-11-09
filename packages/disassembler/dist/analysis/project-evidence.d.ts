import type { AnalysisConflictRecord, AnalysisProjectShards, AnalysisRecord, IntervalAnnotation, ProjectLabel, ProjectComment, ProjectRegion, RuntimeEvidenceRecord, EvidenceRecord, ImportReport } from "../model/project-types.js";
/** Any persisted record addressable by shard and stable id. */
export type AnalysisProjectShardRecord = AnalysisRecord | IntervalAnnotation | ProjectLabel | ProjectComment | ProjectRegion | RuntimeEvidenceRecord | EvidenceRecord | ImportReport;
/** Provenance and conflict links for one persisted project record. */
export interface ProjectEvidenceExplanation {
    /** Exact SQL reverse-reference total when the displayed list is a bounded preview. */
    readonly referencedByTotal?: number;
    /** Collection that owns the explained record. */
    readonly shard: keyof AnalysisProjectShards;
    /** Native record whose provenance and conflicts are being inspected. */
    readonly record: AnalysisProjectShardRecord;
    /** Resolved evidence records referenced directly by the explained record. */
    readonly evidence: readonly EvidenceRecord[];
    /** Stable qualified references from other records back to this provenance. */
    readonly referencedBy: readonly string[];
    /** Persisted conflict records tied to the record or its evidence set. */
    readonly conflicts: readonly AnalysisConflictRecord[];
}
/**
 * List stable reverse links in collection order for evidence inspection and safe undo.
 * @param shards Validated project view, with runtime included only when requested.
 * @param evidenceId Exact provenance ID; no address inference is performed.
 * @returns Qualified collection/record references.
 */
export declare const evidenceReferences: (shards: AnalysisProjectShards, evidenceId: string) => readonly string[];
/**
 * Resolves complete evidence records, reverse references, and related persisted conflicts for one
 * stable project record. This is target-neutral and performs no mapper/address inference.
 * @param shards Validated native project records.
 * @param shard Shard containing the requested record.
 * @param recordId Stable record id to explain.
 * @returns Direct provenance, reverse links, and related conflicts.
 */
export declare const explainProjectEvidence: (shards: AnalysisProjectShards, shard: keyof AnalysisProjectShards, recordId: string) => ProjectEvidenceExplanation;
//# sourceMappingURL=project-evidence.d.ts.map