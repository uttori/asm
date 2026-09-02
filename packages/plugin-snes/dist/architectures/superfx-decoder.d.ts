import type { ArchitectureDecodeContext, ArchitectureDecodeResult, ArchitectureDecoder, DecodedInstruction } from "@uttori/asm-core";
import { type SuperFxAltState } from "./superfx-spec.js";
/** Decode-time GSU selector state. Unknown fields produce explicit ambiguity. */
export interface SuperFxDecodeState {
    readonly alt?: SuperFxAltState | "unknown";
    readonly destinationRegister?: number | "unknown";
    readonly sourceRegister?: number | "unknown";
    readonly programBank?: number | "unknown";
}
/** Bounds-safe SuperFX decoder with canonical ALT-prefix fusion. */
export declare class SuperFxDecoder implements ArchitectureDecoder<SuperFxDecodeState> {
    decode(context: ArchitectureDecodeContext<SuperFxDecodeState>): ArchitectureDecodeResult;
}
/**
 * Formats one decoded instruction in the project's native SuperFX syntax.
 * @param {DecodedInstruction} instruction Instruction to format.
 * @returns {string} Native SuperFX source text.
 */
export declare function formatSuperFxInstruction(instruction: DecodedInstruction): string;
//# sourceMappingURL=superfx-decoder.d.ts.map