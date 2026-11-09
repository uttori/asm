import { type InitializeSourceOptions } from "@uttori/asm-disassembler/source-project";
/**
 * Bootstrap a SNES Git source tree from a private ROM and optional research import.
 * @param options Destination path, ROM file, mapper hints and cancellation hook.
 */
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