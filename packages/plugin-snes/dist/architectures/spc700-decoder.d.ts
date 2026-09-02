import type { ArchitectureDecodeContext, ArchitectureDecodeResult, ArchitectureDecoder, DecodedInstruction } from "@uttori/asm-core";
/** State that changes how SPC700 direct-page operands resolve. */
export interface Spc700DecodeState {
    /** Direct-page base selected by PSW.P: normally `$0000`, `$0100`, or unknown. */
    readonly directPage?: number | "unknown";
}
/** Fixed-width, bounds-safe decoder for every SPC700 opcode. */
export declare class Spc700Decoder implements ArchitectureDecoder<Spc700DecodeState> {
    decode(context: ArchitectureDecodeContext<Spc700DecodeState>): ArchitectureDecodeResult;
}
/**
 * Formats one decoded instruction in this project's native SPC700 syntax.
 * @param {DecodedInstruction} instruction Decoded SPC700 instruction.
 * @returns {string} Canonical native source text.
 */
export declare function formatSpc700Instruction(instruction: DecodedInstruction): string;
//# sourceMappingURL=spc700-decoder.d.ts.map