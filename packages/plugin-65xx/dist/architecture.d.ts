import { type ArchitectureEncoderContext, type InstructionDescriptor } from "@uttori/asm-core";
import type { CpuDefinition, InstructionForm } from "./instructions/schema.js";
/**
 * Compatibility entry point for callers supplying word arrays.
 * Registered architectures use TypedArch65xx directly; this facade parses at its public
 * boundary and delegates every form selection and byte write to that same implementation.
 */
export declare class Arch65xx {
    readonly context: ArchitectureEncoderContext;
    readonly cpu: CpuDefinition;
    private readonly encoder;
    readonly forms: readonly InstructionForm[];
    readonly catalog: InstructionDescriptor[];
    readonly formsByMnemonic: Map<string, readonly InstructionForm[]>;
    constructor(context: ArchitectureEncoderContext, cpu: CpuDefinition);
    getInstructionCatalog(): InstructionDescriptor[];
    estimateSize(words: readonly string[]): number;
    encode(words: readonly string[]): boolean;
    private run;
}
/**
 * Concatenates opcode/prefix bytes with already-encoded operand bytes.
 * Used by tests and tooling. The live encoder writes through `emission` instead.
 * @param {InstructionForm} form The instruction form.
 * @param {readonly number[]} operandBytes The operand bytes.
 * @returns {Uint8Array} The materialized opcode form.
 */
export declare function materializeOpcodeForm(form: InstructionForm, operandBytes?: readonly number[]): Uint8Array;
//# sourceMappingURL=architecture.d.ts.map