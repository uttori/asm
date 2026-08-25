import { type ArchitectureEncoder, type ArchitectureEncoderContext, type EncoderRuntime, type InstructionDescriptor, type LoweredInstruction, type LoweredOperand } from "@uttori/asm-core";
type RegisterOpEncoding = {
    prefix?: number;
    base: number;
    min?: number;
    max?: number;
};
export declare class ArchSuperFX implements ArchitectureEncoder {
    readonly asarMoveShortAddress: () => boolean;
    assembler: EncoderRuntime;
    constructor(context: ArchitectureEncoderContext, asarMoveShortAddress?: () => boolean);
    /**
     * Returns the static Super FX instruction catalog for editor tooling.
     * @returns {InstructionDescriptor[]} The instruction descriptors.
     */
    getInstructionCatalog(): InstructionDescriptor[];
    /**
     * Estimates instruction size from a lowered instruction.
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {number} Encoded size in bytes.
     */
    estimateInstruction(instruction: LoweredInstruction): number;
    /**
     * Encodes a lowered instruction.
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {boolean} True if the instruction was encoded.
     */
    encodeInstruction(instruction: LoweredInstruction): boolean;
    /**
     * Estimates size from tokenized words.
     * @param {string[]} words The words.
     * @returns {number} Encoded size in bytes.
     */
    estimateSize(words: string[]): number;
    /**
     * Estimates encoded size. Must match {@link encodeResolvedInstruction} byte counts
     * so layout `step()` stays in sync with emit.
     * @param {string} mnemonic The mnemonic.
     * @param {string[]} operands The operands.
     * @param {LoweredOperand} [loweredOperand] The combined lowered operand.
     * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
     * @returns {number} Encoded size in bytes.
     */
    estimateResolvedInstruction(mnemonic: string, operands: string[], loweredOperand?: LoweredOperand, loweredOperands?: LoweredOperand[]): number;
    /**
     * Processes a SuperFX assembly instruction.
     * @param {string[]} words The tokenized instruction.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    encode(words: string[]): boolean;
    /**
     * Encodes a resolved instruction.
     * @param {string} mnemonic The mnemonic.
     * @param {string[]} operands The operands.
     * @param {LoweredOperand} [loweredOperand] The combined lowered operand.
     * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
     * @returns {boolean} True if the instruction was encoded.
     */
    encodeResolvedInstruction(mnemonic: string, operands: string[], loweredOperand?: LoweredOperand, loweredOperands?: LoweredOperand[]): boolean;
    /**
     * Handles implied SuperFX opcodes with no operands.
     * @param {string} opcode - the opcode
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    handleSingleWordOpcode(opcode: string): boolean;
    /**
     * Handles instructions with a single operand (e.g., "TO R1", "BRA label").
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @param {number} operandLength - the length of the operand
     * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    handleOneOperandOpcode(opcode: string, operand: string, operandLength: number, loweredOperand?: LoweredOperand): boolean;
    /**
     * Handles instructions with two operands (e.g., MOVE r1, r2).
     * @param {string} opcode - the opcode
     * @param {string} leftOp - the left operand
     * @param {string} rightOp - the right operand
     * @param {LoweredOperand} leftLowered - optional lowered metadata for left operand
     * @param {LoweredOperand} rightLowered - optional lowered metadata for right operand
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    handleTwoOperandOpcode(opcode: string, leftOp: string, rightOp: string, leftLowered?: LoweredOperand, rightLowered?: LoweredOperand): boolean;
    /**
     * Resolves a SuperFX register operand.
     * @param {string} str The operand text.
     * @param {LoweredOperand | undefined} lowered The lowered operand.
     * @param {"r" | "parr" | "hash"} type Direct (`rN`), indirect (`(rN)`), or `#n`.
     * @returns {number | null} Register number 0-15, or null if it doesn't match.
     */
    resolveRegister(str: string, lowered: LoweredOperand | undefined, type: "r" | "parr" | "hash"): number | null;
    /**
     * Attempts to parse a register from a string, e.g. "r0", "(r3)", "#3".
     * @param {string} str The operand string.
     * @param {"r" | "parr" | "hash"} type The type of register.
     * @returns {number | null} The register number or null if it doesn't match.
     */
    getRegister(str: string, type: "r" | "parr" | "hash"): number | null;
    /**
     * Parses the register number. E.g. '5', '10', '15'. Returns -1 if invalid.
     * @param {string} str The string to parse.
     * @returns {number} The register number.
     */
    parseRegisterNumber(str: string): number;
    /**
     * Raises an error if `mid < min` or `mid > max`.
     * @param {number} min The minimum value.
     * @param {number} mid The middle value.
     * @param {number} max The maximum value.
     * @throws {Error} If the middle value is out of range.
     */
    rangeCheck(min: number, mid: number, max: number): void;
    /**
     * For LMS/SMS short addressing, the address must be even and in `[0x000..0x1FE]`.
     * @param {number} num - the address
     * @returns {boolean} True if the address is valid.
     */
    checkShortAddr(num: number): boolean;
    /**
     * True when the source spelling is an explicit 2-digit hex branch offset (`$XX`).
     * Expanded label values that happen to fit in a byte must not use this path.
     * @param {string} operand The raw or expanded operand.
     * @returns {boolean} True if the operand is a raw 8-bit offset spelling.
     */
    isRawBranchOffset(operand: string): boolean;
    /**
     * Returns 1 for a 2-digit hex operand (`$XX`), otherwise 2.
     * @param {string} operand the operand
     * @returns {number} The operand length.
     */
    getOperandLength(operand: string): number;
    /**
     * Splits tokenized words into opcode plus comma-separated operands.
     * @param {string[]} words The tokenized instruction.
     * @returns {{ opcode: string; operands: string[]; rawOperand: string }} Parsed parts.
     */
    parseInstructionWords(words: string[]): {
        opcode: string;
        operands: string[];
        rawOperand: string;
    };
    /**
     * Writes a register-encoded ALU/load op, with optional ALT prefix and range check.
     * @param {RegisterOpEncoding} encoding The encoding table entry.
     * @param {number} register The register number.
     */
    writeRegisterOp(encoding: RegisterOpEncoding, register: number): void;
    /**
     * Encodes the LMS/SMS operand byte for auto-MOVE short addressing.
     * @param {number} addrVal Even RAM byte address below `$200`.
     * @returns {number} Hardware word index, or Asar's raw byte when compat is enabled.
     */
    moveShortAddressByte(addrVal: number): number;
    /**
     * Resolves a numeric operand for sizing without failing layout on forward refs.
     * @param {string} expression The expression.
     * @returns {number | undefined} The value, or undefined if it cannot be resolved yet.
     */
    tryGetNumber(expression: string): number | undefined;
}
export {};
//# sourceMappingURL=superfx.d.ts.map