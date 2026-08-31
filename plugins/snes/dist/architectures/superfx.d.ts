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
    /**
     * @param {ArchitectureEncoderContext} context Encoder host.
     * @param {() => boolean} asarMoveShortAddress Session flag for **auto-MOVE** short RAM only.
     *   Hardware stores a word index (`addr >> 1`); Asar stores `addr & 0xff`. Explicit
     *   `LMS`/`SMS` always encode `addr >> 1` and ignore this flag. Default is hardware.
     */
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
     * Encodes a resolved Super FX mnemonic. Implied/prefixed ops reject extra
     * operands; unknown mnemonics return false (`unknownInstructionBehavior` is
     * `returnFalse` so 65816 can try next).
     *
     * @param {string} mnemonic The mnemonic.
     * @param {string[]} operands Split operands.
     * @param {LoweredOperand} [loweredOperand] Combined lowered operand.
     * @param {LoweredOperand[]} [loweredOperands] Per-operand lowered metadata.
     * @returns {boolean} True if the instruction was encoded.
     */
    encodeResolvedInstruction(mnemonic: string, operands: string[], loweredOperand?: LoweredOperand, loweredOperands?: LoweredOperand[]): boolean;
    /**
     * Handles implied SuperFX opcodes with no operands (STOP, NOP, ALT1, ...) and
     * two-byte prefixed ops (PLOT, SWAP, ...) from PREFIXED_OPCODES.
     * @param {string} opcode Uppercased mnemonic.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    handleSingleWordOpcode(opcode: string): boolean;
    /**
     * Single-operand Super FX: short branches (`$XX` is a raw offset; labels stay
     * PC-relative), then register / `#0`–`#15` / `(Rn)` ops.
     * @param {string} opcode Uppercased mnemonic.
     * @param {string} operand The operand.
     * @param {number} operandLength Logged only; encoded size is fixed per opcode family.
     * @param {LoweredOperand} [loweredOperand] Lowered operand metadata.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    handleOneOperandOpcode(opcode: string, operand: string, operandLength: number, loweredOperand?: LoweredOperand): boolean;
    /**
     * Two-operand Super FX: MOVE/MOVES register pairs, IBT/IWT/`MOVE Rn,#imm`
     * (signed-byte → IBT), MOVEB/MOVEW via `(Rn)`, then LM/LMS/LEA/SM/SMS and
     * auto-MOVE RAM. `(R0)` omits TO/FROM because B/D already default to R0.
     *
     * Explicit `LMS`/`SMS` always store `addr >> 1`. Auto-`MOVE` short form uses
     * {@link moveShortAddressByte} (honors Asar compat). LEA is IWT-shaped: no ALT1.
     *
     * @param {string} opcode Uppercased mnemonic.
     * @param {string} leftOp Left operand.
     * @param {string} rightOp Right operand.
     * @param {LoweredOperand} [leftLowered] Lowered left operand.
     * @param {LoweredOperand} [rightLowered] Lowered right operand.
     * @returns {boolean} True if encoded.
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
     * @param {number} max Inclusive maximum.
     * @returns {void}
     * @throws {Error} If `mid` is outside `[min, max]`.
     */
    rangeCheck(min: number, mid: number, max: number): void;
    /**
     * LMS/SMS require an even RAM byte address in `[0x000..0x1FE]`. Throws otherwise.
     * Encode then stores `addr >> 1`; this check is the byte-address constraint.
     * @param {number} num RAM byte address (not the word index).
     * @returns {boolean} Always `true` when the address is valid.
     * @throws {Error} If the address is odd or outside the short-RAM window.
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
     * Fallback width when lowering did not supply `length`. `$XX` is 1; everything else is 2.
     * Super FX uses this for one-operand branches when `loweredOperand` is missing.
     * @param {string} operand Operand text.
     * @returns {number} 1 for an explicit `$XX` spelling, otherwise 2.
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
     * Writes optional ALT prefix then `base + register`. AND/OR/BIC/XOR reject R0
     * (those encodings are MERGE/HIB).
     *
     * @param {RegisterOpEncoding} encoding Table entry (prefix, base, optional min/max).
     * @param {number} register Register number 0–15.
     * @returns {void}
     */
    writeRegisterOp(encoding: RegisterOpEncoding, register: number): void;
    /**
     * Encodes the short-RAM operand byte for **auto-MOVE** only (`MOVE Rn,(addr)` /
     * `MOVE (addr),Rn`). Explicit LMS/SMS call `addr >> 1` directly and skip this.
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