import { type InstructionResolutionFrame, type TypedArchitectureEncoder, type TypedEncoderContext } from "@uttori/asm-core";
/** 65816 flags belong to this encoder instance and reset once per assembly pass. */
export declare class Typed65816 implements TypedArchitectureEncoder {
    readonly optimizeDirectPage: () => boolean;
    /** Relocatable object emission covers the shared 65816 opcode matrix. */
    readonly supportsRelocatable = true;
    /** Operand binding failures surface at the final read, not during width collection. */
    readonly deferOperandBindingErrors = true;
    /** True selects 16-bit expression immediates; lexical widths can override this hint. */
    m16: boolean;
    /** X/Y immediate-width hint, independent of the accumulator. */
    x16: boolean;
    /** SEP/REP update hints only while smart tracking is enabled. */
    smartMode: boolean;
    /**
     * Creates a 65816 encoder with optional direct-page width optimization.
     * @param optimizeDirectPage When true, same-bank labels may encode as DP addresses.
     */
    constructor(optimizeDirectPage?: () => boolean);
    /** Clears M/X width hints at the start of each assembly pass. */
    beginPass(): void;
    /**
     * Sets the accumulator immediate-width hint used when expressions follow M flag state.
     * @param value True selects 16-bit accumulator immediates.
     */
    setAccumulatorWidth(value: boolean): void;
    /**
     * Sets the index immediate-width hint used when expressions follow X flag state.
     * @param value True selects 16-bit index immediates.
     */
    setIndexWidth(value: boolean): void;
    /**
     * Enables or disables REP/SEP smart tracking of M and X flag hints.
     * @param value When false, width hints ignore SEP/REP operands.
     */
    setSmartMode(value: boolean): void;
    /**
     * Stores the classified operand tuple for reuse during encoding.
     * @param frame Active resolution frame for the occurrence.
     */
    prepare(frame: InstructionResolutionFrame): void;
    /**
     * Returns the byte size chosen for the current instruction form.
     * @param frame Active resolution frame for the occurrence.
     * @returns Encoded instruction length in bytes, or `-1` when unrecognized.
     */
    estimate(frame: InstructionResolutionFrame): number;
    /**
     * Emits opcode bytes when `context` is supplied; otherwise sizes only.
     * @param frame Active resolution frame for the occurrence.
     * @param context Emission sink and diagnostics for the emit pass.
     * @returns True when a recognized form produced bytes.
     */
    encode(frame: InstructionResolutionFrame, context: TypedEncoderContext): boolean;
    /** Shared selection preserves the distinct numeric-read positions of each hardware family. */
    private run;
    /** Existing numeric selection remains shared with explicit Asar source adaptation. */
    private runAbsolute;
    /** Module forms are determined from syntax/state; final symbol addresses cannot shrink instructions. */
    private runModule;
}
//# sourceMappingURL=typed-65816.d.ts.map