import { type AnalysisRecord, type AnalysisTargetOverrideRecord, type AnalysisTargetSetRecord, type EvidenceRecord, type IntervalAnnotation, type ProjectLabel, type StaticAnalysisLimits, type StaticAnalysisResult } from "@uttori/asm-disassembler";
import { type Spc700AramImage } from "./spc700-address-space.js";
import { type Spc700AbstractState, type Spc700StateOverride } from "./spc700-state.js";
/** Explicit seed for standalone SPC700 analysis. No reset-vector assumption is made. */
export interface Spc700EntryPoint {
    readonly id: string;
    readonly address: number;
    readonly state?: Spc700StateOverride;
    readonly evidence?: readonly string[];
}
/** Project shards, entry points, and deterministic worklist limits for SPC700 analysis. */
export interface Spc700AnalysisOptions extends StaticAnalysisLimits {
    readonly annotations?: readonly IntervalAnnotation[];
    readonly labels?: readonly ProjectLabel[];
    readonly evidence?: readonly EvidenceRecord[];
    readonly entryPoints?: readonly Spc700EntryPoint[];
    readonly targetSets?: readonly AnalysisTargetSetRecord[];
    readonly targetOverrides?: readonly AnalysisTargetOverrideRecord[];
}
/** SPC700 CFG plus project-shaped analysis, annotation, and evidence records. */
export interface Spc700AnalysisResult extends StaticAnalysisResult<Spc700AbstractState> {
    readonly records: readonly AnalysisRecord[];
    readonly annotations: readonly IntervalAnnotation[];
    readonly evidenceRecords: readonly EvidenceRecord[];
}
/**
 * Runs conservative SPC700 CFG analysis over one contiguous ARAM image.
 * Entry points are explicit or project-derived. The analyzer does not assume
 * that a standalone payload represents reset-time memory.
 * @param {Spc700AramImage} image Immutable contiguous ARAM bytes and load address.
 * @param {Spc700AnalysisOptions} [options] Project inputs, entry points, overrides, and limits.
 * @returns {Spc700AnalysisResult} Static CFG and project-shaped records.
 */
export declare const analyzeSpc700Aram: (image: Spc700AramImage, options?: Spc700AnalysisOptions) => Spc700AnalysisResult;
//# sourceMappingURL=spc700-analysis.d.ts.map