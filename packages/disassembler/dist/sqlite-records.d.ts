import type { AnalysisRecord, RuntimeEvidenceRecord } from "./project-types.js";
/**
 * Stable ordering for explicit runtime arrays, independent of insertion order in the working store.
 * @param {RuntimeEvidenceRecord} left First semantic record.
 * @param {RuntimeEvidenceRecord} right Second semantic record.
 * @returns {number} Lexical ID comparison; streaming consumers deliberately do not use this sort.
 */
export declare const compareRuntimeRecordIds: (left: RuntimeEvidenceRecord, right: RuntimeEvidenceRecord) => number;
/**
 * Store searchable coordinates as columns and variant-only fields as a bounded payload.
 * Unused coordinate columns stay null so one record kind cannot masquerade as another.
 * Canonicalize payloads here once: the writer reuses this exact text for hashing
 * and encoding, avoiding a JSON stringify/parse/canonicalize round trip per fact.
 * @param {RuntimeEvidenceRecord} record Validated semantic runtime fact.
 * @returns {object} Column bindings with canonical payload text; absent variant fields remain omitted.
 */
export declare const runtimeColumns: (record: RuntimeEvidenceRecord) => {
    addressSpace: string | null;
    address: number | null;
    start: number | null;
    end: number | null;
    fromAddressSpace: string | null;
    fromAddress: number | null;
    toAddressSpace: string | null;
    toAddress: number | null;
    instructionAddressSpace: string | null;
    instructionAddress: number | null;
    accessedAddressSpace: string | null;
    accessedAddress: number | null;
    coverage: string | null;
    payload: string | null;
};
/**
 * Reconstruct a semantic fact without inventing absent optional fields; stable-ID comparisons
 * depend on preserving the same payload across inserts and subsequent reads.
 * @param {object} row SQLite runtime row selected with all columns.
 * @returns {RuntimeEvidenceRecord} Decoded fact in its original discriminated shape.
 */
export declare const runtimeFromRow: (row: object) => RuntimeEvidenceRecord;
/**
 * Extract a point coordinate for persisted analysis metadata; interval-only records have none.
 * @param {AnalysisRecord} record Semantic analysis variant.
 * @returns {object} Point or source coordinate, with null columns when no point is represented.
 */
export declare const analysisAddress: (record: AnalysisRecord) => {
    addressSpace: string | null;
    address: number | null;
};
//# sourceMappingURL=sqlite-records.d.ts.map