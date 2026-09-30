import type { AnalysisConflictRecord, AnalysisProjectShards, AnalysisRecord, IntervalAnnotation, ProjectLabel, ProjectComment, ProjectRegion, RuntimeEvidenceRecord, EvidenceRecord, ImportReport } from "../model/project-types.js";
/** Any persisted record addressable by shard and stable id. */
export type AnalysisProjectShardRecord = AnalysisRecord | IntervalAnnotation | ProjectLabel | ProjectComment | ProjectRegion | RuntimeEvidenceRecord | EvidenceRecord | ImportReport;
/** Provenance and conflict links for one persisted project record. */
export interface ProjectEvidenceExplanation {
    /** Exact SQL reverse-reference total when the displayed list is a bounded preview. */
    readonly referencedByTotal?: number;
    readonly shard: keyof AnalysisProjectShards;
    readonly record: AnalysisProjectShardRecord;
    readonly evidence: readonly EvidenceRecord[];
    readonly referencedBy: readonly string[];
    readonly conflicts: readonly AnalysisConflictRecord[];
}
/** List stable reverse links in collection order for evidence inspection and safe undo.
 * @param {AnalysisProjectShards} shards Validated project view, with runtime included only when requested.
 * @param {string} evidenceId Exact provenance ID; no address inference is performed.
 * @returns {readonly string[]} Qualified collection/record references.
 */
export declare const evidenceReferences: (shards: AnalysisProjectShards, evidenceId: string) => readonly string[];
/**
 * Resolves complete evidence records, reverse references, and related persisted conflicts for one
 * stable project record. This is target-neutral and performs no mapper/address inference.
 * @param {AnalysisProjectShards} shards Validated native project records.
 * @param {keyof AnalysisProjectShards} shard Shard containing the requested record.
 * @param {string} recordId Stable record id to explain.
 * @returns {ProjectEvidenceExplanation} Direct provenance, reverse links, and related conflicts.
 */
export declare const explainProjectEvidence: (shards: AnalysisProjectShards, shard: keyof AnalysisProjectShards, recordId: string) => ProjectEvidenceExplanation;
//# sourceMappingURL=project-evidence.d.ts.map