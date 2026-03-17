import type { ArchitectureEncoder, LoweredOperand } from "./architecture-types.js";
import type { OperandResolver } from "./operand-resolver.js";
import {
  classify65816Operand,
  classifySpc700Operand,
  classifySuperFxOperand,
} from "./operand-classifiers.js";

export type ArchitectureDefinition = {
  name: string;
  encoder: ArchitectureEncoder;
  classifyOperand: (resolver: OperandResolver, operand: string) => LoweredOperand;
};

export class ArchitectureRegistry {
  readonly definitions = new Map<string, ArchitectureDefinition>();
  readonly aliases = new Map<string, string>();

  register(definition: ArchitectureDefinition, aliases: string[] = []): void {
    this.definitions.set(definition.name, definition);
    this.aliases.set(definition.name, definition.name);
    for (const alias of aliases) {
      this.aliases.set(alias, definition.name);
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
}

export const createArchitectureRegistry = (
  encoder65816: ArchitectureEncoder,
  encoderSpc700: ArchitectureEncoder,
  encoderSuperFx: ArchitectureEncoder,
): ArchitectureRegistry => {
  const registry = new ArchitectureRegistry();
  registry.register(
    {
      name: "65816",
      encoder: encoder65816,
      classifyOperand: classify65816Operand,
    },
    ["65816"],
  );
  registry.register(
    {
      name: "spc700",
      encoder: encoderSpc700,
      classifyOperand: classifySpc700Operand,
    },
    ["spc700", "spc700-raw", "spc700-inline"],
  );
  registry.register(
    {
      name: "superfx",
      encoder: encoderSuperFx,
      classifyOperand: classifySuperFxOperand,
    },
    ["superfx"],
  );
  return registry;
};
