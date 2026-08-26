import { type ArchitectureEncoder, type ArchitectureEncoderContext, type EncoderRuntime, type InstructionDescriptor, type LoweredInstruction } from "@uttori/asm-core";
/**
 * WDC 65C816 encoder. M/X size flags start 8-bit each pass (`beginPass`) and
 * track SEP/REP so immediates (`LDA #expr`) match the current register width.
 *
 * `optimizeDirectPage` is a session callback - `optimize dp ram|always` can
 * change mid-source; we must not snapshot it in the constructor.
 *
 * `smartMode` mirrors ca65's `.smart` directive. When `true` (the default),
 * `SEP`/`REP` instructions automatically update M/X width hints. When `false`,
 * the hints are only changed by explicit `.a8`/`.a16`/`.i8`/`.i16` directives.
 * The default matches Asar's always-tracking behaviour.
 */
export declare class Arch65816 implements ArchitectureEncoder {
    readonly optimizeDirectPage: () => boolean;
    assembler: EncoderRuntime;
    /** Native 16-bit accumulator (REP #$20). Reset at the start of each assembly stage. */
    m16: boolean;
    /** Native 16-bit index registers (REP #$10). Reset at the start of each assembly stage. */
    x16: boolean;
    /**
     * When true, `SEP`/`REP` auto-update M/X hints (Asar-compatible default).
     * Set to false by `.smart off`; re-enabled by `.smart` or `.smart on`.
     */
    smartMode: boolean;
    constructor(context: ArchitectureEncoderContext, optimizeDirectPage?: () => boolean);
    /**
     * Resets M/X size flags at the start of each assembly stage.
     * `smartMode` is intentionally NOT reset so `.smart off` persists across stages.
     * @returns {void}
     */
    beginPass(): void;
    /**
     * Sets the accumulator (M-flag) width hint.
     * Used by the ca65-compatible `.a8` and `.a16` directives.
     * @param {boolean} is16 True for 16-bit accumulator, false for 8-bit.
     * @returns {void}
     */
    setAccumulatorWidth(is16: boolean): void;
    /**
     * Sets the index register (X-flag) width hint.
     * Used by the ca65-compatible `.i8` and `.i16` directives.
     * @param {boolean} is16 True for 16-bit index registers, false for 8-bit.
     * @returns {void}
     */
    setIndexWidth(is16: boolean): void;
    /**
     * Enables or disables automatic M/X tracking via `SEP`/`REP` instructions.
     * Used by the ca65-compatible `.smart` directive.
     * @param {boolean} enabled True to enable smart mode (default), false to disable.
     * @returns {void}
     */
    setSmartMode(enabled: boolean): void;
    /**
     * Applies SEP/REP to assembler-facing M/X flags. Unresolvable immediates
     * (forward labels) are ignored - flags stay at the last known value, matching
     * Asar's "best effort" size tracking across passes.
     * Skipped when `smartMode` is false (explicit `.a8`/`.a16`/`.i8`/`.i16` only).
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
     * Size of a lowered instruction. Must match {@link encodeResolvedInstruction}
     * so layout `step()` stays in sync with emit (including SEP/REP side effects).
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {number} Encoded size in bytes, or 0 if not a 65816 op.
     */
    estimateInstruction(instruction: LoweredInstruction): number;
    /**
     * Encodes a lowered instruction. Returns false only when the mnemonic is not ours.
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {boolean} True if encoded.
     */
    encodeInstruction(instruction: LoweredInstruction): boolean;
    /**
     * Estimates size from tokenized words (mnemonic + rest-of-line operand).
     * @param {string[]} words The words.
     * @returns {number} Encoded size in bytes.
     */
    estimateSize(words: string[]): number;
    /**
     * Size for a resolved mnemonic/operand. SEP/REP is applied here too so a
     * following immediate in the same estimate pass sees the new M/X width.
     *
     * Asar quirk: `NOP #$n` (and other implied ops with `#`) is a repeat count,
     * not an immediate - size is `n` bytes of the same opcode.
     * `ASL #$n` is the same for shift/inc/dec (repeat the accumulator form).
     *
     * @param {string} mnemonic The mnemonic.
     * @param {string} rawOperand The raw operand.
     * @param {string} operand Expanded operand.
     * @param {number} operandLength Inferred operand width.
     * @returns {number} Encoded size in bytes.
     */
    estimateResolvedInstruction(mnemonic: string, rawOperand: string, operand: string, operandLength: number): number;
    /**
     * Processes a 65816 assembly instruction.
     * @param {string[]} words The tokenized instruction.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    encode(words: string[]): boolean;
    /**
     * Encodes a resolved mnemonic/operand. Width suffixes (`.b/.w/.l`) and
     * classified modes choose among opcode tables in the `handle*` methods.
     * @param {string} mnemonic The mnemonic.
     * @param {string} rawOperand Source operand (for `#` / indexing tests).
     * @param {string} operand Expanded operand.
     * @param {number} operandLength Inferred width before `.b/.w/.l`.
     * @returns {boolean} True if this architecture handled the instruction.
     */
    encodeResolvedInstruction(mnemonic: string, rawOperand: string, operand: string, operandLength: number): boolean;
    /**
     * Encodes ADC / LDA / SBC / STA. Logic/compare ops are
     * {@link handleLogicAndCompareOperations}; STA has no immediate form.
     *
     * DP (`$xx` / `$xx,x`) is used only when `optimize dp ram|always` is on or
     * the source spelling is explicit 1–2 digit hex. Otherwise a DP-sized value
     * still emits absolute (Asar `optimize dp none` default).
     *
     * @param {string} opcode ADC, LDA, SBC, or STA.
     * @param {string} operand Expanded operand.
     * @param {number} len Inferred or forced operand width.
     * @param {boolean} explicitlen True when `.b/.w/.l` forced the width.
     * @param {string} rawOperand Source operand (immediates / indexing tests).
     * @returns {boolean} True if this family handled the opcode.
     */
    handleMemoryOperations(opcode: string, operand: string, len: number, explicitlen: boolean, rawOperand?: string): boolean;
    /**
     * Encodes AND / EOR / ORA / CMP / CPX / CPY.
     *
     * Unforced DP is **spelling-based**, not `optimize dp`: expanded `$xx` (exactly two
     * hex digits) is DP even when `optimize dp none`. That diverges from
     * {@link handleMemoryOperations} (ADC/LDA/SBC/STA), which require the optimize
     * flag or an explicit 1–2 digit hex spelling. `$007E` is four digits → absolute.
     *
     * Classifier `[$nn]` is `indirectLong` and remaps to `directIndirectLong` (1-byte
     * DP, ORA `$07`) when the table has that key. CPX/CPY omit it and throw.
     * Forced `.l,x` is abs,x + 2 (ORA `$1D` + 2 = `$1F`). Forced `,y` is abs only
     * (`len === 2`); this family has no dp,y / long,y. CPX/CPY have no `(dp,x)` /
     * long / stack forms.
     *
     * @param {string} opcode AND, EOR, ORA, CMP, CPX, or CPY.
     * @param {string} operand Expanded operand.
     * @param {number} len Inferred or forced operand width.
     * @param {boolean} explicitlen True when `.b/.w/.l` forced the width.
     * @param {string} [rawOperand] Source operand before expansion.
     * @returns {boolean} True if this family handled the opcode.
     */
    handleLogicAndCompareOperations(opcode: string, operand: string, len: number, explicitlen: boolean, rawOperand?: string): boolean;
    /**
     * Implied ops. `OPCODE #$n` is Asar's repeat: write the opcode `n` times.
     * `expandOperand` may turn `#10` into `#$A`; strip `$` before parseInt.
     * Count `0` emits nothing (still "handled").
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleNoOperandOperations(opcode: string, operand: string): boolean;
    /**
     * Encodes ASL / LSR / ROL / ROR / INC / DEC.
     * Bare or `A` is accumulator. `ASL #$n` (and friends) repeats the accumulator
     * opcode `n` times - Asar pseudo, not a DP address. `.l` is rejected.
     *
     * @param {string} opcode Shift, rotate, INC, or DEC.
     * @param {string} operand Operand or empty for implied accumulator.
     * @param {number} len Forced width when `explicitlen` is true.
     * @param {boolean} explicitlen True when `.b/.w` forced the width.
     * @returns {boolean} True if this family handled the opcode.
     */
    handleArithmeticOperations(opcode: string, operand: string, len: number, explicitlen: boolean): boolean;
    /**
     * Encodes LDX / LDY. Immediate width follows {@link immediateBytes} (X flag).
     * Hardware: LDX indexes Y, LDY indexes X - there is no LDX abs,x.
     * `.l` is rejected. Without `.b/.w`, `$xxxx` spelling or value `> $FF` picks abs.
     *
     * @param {string} opcode LDX or LDY.
     * @param {string} operand Source operand.
     * @param {number} len Inferred or forced width.
     * @param {boolean} explicitlen True when `.b/.w` forced the width.
     * @returns {boolean} True if LDX/LDY was encoded.
     */
    handleLoadRegister(opcode: string, operand: string, len: number, explicitlen: boolean): boolean;
    /**
     * Handles JMP / JSR / JML / JSL, including `(addr)`, `[addr]`, and `(addr,x)`.
     * `_bbxxxx` label names can supply a bank when the symbol value is 16-bit.
     * JMP/JSR promote to JML/JSL when the target is outside the current bank.
     * @param {string} opcode - The opcode to handle.
     * @param {string} operand - The resolved operand to handle.
     * @param {string} rawOperand - The original source operand before expansion.
     * @returns {boolean} True if the opcode and operand were handled successfully, false otherwise.
     */
    handleJump(opcode: string, operand: string, rawOperand?: string): boolean;
    /**
     * PER (Push Effective Relative): encodes a 16-bit displacement as the operand
     * value itself. Asar does not subtract PC here - authors write `label-*` or a
     * literal offset. Adding `currentTargetAddress` double-counted and was removed.
     * @param {string} operand The operand to handle.
     * @returns {boolean} true if the instruction was handled, false otherwise
     */
    handlePER(operand: string): boolean;
    /**
     * Encodes STX / STY / STZ. STX indexes Y only (no abs,y); STY indexes X only
     * (no abs,x). Forced `.w` on those indexed forms still emits the DP opcode.
     *
     * @param {string} opcode STX, STY, or STZ.
     * @param {string} operand Source operand.
     * @param {number} len Forced width when `explicitlen` is true.
     * @param {boolean} explicitlen True when `.b/.w` forced the width.
     * @returns {boolean} True if this family handled the opcode.
     */
    handleStoreOperations(opcode: string, operand: string, len: number, explicitlen: boolean): boolean;
    /**
     * MVN/MVP. WDC and the hover catalog spell `dest, src`; we still write bytes
     * in source order (first operand, then second) - Asar's wire format. Locals
     * are named src/dest after that write order, not WDC's dest-then-src names.
     *
     * Hardware: opcode $54 MVN (ascending), $44 MVP (descending), then two bank bytes.
     *
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleBlockMove(opcode: string, operand: string): boolean;
    /**
     * Encodes BIT / TSB / TRB. TSB/TRB have no immediate or `,x`.
     * Unforced `BIT #$0000` is 16-bit because the source spelling is 6 chars
     * (`#$` + 4 hex digits), not because the value needs a word.
     *
     * @param {string} opcode BIT, TSB, or TRB.
     * @param {string} operand Source operand.
     * @param {number} len Forced width when `explicitlen` is true.
     * @param {boolean} explicitlen True when `.b/.w` forced the width.
     * @returns {boolean} True if this family handled the opcode.
     */
    handleBitTestOperations(opcode: string, operand: string, len: number, explicitlen: boolean): boolean;
    /**
     * Encodes BRK / COP / PEA / PEI / REP / SEP / WDM. Width is fixed: PEA is
     * always 16-bit; the rest are 8-bit. `.b/.w` on REP/SEP only validates range.
     * `hexconstant` is diagnostic-only (non-hex immediates log "assuming 8-bit").
     *
     * @param {string} opcode Candidate mnemonic.
     * @param {number} num Already-evaluated operand value.
     * @param {number} len Inferred width (REP/SEP range check).
     * @param {boolean} explicitlen Whether a suffix forced the width.
     * @param {boolean} hexconstant True when the operand spelling starts with `$` or `%`.
     * @returns {boolean} True if this family handled the opcode.
     */
    handleGenericOpcode(opcode: string, num: number, len: number, explicitlen: boolean, hexconstant: boolean): boolean;
    /**
     * Relative branches. `$xx` (1–2 hex digits) is a raw displacement, not a
     * target - same Asar rule as Super FX. `+`/`-` unnamed labels resolve from
     * the instruction *after* the branch (PC+2 or PC+3 for BRL).
     * @param {string} opcode The opcode to handle.
     * @param {string} operand The operand to handle.
     * @returns {boolean} True if the opcode was handled, false otherwise.
     */
    handleBranchInstructions(opcode: string, operand: string): boolean;
    /**
     * Fallback TSB/TRB encoder (tests call this directly). Live encode uses
     * {@link handleBitTestOperations}. `$` + 4 hex digits (`operand.length === 5`)
     * is treated as absolute even if the value fits in a byte.
     *
     * @param {string} opcode TSB or TRB.
     * @param {string} operand Absolute or direct-page address.
     * @returns {boolean} True if TSB/TRB was encoded.
     */
    handleMemoryBitInstructions(opcode: string, operand: string): boolean;
    /**
     * Strips an explicit `.b/.w/.l/.d` suffix from a mnemonic.
     * @param {string} opcode Uppercased mnemonic, possibly with a length suffix.
     * @returns {{ name: string; explicitLength: number | undefined }} Bare mnemonic and length when present.
     */
    readMnemonicLength(opcode: string): {
        name: string;
        explicitLength: number | undefined;
    };
    /**
     * `.b` = 1, `.w` = 2, `.l` = 3. `.d` (32-bit) is accepted but deprecated -
     * 65816 has no 32-bit immediate; callers treat it as width 4 for PEA-like repeats.
     * @param {string} c The opcode suffix to resolve the length of.
     * @returns {number} The operand length.
     * @throws {Error} If the opcode length is invalid.
     */
    getlenfromchar(c: string): number;
}
//# sourceMappingURL=65816.d.ts.map