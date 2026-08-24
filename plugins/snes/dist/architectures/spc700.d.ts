import { type ArchitectureEncoder, type ArchitectureEncoderContext, type EncoderRuntime, type InstructionDescriptor, type LoweredInstruction, type LoweredOperand } from "@uttori/asm-core";
/**
 * Additional instructions share similar addressing forms but have unique opcodes,
 * e.g. "(X),(Y)" or "$dp,#$imm", etc. However, some instructions (like "CMP X,#imm")
 * differ in syntax. We'll handle that in code directly.
 */
export declare class ArchSPC700 implements ArchitectureEncoder {
    assembler: EncoderRuntime;
    constructor(context: ArchitectureEncoderContext);
    /**
     * Returns the static SPC700 instruction catalog for editor tooling.
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
     * @param {string} operandText The operand text.
     * @param {LoweredOperand} [loweredOperand] The lowered operand.
     * @param {LoweredOperand[]} [loweredOperands] The lowered operands.
     * @returns {number} The result.
     */
    estimateResolvedInstruction(mnemonic: string, operandText: string, loweredOperand?: LoweredOperand, loweredOperands?: LoweredOperand[]): number;
    /**
     * Encoded size for MOV. Must match {@link handleMovInstruction} / XY immediate forms.
     * @param {string} left Left operand.
     * @param {string} right Right operand.
     * @param {LoweredOperand} [leftLowered] Lowered left operand.
     * @param {LoweredOperand} [rightLowered] Lowered right operand.
     * @returns {number} Encoded size in bytes.
     */
    estimateMovSize(left: string, right: string, leftLowered?: LoweredOperand, rightLowered?: LoweredOperand): number;
    /**
     * Encoded size for ADC/AND/EOR/OR/SBC/CMP. Must match {@link handleMemoryInstruction}.
     * @param {string} left Left operand.
     * @param {string} right Right operand.
     * @param {LoweredOperand} [leftLowered] Lowered left operand.
     * @param {LoweredOperand} [rightLowered] Lowered right operand.
     * @returns {number} Encoded size in bytes.
     */
    estimateMemoryOpSize(left: string, right: string, leftLowered?: LoweredOperand, rightLowered?: LoweredOperand): number;
    /**
     * Processes an SPC700 assembly instruction.
     * @param {string[]} words The tokenized instruction.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    encode(words: string[]): boolean;
    /** Legacy API alias for {@link encode}. */
    readonly asblock_spc700: (words: string[]) => boolean;
    /**
     * Encodes resolved instruction.
     * @param {string} mnemonic The mnemonic.
     * @param {string[]} operands The operands.
     * @param {LoweredOperand} [loweredOperand] The lowered operand.
     * @param {LoweredOperand[]} [loweredOperands] The lowered operands.
     * @returns {boolean} The result.
     */
    encodeResolvedInstruction(mnemonic: string, operands: string[], loweredOperand?: LoweredOperand, loweredOperands?: LoweredOperand[]): boolean;
    /**
     * Splits by commas at top-level, ignoring any parentheses grouping.
     * For spc700 code, we typically do not nest parentheses deeply, so a simpler approach may suffice.
     * @param {string} text - the operand string
     * @returns {string[]} array of operands
     */
    splitTopLevelComma(text: string): string[];
    /**
     * Handles single, no-operand opcodes, like NOP, BRK, etc.
     * @param {string} opcode - the opcode
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleSingleNoOperand(opcode: string): boolean;
    /**
     * Handle instructions that have exactly one operand
     * e.g. ASL A, LSR A, DEC A, DEC X, DEC Y,
     * or branches like BRA label, or bit set/clear with one operand, etc.
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @param {number | null} forcedLen - the forced length
     * @param {boolean} explicitlen - the explicit length
     * @param {LoweredOperand} loweredOperand - optional lowered metadata
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleOneOperand(opcode: string, operand: string, forcedLen: number | null, explicitlen: boolean, loweredOperand?: LoweredOperand): boolean;
    /**
     * Handle instructions that have exactly two operands, e.g. "ADC A,($12+X)" or "MOV $12,#$34".
     * @param {string} opcode - the opcode
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @param {number | null} forcedLen - the forced length
     * @param {boolean} explicitlen - the explicit length
     * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
     * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleTwoOperands(opcode: string, left: string, right: string, forcedLen: number | null, explicitlen: boolean, leftLowered?: LoweredOperand, rightLowered?: LoweredOperand): boolean;
    /**
     * handleWordOpsTwoOperands: covers
     *   CMPW YA,$12  => 5A dp
     *   ADDW YA,$12  => 7A dp
     *   SUBW YA,$12  => 9A dp
     *   MOVW YA,$12  => BA dp
     *   MOVW $12,YA  => DA dp
     *
     * According to the test file lines:
     *   "CMPW YA,$12 => 5A 12"
     *   "ADDW YA,$12 => 7A 12"
     *   "SUBW YA,$12 => 9A 12"
     *   "MOVW YA,$12 => BA 12"
     *   "MOVW $12,YA => DA 12"
     *
     * The test only shows an 8-bit direct-page operand. No examples of $1234 for these instructions,
     * so we assume DP only.
     * @param {string} opcode - the opcode
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleWordOpsTwoOperands(opcode: string, left: string, right: string): boolean;
    /**
     * Handle instructions like "ADC A,(X)" or "SBC (X),(Y)", "AND A,$1234", etc.
     * @param {string} opcode - the opcode
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @param {number | null} forcedLen - the forced length
     * @param {boolean} explicitlen - the explicit length
     * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
     * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleMemoryInstruction(opcode: string, left: string, right: string, forcedLen: number | null, explicitlen: boolean, leftLowered?: LoweredOperand, rightLowered?: LoweredOperand): boolean;
    /**
     * Writes a dp (1 byte) or abs (2 byte) address.
     * Width follows the source spelling via `length`, not whether the value fits in 8 bits.
     * `$0030` is absolute even though 0x30 is a direct-page number.
     * @param {number} value Address to write.
     * @param {number} length 1 for direct page, 2 for absolute.
     */
    writeDpOrAbs(value: number, length: number): void;
    /**
     * Classify operand for "A,(X)" style memory instructions,
     * returning an address mode name that matches e.g. a_indirectX, a_dp, a_abs, etc.
     * @param {string} operand - the operand
     * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
     * @returns {{ mode: string; val: number }} the address mode and value
     */
    classifySpc700Addressing(operand: string, loweredOperand?: LoweredOperand): {
        mode: "indirectX" | "indirectDpX" | "imm" | "absX" | "dpX" | "absY" | "indirectDpY" | "abs" | "dp";
        val: number;
    };
    /**
     * Checks whether dp or abs.
     * @param {string} operand The operand.
     * @returns {boolean} The result.
     */
    isDpOrAbs(operand: string): boolean;
    /**
     * SHIFT, INC, DEC instructions. e.g. "ASL A" => 0x1C, "ASL $12+X" => 0x1B 12, etc.
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @param {number | null} forcedLen - the forced length
     * @param {boolean} explicitlen - whether the length is explicit
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleShiftIncDec(opcode: string, operand: string, forcedLen: number | null, explicitlen: boolean): boolean;
    /**
     * Actually that's 2 "operands," but the test lumps them into a single comma-split line "BBS0 $12,Mylabel".
     * We'll handle that in handleTwoOperands.
     *
     * For "SETn $12 => 0x02 12" or "CLRn $12 => 0x12 12," that's one operand + the bit # is in the opcode name.
     * Asar also accepts `SET1 $13.7` / `CLR1 $13.7`, where the bit comes from the operand.
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleBitSetClear(opcode: string, operand: string): boolean;
    /**
     * BPL / BMI / BVC / BVS / BCC / BCS / BNE / BEQ / BRA => 1 operand (the label).
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleBranch(opcode: string, operand: string): boolean;
    /**
     * BBSn / BBCn / wiki-native `BBS $dp.n`: e.g. "BBC0 $12,Mylabel => 13 12 FF",
     * "BBS $12.3,L => 63 12 FF". Bit comes from `$dp.n` if present, else the mnemonic digit.
     * That logic is in handleTwoOperands because we have two comma-split sections.
     * @param {string} opcode - the opcode
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleTwoOperandsBitBranch(opcode: string, left: string, right: string): boolean;
    /**
     * e.g. DBNZ Y,Mylabel => FE offset, DBNZ $dp,Mylabel => 6E dp offset
     * also "CBNE $dp+X,Mylabel => DE dp offset" or "CBNE $dp,Mylabel => 2E dp offset"
     * @param {string} opcode - the opcode
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
     * @param {LoweredOperand} _rightLowered - optional lowered metadata for the right operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleDbnzCbne(opcode: string, left: string, right: string, leftLowered?: LoweredOperand, _rightLowered?: LoweredOperand): boolean;
    /**
     * handle push/pop with single operand => e.g. PUSH A => 0x2D, PUSH X => 0x4D, etc.
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handlePushPop(opcode: string, operand: string, loweredOperand?: LoweredOperand): boolean;
    /**
     * handle call/jump instructions with single operand => e.g. "CALL $1234", "PCALL $12"
     * "JMP $1234", "JMP ($1234+X)"
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @param {LoweredOperand} loweredOperand - optional lowered operand metadata
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleCallJump(opcode: string, operand: string, loweredOperand?: LoweredOperand): boolean;
    /**
     * handle "CMP X,#$12" or "CMP X,$1234" or "MOV X,#$12" or "MOV Y,#$12" etc.
     * We see from the test code lines like:
     *  CMP X,#$12 => C8 12
     *  CMP X,$1234 => 1E 34 12
     *  CMP X,$12 => 3E 12
     *  MOV X,#$12 => CD 12
     *  MOV Y,#$12 => 8D 12
     *
     * We'll unify them here.
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @param {number | null} forcedLen - the forced length
     * @param {boolean} explicitlen - whether the length is explicit
     * @param {LoweredOperand} leftLowered - optional lowered metadata for the left operand
     * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleCmpXyOrMovXy(opcode: string, operand: string, forcedLen: number | null, explicitlen: boolean, leftLowered?: LoweredOperand, rightLowered?: LoweredOperand): boolean;
    /**
     * TSET / TCLR => e.g. "TSET $1234,A" => 0x0E 34 12
     * @param {string} opcode - the opcode
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @param {LoweredOperand} rightLowered - optional lowered metadata for the right operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleTsetTclr(opcode: string, left: string, right: string, rightLowered?: LoweredOperand): boolean;
    /**
     * handle e.g. "MOV X,A" or "MOV (X+),A" or "MOV $12,#$34".
     * Some are covered by memory instructions if the left side is A.
     * This function focuses on the big variety from the test lines.
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @param {number | null} forcedLen - the forced length
     * @param {boolean} explicitlen - whether the length is explicit
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleMovInstruction(left: string, right: string, forcedLen: number | null, explicitlen: boolean): boolean;
    /**
     * handle combos like "MOV ($12+X),A => 0xC7 12"
     * or "MOV ($12)+Y,A => 0xD7 12"
     * or "MOV A,($12+X) => 0xE7 12"
     * or "MOV A,($12)+Y => 0xF7 12"
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @returns {boolean} true if the combo was handled, false otherwise
     */
    handleMovMemoryCombo(left: string, right: string): boolean;
    /**
     * handle combos like "MOV $1234+X,A => 0xD5 34 12", "MOV $12+X,A => 0xD4 12", etc.
     * or "MOV A,$1234+X => 0xF5 34 12" etc.
     * or "MOV $12+Y,X => 0xD9 12", etc.
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @returns {boolean} true if the combo was handled, false otherwise
     */
    handleMovMemoryCombo2(left: string, right: string): boolean;
    /**
     * Encodes mem.bit carry ops. Bit is taken from `$addr.n` if present, else the
     * mnemonic digit (`NOT2` → bit 2). High byte is `(addr >> 8) | (bit << 5)`.
     *
     *   NOT1 $1234 / NOT2 C,$0027 / NOT1 $12.3 / NOT1 $addr,3
     *   MOV1 C,$addr / MOV2 $addr,C
     *   OR1 C,$addr / OR1 C,!$addr / AND1 C,/addr
     * @param {string} opcode Mnemonic, including numbered TASM forms.
     * @param {string} left Left operand.
     * @param {string} right Right operand, or empty for one-operand NOT/MOV.
     * @param {string} [explicitBitText] Optional third operand bit (`AND1 C,$addr,2`).
     * @returns {boolean} true if the combo was handled, false otherwise
     */
    handleBitManipulation(opcode: string, left: string, right: string, explicitBitText?: string): boolean;
    /**
     * handle instructions with 1 operand that didn't match the prior sets, e.g. "DAA A => DF," "DAS A => BE," "MUL YA => CF," "DIV YA,X => 9E"
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @returns {boolean} true if the combo was handled, false otherwise
     */
    handleSingleOperandSpecial(opcode: string, operand: string): boolean;
    /**
     * e.g. "DECW $12 => 1A 12", "INCW $12 => 3A 12", "CMPW YA,$12 => 5A ???" => That's 2 operands though
     * We'll handle the single-operand forms: DECW dp => 1A dp, INCW dp => 3A dp
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @returns {boolean} true if the combo was handled, false otherwise
     */
    handleWordOps(opcode: string, operand: string): boolean;
    /**
     * Resolves the operand length from opcode suffix.
     * @param {string} c - the opcode suffix
     * @returns {number} the operand length
     */
    getlenfromchar(c: string): number;
}
//# sourceMappingURL=spc700.d.ts.map