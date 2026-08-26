import type { LoweredOperand, OperandResolutionContext } from "@uttori/asm-core";
export type ClassificationInput = {
    raw: string;
    expanded: string;
    length: number;
};
/**
 * Generic 65xx-style operand classifier.
 * This classifies syntax/addressing mode and keeps expression expansion in
 * OperandResolver.
 * @param {ClassificationInput} input Classifier input values.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export declare function classifyGenericOperand(input: ClassificationInput): LoweredOperand;
/**
 * Classifies 65816 operands.
 * @param {OperandResolver} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export declare function classify65816Operand(resolver: OperandResolutionContext, operand: string): LoweredOperand;
/**
 * Applies 65816 policy to operand facts that core has already expanded.
 * @param {OperandResolutionContext} resolver Operand resolver dependency.
 * @param {ClassificationInput} input Expanded operand facts.
 * @returns {LoweredOperand} Classified 65816 operand.
 */
export declare function classifyExpanded65816Operand(resolver: OperandResolutionContext, input: ClassificationInput): LoweredOperand;
/**
 * Classifies SPC700 operands.
 * @param {OperandResolver} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export declare function classifySpc700Operand(resolver: OperandResolutionContext, operand: string): LoweredOperand;
/**
 * Classifies SuperFX operands.
 * @param {OperandResolver} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export declare function classifySuperFxOperand(resolver: OperandResolutionContext, operand: string): LoweredOperand;
//# sourceMappingURL=operand-classifiers.d.ts.map