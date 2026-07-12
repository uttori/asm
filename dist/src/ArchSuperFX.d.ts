import type { ArchitectureEncoder, InstructionDescriptor, LoweredInstruction, LoweredOperand } from "./architecture-types.js";
import type { Assembler } from "./assembler.js";
import type { NormalizedCommand } from "./ir/normalized-command.js";
export declare class ArchSuperFX implements ArchitectureEncoder {
    assembler: Assembler;
    constructor(assembler: Assembler);
    /**
     * Returns the static Super FX instruction catalog for editor tooling.
     * @returns {InstructionDescriptor[]} The instruction descriptors.
     */
    getInstructionCatalog(): InstructionDescriptor[];
    encode(words: string[]): boolean;
    estimateInstruction(instruction: LoweredInstruction): number;
    encodeInstruction(instruction: LoweredInstruction): boolean;
    lowerInstructionFromCommand(command: NormalizedCommand): LoweredInstruction;
    estimateSize(words: string[]): number;
    estimateResolvedInstruction(mnemonic: string, operandText: string, loweredOperand?: LoweredOperand, loweredOperands?: LoweredOperand[]): number;
    /**
     * Processes a SuperFX assembly instruction.
     * @param {string[]} words The tokenized instruction.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    asblock_superfx(words: string[]): boolean;
    encodeResolvedInstruction(mnemonic: string, operands: string[], loweredOperand?: LoweredOperand, loweredOperands?: LoweredOperand[]): boolean;
    /**
     * Handles single-word (no-operand) opcodes for SuperFX.
     * @param {string} opcode - the opcode
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    handleSingleWordOpcode(opcode: string): boolean;
    /**
     * Handles two-word opcodes (one opcode + one operand).
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @param {number} operandLength - the lowered operand length
     * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    handleTwoWordOpcode(opcode: string, operand: string, operandLength: number, loweredOperand?: LoweredOperand): boolean;
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
     * For "LMS" or "SMS" short addressing forms, we need to ensure the address is
     * even and in range [0x000..0x1FE].
     * @param {number} num - the address
     * @returns {boolean} True if the address is valid, false otherwise.
     */
    checkShortAddr(num: number): boolean;
    /**
     * Returns an approximate operand length (1 or 2) by checking the operand format.
     * This is a simple approximation for short vs. relative addressing.
     * @param {string} operand the operand
     * @returns {number} The operand length.
     */
    getOperandLength(operand: string): number;
}
//# sourceMappingURL=ArchSuperFX.d.ts.map