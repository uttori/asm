import type { InstructionDescriptor } from "../architecture-types.js";
/**
 * The 65816 instruction catalog. Summaries are concise descriptions of effect;
 * mode lists capture the addressing forms the assembler accepts so editors can
 * offer hover, completion, and signature help.
 */
export declare const cpu65816Catalog: InstructionDescriptor[];
/**
 * The SPC700 (sound CPU) instruction catalog. Summaries describe effects and
 * mode lists capture the operand forms accepted by the assembler.
 */
export declare const spc700Catalog: InstructionDescriptor[];
/**
 * The Super FX (GSU) instruction catalog. Coverage focuses on the mnemonics the
 * assembler accepts so editors can complete and document them.
 */
export declare const superFxCatalog: InstructionDescriptor[];
/**
 * Returns the static instruction catalog for an architecture name.
 * @param {string} architecture The architecture name (e.g. "65816", "spc700", "superfx").
 * @returns {InstructionDescriptor[]} The matching catalog, or the 65816 catalog as a default.
 */
export declare function getCatalogForArchitecture(architecture: string): InstructionDescriptor[];
//# sourceMappingURL=instruction-catalog.d.ts.map