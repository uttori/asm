import type { InstructionResolutionFrame, TypedArchitectureEncoder, TypedEncoderContext } from "@uttori/asm-core";
/** Native GSU instruction selection. Values are invocation-local and never stored on syntax nodes. */
export declare class TypedSuperFx implements TypedArchitectureEncoder {
    readonly asarMoveShortAddress: () => boolean;
    readonly supportsRelocatable = true;
    readonly deferOperandBindingErrors = true;
    constructor(asarMoveShortAddress?: () => boolean);
    prepare(frame: InstructionResolutionFrame): void;
    estimate(frame: InstructionResolutionFrame): number;
    encode(frame: InstructionResolutionFrame, context: TypedEncoderContext): boolean;
    /** The same ordered form selection drives sizing and emission; speculative reads occur only for auto forms. */
    private run;
    /** Registers are fixed opcode fields; relocatable automatic MOVE forms consistently use long operands. */
    private runModule;
}
//# sourceMappingURL=typed-superfx.d.ts.map