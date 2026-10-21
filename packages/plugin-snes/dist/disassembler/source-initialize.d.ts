import { type InitializeSourceOptions } from "@uttori/asm-disassembler/source-project";
export declare function initializeSnesSourceProject(options: InitializeSourceOptions): Promise<{
    directory: string;
    generation: string;
    verification: import("@uttori/asm-disassembler/source-project").SourceBuildVerification;
    analysis: {
        status: "complete" | "incomplete";
        instructions: number;
        incompleteReasons: readonly import("@uttori/asm-disassembler").StaticAnalysisIncompleteReason[];
    };
}>;
//# sourceMappingURL=source-initialize.d.ts.map