import type {
  AnalysisConflictRecord,
  AnalysisProjectShards,
  AnalysisRecord,
  IntervalAnnotation,
  ProjectLabel,
  ProjectComment,
  ProjectRegion,
  RuntimeEvidenceRecord,
  EvidenceRecord,
  ImportReport,
} from "../model/project-types.js";

/** Any persisted record addressable by shard and stable id. */
export type AnalysisProjectShardRecord =
  | AnalysisRecord
  | IntervalAnnotation
  | ProjectLabel
  | ProjectComment
  | ProjectRegion
  | RuntimeEvidenceRecord
  | EvidenceRecord
  | ImportReport;

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
export const evidenceReferences = (
  shards: AnalysisProjectShards,
  evidenceId: string,
): readonly string[] => [
  ...shards.analysis
    .filter((record) => record.evidence.includes(evidenceId))
    .map((record) => `analysis:${record.id}`),
  ...shards.annotations
    .filter((record) => record.evidence.includes(evidenceId))
    .map((record) => `annotations:${record.id}`),
  ...shards.labels
    .filter((record) => record.evidence.includes(evidenceId))
    .map((record) => `labels:${record.id}`),
  ...shards.comments
    .filter((record) => record.evidence.includes(evidenceId))
    .map((record) => `comments:${record.id}`),
  ...shards.regions
    .filter((record) => record.evidence.includes(evidenceId))
    .map((record) => `regions:${record.id}`),
  ...shards.runtime
    .filter((record) => record.evidence.includes(evidenceId))
    .map((record) => `runtime:${record.id}`),
];

const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

/**
 * Resolves complete evidence records, reverse references, and related persisted conflicts for one
 * stable project record. This is target-neutral and performs no mapper/address inference.
 * @param {AnalysisProjectShards} shards Validated native project records.
 * @param {keyof AnalysisProjectShards} shard Shard containing the requested record.
 * @param {string} recordId Stable record id to explain.
 * @returns {ProjectEvidenceExplanation} Direct provenance, reverse links, and related conflicts.
 */
export const explainProjectEvidence = (
  shards: AnalysisProjectShards,
  shard: keyof AnalysisProjectShards,
  recordId: string,
): ProjectEvidenceExplanation => {
  const records: readonly AnalysisProjectShardRecord[] = shards[shard];
  const record = records.find(({ id }) => id === recordId);
  if (!record) {
    throw new Error(`Analysis ${shard} record '${recordId}' does not exist.`);
  }
  let evidenceIds: readonly string[] = [];
  if (shard === "evidence") {
    evidenceIds = [record.id];
  } else if ("evidence" in record) {
    evidenceIds = record.evidence;
  }
  const evidence = evidenceIds.map((id) => {
    const found = shards.evidence.find((entry) => entry.id === id);
    if (!found) {
      throw new Error(`Analysis record '${recordId}' refers to missing evidence '${id}'.`);
    }
    return found;
  });
  const referencedBy = sortedUnique(evidenceIds.flatMap((id) => evidenceReferences(shards, id)));
  const evidenceSet = new Set(evidenceIds);
  const conflicts = shards.analysis
    .filter(
      (entry): entry is AnalysisConflictRecord =>
        entry.kind === "conflict" &&
        (entry.id === recordId ||
          entry.nodes.includes(recordId) ||
          entry.evidence.some((id) => evidenceSet.has(id))),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  return { shard, record, evidence, referencedBy, conflicts };
};
