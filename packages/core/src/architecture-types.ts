import type { ExpressionNode } from "./ir/expression-node.js";
import type { NormalizedCommand } from "./ir/normalized-command.js";
import type { OperandSyntax } from "./operand-syntax.js";

/** Expression values are numeric or string literals; conversion is the caller's responsibility. */
export type MathValue = number | string;

/** Text after define/expression expansion with target-neutral lexical information. */
export interface ExpandedOperand {
  /** Original operand spelling before define, symbol, or expression resolution. */
  raw: string;
  expanded: string;
  /** Target-neutral byte width inferred from the resolved value or literal spelling. */
  length: number;
  /** Lexical facts only; register and addressing-mode validity remain architecture-owned. */
  syntax: OperandSyntax;
}

/** Operand classification passed to encoders; architecture-specific modes live in mode/metadata. */
export interface LoweredOperand {
  /** Architecture-owned addressing-mode identifier. */
  mode?: string;
  baseExpression?: string;
  registerName?: string;
  explicitDirectPage?: boolean;
  explicitDirectPageIndexedX?: boolean;
  raw: string;
  expanded: string;
  /** Inferred operand width in bytes, not full instruction size. */
  length: number;
  /** The index register for indexed addressing modes. */
  indexRegister?: string;
  immediate: boolean;
  indirect: boolean;
  /** Architecture-specific lowering metadata for extension encoders. */
  metadata?: Readonly<Record<string, unknown>>;
}

/** Live access to the current session's symbols and operand expressions. */
export interface OperandResolutionContext {
  expandOperand(operand: string): ExpandedOperand;
  /**
   * Architecture-bound contexts classify through their registered contribution.
   * The bare resolver returns target-neutral metadata with mode `unknown`.
   */
  lowerOperand(operand: string): LoweredOperand;
  getnum(expression: string | ExpressionNode): number;
  getCurrentAddress(): number;
}

/** Writes at the session's logical cursor, applying target mapping and stage write rules. */
export interface EncoderEmissionContext {
  /** Emit the low byte and advance by one byte. */
  write1(value: number): void;
  write2(value: number): void;
  write3(value: number): void;
  writeByte(value: number): void;
  writeBytes(values: readonly number[]): void;
  /** Width is in bytes; omitted endianness means little-endian. */
  writeValue(value: number, width: number, endianness?: "little" | "big"): void;
}

/** Current logical byte address used for layout and branch-size estimates. */
export interface EncoderSizingContext {
  getCurrentAddress(): number;
}

/** Stage-sensitive label lookup for relative branches and unnamed labels. */
export interface EncoderBranchContext {
  enforceResolvedLabels(): boolean;
  findNextLabel(label: string, referenceAddress: number): number;
  findPreviousLabel(label: string, referenceAddress: number): number;
}

/** Creates source-attributed errors; the encoder decides when to throw them. */
export interface EncoderDiagnosticContext {
  error(message: string): Error;
}

/** Borrowed capabilities for a single session, without ownership of its mutable runtime. */
export interface ArchitectureEncoderContext {
  operands: OperandResolutionContext;
  emission: EncoderEmissionContext;
  sizing: EncoderSizingContext;
  branches: EncoderBranchContext;
  diagnostics: EncoderDiagnosticContext;
}

/** Convenience facade over encoder capabilities; address and label policy remain live getters. */
export interface EncoderRuntime {
  operandResolver: OperandResolutionContext;
  write1(value: number): void;
  write2(value: number): void;
  write3(value: number): void;
  writeByte(value: number): void;
  writeBytes(values: readonly number[]): void;
  writeValue(value: number, width: number, endianness?: "little" | "big"): void;
  readonly currentTargetAddress: number;
  readonly enforceResolvedLabels: boolean;
  symbolScope: {
    findNextLabel(label: string, referenceAddress: number): number;
    findPreviousLabel(label: string, referenceAddress: number): number;
  };
  diagnostics: EncoderDiagnosticContext;
}

/**
 * Adapt capability groups to a flat encoder facade without copying session state.
 * @param {ArchitectureEncoderContext} context Capabilities borrowed from the owning session.
 * @returns {EncoderRuntime} A facade whose address and label-policy getters read live session values.
 */
