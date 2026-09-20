import { type AnalysisProjectShards, type AnalysisRecord, type EvidenceRecord, type ImportReport, type IntervalAnnotation, type ProjectComment, type ProjectLabel, type ProjectRegion, type RuntimeEvidenceRecord, type RuntimeStateValue } from "./project-types.js";
/** Shard records produced by one offline runtime-evidence import. */
export interface RuntimeEvidenceBatch {
    readonly analysis?: readonly AnalysisRecord[];
    readonly annotations?: readonly IntervalAnnotation[];
    readonly labels?: readonly ProjectLabel[];
    readonly comments?: readonly ProjectComment[];
    readonly regions?: readonly ProjectRegion[];
    readonly runtime?: readonly RuntimeEvidenceRecord[];
    readonly evidence?: readonly EvidenceRecord[];
    readonly imports?: readonly ImportReport[];
}
/** One differing value observed at the same runtime fact location. */
export interface RuntimeConflictValue {
    readonly value: RuntimeStateValue;
    readonly records: readonly string[];
    readonly evidence: readonly string[];
}
/** Deterministic, non-destructive report of mutually different observations. */
export interface RuntimeEvidenceConflict {
    readonly id: string;
    readonly kind: "cpu-state" | "instruction-size" | "opcode";
    readonly architecture: string;
    readonly addressSpace: string;
    readonly address: number;
    readonly field: string;
    readonly values: readonly RuntimeConflictValue[];
}
/** Human-readable link between imported evidence and a derived project fact. */
export interface RuntimeEvidenceExplanation {
    readonly recordId: string;
    readonly detail: string;
    readonly evidence: readonly string[];
}
/** Result of an idempotent merge. The original project object is not mutated. */
export interface RuntimeEvidenceMergeResult {
    readonly shards: AnalysisProjectShards;
    readonly changed: boolean;
    readonly added: Readonly<Record<keyof AnalysisProjectShards, number>>;
    readonly updated: Readonly<Record<keyof AnalysisProjectShards, number>>;
    readonly existing: Readonly<Record<keyof AnalysisProjectShards, number>>;
    /** Computed and cached on first access. May expand millions of per-register observations. */
    readonly conflicts: readonly RuntimeEvidenceConflict[];
    /** Computed and cached on first access. Maintenance callers can merge without building this report. */
    readonly explanations: readonly RuntimeEvidenceExplanation[];
}
/**
 * Merges an offline evidence batch by stable id. Existing claims are never removed or rewritten.
 * Reimporting an identical batch returns `changed: false`. Differing observations remain separate
 * and are surfaced through `conflicts`. Diagnostic getters are lazy. Reading or serializing
 * them can require substantially more memory than merging the facts alone.
 * @param {AnalysisProjectShards} shards Existing native project shards.
 * @param {RuntimeEvidenceBatch} batch Normalized imported and derived records.
 * @returns {RuntimeEvidenceMergeResult} New shards plus deterministic merge diagnostics.
 */
export declare const mergeRuntimeEvidence: (shards: AnalysisProjectShards, batch: RuntimeEvidenceBatch) => RuntimeEvidenceMergeResult;
/**
 * Recomputes conflict and provenance explanations for a previously merged project.
 * @param {AnalysisProjectShards} shards Native project shards to inspect.
 * @returns {Pick<RuntimeEvidenceMergeResult, "conflicts" | "explanations">} Stable diagnostics.
 */
export declare const inspectRuntimeEvidence: (shards: AnalysisProjectShards) => Pick<RuntimeEvidenceMergeResult, "conflicts" | "explanations">;
//# sourceMappingURL=runtime-evidence.d.ts.map