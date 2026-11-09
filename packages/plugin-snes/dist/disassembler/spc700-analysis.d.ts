import { type AnalysisRecord, type AnalysisTargetOverrideRecord, type AnalysisTargetSetRecord, type EvidenceRecord, type IntervalAnnotation, type ProjectLabel, type StaticAnalysisLimits, type StaticAnalysisResult } from "@uttori/asm-disassembler";
import { type Spc700AramImage } from "./spc700-address-space.js";
import { type Spc700AbstractState, type Spc700StateOverride } from "./spc700-state.js";
/** Explicit seed for standalone SPC700 analysis. No reset-vector assumption is made. */
export interface Spc700EntryPoint {
    /** Stable seed id referenced by analysis records. */
    readonly id: string;
    /** 16-bit ARAM address where decoding begins. */
    readonly address: number;
    /** Optional PSW/direct-page overlay applied at entry. */
    readonly state?: Spc700StateOverride;
    /** Evidence ids justifying this seed; synthesized when omitted. */
    readonly evidence?: readonly string[];
}
/** Project shards, entry points, and deterministic worklist limits for SPC700 analysis. */
export interface Spc700AnalysisOptions extends StaticAnalysisLimits {
    /** Existing interval annotations that block decoding or supply seeds. */
    readonly annotations?: readonly IntervalAnnotation[];
    /** Project labels converted to ARAM entry seeds when in range. */
    readonly labels?: readonly ProjectLabel[];
    /** Prior evidence records reused and deduplicated for this run. */
    readonly evidence?: readonly EvidenceRecord[];
    /** Explicit ARAM entry points beyond labels and annotations. */
    readonly entryPoints?: readonly Spc700EntryPoint[];
    /** Target-set addresses seeded as additional entry points. */
    readonly targetSets?: readonly AnalysisTargetSetRecord[];
    /** Manual overrides for indirect control transfers. */
    readonly targetOverrides?: readonly AnalysisTargetOverrideRecord[];
}
/** SPC700 CFG plus project-shaped analysis, annotation, and evidence records. */
export interface Spc700AnalysisResult extends StaticAnalysisResult<Spc700AbstractState> {
    /** CFG nodes, edges, diagnostics and summary records for publication. */
    readonly records: readonly AnalysisRecord[];
    /** Opcode/operand intervals regenerated from the CFG decode. */
    readonly annotations: readonly IntervalAnnotation[];
    /** Input evidence plus run and entry evidence sorted by id. */
    readonly evidenceRecords: readonly EvidenceRecord[];
}
/**
 * Runs conservative SPC700 CFG analysis over one contiguous ARAM image.
 * Entry points are explicit or project-derived. The analyzer does not assume
 * that a standalone payload represents reset-time memory.
 * @param image Immutable contiguous ARAM bytes and load address.
 * @param [options] Project inputs, entry points, overrides, and limits.
 * @returns Static CFG and project-shaped records.
 */
export declare const analyzeSpc700Aram: (image: Spc700AramImage, options?: Spc700AnalysisOptions) => Spc700AnalysisResult;
//# sourceMappingURL=spc700-analysis.d.ts.map