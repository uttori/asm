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

export class ArchitectureRegistry {
  readonly definitions = new Map<string, ArchitectureDefinition>();
  readonly aliases = new Map<string, string>();

  /**
   * Registers the value.
   * @param {ArchitectureDefinition} definition The definition.
   * @param {string[]} [aliases] The aliases.
   */
  register(definition: ArchitectureDefinition, aliases: string[] = []): void {
    const canonical = definition.name.toLowerCase();
    this.definitions.set(canonical, { ...definition, name: canonical });
    this.aliases.set(canonical, canonical);
    for (const alias of aliases) {
      this.aliases.set(alias.toLowerCase(), canonical);
    }
  }

  getCanonicalName(name: string): string | undefined {
    return this.aliases.get(name.toLowerCase());
  }

  getDefinition(name: string): ArchitectureDefinition | undefined {
    const canonical = this.getCanonicalName(name);
    if (!canonical) {
      return undefined;
    }
    return this.definitions.get(canonical);
  }

  /**
   * Returns editor metadata from the same registered encoder used for builds.
   * @param {string} name Architecture name or alias.
   * @returns {InstructionDescriptor[]} Registered instruction descriptors.
   */
  getInstructionCatalog(name: string): InstructionDescriptor[] {
    const definition = this.getDefinition(name);
    return [...(definition?.instructions ?? definition?.encoder.getInstructionCatalog?.() ?? [])];
  }
}
