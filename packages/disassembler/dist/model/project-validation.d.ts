import { type AnalysisProjectManifest, type AnalysisProjectShards, type RuntimeEvidenceRecord } from "./project-types.js";
/**
 * Validate the semantic manifest and reject obsolete storage descriptors.
 * @param manifest Semantic identity and current storage descriptors.
 */
export declare function validateAnalysisProjectManifest(manifest: unknown): asserts manifest is AnalysisProjectManifest;
/**
 * Validate runtime facts in one pass, spilling large duplicate-ID indexes to temporary disk storage.
 * Stored SQLite rows skip the duplicate index because their primary key already enforces uniqueness.
 * @param project ROM bounds and named address spaces.
 * @param evidence Evidence available to every retained runtime fact.
 * @param [checkDuplicateIds] False only for rows from a primary-key constrained table.
 * @returns Stateful validator. Close it after success or failure to release its temporary index.
 */
export declare const createRuntimeRecordValidator: (project: Pick<AnalysisProjectManifest, "addressSpaces" | "mapping" | "rom">, evidence: AnalysisProjectShards["evidence"], checkDuplicateIds?: boolean) => ((record: RuntimeEvidenceRecord) => void) & {
    close: () => void;
};
/**
 * Validate an iterable without copying its records into intermediate arrays.
 * @param records Complete runtime history.
 * @param project ROM identity and address-space bounds.
 * @param evidence Valid referenced evidence.
 */
export declare const validateRuntimeRecords: (records: Iterable<RuntimeEvidenceRecord>, project: Pick<AnalysisProjectManifest, "addressSpaces" | "mapping" | "rom">, evidence: AnalysisProjectShards["evidence"]) => void;
/**
 * Validate metadata, runtime values, address bounds and provenance before publication.
 * @param shards Complete record collections, or metadata with empty runtime.
 * @param project ROM identity, mapper and address-space bounds.
 * @param analysisScope Complete ownership at publication; partial only for bounded persisted views.
 */
export declare const validateLoadedShards: (shards: AnalysisProjectShards, project: Pick<AnalysisProjectManifest, "addressSpaces" | "mapping" | "rom">, analysisScope?: "complete" | "partial") => void;
//# sourceMappingURL=project-validation.d.ts.map