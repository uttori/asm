import { type ArchitectureEncoder, type ArchitectureEncoderContext, type EncoderRuntime, type InstructionDescriptor, type LoweredInstruction } from "./architecture-types.js";
export declare class Arch65816 implements ArchitectureEncoder {
    assembler: EncoderRuntime;
    /** Native 16-bit accumulator (REP #$20). Reset at the start of each assembly stage. */
    m16: boolean;
    /** Native 16-bit index registers (REP #$10). Reset at the start of each assembly stage. */
    x16: boolean;
    constructor(context: ArchitectureEncoderContext);
    /**
     * Resets M/X size flags at the start of each assembly stage.
     * @returns {void}
     */
    beginPass(): void;
    /**
     * Applies SEP/REP to the assembler-facing M/X size flags.
     * @param {string} opcode The opcode.
     * @param {string} rawOperand The raw operand.
     * @returns {void}
     */
    applySepRep(opcode: string, rawOperand: string): void;
    /**
     * Immediate operand width in bytes from M/X flags, hex spelling, and .b/.w.
     * Plain hex/define immediates keep their expanded width so Chou `lda #$20`
     * and `lda #!flag` stay 8-bit. Math expressions such as `#(NMI&$FFFF)`
     * follow the M/X flags.
     * @param {string} opcode The opcode.
     * @param {number} operandLength Expanded operand width.
     * @param {boolean} explicitlen Whether a .b/.w/.l suffix forced the width.
     * @param {string} [rawOperand] The raw source operand.
     * @returns {number} 1 or 2.
     */
    immediateBytes(opcode: string, operandLength: number, explicitlen: boolean, rawOperand?: string): number;
    /**
     * Returns the static 65816 instruction catalog for editor tooling.
     * @returns {InstructionDescriptor[]} The instruction descriptors.
     */
    getInstructionCatalog(): InstructionDescriptor[];
    /**
     * Estimates instruction.
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {number} The result.
     */
    estimateInstruction(instruction: LoweredInstruction): number;
    /**
     * Encodes instruction.
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {boolean} The result.
     */
    encodeInstruction(instruction: LoweredInstruction): boolean;
    /**
     * Estimates size.
     * @param {string[]} words The words.
     * @returns {number} The result.
     */
    estimateSize(words: string[]): number;
    /**
     * Estimates resolved instruction.
     * @param {string} mnemonic The mnemonic.
     * @param {string} rawOperand The raw operand.
     * @param {string} operand The operand.
     * @param {number} operandLength The operand length.
     * @returns {number} The result.
     */
    estimateResolvedInstruction(mnemonic: string, rawOperand: string, operand: string, operandLength: number): number;
    /**
     * Processes a 65816 assembly instruction.
     * @param {string[]} words The tokenized instruction.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    encode(words: string[]): boolean;
    /** Legacy API alias for {@link encode}. */
    readonly asblock_65816: (words: string[]) => boolean;
    /**
     * Encodes resolved instruction.
     * @param {string} mnemonic The mnemonic.
     * @param {string} rawOperand The raw operand.
     * @param {string} operand The operand.
     * @param {number} operandLength The operand length.
     * @returns {boolean} The result.
     */
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
     * @param {string} [rawOperand] The raw source operand before expansion.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleLogicAndCompareOperations(opcode: string, operand: string, len: number, explicitlen: boolean, rawOperand?: string): boolean;
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