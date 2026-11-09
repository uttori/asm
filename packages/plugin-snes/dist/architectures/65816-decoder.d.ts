import type { ArchitectureDecodeContext, ArchitectureDecodeResult, ArchitectureDecoder, DecodedInstruction } from "@uttori/asm-core";
/** Width or emulation flag value observed during linear disassembly. */
export type Cpu65816FlagState = 0 | 1 | boolean | "unknown";
/**
 * The state of the 65816 decoder.
 */
export interface Cpu65816DecodeState {
    /** Emulation flag. E=1 forces M=X=1. */
    readonly e?: Cpu65816FlagState;
    /** Accumulator width flag: 1 = 8-bit, 0 = 16-bit. */
    readonly m?: Cpu65816FlagState;
    /** Index width flag: 1 = 8-bit, 0 = 16-bit. */
    readonly x?: Cpu65816FlagState;
    /** Program bank (bits 16–23) of the instruction address being decoded. */
    readonly programBank?: number;
    /** Data bank register assumed for absolute long reads and writes. */
    readonly dataBank?: number;
    /** Direct page base used when formatting DP-relative operands. */
    readonly directPage?: number;
}
/**
 * The 65816 decoder.
 */
export declare class Cpu65816Decoder implements ArchitectureDecoder<Cpu65816DecodeState> {
    /**
     * Decodes a 65816 instruction.
     * @param context The decode context.
     * @returns The decode result.
     */
    decode(context: ArchitectureDecodeContext<Cpu65816DecodeState>): ArchitectureDecodeResult;
}
/**
 * Formats one decoded instruction in this project's native source syntax.
 * @param instruction The decoded 65816 instruction.
 * @returns Canonical native source text.
 */
export declare function formatCpu65816Instruction(instruction: DecodedInstruction): string;
//# sourceMappingURL=65816-decoder.d.ts.map