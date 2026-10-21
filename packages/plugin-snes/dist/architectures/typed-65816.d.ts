import { type InstructionResolutionFrame, type TypedArchitectureEncoder, type TypedEncoderContext } from "@uttori/asm-core";
/** 65816 flags belong to this encoder instance and reset once per assembly pass. */
export declare class Typed65816 implements TypedArchitectureEncoder {
    readonly optimizeDirectPage: () => boolean;
    readonly deferOperandBindingErrors = true;
    /** True selects 16-bit expression immediates; lexical widths can override this hint. */
    m16: boolean;
    /** X/Y immediate-width hint, independent of the accumulator. */
    x16: boolean;
    /** SEP/REP update hints only while smart tracking is enabled. */
    smartMode: boolean;
    constructor(optimizeDirectPage?: () => boolean);
    beginPass(): void;
    setAccumulatorWidth(value: boolean): void;
    setIndexWidth(value: boolean): void;
    setSmartMode(value: boolean): void;
    prepare(frame: InstructionResolutionFrame): void;
    estimate(frame: InstructionResolutionFrame): number;
    encode(frame: InstructionResolutionFrame, context: TypedEncoderContext): boolean;
    /** Shared selection preserves the distinct numeric-read positions of each hardware family. */
    private run;
}
//# sourceMappingURL=typed-65816.d.ts.map