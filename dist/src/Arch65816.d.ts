import type { ArchitectureContext, ArchitectureEncoder, LoweredInstruction } from "./architecture-types.js";
import type { NormalizedCommand } from "./ir/normalized-command.js";
export declare class Arch65816 implements ArchitectureEncoder {
    assembler: ArchitectureContext;
    constructor(assembler: ArchitectureContext);
    encode(words: string[]): boolean;
    estimateInstruction(instruction: LoweredInstruction): number;
    encodeInstruction(instruction: LoweredInstruction): boolean;
    lowerInstructionFromCommand(command: NormalizedCommand): LoweredInstruction;
    estimateSize(words: string[]): number;
    estimateResolvedInstruction(mnemonic: string, rawOperand: string, operand: string, operandLength: number): number;
    /**
     * Processes a 65816 assembly instruction.
     * @param {string[]} words The tokenized instruction.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    asblock_65816(words: string[]): boolean;
    encodeResolvedInstruction(mnemonic: string, rawOperand: string, operand: string, operandLength: number): boolean;
    /**
     * Handles ORA, SBC, STA, LDA, EOR, CMP, AND, ADC with all valid addressing modes.
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @param {number} len The length of the operand.
     * @param {boolean} explicitlen Whether the operand length is explicit.
     * @param {string} rawOperand The raw source operand before expansion.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleMemoryOperations(opcode: string, operand: string, len: number, explicitlen: boolean, rawOperand?: string): boolean;
    /**
     * Handles AND, EOR, ORA, CMP, CPX, and CPY instructions.
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @param {number} len The length of the operand.
     * @param {boolean} explicitlen Whether the operand length is explicit.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleLogicAndCompareOperations(opcode: string, operand: string, len: number, explicitlen: boolean): boolean;
    /**
     * Handles operators that do not take operands.
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleNoOperandOperations(opcode: string, operand: string): boolean;
    /**
     * Handles ASL (Arithmetic Shift Left), LSR (Logical Shift Right),
     * ROL (Rotate Left), ROR (Rotate Right), INC (Increment), and DEC (Decrement).
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @param {number} len The length of the operand.
     * @param {boolean} explicitlen Whether the operand length is explicit.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleArithmeticOperations(opcode: string, operand: string, len: number, explicitlen: boolean): boolean;
    /**
     * Handles Load X/Y Register instructions.
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @param {number} len The length of the operand.
     * @param {boolean} explicitlen Whether the operand length is explicit.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleLoadRegister(opcode: string, operand: string, len: number, explicitlen: boolean): boolean;
    /**
     * Handles the JMP (Jump), JSR (Jump to Subroutine), and JSL (Jump to Subroutine Long) instructions.
     * @param {string} opcode - The opcode to handle.
     * @param {string} operand - The resolved operand to handle.
     * @param {string} rawOperand - The original source operand before expansion.
     * @returns {boolean} True if the opcode and operand were handled successfully, false otherwise.
     */
    handleJump(opcode: string, operand: string, rawOperand?: string): boolean;
    /**
     * Handles the PER (Push Effective Relative Address) instruction.
     * @param {string} operand The operand to handle.
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handlePER(operand: string): boolean;
    /**
     * Handles STX, STY, and STZ instructions.
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @param {number} len The length of the operand.
     * @param {boolean} explicitlen Whether the operand length is explicit.
     * @returns {boolean} True if the instruction was handled, false otherwise
     */
    handleStoreOperations(opcode: string, operand: string, len: number, explicitlen: boolean): boolean;
    /**
     * Handles MVN (Move Negative) and MVP (Move Positive) instructions.
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleBlockMove(opcode: string, operand: string): boolean;
    /**
     * Handles BIT, TSB, and TRB instructions, including all their addressing modes.
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @param {number} len The length of the operand.
     * @param {boolean} explicitlen Whether the operand length is explicit.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleBitTestOperations(opcode: string, operand: string, len: number, explicitlen: boolean): boolean;
    /**
     * Handles generic opcodes with standard addressing.
     * @param {string} opcode The opcode to handle.
     * @param {number} num The operand value.
     * @param {number} len The length of the operand.
     * @param {boolean} explicitlen Whether the operand length is explicit.
     * @param {boolean} hexconstant Whether the operand is a hex constant.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleGenericOpcode(opcode: string, num: number, len: number, explicitlen: boolean, hexconstant: boolean): boolean;
    /**
     * Handle Branch Instructions
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleBranchInstructions(opcode: string, operand: string): boolean;
    /**
     * Handles bit manipulation instructions (TSB, TRB) with both absolute and direct page addressing modes.
     * @param {string} opcode (TSB or TRB)
     * @param {string} operand (absolute or direct)
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleMemoryBitInstructions(opcode: string, operand: string): boolean;
    /**
     * Resolves the operand length from opcode suffix.
     * @param {string} c The opcode suffix to resolve the length of.
     * @returns {number} The operand length.
     */
    getlenfromchar(c: string): number;
}
//# sourceMappingURL=Arch65816.d.ts.map