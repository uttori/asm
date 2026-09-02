import { type AnalysisRecord, type AnalysisTargetOverrideRecord, type AnalysisTargetSetRecord, type EvidenceRecord, type IntervalAnnotation, type ProjectLabel, type StaticAnalysisResult } from "@uttori/asm-disassembler";
import { SuperFxRomImage } from "./superfx-address-space.js";
import { type SuperFxAbstractState } from "./superfx-state.js";
export interface SuperFxEntryPoint {
    readonly id: string;
    readonly address: number;
    readonly state?: {
        readonly alt?: 0 | 1 | 2 | 3;
        readonly destinationRegister?: number;
        readonly sourceRegister?: number;
    };
    readonly evidence?: readonly string[];
}
export interface SuperFxAnalysisOptions {
    readonly entryPoints?: readonly SuperFxEntryPoint[];
    readonly labels?: readonly ProjectLabel[];
    readonly annotations?: readonly IntervalAnnotation[];
    readonly evidence?: readonly EvidenceRecord[];
    readonly targetOverrides?: readonly AnalysisTargetOverrideRecord[];
    readonly targetSets?: readonly AnalysisTargetSetRecord[];
    readonly maxWorkItems?: number;
    readonly maxCallDepth?: number;
}
export interface SuperFxAnalysisResult extends StaticAnalysisResult<SuperFxAbstractState> {
    readonly records: readonly AnalysisRecord[];
    readonly annotations: readonly IntervalAnnotation[];
    readonly evidenceRecords: readonly EvidenceRecord[];
}
/**
 * Runs conservative control-flow analysis over one contiguous SuperFX program image.
 * @param {SuperFxRomImage} image Immutable GSU ROM image to analyze.
 * @param {SuperFxAnalysisOptions} options Entry points, annotations, and overrides.
 * @returns {SuperFxAnalysisResult} CFG, evidence, conflicts, and project records.
 */
export declare const analyzeSuperFxRom: (image: SuperFxRomImage, options?: SuperFxAnalysisOptions) => SuperFxAnalysisResult;
//# sourceMappingURL=superfx-analysis.d.ts.map