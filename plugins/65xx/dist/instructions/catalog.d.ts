import type { InstructionDescriptor } from "@uttori/asm-core";
import type { InstructionForm } from "./schema.js";
/**
 * Groups forms by mnemonic for editor tooling (hover, completion, signatures).
 *
 * @param {readonly InstructionForm[]} forms Assembly forms for one CPU.
 * @returns {InstructionDescriptor[]} Sorted instruction descriptors.
 */
export declare function buildInstructionCatalog(forms: readonly InstructionForm[]): InstructionDescriptor[];
//# sourceMappingURL=catalog.d.ts.map