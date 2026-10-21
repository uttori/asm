import type { ArchitectureEncoder, InstructionDescriptor } from "./architecture-types.js";
export type ArchitectureDefinition = {
    operandGrammar: import("./ir/resolved-instruction.js").ArchitectureOperandGrammar;
    name: string;
    encoder: ArchitectureEncoder;
    instructions?: readonly InstructionDescriptor[];
    /** Architecture-owned lexical extraction preserves symbolic references hidden by addressing wrappers. */
    referenceExpressions?: (operandText: string) => readonly string[];
    unknownInstructionBehavior: "throw" | "returnFalse";
};
export declare class ArchitectureRegistry {
    readonly definitions: Map<string, ArchitectureDefinition>;
    readonly aliases: Map<string, string>;
    /**
     * Registers the value.
     * @param {ArchitectureDefinition} definition The definition.
     * @param {string[]} [aliases] The aliases.
     */
    register(definition: ArchitectureDefinition, aliases?: string[]): void;
    getCanonicalName(name: string): string | undefined;
    getDefinition(name: string): ArchitectureDefinition | undefined;
    /**
     * Returns editor metadata from the same registered encoder used for builds.
     * @param {string} name Architecture name or alias.
     * @returns {InstructionDescriptor[]} Registered instruction descriptors.
     */
    getInstructionCatalog(name: string): InstructionDescriptor[];
}
//# sourceMappingURL=architecture-registry.d.ts.map