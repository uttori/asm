import { HalfOpenIntervalIndex, type AnalysisControlFlowNodeRecord, type ProjectLabel, type ProjectComment } from "@uttori/asm-disassembler";
import type { NesCartridge } from "./cartridge.js";
import { type NesMapperState } from "./mapper.js";
/** One export's physical intervals and mapping-qualified research candidates; never retained across exports. */
export declare class NesSourceIndex {
    #private;
    /** Headerless cartridge-file intervals; overlapping execution contexts remain separate candidates. */
    readonly physical: HalfOpenIntervalIndex<{
        start: number;
        end: number;
        node: AnalysisControlFlowNodeRecord;
    }>;
    /** Research-free exports avoid mapper work used solely to qualify research coordinates. */
    constructor(rom: NesCartridge, nodes: readonly AnalysisControlFlowNodeRecord[], labels: readonly ProjectLabel[], hasResearch: boolean);
    /** Exact predicates still decide mapping selectors after the coordinate index narrows the search. */
    nodes(record: ProjectLabel | ProjectComment): readonly AnalysisControlFlowNodeRecord[];
    /** CPU and physical aliases compete in original declaration order; duplicate names stay ambiguous. */
    labels(address: number, mapper: NesMapperState): readonly ProjectLabel[];
}
/** Indexed overlap candidates retain all contexts while identical boundaries remain compatible. */
export declare function nesInstructionIntervals(nodes: readonly AnalysisControlFlowNodeRecord[]): HalfOpenIntervalIndex<{
    start: number;
    end: number;
    node: AnalysisControlFlowNodeRecord;
}>;
//# sourceMappingURL=source-index.d.ts.map