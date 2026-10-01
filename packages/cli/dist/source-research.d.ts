import { type ResearchSymbolChange, type SourceProject, type AddressSpaceDescriptor, type ResearchAnalysisChange, type ResearchAnalysisRecord } from "@uttori/asm-disassembler";
/** Omit the selection to list declarations; a selected change returns a proposal without saving it. */
export type SourceResearchRequest = {
    readonly kind?: "symbols";
    readonly symbolId?: string;
    readonly change?: ResearchSymbolChange;
} | {
    readonly kind: "analysis";
    readonly change?: ResearchAnalysisChange;
};
/** Compact picker/navigation data; original addresses remain valid after source relocation. */
export interface SourceResearchSymbol {
    readonly id: string;
    readonly name: string;
    readonly path: string;
    readonly addressSpace: string;
    readonly address: number;
    readonly aliases: readonly string[];
    readonly suppressed: boolean;
    readonly entryPoint: boolean;
}
/** Exact before/after text supports both terminal review and one native workspace undo operation. */
export type SourceResearchResult = {
    readonly kind: "symbols";
    readonly symbols: readonly SourceResearchSymbol[];
} | {
    readonly kind: "analysis";
    readonly documents: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
    readonly addressSpaces: readonly AddressSpaceDescriptor[];
    readonly records: readonly {
        readonly path: string;
        readonly collection: "annotations" | "analysis";
        readonly value: ResearchAnalysisRecord;
    }[];
} | {
    readonly kind: "edit";
    readonly path: string;
    readonly beforeSha256: string;
    readonly before: string;
    readonly after: string;
};
/** Research choices are prepared from saved files plus optional editor buffers, never written to SQLite. */
export declare function prepareSourceResearch(project: SourceProject, request?: SourceResearchRequest, buffers?: readonly {
    readonly path: string;
    readonly bytes: Uint8Array;
}[]): SourceResearchResult;
//# sourceMappingURL=source-research.d.ts.map