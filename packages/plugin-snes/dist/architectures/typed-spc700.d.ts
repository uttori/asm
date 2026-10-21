import { type InstructionResolutionFrame, type TypedArchitectureEncoder, type TypedEncoderContext } from "@uttori/asm-core";
/** All SPC forms execute structural operands; opcode writes retain each family's established ordering. */
export declare class TypedSpc700 implements TypedArchitectureEncoder {
    readonly deferOperandBindingErrors = true;
    /** Preserve per-slot observations before the whole-fragment width probe. */
    prepare(frame: InstructionResolutionFrame): void;
    estimate(frame: InstructionResolutionFrame): number;
    encode(frame: InstructionResolutionFrame, context: TypedEncoderContext): boolean;
    private run;
}
//# sourceMappingURL=typed-spc700.d.ts.map