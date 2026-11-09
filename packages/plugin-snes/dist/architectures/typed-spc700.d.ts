import { type InstructionResolutionFrame, type TypedArchitectureEncoder, type TypedEncoderContext } from "@uttori/asm-core";
/** All SPC forms execute structural operands; opcode writes retain each family's established ordering. */
export declare class TypedSpc700 implements TypedArchitectureEncoder {
    /** Relocatable object emission covers the full opcode matrix. */
    readonly supportsRelocatable = true;
    /** Operand binding failures surface at the final read, not during width collection. */
    readonly deferOperandBindingErrors = true;
    /** Preserve per-slot observations before the whole-fragment width probe. */
    prepare(frame: InstructionResolutionFrame): void;
    /**
     * Returns the byte size chosen for the current instruction form.
     * @param frame Active resolution frame for the occurrence.
     * @returns Encoded instruction length in bytes.
     */
    estimate(frame: InstructionResolutionFrame): number;
    /**
     * Emits opcode bytes when `context` is supplied; otherwise sizes only.
     * @param frame Active resolution frame for the occurrence.
     * @param context Emission sink and diagnostics for the emit pass.
     * @returns True when a recognized form produced bytes.
     */
    encode(frame: InstructionResolutionFrame, context: TypedEncoderContext): boolean;
    private run;
    /** Matrix-driven object emission covers all hardware forms without interpreting provisional values. */
    private runModule;
}
//# sourceMappingURL=typed-spc700.d.ts.map