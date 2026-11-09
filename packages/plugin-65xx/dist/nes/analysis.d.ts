import { type StaticAnalysisLimits, type StaticAnalysisSeed, type StaticTargetOverride, type IntervalAnnotation } from "@uttori/asm-disassembler";
import { NesCartridge } from "./cartridge.js";
import { type NesMapperState } from "./mapper.js";
/** Constant propagation deliberately forgets values after unsupported arithmetic or memory reads. */
export interface NesAnalysisState {
    /** Mapper number or register snapshot. */
    readonly mapper: NesMapperState;
    /** Accumulator at the observation boundary. */
    readonly a: number | null;
    /** Index X at the observation boundary. */
    readonly x: number | null;
    /** Index Y at the observation boundary. */
    readonly y: number | null;
}
/** Empty NES analysis seed: unknown mapper, no banks, no PPU clock. */
export declare const initialNesAnalysisState: () => NesAnalysisState;
/** Decode through each live CPU window; noncontiguous physical fetches remain a conservative analysis boundary. */
export declare function decodeNesInstruction(rom: NesCartridge, address: number, state: NesMapperState): {
    result: import("@uttori/asm-core").ArchitectureDecodeResult;
    offsets: number[];
};
/** Worklist analysis seeds only justified entries. Unknown banks and indirect RAM pointers stop discovery. */
export declare function analyzeNes(rom: NesCartridge, options?: StaticAnalysisLimits & {
    readonly seeds?: readonly StaticAnalysisSeed<NesAnalysisState>[];
    readonly annotations?: readonly IntervalAnnotation[];
    readonly targetOverrides?: readonly StaticTargetOverride[];
}): import("@uttori/asm-disassembler").StaticAnalysisResult<NesAnalysisState>;
//# sourceMappingURL=analysis.d.ts.map