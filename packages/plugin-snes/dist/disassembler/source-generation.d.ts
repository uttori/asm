import type { AssemblerEnvironment } from "@uttori/asm-core";
import { type SourceRepository, type SourceGeneration, type SourceGenerationFile, type SourceGenerationInputs } from "@uttori/asm-disassembler";
import { type SnesSourceBuild } from "./source-build.js";
/** Original asset inputs are borrowed from the accepted pure tree, never from an edited working PNG/JSON/WAV. */
export interface PrepareSnesGenerationOptions {
    readonly repository: SourceRepository;
    readonly parent: string;
    readonly evidenceDirectory: string;
    readonly romFile: string;
    /** Exact source projection prefix in this project repository, such as disassembly. */
    readonly sourceRoot: string;
    readonly inputs: SourceGenerationInputs;
    /** Explicit authoring maps/configuration, already captured by the caller. Paths are source-root relative. */
    readonly recipes: readonly SourceGenerationFile[];
    /** Exact research/configuration/catalog and evidence-manifest bytes retained in generation history. */
    readonly inputFiles: readonly SourceGenerationFile[];
    /** Repository-relative pristine inputs, taken from the accepted generation or explicitly extracted original ROM bytes. */
    readonly pristineAssets: readonly {
        readonly path: string;
        readonly sha256: string;
        /** Half-open, headerless original-ROM file offsets. This admits new binary inputs without trusting edited working files. */
        readonly romRange?: {
            readonly start: number;
            readonly end: number;
        };
    }[];
    /** Git-reviewed exceptions for withdrawing previously emitted code; reasons remain in the input receipt. */
    readonly codeWithdrawals?: readonly {
        readonly start: number;
        readonly end: number;
        readonly reason: string;
    }[];
    readonly signal?: AbortSignal;
    /** Host owns trusted plugin loading and disposal, keeping Node module loading out of the target layer. */
    readonly loadEnvironment: (configuration: string) => Promise<{
        readonly environment: AssemblerEnvironment;
        readonly includePaths: readonly string[];
        readonly targetOptions: Readonly<Record<string, unknown>>;
        dispose(): Promise<void>;
    }>;
}
/** Candidate and exact build proof; temporary source and build folders are reclaimed before returning. */
export interface PreparedSnesGeneration {
    readonly generation: SourceGeneration;
    readonly verification: SnesSourceBuild["verification"];
    readonly codeBytes: number;
    readonly files: number;
    readonly withdrawnCode: readonly {
        readonly start: number;
        readonly end: number;
    }[];
}
/** Exact render options include recipe contents and the pristine-asset selection, not host paths. */
export declare function snesGenerationOptionsHash(options: Pick<PrepareSnesGenerationOptions, "sourceRoot" | "recipes" | "pristineAssets" | "codeWithdrawals">): string;
/**
 * Render one pinned analysis snapshot in an owned temporary directory, verify the original ROM,
 * then retain only its immutable Git payload. No evidence/capture directory is copied and the
 * source checkout/index remain untouched. Failed candidates never acquire a retained Git ref.
 */
export declare function prepareSnesGeneration(options: PrepareSnesGenerationOptions): Promise<PreparedSnesGeneration>;
//# sourceMappingURL=source-generation.d.ts.map