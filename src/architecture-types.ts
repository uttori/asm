import type { ExpressionNode } from "./ir/expression-node.js";
import type { NormalizedCommand } from "./ir/normalized-command.js";

export type MathValue = number | string;

export interface ExpandedOperand {
  expanded: string;
  length: number;
}

export interface LoweredOperand {
  mode?: "unknown"
    | "immediate"
    | "register"
    | "registerIndirect"
    | "registerIndirectAutoIncrement"
    | "directPageIndexedXIndirect"
    | "directPageIndirectIndexedY"
    | "directPageBit"
    | "absoluteBit"
    | "absolute"
    | "absoluteLong"
    | "absoluteIndexedX"
    | "absoluteIndexedY"
    | "absoluteLongIndexedX"
    | "indexedIndirectX"
    | "directPageIndirect"
    | "directPageIndexedX"
    | "stackRelative"
    | "stackRelativeIndexedIndirectY"
    | "indirectLong"
    | "indirectLongIndexedY"
    | "indirectIndexedY";
  baseExpression?: string;
  registerName?: string;
  explicitDirectPage?: boolean;
  explicitDirectPageIndexedX?: boolean;
  raw: string;
  expanded: string;
  length: number;
  indexRegister?: "x" | "y" | "s";
  immediate: boolean;
  indirect: boolean;
}

export interface OperandResolutionContext {
  expandOperand(operand: string): ExpandedOperand;
  lowerOperand(operand: string): LoweredOperand;
  getnum(expression: string | ExpressionNode): number;
}

export interface ExpressionHost {
  resolveLabel(identifier: string): MathValue;
  convertSnesToPc(address: number): number;
  convertPcToSnes(offset: number): number;
  getCurrentAddress(): number;
  getCurrentBaseAddress(): number;
  isDefined(identifier: string): number;
  getExpressionObjectSize(identifier: string, baseOnly?: boolean): number;
  getFileSize(filename: string): number;
  getFileStatus(filename: string): number;
  canReadFile(filename: string, position: number, size: number): number;
  readFile(filename: string, position: number, size: number, defaultValue?: number): number;
  canReadRom(position: number, size: number): number;
  readRom(position: number, size: number, defaultValue?: number): number;
}

export interface LoweredInstruction {
  kind: "instruction";
  mnemonic: string;
  operandText: string;
  operands: string[];
  loweredOperands: LoweredOperand[];
  loweredOperand: LoweredOperand;
  words: string[];
  sourceFile: string;
  sourceLine: number;
  sourceRaw: string;
}

export interface ArchitectureEncoder {
  estimateSize(words: string[]): number;
  encode(words: string[]): boolean;
  estimateInstruction?(instruction: LoweredInstruction): number;
  encodeInstruction?(instruction: LoweredInstruction): boolean;
  lowerInstructionFromCommand?(command: NormalizedCommand): LoweredInstruction;
}
