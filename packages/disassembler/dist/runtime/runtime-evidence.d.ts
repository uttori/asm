import { type AnalysisProjectShards, type AnalysisRecord, type EvidenceRecord, type ImportReport, type IntervalAnnotation, type ProjectComment, type ProjectLabel, type ProjectRegion, type RuntimeEvidenceRecord, type RuntimeStateValue } from "../model/project-types.js";
/** Shard records produced by one offline runtime-evidence import. */
export interface RuntimeEvidenceBatch {
    /** Analysis shard records produced by the import. */
    readonly analysis?: readonly AnalysisRecord[];
    /** Annotation shard records produced by the import. */
    readonly annotations?: readonly IntervalAnnotation[];
    /** Label shard records produced by the import. */
    readonly labels?: readonly ProjectLabel[];
    /** Comment shard records produced by the import. */
    readonly comments?: readonly ProjectComment[];
    /** Region shard records produced by the import. */
    readonly regions?: readonly ProjectRegion[];
    /** Runtime evidence records produced by the import. */
    readonly runtime?: readonly RuntimeEvidenceRecord[];
    /** Evidence provenance records produced by the import. */
    readonly evidence?: readonly EvidenceRecord[];
    /** Import reports describing the captured artifact. */
    readonly imports?: readonly ImportReport[];
}
/** One differing value observed at the same runtime fact location. */
export interface RuntimeConflictValue {
    /** Observed runtime state or opcode value at the conflict site. */
    readonly value: RuntimeStateValue;
    /** Runtime record ids that reported this value. */
    readonly records: readonly string[];
    /** Evidence ids supporting those runtime records. */
    readonly evidence: readonly string[];
}
/** Deterministic, non-destructive report of mutually different observations. */
export interface RuntimeEvidenceConflict {
    /** Stable conflict id derived from the conflicting observations. */
    readonly id: string;
    /** Whether the conflict compares CPU state, instruction size, or opcode bytes. */
    readonly kind: "cpu-state" | "instruction-size" | "opcode";
    /** Architecture tag shared by the conflicting runtime records. */
    readonly architecture: string;
    /** Address space containing the conflict site. */
    readonly addressSpace: string;
    /** Instruction address where the conflicting values were observed. */
    readonly address: number;
    /** Register or synthetic field name under comparison. */
    readonly field: string;
    /** Distinct values observed at the site with their supporting records. */
    readonly values: readonly RuntimeConflictValue[];
}
/** Human-readable link between imported evidence and a derived project fact. */
export interface RuntimeEvidenceExplanation {
    /** Project record id receiving the derived fact. */
    readonly recordId: string;
    /** Plain-language explanation of the runtime contribution. */
    readonly detail: string;
    /** Runtime evidence ids justifying the explanation. */
    readonly evidence: readonly string[];
}
/** Result of an idempotent merge. The original project object is not mutated. */
export interface RuntimeEvidenceMergeResult {
    /** Merged shard collections after applying the runtime batch. */
    readonly shards: AnalysisProjectShards;
    /** True when any shard changed during the merge. */
    readonly changed: boolean;
    /** Per-shard counts of newly inserted records. */
    readonly added: Readonly<Record<keyof AnalysisProjectShards, number>>;
    /** Per-shard counts of updated existing records. */
    readonly updated: Readonly<Record<keyof AnalysisProjectShards, number>>;
    /** Per-shard counts of incoming records that matched existing ids. */
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
 * Collections without incoming records retain their input arrays. Treat all shared records as readonly.
 * @param shards Valid native project shards with unique IDs in each collection.
 * @param batch Normalized imported and derived records.
 * @returns New shards plus deterministic merge diagnostics.
 */
export declare const mergeRuntimeEvidence: (shards: AnalysisProjectShards, batch: RuntimeEvidenceBatch) => RuntimeEvidenceMergeResult;
/**
 * Recomputes conflict and provenance explanations for a previously merged project.
 * @param shards Native project shards to inspect.
 * @returns Stable diagnostics.
 */
export declare const inspectRuntimeEvidence: (shards: AnalysisProjectShards) => Pick<RuntimeEvidenceMergeResult, "conflicts" | "explanations">;
//# sourceMappingURL=runtime-evidence.d.ts.map