import type { ArchitectureEncoder, InstructionDescriptor, LoweredOperand } from "./architecture-types.js";
import type { OperandResolver } from "./operand-resolver.js";
export type ArchitectureDefinition = {
    name: string;
    encoder: ArchitectureEncoder;
    instructions?: readonly InstructionDescriptor[];
    classifyOperand: (resolver: OperandResolver, operand: string) => LoweredOperand;
    splitOperands: (operandText: string) => string[];
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