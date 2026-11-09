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
    /** Every form the CPU can assemble, shared by reference with the typed encoder. */
    readonly forms: readonly InstructionForm[];
    /** Instruction descriptors exposed to tooling, shared with the typed encoder. */
    readonly catalog: InstructionDescriptor[];
    /** Assemblable forms grouped by uppercase mnemonic. */
    readonly formsByMnemonic: Map<string, readonly InstructionForm[]>;
    constructor(context: ArchitectureEncoderContext, cpu: CpuDefinition);
    /**
     * Returns the typed encoder's instruction catalog without copying it.
     * @returns The shared descriptor list.
     */
    getInstructionCatalog(): InstructionDescriptor[];
    /**
     * Estimates instruction size without emitting bytes.
     * @param words Mnemonic followed by operand words; the operand words are rejoined with spaces before parsing.
     * @returns Encoded size in bytes, or 0 for an empty line.
     */
    estimateSize(words: readonly string[]): number;
    /**
     * Encodes one instruction into the current emission.
     * @param words Mnemonic followed by operand words; the operand words are rejoined with spaces before parsing.
     * @returns True when the instruction was handled; an empty line is a successful no-op.
     */
    encode(words: readonly string[]): boolean;
    private run;
}
/**
 * Concatenates opcode/prefix bytes with already-encoded operand bytes.
 * Used by tests and tooling. The live encoder writes through `emission` instead.
 * @param form The instruction form.
 * @param operandBytes The operand bytes.
 * @returns The materialized opcode form.
 */
export declare function materializeOpcodeForm(form: InstructionForm, operandBytes?: readonly number[]): Uint8Array;
//# sourceMappingURL=architecture.d.ts.map