import type { InstructionResolutionFrame, TypedArchitectureEncoder, TypedEncoderContext } from "@uttori/asm-core";
/** Native GSU instruction selection. Values are invocation-local and never stored on syntax nodes. */
export declare class TypedSuperFx implements TypedArchitectureEncoder {
    readonly asarMoveShortAddress: () => boolean;
    /** Relocatable object emission covers automatic MOVE and branch forms. */
    readonly supportsRelocatable = true;
    /** Operand binding failures surface at the final read, not during width collection. */
    readonly deferOperandBindingErrors = true;
    /**
     * Creates a Super FX encoder with optional Asar short-RAM MOVE dialect.
     * @param asarMoveShortAddress When true, auto-MOVE stores the raw RAM byte instead of `addr >> 1`.
     */
    constructor(asarMoveShortAddress?: () => boolean);
    /**
     * Records per-part width observations before whole-operand classification.
     * @param frame Active resolution frame for the occurrence.
     */
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
    /** The same ordered form selection drives sizing and emission; speculative reads occur only for auto forms. */
    private run;
    /** Registers are fixed opcode fields; relocatable automatic MOVE forms consistently use long operands. */
    private runModule;
}
//# sourceMappingURL=typed-superfx.d.ts.map