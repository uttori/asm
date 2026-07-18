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
  splitOperands: (operandText: string) => string[];
  unknownInstructionBehavior: "throw" | "returnFalse";
};

const splitSingleOperand = (operandText: string): string[] => operandText ? [operandText] : [];
const splitCommaOperands = (operandText: string): string[] => operandText
  ? operandText.split(",").map((operand) => operand.trim())
  : [];
const splitTopLevelCommaOperands = (operandText: string): string[] => {
  const operands: string[] = [];
  let level = 0;
  let current = "";
  for (const character of operandText) {
    if (character === "(") {
      level++;
    } else if (character === ")") {
      level--;
    }
    if (character === "," && level === 0) {
      operands.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) {
    operands.push(current.trim());
  }
  return operands;
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
      splitOperands: splitSingleOperand,
      unknownInstructionBehavior: "throw",
    },
    ["65816"],
  );
  registry.register(
    {
      name: "spc700",
      encoder: encoderSpc700,
      classifyOperand: classifySpc700Operand,
      splitOperands: splitTopLevelCommaOperands,
      unknownInstructionBehavior: "throw",
    },
    ["spc700", "spc700-raw", "spc700-inline"],
  );
  registry.register(
    {
      name: "superfx",
      encoder: encoderSuperFx,
      classifyOperand: classifySuperFxOperand,
      splitOperands: splitCommaOperands,
      unknownInstructionBehavior: "returnFalse",
    },
    ["superfx"],
  );
  return registry;
};
