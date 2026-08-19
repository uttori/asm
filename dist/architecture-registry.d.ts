import type { ArchitectureEncoder, ArchitectureEncoderContext, InstructionDescriptor, LoweredOperand } from "./architecture-types.js";
import type { OperandResolver } from "./operand-resolver.js";
export type ArchitectureDefinition = {
    name: string;
    encoder: ArchitectureEncoder;
    classifyOperand: (resolver: OperandResolver, operand: string) => LoweredOperand;
    splitOperands: (operandText: string) => string[];
    unknownInstructionBehavior: "throw" | "returnFalse";
};
/** Factory-based architecture extension bound to each assembler session. */
export type ArchitectureExtension = Omit<ArchitectureDefinition, "encoder"> & {
    aliases?: readonly string[];
    createEncoder(context: ArchitectureEncoderContext): ArchitectureEncoder;
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
    /**
     * Gets canonical name.
     * @param {string} name The name.
     * @returns {string | undefined} The result.
     */
    getCanonicalName(name: string): string | undefined;
    /**
     * Gets definition.
     * @param {string} name The name.
     * @returns {ArchitectureDefinition | undefined} The result.
     */
    getDefinition(name: string): ArchitectureDefinition | undefined;
    /**
     * Returns editor metadata from the same registered encoder used for builds.
     * @param {string} name Architecture name or alias.
     * @returns {InstructionDescriptor[]} Registered instruction descriptors.
     */
    getInstructionCatalog(name: string): InstructionDescriptor[];
    /**
     * Binds an extension factory to this assembler session.
     * @param {ArchitectureExtension} extension Architecture extension.
     * @param {ArchitectureEncoderContext} context Session-bound encoder context.
     */
    registerExtension(extension: ArchitectureExtension, context: ArchitectureEncoderContext): void;
}
export declare const createArchitectureRegistry: (encoder65816: ArchitectureEncoder, encoderSpc700: ArchitectureEncoder, encoderSuperFx: ArchitectureEncoder, encoder6502?: ArchitectureEncoder) => ArchitectureRegistry;
//# sourceMappingURL=architecture-registry.d.ts.map