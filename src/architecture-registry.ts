import type {
  ArchitectureEncoder,
  ArchitectureEncoderContext,
  InstructionDescriptor,
  LoweredOperand,
} from "./architecture-types.js";
import type { OperandResolver } from "./operand-resolver.js";
import {
  classify65816Operand,
  classify6502Operand,
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

/** Factory-based architecture extension bound to each assembler session. */
export type ArchitectureExtension = Omit<ArchitectureDefinition, "encoder"> & {
  aliases?: readonly string[];
  createEncoder(context: ArchitectureEncoderContext): ArchitectureEncoder;
};

const splitSingleOperand = (operandText: string): string[] => (operandText ? [operandText] : []);
const splitCommaOperands = (operandText: string): string[] =>
  operandText ? operandText.split(",").map((operand) => operand.trim()) : [];
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
    return this.getDefinition(name)?.encoder.getInstructionCatalog?.() ?? [];
  }

  /**
   * Binds an extension factory to this assembler session.
   * @param {ArchitectureExtension} extension Architecture extension.
   * @param {ArchitectureEncoderContext} context Session-bound encoder context.
   */
  registerExtension(extension: ArchitectureExtension, context: ArchitectureEncoderContext): void {
    this.register(
      {
        name: extension.name,
        encoder: extension.createEncoder(context),
        classifyOperand: extension.classifyOperand,
        splitOperands: extension.splitOperands,
        unknownInstructionBehavior: extension.unknownInstructionBehavior,
      },
      [...(extension.aliases ?? [])],
    );
  }
}

export const createArchitectureRegistry = (
  encoder65816: ArchitectureEncoder,
  encoderSpc700: ArchitectureEncoder,
  encoderSuperFx: ArchitectureEncoder,
  encoder6502?: ArchitectureEncoder,
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
  if (encoder6502) {
    registry.register(
      {
        name: "6502",
        encoder: encoder6502,
        classifyOperand: classify6502Operand,
        splitOperands: splitSingleOperand,
        unknownInstructionBehavior: "throw",
      },
      ["6502", "mos6502"],
    );
  }
  return registry;
};
