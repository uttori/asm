import type { ArchitectureEncoderContext } from "../../packages/core/src/architecture-types.js";
import { renderExpressionNode } from "../../packages/core/src/ir/expression-node.js";
import { MathCore } from "../../packages/core/src/mathcore.js";
import { OperandResolver } from "../../packages/core/src/operand-resolver.js";

export type EncoderTestHost = {
  context: ArchitectureEncoderContext;
  operandResolver: OperandResolver;
  emitted: number[];
  symbols: Map<string, number>;
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
    symbols: new Map<string, number>(),
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
  const math = new MathCore();
  const resolveReference = (
    node: import("../../packages/core/src/ir/expression-node.js").ReferenceExpressionNode,
  ): import("../../packages/core/src/ir/reference-path.js").ReferenceResolution => {
    const name = renderExpressionNode(node);
    const symbol = host.symbols.get(name);
    if (symbol !== undefined) {
      return { kind: "resolved", value: symbol };
    }
    const hint = /^_([\dA-Fa-f]{6})$/.exec(name);
    if (hint) {
      return { kind: "resolved", value: Number.parseInt(hint[1], 16) };
    }
    try {
      return { kind: "resolved", value: parseNumber(name) };
    } catch (cause) {
      return { kind: "error", error: cause instanceof Error ? cause : new Error(String(cause)) };
    }
  };
  math.host = {
    resolveReference,
    resolveLabel: parseNumber,
    convertLogicalToOutputOffset: (value) => value,
    convertOutputOffsetToLogical: (value) => value,
    getCurrentAddress: () => host.currentTargetAddress,
    getCurrentBaseAddress: () => host.currentTargetAddress,
    isDefined: (name) => Number(host.symbols.has(name)),
    getExpressionObjectSize: () => 0,
    getFileSize: () => 0,
    getFileStatus: () => 0,
    canReadFile: () => 0,
    readFile: () => 0,
    canReadBaseImage: () => 0,
    readBaseImage: () => 0,
  };
  const operandResolver = new OperandResolver({
    resolveReference,
    evaluateMath: (node) => math.math(node),
    // Public encoder hosts report unresolved reads; the typed encoder owns speculative sizing.
    shouldDeferExpressionEvaluation: () => false,
    getCurrentAddress: () => host.currentTargetAddress,
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
