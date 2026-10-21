import { type InitializeSourceOptions } from "@uttori/asm-disassembler/source-project";
/** Verify a complete cartridge in staging before adding an editable Git project beside original inputs. */
export declare function initializeNesSourceProject(options: InitializeSourceOptions): Promise<{
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