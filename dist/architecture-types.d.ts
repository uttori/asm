import type { ExpressionNode } from "./ir/expression-node.js";
import type { NormalizedCommand } from "./ir/normalized-command.js";
export type MathValue = number | string;
export interface ExpandedOperand {
    expanded: string;
    length: number;
}
export interface LoweredOperand {
    mode?: "unknown" | "immediate" | "register" | "registerIndirect" | "registerIndirectAutoIncrement" | "directPageIndexedXIndirect" | "directPageIndirectIndexedY" | "directPageBit" | "absoluteBit" | "absolute" | "absoluteLong" | "absoluteIndexedX" | "absoluteIndexedY" | "absoluteLongIndexedX" | "indexedIndirectX" | "directPageIndirect" | "directPageIndexedX" | "stackRelative" | "stackRelativeIndexedIndirectY" | "indirectLong" | "indirectLongIndexedY" | "indirectIndexedY";
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
export interface EncoderEmissionContext {
    write1(value: number): void;
    write2(value: number): void;
    write3(value: number): void;
}
export interface EncoderSizingContext {
    getCurrentAddress(): number;
    optimizeDirectPage(): boolean;
}
export interface EncoderBranchContext {
    enforceResolvedLabels(): boolean;
    findNextLabel(label: string, referenceAddress: number): number;
    findPreviousLabel(label: string, referenceAddress: number): number;
}
export interface EncoderDiagnosticContext {
    error(message: string): Error;
}
export interface ArchitectureEncoderContext {
    operands: OperandResolutionContext;
    emission: EncoderEmissionContext;
    sizing: EncoderSizingContext;
    branches: EncoderBranchContext;
    diagnostics: EncoderDiagnosticContext;
}
export interface EncoderRuntime {
    operandResolver: OperandResolutionContext;
    write1(value: number): void;
    write2(value: number): void;
    write3(value: number): void;
    readonly currentTargetAddress: number;
    readonly optimizeDirectPage: boolean;
    readonly enforceResolvedLabels: boolean;
    symbolScope: {
        findNextLabel(label: string, referenceAddress: number): number;
        findPreviousLabel(label: string, referenceAddress: number): number;
    };
    diagnostics: EncoderDiagnosticContext;
}
export declare const createEncoderRuntime: (context: ArchitectureEncoderContext) => EncoderRuntime;
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
    command?: NormalizedCommand;
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
export interface ArchitectureEncoder {
    estimateSize(words: string[]): number;
    encode(words: string[]): boolean;
    estimateInstruction?(instruction: LoweredInstruction): number;
    encodeInstruction?(instruction: LoweredInstruction): boolean;
    /**
     * Returns the static instruction catalog for editor tooling, when available.
     * @returns {InstructionDescriptor[]} The instruction descriptors.
     */
    getInstructionCatalog?(): InstructionDescriptor[];
}
//# sourceMappingURL=architecture-types.d.ts.map