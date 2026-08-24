import type {
  ArchitectureEncoder,
  InstructionDescriptor,
  LoweredOperand,
} from "./architecture-types.js";
import type { OperandResolver } from "./operand-resolver.js";

export type ArchitectureDefinition = {
  name: string;
  encoder: ArchitectureEncoder;
  instructions?: readonly InstructionDescriptor[];
  classifyOperand: (resolver: OperandResolver, operand: string) => LoweredOperand;
  splitOperands: (operandText: string) => string[];
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

  /**
   * Gets canonical name.
   * @param {string} name The name.
   * @returns {string | undefined} The result.
   */
  getCanonicalName(name: string): string | undefined {
    return this.aliases.get(name.toLowerCase());
  }

  /**
   * Gets definition.
   * @param {string} name The name.
   * @returns {ArchitectureDefinition | undefined} The result.
   */
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
