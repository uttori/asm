import type { ArchitectureEncoder, LoweredInstruction, Spc700Context } from "./architecture-types.js";
/**
 * Additional instructions share similar addressing forms but have unique opcodes,
 * e.g. "(X),(Y)" or "$dp,#$imm", etc. However, some instructions (like "CMP X,#imm")
 * differ in syntax. We'll handle that in code directly.
 */
export declare class ArchSPC700 implements ArchitectureEncoder {
    assembler: Spc700Context;
    constructor(assembler: Spc700Context);
    encode(words: string[]): boolean;
    estimateInstruction(instruction: LoweredInstruction): number;
    encodeInstruction(instruction: LoweredInstruction): boolean;
    estimateSize(words: string[]): number;
    asblock_spc700(words: string[]): boolean;
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
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleOneOperand(opcode: string, operand: string, forcedLen: number | null, explicitlen: boolean): boolean;
    /**
     * Handle instructions that have exactly two operands, e.g. "ADC A,($12+X)" or "MOV $12,#$34".
     * @param {string} opcode - the opcode
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @param {number | null} forcedLen - the forced length
     * @param {boolean} explicitlen - the explicit length
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleTwoOperands(opcode: string, left: string, right: string, forcedLen: number | null, explicitlen: boolean): boolean;
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
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleMemoryInstruction(opcode: string, left: string, right: string, forcedLen: number | null, explicitlen: boolean): boolean;
    /**
     * Writes dp or abs address (1 or 2 bytes) depending on getAddressSize
     * @param {number} value - the value to write
     */
    writeDpOrAbs(value: number): void;
    /**
     * Classify operand for "A,(X)" style memory instructions,
     * returning an address mode name that matches e.g. a_indirectX, a_dp, a_abs, etc.
     * @param {string} operand - the operand
     * @returns {{ mode: string; val: number }} the address mode and value
     */
    classifySpc700Addressing(operand: string): {
        mode: "indirectX" | "indirectDpX" | "imm" | "absX" | "dpX" | "absY" | "indirectDpY" | "abs" | "dp";
        val: number;
    };
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
     * BBSn / BBCn => 2 operands: e.g. "BBC0 $12,Mylabel => 13 12 FF"
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
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleDbnzCbne(opcode: string, left: string, right: string): boolean;
    /**
     * handle push/pop with single operand => e.g. PUSH A => 0x2D, PUSH X => 0x4D, etc.
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handlePushPop(opcode: string, operand: string): boolean;
    /**
     * handle call/jump instructions with single operand => e.g. "CALL $1234", "PCALL $12"
     * "JMP $1234", "JMP ($1234+X)"
     * @param {string} opcode - the opcode
     * @param {string} operand - the operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleCallJump(opcode: string, operand: string): boolean;
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
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleCmpXyOrMovXy(opcode: string, operand: string, forcedLen: number | null, explicitlen: boolean): boolean;
    /**
     * TSET / TCLR => e.g. "TSET $1234,A" => 0x0E 34 12
     * @param {string} opcode - the opcode
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handleTsetTclr(opcode: string, left: string, right: string): boolean;
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
     * handle e.g. "OR1 C,$1234" => 0x0A 34 12, "OR1 C,!$1234" => 0x2A 34 12,
     * "AND1 C,$1234" => 0x4A 34 12, "AND1 C,!$1234 => 0x6A 34 12, "EOR1 C,$1234 => 0x8A 34 12,
     * "MOV1 $1234,C => 0xCA 34 32" or "MOV1 C,$1234 => 0xAA 34 32"
     * "NOT1 $1234 => 0xEA 34 32"
     * @param {string} opcode - the opcode
     * @param {string} left - the left operand
     * @param {string} right - the right operand
     * @returns {boolean} true if the combo was handled, false otherwise
     */
    handleBitManipulation(opcode: string, left: string, right: string): boolean;
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
//# sourceMappingURL=ArchSPC700.d.ts.map