import type { ArchitectureDecodeContext, ArchitectureDecodeResult, ArchitectureDecoder, DecodedInstruction } from "@uttori/asm-core";
import { type SuperFxAltState } from "./superfx-spec.js";
/** Decode-time GSU selector state. Unknown fields produce explicit ambiguity. */
export interface SuperFxDecodeState {
    /** Current GSU ALT selector, or unknown when disassembly cannot prove it. */
    readonly alt?: SuperFxAltState | "unknown";
    /** TO/WITH-selected destination register, if tracked. */
    readonly destinationRegister?: number | "unknown";
    /** FROM/WITH-selected source register, if tracked. */
    readonly sourceRegister?: number | "unknown";
    /** Program bank assumed when resolving R15 jump targets. */
    readonly programBank?: number | "unknown";
}
/** Bounds-safe SuperFX decoder with canonical ALT-prefix fusion. */
export declare class SuperFxDecoder implements ArchitectureDecoder<SuperFxDecodeState> {
    /**
     * Decodes one GSU instruction, fusing ALT prefixes and macro selector sequences when present.
     * @param context Byte source, offset, and optional GSU decode state.
     * @returns A decoded instruction or a bounds/state error.
     */
    decode(context: ArchitectureDecodeContext<SuperFxDecodeState>): ArchitectureDecodeResult;
}
/**
 * Formats one decoded instruction in the project's native SuperFX syntax.
 * @param instruction Instruction to format.
 * @returns Native SuperFX source text.
 */
export declare function formatSuperFxInstruction(instruction: DecodedInstruction): string;
//# sourceMappingURL=superfx-decoder.d.ts.map