export const createEncoderRuntime = (context: ArchitectureEncoderContext): EncoderRuntime => ({
  operandResolver: context.operands,
  write1: (value) => context.emission.write1(value),
  write2: (value) => context.emission.write2(value),
  write3: (value) => context.emission.write3(value),
  writeByte: (value) => context.emission.writeByte(value),
  writeBytes: (values) => context.emission.writeBytes(values),
  writeValue: (value, width, endianness) => context.emission.writeValue(value, width, endianness),
  get currentTargetAddress() {
    return context.sizing.getCurrentAddress();
  },
  get enforceResolvedLabels() {
    return context.branches.enforceResolvedLabels();
  },
  symbolScope: {
    findNextLabel: (label, referenceAddress) =>
      context.branches.findNextLabel(label, referenceAddress),
    findPreviousLabel: (label, referenceAddress) =>
      context.branches.findPreviousLabel(label, referenceAddress),
  },
  diagnostics: context.diagnostics,
});

/** Host services used by the expression evaluator; logical addresses are distinct from file offsets. */
export interface ExpressionHost {
  resolveLabel(identifier: string): MathValue;
  convertLogicalToOutputOffset(address: number): number;
  convertOutputOffsetToLogical(offset: number): number;
  getCurrentAddress(): number;
  getCurrentBaseAddress(): number;
  isDefined(identifier: string): number;
  getExpressionObjectSize(identifier: string, baseOnly?: boolean): number;
  /** Optional for non-assembler hosts; reflects declared bounds, never reads emitted data. */
  getExpressionStructMetadata?(
    identifier: string,
    property: import("./services/struct-metadata.js").StructMetadataProperty,
  ): number;
  getFileSize(filename: string): number;
  getFileStatus(filename: string): number;
  canReadFile(filename: string, position: number, size: number): number;
  readFile(filename: string, position: number, size: number, defaultValue?: number): number;
  canReadBaseImage(position: number, size: number): number;
  readBaseImage(position: number, size: number, defaultValue?: number): number;
}

/** Parsed instruction and source context for encoders that consume structured operands. */
export interface LoweredInstruction {
  kind: "instruction";
  command?: NormalizedCommand;
  mnemonic: string;
  operandText: string;
  operands: string[];
  loweredOperands: LoweredOperand[];
  loweredOperand: LoweredOperand;
  words: readonly string[];
  sourceFile: string;
  /** Zero-based source line index. */
  sourceLine: number;
  sourceRaw: string;
}

/**
 * One addressing-mode form of an instruction, used for hover, completion, and
 * signature help in editor tooling.
 */
export interface InstructionAddressingMode {
  /** The addressing-mode name, e.g. "immediate", "absolute", "absoluteIndexedX". */
  mode: string;
  /** Example operand syntax, e.g. "#const", "addr", "addr,x". */
  syntax: string;
  /** The leading opcode byte when statically known. */
  opcode?: number;
  /** The total instruction size in bytes when statically known. */
  size?: number;
}

/**
 * A static description of one instruction mnemonic for a given architecture.
 */
export interface InstructionDescriptor {
  /** The uppercase mnemonic, e.g. "LDA". */
  mnemonic: string;
  /** A short human-readable summary suitable for hover documentation. */
  summary?: string;
  /** The addressing-mode forms supported by the mnemonic. */
  modes: InstructionAddressingMode[];
}

/** Per-session encoder. Sizing returns byte counts; encoding reports whether it handled the instruction. */
export interface ArchitectureEncoder {
  /** Estimate total instruction bytes without emitting output; words include the mnemonic. */
  estimateSize(words: readonly string[]): number;
  /** Emit through the supplied emission context; false indicates an unrecognized instruction. */
  encode(words: readonly string[]): boolean;
  estimateInstruction?(instruction: LoweredInstruction): number;
  encodeInstruction?(instruction: LoweredInstruction): boolean;
  /** Resets pass-local encoder state (M/X flags, etc.) at the start of each assembly stage. */
  beginPass?(): void;
  /**
   * Returns the static instruction catalog for editor tooling, when available.
   * @returns {InstructionDescriptor[]} The instruction descriptors.
   */
  getInstructionCatalog?(): InstructionDescriptor[];
}
