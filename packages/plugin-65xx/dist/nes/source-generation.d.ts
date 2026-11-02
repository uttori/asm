import { type SourceGenerationOptions as PrepareNesGenerationOptions, type PreparedSourceGeneration as PreparedNesGeneration } from "@uttori/asm-disassembler/source-project";
export type { SourceGenerationOptions as PrepareNesGenerationOptions, PreparedSourceGeneration as PreparedNesGeneration, } from "@uttori/asm-disassembler/source-project";
/** Exact render options include recipe contents and the pristine-asset selection, not host paths. */
export declare function nesGenerationOptionsHash(options: Pick<PrepareNesGenerationOptions, "sourceRoot" | "recipes" | "pristineAssets" | "codeWithdrawals" | "assembly">): string;
/**
 * Render one pinned analysis snapshot in an owned temporary directory, verify the original ROM,
 * then retain only its immutable Git payload. No evidence/capture directory is copied and the
 * source checkout/index remain untouched. Failed candidates never acquire a retained Git ref.
 */
export declare function prepareNesGeneration(options: PrepareNesGenerationOptions): Promise<PreparedNesGeneration>;
//# sourceMappingURL=source-generation.d.ts.map