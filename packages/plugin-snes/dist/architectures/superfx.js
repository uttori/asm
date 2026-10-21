import { runTypedEncoderEntry, } from "@uttori/asm-core";
import { superFxCatalog } from "../tooling/instruction-catalog.js";
import { parseSuperFxOperands } from "./superfx-syntax.js";
import { TypedSuperFx } from "./typed-superfx.js";
/** Public source-entry facade. Instruction semantics belong exclusively to the typed encoder. */
export class ArchSuperFX {
    context;
    asarMoveShortAddress;
    typedEncoder;
    constructor(context, asarMoveShortAddress = () => false) {
        this.context = context;
        this.asarMoveShortAddress = asarMoveShortAddress;
        this.typedEncoder = new TypedSuperFx(this.asarMoveShortAddress);
    }
    /** Public word callers parse at entry and use the same typed encoder as registered sessions. */
    typedEntry(mnemonic, text, emit) {
        const instruction = { mnemonic, operands: parseSuperFxOperands(mnemonic, text) };
        if (emit) {
            return runTypedEncoderEntry(this.context, this.typedEncoder, instruction, true);
        }
        return runTypedEncoderEntry(this.context, this.typedEncoder, instruction, false);
    }
    /** Static catalog shared with typed instruction tooling. */
    getInstructionCatalog() {
        return superFxCatalog;
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
//# sourceMappingURL=superfx.js.map