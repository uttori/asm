import type { InitializeSourceOptions } from "./source-init.js";
/** Verify a complete cartridge in staging before adding an editable Git project beside original inputs. */
export declare function initializeNesSourceProject(options: InitializeSourceOptions): Promise<{
    directory: string;
    generation: string;
    verification: import("@uttori/asm-disassembler").SourceBuildVerification;
    analysis: {
        status: "complete" | "incomplete";
        instructions: number;
        incompleteReasons: readonly import("@uttori/asm-disassembler").StaticAnalysisIncompleteReason[];
    };
}>;
//# sourceMappingURL=source-init-nes.d.ts.map