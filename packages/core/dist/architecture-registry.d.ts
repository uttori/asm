import type { ArchitectureEncoder, InstructionDescriptor } from "./architecture-types.js";
/** A registered architecture's grammar, encoder and tooling metadata. */
export type ArchitectureDefinition = {
    /** Processor-owned operand grammar; its version participates in parse cache identities. */
    operandGrammar: import("./ir/resolved-instruction.js").ArchitectureOperandGrammar;
    /** Architecture name; lowercased to the canonical key on registration. */
    name: string;
    /** Per-session encoder used for builds and as the fallback instruction catalog. */
    encoder: ArchitectureEncoder;
    /** Static instruction catalog; when absent, the encoder's catalog is used. */
    instructions?: readonly InstructionDescriptor[];
    /** Architecture-owned lexical extraction preserves symbolic references hidden by addressing wrappers. */
    referenceExpressions?: (operandText: string) => readonly string[];
    /** Whether an instruction the encoder does not handle raises `Unknown instruction` or is reported as unhandled. */
    unknownInstructionBehavior: "throw" | "returnFalse";
};
/** Case-insensitive registry of architecture definitions and their aliases. */
export declare class ArchitectureRegistry {
    /** Definitions keyed by lowercase canonical name. */
    readonly definitions: Map<string, ArchitectureDefinition>;
    /** Lowercase alias or canonical name to canonical name; every canonical name maps to itself. */
    readonly aliases: Map<string, string>;
    /**
     * Registers the value.
     * @param definition The definition.
     * @param [aliases] The aliases.
     */
    register(definition: ArchitectureDefinition, aliases?: string[]): void;
    /**
     * Resolves an architecture name or alias, ignoring case.
     * @param name Architecture name or alias.
     * @returns The lowercase canonical name, or undefined when unregistered.
     */
    getCanonicalName(name: string): string | undefined;
    /**
     * Looks up a definition by name or alias, ignoring case.
     * @param name Architecture name or alias.
     * @returns The registered definition, or undefined when unregistered.
     */
    getDefinition(name: string): ArchitectureDefinition | undefined;
    /**
     * Returns editor metadata from the same registered encoder used for builds.
     * @param name Architecture name or alias.
     * @returns Registered instruction descriptors.
     */
    getInstructionCatalog(name: string): InstructionDescriptor[];
}
//# sourceMappingURL=architecture-registry.d.ts.map