import type { ArchitectureEncoder, ArchitectureEncoderContext, InstructionDescriptor, LoweredInstruction } from "@uttori/asm-core";
import { type CpuDefinition, type InstructionForm } from "./instructions/schema.js";
/**
 * Concatenates opcode/prefix bytes with already-encoded operand bytes.
 * Used by tests and tooling; the live encoder writes through `emission` instead.
 * @param {InstructionForm} form The instruction form.
 * @param {readonly number[]} operandBytes The operand bytes.
 * @returns {Uint8Array} The materialized opcode form.
 */
export declare function materializeOpcodeForm(form: InstructionForm, operandBytes?: readonly number[]): Uint8Array;
/**
 * Table-driven encoder for one {@link CpuDefinition}. Unknown mnemonics that
 * exist only on another CPU get a targeted diagnostic; truly unknown ops
 * return false so the assembler can try the next architecture.
 */
export declare class Arch65xx implements ArchitectureEncoder {
    readonly context: ArchitectureEncoderContext;
    readonly cpu: CpuDefinition;
    readonly forms: readonly InstructionForm[];
    readonly catalog: InstructionDescriptor[];
    readonly formsByMnemonic: Map<string, readonly InstructionForm[]>;
    /**
     * @param {ArchitectureEncoderContext} context Encoder host (operands, emission, diagnostics).
     * @param {CpuDefinition} cpu CPU whose feature set filters {@link getCpuAssemblyForms}.
     */
    constructor(context: ArchitectureEncoderContext, cpu: CpuDefinition);
    getInstructionCatalog(): InstructionDescriptor[];
    /**
     * Estimates size from tokenized words.
     * @param {readonly string[]} words Mnemonic plus rest-of-line operand.
     * @returns {number} Encoded size in bytes, or 0 if unknown.
     */
    estimateSize(words: readonly string[]): number;
    /**
     * Encodes tokenized words. Returns false when the mnemonic is unknown on this CPU.
     * @param {readonly string[]} words Mnemonic plus rest-of-line operand.
     * @returns {boolean} True if encoded.
     */
    encode(words: readonly string[]): boolean;
    estimateInstruction(instruction: LoweredInstruction): number;
    encodeInstruction(instruction: LoweredInstruction): boolean;
    private estimateResolved;
    private encodeResolved;
    private readCompoundValues;
    private resolveForm;
    private readValue;
    private readExpressionValue;
    private readBranchDelta;
    private readBranchExpression;
}
//# sourceMappingURL=architecture.d.ts.map