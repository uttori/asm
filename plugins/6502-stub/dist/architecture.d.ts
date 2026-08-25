import type { ArchitectureEncoder, ArchitectureEncoderContext, InstructionDescriptor, LoweredInstruction } from "@uttori/asm-core";
/**
 * Deliberately non-functional architecture placeholder. It exercises target
 * and architecture composition without claiming 6502 instruction support.
 */
export declare class Arch6502 implements ArchitectureEncoder {
    readonly context: ArchitectureEncoderContext;
    constructor(context: ArchitectureEncoderContext);
    getInstructionCatalog(): InstructionDescriptor[];
    estimateSize(_words: readonly string[]): number;
    encode(_words: readonly string[]): boolean;
    estimateInstruction(_instruction: LoweredInstruction): number;
    encodeInstruction(_instruction: LoweredInstruction): boolean;
}
//# sourceMappingURL=architecture.d.ts.map