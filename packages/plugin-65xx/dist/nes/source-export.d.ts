import { type ProjectLabel, type ProjectComment, type IntervalAnnotation, type AnalysisControlFlowNodeRecord } from "@uttori/asm-disassembler";
import { type SourceGenerationFile } from "@uttori/asm-disassembler/source-project";
import type { NesCartridge } from "./cartridge.js";
/** One physical output segment, independent of the runtime mapper selection. */
export interface NesSourceSegment {
    readonly name: string;
    readonly offset: number;
    readonly size: number;
    readonly origin: number;
}
/** Stable 8 KiB PRG/CHR ownership with separate trainer/trailer segments. Offsets include the iNES header. */
export declare function nesSourceSegments(rom: NesCartridge, _nodes?: readonly AnalysisControlFlowNodeRecord[]): readonly NesSourceSegment[];
/** Export every physical byte once; ambiguous instruction boundaries remain editable binary data. */
export declare function exportNesSource(rom: NesCartridge, nodes: readonly AnalysisControlFlowNodeRecord[], romSha256: string, research?: {
    readonly labels?: readonly ProjectLabel[];
    readonly comments?: readonly ProjectComment[];
    /** Explicit data classifications and versioned text/graphics layouts, qualified to original bytes. */
    readonly annotations?: readonly IntervalAnnotation[];
}): {
    files: SourceGenerationFile[];
    segments: readonly NesSourceSegment[];
    codeBytes: number;
    ranges: readonly {
        start: number;
        end: number;
    }[];
};
//# sourceMappingURL=source-export.d.ts.map