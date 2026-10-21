import { runTypedEncoderEntry, } from "@uttori/asm-core";
import { cpu65816Catalog } from "../tooling/instruction-catalog.js";
import { parse65816Operands } from "./65816-syntax.js";
import { Typed65816 } from "./typed-65816.js";
/** Public source-entry facade. Instruction semantics belong exclusively to the typed encoder. */
export class Arch65816 {
    context;
    optimizeDirectPage;
    typedEncoder;
    /** Public word callers parse at entry and use the same typed encoder as registered sessions. */
    typedEntry(mnemonic, text, emit) {
        this.typedEncoder.m16 = this.m16;
        this.typedEncoder.x16 = this.x16;
        this.typedEncoder.smartMode = this.smartMode;
        const instruction = { mnemonic, operands: parse65816Operands(mnemonic, text) };
        try {
            if (emit) {
                return runTypedEncoderEntry(this.context, this.typedEncoder, instruction, true);
            }
            return runTypedEncoderEntry(this.context, this.typedEncoder, instruction, false);
        }
        finally {
            this.m16 = this.typedEncoder.m16;
            this.x16 = this.typedEncoder.x16;
        }
    }
    /** Native 16-bit accumulator (REP #$20). Reset at the start of each assembly stage. */
    m16;
    /** Native 16-bit index registers (REP #$10). Reset at the start of each assembly stage. */
    x16;
    /**
     * When true, `SEP`/`REP` auto-update M/X hints (Asar-compatible default).
     * Set to false by `.smart off`. Re-enabled by `.smart` or `.smart on`.
     */
    smartMode;
    constructor(context, optimizeDirectPage = () => false) {
        this.context = context;
        this.optimizeDirectPage = optimizeDirectPage;
        this.typedEncoder = new Typed65816(this.optimizeDirectPage);
        this.m16 = false;
        this.x16 = false;
        this.smartMode = true;
    }
    /**
     * Resets M/X size flags at the start of each assembly stage.
     * `smartMode` is intentionally NOT reset so `.smart off` persists across stages.
     * @returns {void}
     */
    beginPass() {
        this.m16 = false;
        this.x16 = false;
    }
    /**
     * Sets the accumulator (M-flag) width hint.
     * Used by the ca65-compatible `.a8` and `.a16` directives.
     * @param {boolean} is16 True for 16-bit accumulator, false for 8-bit.
     * @returns {void}
     */
    setAccumulatorWidth(is16) {
        this.m16 = is16;
    }
    /**
     * Sets the index register (X-flag) width hint.
     * Used by the ca65-compatible `.i8` and `.i16` directives.
     * @param {boolean} is16 True for 16-bit index registers, false for 8-bit.
     * @returns {void}
     */
    setIndexWidth(is16) {
        this.x16 = is16;
    }
    /**
     * Enables or disables automatic M/X tracking via `SEP`/`REP` instructions.
     * Used by the ca65-compatible `.smart` directive.
     * @param {boolean} enabled True to enable smart mode (default), false to disable.
     * @returns {void}
     */
    setSmartMode(enabled) {
        this.smartMode = enabled;
    }
    /** Static catalog shared with typed instruction tooling. */
    getInstructionCatalog() {
        return cpu65816Catalog;
    }
    /** Parse a source instruction and reserve the byte count selected by the typed encoder. */
    estimateSize(words) {
        if (!words.length) {
            return 0;
        }
        return this.typedEntry(words[0], words.slice(1).join(" "), false);
    }
    /** Parse a source instruction and emit through the same target contract as assembler sessions. */
    encode(words) {
        if (!words.length) {
            return false;
        }
        return this.typedEntry(words[0], words.slice(1).join(" "), true);
    }
}
//# sourceMappingURL=65816.js.map