import type { ArchitectureEncoder, ArchitectureEncoderContext, InstructionDescriptor, LoweredInstruction } from "@uttori/asm-core";
import { type CpuDefinition, type InstructionForm } from "./instructions/schema.js";
/**
 * Concatenates opcode/prefix bytes with already-encoded operand bytes.
 * Used by tests and tooling. The live encoder writes through `emission` instead.
 * @param {InstructionForm} form The instruction form.
 * @param {readonly number[]} operandBytes The operand bytes.
 * @returns {Uint8Array} The materialized opcode form.
 */
export declare function materializeOpcodeForm(form: InstructionForm, operandBytes?: readonly number[]): Uint8Array;
/**
 * Table-driven encoder for one {@link CpuDefinition}. Unknown mnemonics that
 * exist only on another CPU get a targeted diagnostic. Truly unknown ops
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
    /**
     * Estimates the size of a resolved instruction.
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {number} The estimated size in bytes.
     */
    estimateInstruction(instruction: LoweredInstruction): number;
    /**
     * Encodes a resolved instruction.
     * @param {LoweredInstruction} instruction The instruction.
     * @returns {boolean} True if encoded.
     */
    encodeInstruction(instruction: LoweredInstruction): boolean;
    /**
     * Estimates the size of a resolved instruction.
     * @param {string} rawMnemonic The raw mnemonic.
     * @param {LoweredOperand} operand The operand.
     * @returns {number} The estimated size in bytes.
     */
    private estimateResolved;
    /**
     * Encodes a resolved instruction.
     * @param {string} rawMnemonic The raw mnemonic.
     * @param {LoweredOperand} operand The operand.
     * @returns {boolean} True if encoded.
     */
    private encodeResolved;
    /**
     * Reads compound values from operands.
     * @param {InstructionForm} form The instruction form.
     * @param {readonly string[]} operands The operands.
     * @returns {readonly number[]} The compound values.
     */
    private readCompoundValues;
    /**
     * Resolves a form for a mnemonic and operand.
     * @param {string} rawMnemonic The raw mnemonic.
     * @param {LoweredOperand} operand The operand.
     * @returns {InstructionForm | undefined} The resolved form.
     */
    private resolveForm;
    /**
     * Reads an expression value.
     * @param {string} expression The expression.
     * @param {1 | 2 | 3} width The width.
     * @param {string} description The description.
     * @param {boolean} immediate Whether the expression is immediate.
     * @returns {number} The value.
     */
    private readExpressionValue;
    /**
     * Reads a branch delta.
     * @param {LoweredOperand} operand The operand.
     * @param {number} relativeBaseOffset The relative base offset.
     * @param {1 | 2} width The width.
     * @returns {number} The branch delta.
     */
    private readBranchDelta;
    /**
     * Reads a branch expression.
     * @param {string} expression The expression.
     * @param {number} relativeBaseOffset The relative base offset.
     * @param {1 | 2} width The width.
     * @returns {number} The branch expression.
     */
    private readBranchExpression;
}
//# sourceMappingURL=architecture.d.ts.map