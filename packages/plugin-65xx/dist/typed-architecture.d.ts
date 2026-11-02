import type { InstructionResolutionFrame, TypedArchitectureEncoder, TypedEncoderContext } from "@uttori/asm-core";
import { type CpuDefinition, type InstructionForm } from "./instructions/schema.js";
/** All shipped 65xx forms use this selector for both layout and emission. */
export declare class TypedArch65xx implements TypedArchitectureEncoder {
    readonly cpu: CpuDefinition;
    readonly supportsRelocatable = true;
    readonly deferOperandBindingErrors = true;
    readonly forms: readonly InstructionForm[];
    readonly catalog: import("@uttori/asm-core").InstructionDescriptor[];
    readonly formsByMnemonic: Map<string, readonly InstructionForm[]>;
    constructor(cpu: CpuDefinition);
    /** Failed binding retains parsed punctuation so addressing errors keep precedence over value reads. */
    private syntax;
    /** Record classification effects before form selection; this receipt does not yet carry a size. */
    prepare(frame: InstructionResolutionFrame): void;
    /** Reuse this occurrence's preparation without repeating its width probes during encoding. */
    private classification;
    estimate(frame: InstructionResolutionFrame): number;
    private resolveForm;
    /** Validate the complete operand tuple before the first opcode/prefix write. */
    encode(frame: InstructionResolutionFrame, context: TypedEncoderContext): boolean;
    /** Form tables supply every field's width/order, including vendor and prefixed instructions. */
    private encodeModule;
    /** Validate before writing, retaining a classification value only when its evaluation schedule requires it. */
    private readValue;
    /** Relative streams select against the same reference cursor used by the wrapping subtraction. */
    private readBranch;
}
//# sourceMappingURL=typed-architecture.d.ts.map