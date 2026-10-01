import { type AnalysisProjectManifest, type AnalysisProjectShards, type RuntimeEvidenceRecord } from "./project-types.js";
/**
 * Validate the semantic manifest and reject obsolete storage descriptors.
 * @param {AnalysisProjectManifest} manifest Semantic identity and current storage descriptors.
 */
export declare const validateAnalysisProjectManifest: (manifest: AnalysisProjectManifest) => void;
/**
 * Validate runtime facts in one pass, spilling large duplicate-ID indexes to temporary disk storage.
 * Stored SQLite rows skip the duplicate index because their primary key already enforces uniqueness.
 * @param {object} project ROM bounds and named address spaces.
 * @param {Array} evidence Evidence available to every retained runtime fact.
 * @param {boolean} [checkDuplicateIds] False only for rows from a primary-key constrained table.
 * @returns {Function} Stateful validator. Close it after success or failure to release its temporary index.
 */
export declare const createRuntimeRecordValidator: (project: Pick<AnalysisProjectManifest, "addressSpaces" | "mapping" | "rom">, evidence: AnalysisProjectShards["evidence"], checkDuplicateIds?: boolean) => ((record: RuntimeEvidenceRecord) => void) & {
    close: () => void;
};
/**
 * Validate an iterable without copying its records into intermediate arrays.
 * @param {Iterable} records Complete runtime history.
 * @param {object} project ROM identity and address-space bounds.
 * @param {Array} evidence Valid referenced evidence.
 * @returns {void}
 */
export declare const validateRuntimeRecords: (records: Iterable<RuntimeEvidenceRecord>, project: Pick<AnalysisProjectManifest, "addressSpaces" | "mapping" | "rom">, evidence: AnalysisProjectShards["evidence"]) => void;
/**
 * Validate metadata, runtime values, address bounds and provenance before publication.
 * @param {AnalysisProjectShards} shards Complete record collections, or metadata with empty runtime.
 * @param {object} project ROM identity, mapper and address-space bounds.
 * @param {string} analysisScope Complete ownership at publication; partial only for bounded persisted views.
 */
export declare const validateLoadedShards: (shards: AnalysisProjectShards, project: Pick<AnalysisProjectManifest, "addressSpaces" | "mapping" | "rom">, analysisScope?: "complete" | "partial") => void;
//# sourceMappingURL=project-validation.d.ts.map