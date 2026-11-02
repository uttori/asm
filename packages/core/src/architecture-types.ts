import type { ExpressionNode } from "./ir/expression-node.js";
import type { LinkExpression } from "./ir/link-expression.js";
import type { RelocationEncoding } from "./relocatable.js";

/** Expression values are numeric or string literals. Conversion is the caller's responsibility. */
export type MathValue = number | string;

/** Live access to the current session's symbols and operand expressions. */
export interface OperandResolutionContext {
  /** displayText preserves emission attribution when a typed expression replaces a text input. */
  getnum(expression: string | ExpressionNode, displayText?: string): number;
  getCurrentAddress(): number;
}

/** Writes at the session's logical cursor, applying target mapping and stage write rules. */
export interface EncoderEmissionContext {
  /** Object producers retain an explicit field; absolute-only embedding hosts may omit this capability. */
  writeRelocation?(expression: LinkExpression, encoding: RelocationEncoding): void;
  /** Emit the low byte and advance by one byte. */
  write1(value: number): void;
  write2(value: number): void;
  write3(value: number): void;
  writeByte(value: number): void;
  writeBytes(values: readonly number[]): void;
  /**
   * Emit the low 1–4 bytes of a safe integer (two's complement for negatives), little-endian
   * by default. Invalid arguments throw before writes or cursor changes; use writeBytes for wider data.
   */
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

/** Creates source-attributed errors. The encoder decides when to throw them. */
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

/** Host services used by the expression evaluator. Logical addresses are distinct from file offsets. */
export interface ExpressionHost {
  /** Bind explicitly generated expression grammar using the session's ordered define state. */
  bindExpressionTemplate?(
    template: import("./ir/expression-node.js").TemplateExpressionNode,
  ): import("./ir/expression-node.js").ExpressionNode;
  /** Typed hosts preserve reference structure and distinguish a missing value from a real zero. */
  resolveReference(
    reference: import("./ir/expression-node.js").ReferenceExpressionNode,
  ): import("./ir/reference-path.js").ReferenceResolution;
  resolveLabel(identifier: string): MathValue;
  convertLogicalToOutputOffset(address: number): number;
  convertOutputOffsetToLogical(offset: number): number;
  getCurrentAddress(): number;
  getCurrentBaseAddress(): number;
  isDefined(identifier: string): number;
  getExpressionObjectSize(identifier: string, baseOnly?: boolean): number;
  /** Optional for non-assembler hosts. Reflects declared bounds, never reads emitted data. */
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

/** Per-session encoder. Sizing returns byte counts. Encoding reports whether it handled the instruction. */
export interface ArchitectureEncoder {
  /** Converted families use only parsed instructions and a fresh stage-owned resolution frame. */
  typed: import("./ir/resolved-instruction.js").TypedArchitectureEncoder;
  /** Resets pass-local encoder state (M/X flags, etc.) at the start of each assembly stage. */
  beginPass?(): void;
  /**
   * Returns the static instruction catalog for editor tooling, when available.
   * @returns {InstructionDescriptor[]} The instruction descriptors.
   */
  getInstructionCatalog?(): InstructionDescriptor[];
}
