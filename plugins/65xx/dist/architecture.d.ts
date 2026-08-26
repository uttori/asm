import type { ArchitectureEncoder, ArchitectureEncoderContext, InstructionDescriptor, LoweredInstruction } from "@uttori/asm-core";
import { type CpuDefinition, type InstructionForm } from "./instructions/schema.js";
export declare function materializeOpcodeForm(form: InstructionForm, operandBytes?: readonly number[]): Uint8Array;
export declare class Arch65xx implements ArchitectureEncoder {
    readonly context: ArchitectureEncoderContext;
    readonly cpu: CpuDefinition;
    readonly forms: readonly InstructionForm[];
    readonly catalog: InstructionDescriptor[];
    readonly formsByMnemonic: Map<string, readonly InstructionForm[]>;
    constructor(context: ArchitectureEncoderContext, cpu: CpuDefinition);
    getInstructionCatalog(): InstructionDescriptor[];
    estimateSize(words: readonly string[]): number;
    encode(words: readonly string[]): boolean;
    estimateInstruction(instruction: LoweredInstruction): number;
    encodeInstruction(instruction: LoweredInstruction): boolean;
    private estimateResolved;
    private encodeResolved;
    private resolveForm;
    private readValue;
    private readExpressionValue;
    private readBranchDelta;
    private readBranchExpression;
}
//# sourceMappingURL=architecture.d.ts.map