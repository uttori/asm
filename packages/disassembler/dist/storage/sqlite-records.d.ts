import type { AnalysisRecord, RuntimeEvidenceRecord, RuntimeInstructionRecord } from "../model/project-types.js";
/**
 * Stable ordering for explicit runtime arrays, independent of insertion order in the working store.
 * @param left First semantic record.
 * @param right Second semantic record.
 * @returns Lexical ID comparison. Streaming consumers deliberately do not use this sort.
 */
export declare const compareRuntimeRecordIds: (left: RuntimeEvidenceRecord, right: RuntimeEvidenceRecord) => number;
/**
 * Store searchable coordinates as columns and variant-only fields as a bounded payload.
 * Unused coordinate columns stay null so one record kind cannot masquerade as another.
 * Canonicalize payloads here once: the writer reuses this exact text for hashing
 * and encoding, avoiding a JSON stringify/parse/canonicalize round trip per fact.
 * @param record Validated semantic runtime fact.
 * @returns Column bindings with canonical payload text. Absent variant fields remain omitted.
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
 * Validate all captured registers before selecting decoder fields, including otherwise unused ones.
 * Bytes are detached; the validated state belongs to the caller's decoded payload.
 */
export declare const runtimeInstructionFields: (value: Record<string, unknown> | undefined) => Pick<RuntimeInstructionRecord, "bytes" | "state">;
/**
 * Reconstruct a semantic fact without inventing absent optional fields. Stable-ID comparisons
 * depend on preserving the same payload across inserts and subsequent reads.
 * @param row SQLite runtime row selected with all columns.
 * @returns Decoded fact in its original discriminated shape.
 */
export declare const runtimeFromRow: (row: object) => RuntimeEvidenceRecord;
/** Flat semantic runtime fact, as stored inside an indexed trace payload. */
export declare function isRuntimeEvidenceRecord(value: unknown): value is RuntimeEvidenceRecord;
/**
 * Extract a point coordinate for persisted analysis metadata. Interval-only records have none.
 * @param record Semantic analysis variant.
 * @returns Point or source coordinate, with null columns when no point is represented.
 */
export declare const analysisAddress: (record: AnalysisRecord) => {
    addressSpace: string | null;
    address: number | null;
};
//# sourceMappingURL=sqlite-records.d.ts.map