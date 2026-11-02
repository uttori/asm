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

/** Sort and deduplicate stable reference strings for deterministic inspection output. */
const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].toSorted((left, right) => left.localeCompare(right));

/**
 * Resolves complete evidence records, reverse references, and related persisted conflicts for one
 * stable project record. This is target-neutral and performs no mapper/address inference.
 * @param shards Validated native project records.
 * @param shard Shard containing the requested record.
 * @param recordId Stable record id to explain.
 * @returns Direct provenance, reverse links, and related conflicts.
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
    .toSorted((left, right) => left.id.localeCompare(right.id));
  return { shard, record, evidence, referencedBy, conflicts };
};
