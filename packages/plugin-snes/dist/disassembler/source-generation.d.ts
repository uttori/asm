import { type SourceGenerationOptions as PrepareSnesGenerationOptions, type PreparedSourceGeneration as PreparedSnesGeneration } from "@uttori/asm-disassembler/source-project";
export type { SourceGenerationOptions as PrepareSnesGenerationOptions, PreparedSourceGeneration as PreparedSnesGeneration, } from "@uttori/asm-disassembler/source-project";
/** Exact render options include recipe contents and the pristine-asset selection, not host paths. */
export declare function snesGenerationOptionsHash(options: Pick<PrepareSnesGenerationOptions, "sourceRoot" | "recipes" | "pristineAssets" | "codeWithdrawals">): string;
/**
 * Render one pinned analysis snapshot in an owned temporary directory, verify the original ROM,
 * then retain only its immutable Git payload. No evidence/capture directory is copied and the
 * source checkout/index remain untouched. Failed candidates never acquire a retained Git ref.
 */
export declare function prepareSnesGeneration(options: PrepareSnesGenerationOptions): Promise<PreparedSnesGeneration>;
//# sourceMappingURL=source-generation.d.ts.map