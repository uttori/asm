import type { ArchitectureEncoderContext } from "../../packages/core/src/architecture-types.js";
import { renderExpressionNode } from "../../packages/core/src/ir/expression-node.js";
import { OperandResolver } from "../../packages/core/src/operand-resolver.js";

export type EncoderTestHost = {
  context: ArchitectureEncoderContext;
  operandResolver: OperandResolver;
  emitted: number[];
  currentTargetAddress: number;
  optimizeDirectPage: boolean;
  enforceResolvedLabels: boolean;
  asarSuperFxMoveShortAddress: boolean;
  symbolScope: {
    findNextLabel(label: string, referenceAddress: number): number;
    findPreviousLabel(label: string, referenceAddress: number): number;
  };
  activateStage(stage: "collectDefinitions" | "resolveLayout" | "emitProgram"): void;
  write1(value: number): void;
  write2(value: number): void;
  write3(value: number): void;
};

const parseNumber = (input: string): number => {
  const value = input.trim().replace(/^#/, "");
  if (/^\$[\da-f]+$/i.test(value)) {
    return Number.parseInt(value.slice(1), 16);
  }
  if (/^%[01]+$/.test(value)) {
    return Number.parseInt(value.slice(1), 2);
  }
  const parsed = Number(value);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  throw new Error(`Unresolved test expression: ${input}`);
};

export const createEncoderTestHost = (): EncoderTestHost => {
  const host = {
    emitted: [] as number[],
    currentTargetAddress: 0,
    optimizeDirectPage: true,
    enforceResolvedLabels: false,
    asarSuperFxMoveShortAddress: false,
    symbolScope: {
      findNextLabel: (_label: string, _referenceAddress: number): number => {
        throw new Error("Unresolved next test label");
      },
      findPreviousLabel: (_label: string, _referenceAddress: number): number => {
        throw new Error("Unresolved previous test label");
      },
    },
    activateStage(stage: "collectDefinitions" | "resolveLayout" | "emitProgram"): void {
      host.enforceResolvedLabels = stage === "emitProgram";
    },
    write1(value: number): void {
      host.emitted.push(value & 0xff);
      host.currentTargetAddress++;
    },
    write2(value: number): void {
      host.write1(value);
      host.write1(value >> 8);
    },
    write3(value: number): void {
      host.write1(value);
      host.write1(value >> 8);
      host.write1(value >> 16);
    },
  };
  const operandResolver = new OperandResolver({
    resolveDefines: (input) => input,
    isStructReference: () => false,
    resolveStructLabel: () => {
      throw new Error("Not a test struct label");
    },
    tryResolveLabel: (input) => {
      try {
        return parseNumber(input);
      } catch {
        return undefined;
      }
    },
    resolveLabel: (input) => parseNumber(input),
    evaluateMath: (input) =>
      parseNumber(typeof input === "string" ? input : renderExpressionNode(input)),
    shouldDeferExpressionEvaluation: () => !host.enforceResolvedLabels,
    getCurrentAddress: () => host.currentTargetAddress,
    requireStaticLabelLookup: () => false,
  });
  const context: ArchitectureEncoderContext = {
    operands: operandResolver,
    emission: {
      write1: (value) => host.write1(value),
      write2: (value) => host.write2(value),
      write3: (value) => host.write3(value),
      writeByte: (value) => host.write1(value),
      writeBytes: (values) => values.forEach((value) => host.write1(value)),
      writeValue: (value, width, endianness = "little") => {
        for (let index = 0; index < width; index++) {
          const shift = endianness === "little" ? index : width - index - 1;
          host.write1(value >> (shift * 8));
        }
      },
    },
    sizing: {
      getCurrentAddress: () => host.currentTargetAddress,
      optimizeDirectPage: () => host.optimizeDirectPage,
    },
    branches: {
      enforceResolvedLabels: () => host.enforceResolvedLabels,
      findNextLabel: (label, referenceAddress) =>
        host.symbolScope.findNextLabel(label, referenceAddress),
      findPreviousLabel: (label, referenceAddress) =>
        host.symbolScope.findPreviousLabel(label, referenceAddress),
    },
    diagnostics: {
      error: (message) => new Error(message),
    },
    compatibility: {
      asarSuperFxMoveShortAddress: () => host.asarSuperFxMoveShortAddress,
    },
  };
  return Object.assign(host, { context, operandResolver });
};
