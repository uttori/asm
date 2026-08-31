import { type ArchitectureEncoder, type ArchitectureEncoderContext, type EncoderRuntime, type InstructionDescriptor, type LoweredInstruction, type LoweredOperand } from "@uttori/asm-core";
/**
 * Sony SPC700 encoder. Operand commas are split at top-level only so
 * `MOV A,($12+X)` stays two operands. Address width follows hex spelling,
 * not the resolved value - see {@link getAddressSize}.
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
     * Size of a lowered instruction. Must match encode so layout stays in sync.
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {number} Encoded size in bytes.
     */
    estimateInstruction(instruction: LoweredInstruction): number;
    /**
     * Encodes a lowered instruction.
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {boolean} True if encoded.
     */
    encodeInstruction(instruction: LoweredInstruction): boolean;
    /**
     * Estimates size from tokenized words.
     * @param {string[]} words The words.
     * @returns {number} Encoded size in bytes.
     */
    estimateSize(words: string[]): number;
    /**
     * Size for a resolved mnemonic. `.b/.w` suffixes are stripped (SPC700 width
     * is spelling-based, not 65816 `.l`). Unknown ops return 1 so layout does
     * not stall; encode will still reject them.
     *
     * @param {string} mnemonic The mnemonic.
     * @param {string} operandText The operand text.
     * @param {LoweredOperand} [loweredOperand] Combined lowered operand.
     * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
     * @returns {number} Encoded size in bytes.
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
    /**
     * Encodes a resolved mnemonic. `.b/.w/.l` is stripped (SPC700 width is
     * spelling-based). Dispatch is operand-count: 0/implied → 1 → 2 → numbered
     * bit ops with a third bit argument (`AND1 C,$addr,2`).
     *
     * @param {string} mnemonic Raw mnemonic, possibly with a length suffix.
     * @param {string[]} operands Split operands (already expanded when possible).
     * @param {LoweredOperand} [loweredOperand] Combined rest-of-line operand.
     * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
     * @returns {boolean} True if encoded.
     */
    encodeResolvedInstruction(mnemonic: string, operands: string[], loweredOperand?: LoweredOperand, loweredOperands?: LoweredOperand[]): boolean;
    /**
     * Implied single-byte ops (NOP, BRK, RET, flag ops, SLEEP, STOP, XCN).
     * Returns false when the mnemonic is not in this set so other handlers can run.
     *
     * @param {string} opcode Uppercased mnemonic.
     * @returns {boolean} True if a 1-byte opcode was written.
     */
    handleSingleNoOperand(opcode: string): boolean;
    /**
     * One-operand dispatch: shift/inc/dec, SET/CLR bits, relative branches,
     * TCALL n (decimal 0–15, not `$n`), PUSH/POP, CALL/JMP/PCALL, then MUL/DIV/DAA.
     *
     * @param {string} opcode Uppercased mnemonic.
     * @param {string} operand Single operand text.
     * @param {number | null} forcedLen `.b`=1 / `.w`=2 when a suffix was present.
     * @param {boolean} explicitlen True when `forcedLen` came from a suffix.
     * @param {LoweredOperand} [loweredOperand] Lowered metadata for `operand`.
     * @returns {boolean} True if encoded.
     */
    handleOneOperand(opcode: string, operand: string, forcedLen: number | null, explicitlen: boolean, loweredOperand?: LoweredOperand): boolean;
    /**
     * Two-operand dispatch: BBS/BBC, DBNZ/CBNE, CMP/MOV X|Y, ALU memory forms,
     * TSET/TCLR, MOV, mem.bit carry ops, then YA word ops.
     *
     * @param {string} opcode Uppercased mnemonic.
     * @param {string} left Left operand.
     * @param {string} right Right operand.
     * @param {number | null} forcedLen `.b`=1 / `.w`=2 when a suffix was present.
     * @param {boolean} explicitlen True when `forcedLen` came from a suffix.
     * @param {LoweredOperand} [leftLowered] Lowered left operand.
     * @param {LoweredOperand} [rightLowered] Lowered right operand.
     * @returns {boolean} True if encoded.
     */
    handleTwoOperands(opcode: string, left: string, right: string, forcedLen: number | null, explicitlen: boolean, leftLowered?: LoweredOperand, rightLowered?: LoweredOperand): boolean;
    /**
     * YA word ops: CMPW/ADDW/SUBW/MOVW YA,$dp and MOVW $dp,YA. DP only -
     * `$1234` is not a documented form here (Asar tests are 8-bit).
     *
     * @param {string} opcode Word mnemonic.
     * @param {string} left Left operand (`YA` or `$dp`).
     * @param {string} right Right operand (`$dp` or `YA`).
     * @returns {boolean} True if encoded.
     */
    handleWordOpsTwoOperands(opcode: string, left: string, right: string): boolean;
    /**
     * Encodes ADC/AND/EOR/OR/SBC/CMP from {@link memOpTables}.
     * `A,<mode>` uses {@link classifySpc700Addressing}. `(X),(Y)` is 1 byte.
     * `dp,#imm` and `dp,dp` write the *right* operand first (hardware order),
     * opposite of source order.
     *
     * @param {string} opcode ALU mnemonic.
     * @param {string} left Left operand.
     * @param {string} right Right operand.
     * @param {number | null} forcedLen `.b`/`.w` override for A,dp vs A,abs.
     * @param {boolean} explicitlen True when a suffix forced the width.
     * @param {LoweredOperand} [leftLowered] Lowered left operand.
     * @param {LoweredOperand} [rightLowered] Lowered right operand.
     * @returns {boolean} True if encoded.
     */
    handleMemoryInstruction(opcode: string, left: string, right: string, forcedLen: number | null, explicitlen: boolean, leftLowered?: LoweredOperand, rightLowered?: LoweredOperand): boolean;
    /**
     * Writes a dp (1 byte) or abs (2 byte) address.
     * Width follows the source spelling via `length`, not whether the value fits in 8 bits.
     * `$0030` is absolute even though 0x30 is a direct-page number.
     * @param {number} value Address to write.
     * @param {number} length 1 for direct page, 2 for absolute.
     * @returns {void}
     */
    writeDpOrAbs(value: number, length: number): void;
    /**
     * Maps an `A,<addr>` operand onto {@link memOpTables} keys.
     * Labels keep original case so `spc_07C2+Y` still looks up. `(X)` is
     * indirectX (no extra byte); `($dp+X)` is indirectDpX.
     *
     * @param {string} operand Right-hand operand of an A-destination ALU op.
     * @param {LoweredOperand} [loweredOperand] Lowered metadata when available.
     * @returns {{ mode: string; val: number }} Addressing mode and numeric payload.
     */
    classifySpc700Addressing(operand: string, loweredOperand?: LoweredOperand): {
        mode: "indirectX" | "indirectDpX" | "imm" | "absX" | "dpX" | "absY" | "indirectDpY" | "abs" | "dp";
        val: number;
    };
    /**
     * True for a hex address spelling (`$12`, `$1234`, or bare hex). Registers
     * `A`/`X`/`Y`/`YA`/`SP` are excluded - otherwise `MOV label, A` becomes dp,dp
     * with source `$0A`.
     *
     * @param {string} operand Operand text.
     * @returns {boolean} True when the operand is a dp/abs hex address.
     */
    isDpOrAbs(operand: string): boolean;
    /**
     * ASL / LSR / ROL / ROR / INC / DEC. `A` is implied-acc; `DEC X`/`DEC Y` and
     * `INC X`/`INC Y` are 1-byte register forms. `$dp+X` vs `$abs+X` follows
     * {@link getAddressSize} (spelling), not the numeric value.
     *
     * @param {string} opcode Shift or inc/dec mnemonic.
     * @param {string} operand Operand (`A`, `X`, `Y`, `$dp`, `$dp+X`, `$abs`).
     * @param {number | null} forcedLen `.b`/`.w` override for dp vs abs.
     * @param {boolean} explicitlen True when a suffix forced the width.
     * @returns {boolean} True if encoded.
     */
    handleShiftIncDec(opcode: string, operand: string, forcedLen: number | null, explicitlen: boolean): boolean;
    /**
     * SET0–SET7 / CLR0–CLR7 `$dp`. Bit is in the mnemonic; Asar also accepts
     * `SET1 $13.7` where `.n` overrides the mnemonic digit.
     *
     * @param {string} opcode SET/CLR mnemonic with bit digit.
     * @param {string} operand Direct-page address, optionally `$dp.n`.
     * @returns {boolean} True if encoded.
     */
    handleBitSetClear(opcode: string, operand: string): boolean;
    /**
     * Relative branches (BPL...BRA). Opcode is written first, so the displacement
     * is `target - (pc + 1)` - equivalent to `target - (start + 2)` before the
     * write. `+`/`-` unnamed labels use that same post-opcode PC.
     *
     * @param {string} opcode Branch mnemonic.
     * @param {string} operand Label, `$xx`, or `+`/`-` unnamed label.
     * @returns {boolean} True if encoded.
     */
    handleBranch(opcode: string, operand: string): boolean;
    /**
     * BBS/BBC `$dp,label`. Bit from `$dp.n` if present, else the mnemonic digit
     * (`BBS3`). Wiki-native `BBS $12.3,L` has no digit in the mnemonic.
     *
     * @param {string} opcode BBS/BBC, optionally with a bit digit.
     * @param {string} left Direct-page operand (`$dp` or `$dp.n`).
     * @param {string} right Branch target.
     * @returns {boolean} True if encoded.
     */
    handleTwoOperandsBitBranch(opcode: string, left: string, right: string): boolean;
    /**
     * DBNZ Y,label (2 bytes) vs DBNZ $dp,label (3 bytes). CBNE is always 3 bytes:
     * `$dp` or `$dp+X`.
     *
     * @param {string} opcode DBNZ or CBNE.
     * @param {string} left Register, `$dp`, or `$dp+X`.
     * @param {string} right Branch target.
     * @param {LoweredOperand} [leftLowered] Lowered left operand.
     * @param {LoweredOperand} [_rightLowered] Unused; kept for call-site symmetry.
     * @returns {boolean} True if encoded.
     */
    handleDbnzCbne(opcode: string, left: string, right: string, leftLowered?: LoweredOperand, _rightLowered?: LoweredOperand): boolean;
    /**
     * PUSH/POP A, X, Y, or P (PSW). No `(X)` form.
     *
     * @param {string} opcode PUSH or POP.
     * @param {string} operand Register name.
     * @param {LoweredOperand} [loweredOperand] Lowered register operand.
     * @returns {boolean} True if encoded.
     */
    handlePushPop(opcode: string, operand: string, loweredOperand?: LoweredOperand): boolean;
    /**
     * CALL `$abs` (3F), PCALL `$dp` (4F page-zero), JMP `$abs` (5F) or
     * JMP `($abs+X)` (1F). JMP indirect uses a 16-bit pointer, not DP.
     *
     * @param {string} opcode CALL, PCALL, or JMP.
     * @param {string} operand Target or `($abs+X)`.
     * @param {LoweredOperand} [loweredOperand] Lowered operand metadata.
     * @returns {boolean} True if encoded.
     */
    handleCallJump(opcode: string, operand: string, loweredOperand?: LoweredOperand): boolean;
    /**
     * CMP/MOV with X or Y on the left (`CMP X,#$12`, `MOV Y,$1234`).
     * `operand` is `left,right` joined - a leftover from the one-operand path.
     *
     * @param {string} opcode CMP or MOV.
     * @param {string} operand Combined `left,right` text.
     * @param {number | null} forcedLen `.b`/`.w` override for dp vs abs.
     * @param {boolean} explicitlen True when a suffix forced the width.
     * @param {LoweredOperand} [leftLowered] Lowered left operand.
     * @param {LoweredOperand} [rightLowered] Lowered right operand.
     * @returns {boolean} True if encoded.
     */
    handleCmpXyOrMovXy(opcode: string, operand: string, forcedLen: number | null, explicitlen: boolean, leftLowered?: LoweredOperand, rightLowered?: LoweredOperand): boolean;
    /**
     * TSET/TCLR `$abs,A` - always 16-bit absolute, even for `$12`. Right must be A.
     *
     * @param {string} opcode TSET or TCLR.
     * @param {string} left Absolute address.
     * @param {string} right Must classify as A.
     * @param {LoweredOperand} [rightLowered] Lowered right operand.
     * @returns {boolean} True if encoded.
     */
    handleTsetTclr(opcode: string, left: string, right: string, rightLowered?: LoweredOperand): boolean;
    /**
     * MOV register pairs, then A/X/Y ↔ memory. `.b`/`.w` on `MOV.w A,$0000`
     * forces abs even when the hex is 4 digits of zeros. Remaining indexed
     * forms go to {@link handleMovMemoryCombo} / {@link handleMovMemoryCombo2}.
     *
     * @param {string} left Left operand.
     * @param {string} right Right operand.
     * @param {number | null} forcedLen `.b`=1 / `.w`=2 when a suffix was present.
     * @param {boolean} explicitlen True when `forcedLen` came from a suffix.
     * @returns {boolean} True if encoded.
     */
    handleMovInstruction(left: string, right: string, forcedLen: number | null, explicitlen: boolean): boolean;
    /**
     * MOV `(dp+X)` / `(dp)+Y` ↔ A. Parentheses are optional in the regex so
     * `$12+X,A` can still match C7 - combo2 handles the abs+X variants.
     *
     * @param {string} left Left operand.
     * @param {string} right Right operand.
     * @returns {boolean} True if encoded.
     */
    handleMovMemoryCombo(left: string, right: string): boolean;
    /**
     * MOV `$addr+X|+Y` ↔ A/X/Y. Width from {@link getAddressSize} on the base
     * expression (`$12+X` vs `$1234+X`). Skips anything with parentheses
     * (those belong to {@link handleMovMemoryCombo}).
     *
     * @param {string} left Left operand.
     * @param {string} right Right operand.
     * @returns {boolean} True if encoded.
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
     * DAA A, DAS A, MUL YA, DIV YA,X, then DECW/INCW `$dp`. DIV is passed as
     * `"YA,X"` from {@link handleTwoOperands} via join - still one "operand" here.
     *
     * @param {string} opcode Special mnemonic.
     * @param {string} operand Register combo or `$dp`.
     * @returns {boolean} True if encoded.
     */
    handleSingleOperandSpecial(opcode: string, operand: string): boolean;
    /**
     * DECW/INCW `$dp` only. YA word ops with two operands are
     * {@link handleWordOpsTwoOperands}.
     *
     * @param {string} opcode DECW or INCW.
     * @param {string} operand Direct-page address.
     * @returns {boolean} True if encoded.
     */
    handleWordOps(opcode: string, operand: string): boolean;
    /**
     * `.b`=1, `.w`=2, `.l`=3. `.d` is accepted (deprecated) but SPC700 never
     * emits 32-bit immediates - callers treat 4 as "not dp".
     *
     * @param {string} c Length suffix character.
     * @returns {number} Operand width in bytes.
     */
    getlenfromchar(c: string): number;
}
//# sourceMappingURL=spc700.d.ts.map