import { type AnalysisProjectShards, type IntervalAnnotation, type ResearchMapping, type StaticAnalysisSeed, type StaticTargetOverride } from "@uttori/asm-disassembler";
import type { NesAnalysisState } from "./analysis.js";
import type { NesCartridge } from "./cartridge.js";
import { type NesMapperState } from "./mapper.js";
/** Flatten only mapper registers. CPU values never participate in a bank selector. */
export declare function nesResearchState(mapper: NesMapperState): Readonly<Record<string, number | boolean | null>>;
/** Missing registers remain unknown; a research seed must not inherit the emulator's reset profile. */
export declare function nesResearchMapper(mapping?: ResearchMapping): NesMapperState;
/** Test physical or CPU research at an instruction, including a range's anchored physical delta. */
export declare function matchesNesResearch(rom: NesCartridge, record: {
    readonly addressSpace: string;
    readonly mapping?: ResearchMapping;
} & ({
    readonly address: number;
} | {
    readonly start: number;
    readonly end: number;
}), address: number, mapper: NesMapperState): boolean;
/** Build explicit inputs from the selected research projection. Bare switchable CPU locations are rejected. */
export declare function nesResearchInputs(rom: NesCartridge, view: Pick<AnalysisProjectShards, "labels" | "comments" | "annotations" | "analysis" | "regions">): {
    seeds: StaticAnalysisSeed<NesAnalysisState>[];
    annotations: readonly IntervalAnnotation[];
    targetOverrides: StaticTargetOverride[];
};
/** Validate persisted CFG mapper state before matching research or naming a physical instruction. */
export declare function nesStoredMapper(state: Readonly<Record<string, unknown>>): NesMapperState;
//# sourceMappingURL=research.d.ts.map