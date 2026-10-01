import { type SourceProjectConfiguration } from "@uttori/asm-disassembler";
import { type SnesMapper, type PrepareSnesGenerationOptions } from "@uttori/asm-plugin-snes";
/** Creation owns a missing destination; existing projects must use normal generation and merge. */
export interface InitializeSourceOptions {
    readonly directory: string;
    readonly rom: string;
    /** Optional uncompressed DiztinGUIsh research, copied into Git declarations during creation. */
    readonly dizRawFile?: string;
    readonly mapper?: SnesMapper;
    readonly id?: string;
    readonly limits?: SourceProjectConfiguration["limits"];
    readonly signal?: AbortSignal;
    readonly onProgress?: (message: string) => void;
    readonly toolchainSha256: string;
    readonly loadEnvironment: PrepareSnesGenerationOptions["loadEnvironment"];
}
/**
 * Create, analyze and verify a new Git source repository in owned staging, then publish it once.
 * The original ROM stays private. A pure root commit and an ordinary source commit establish
 * cloneable regeneration ancestry without introducing managed-export manifests or folder backups.
 */
export declare function initializeSnesSourceProject(options: InitializeSourceOptions): Promise<{
    directory: string;
    generation: string;
    verification: import("@uttori/asm-disassembler").SourceBuildVerification;
    analysis: {
        status: "complete" | "incomplete";
        instructions: number;
        incompleteReasons: readonly import("@uttori/asm-disassembler").StaticAnalysisIncompleteReason[];
    };
}>;
//# sourceMappingURL=source-init.d.ts.map