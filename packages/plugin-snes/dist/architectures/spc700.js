import { runTypedEncoderEntry, } from "@uttori/asm-core";
import { spc700Catalog } from "../tooling/instruction-catalog.js";
import { parseSpcOperands } from "./spc700-syntax.js";
import { TypedSpc700 } from "./typed-spc700.js";
/** Public source-entry facade. Instruction semantics belong exclusively to the typed encoder. */
export class ArchSPC700 {
    context;
    typedEncoder;
    constructor(context) {
        this.context = context;
        this.typedEncoder = new TypedSpc700();
    }
    /** Public word callers parse at entry and use the same typed encoder as registered sessions. */
    typedEntry(mnemonic, text, emit) {
        const instruction = { mnemonic, operands: parseSpcOperands(mnemonic, text) };
        if (emit) {
            return runTypedEncoderEntry(this.context, this.typedEncoder, instruction, true);
        }
        return runTypedEncoderEntry(this.context, this.typedEncoder, instruction, false);
    }
    /** Static catalog shared with typed instruction tooling. */
    getInstructionCatalog() {
        return spc700Catalog;
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
//# sourceMappingURL=spc700.js.map