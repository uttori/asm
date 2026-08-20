import type { LoweredOperand, OperandResolutionContext } from "./architecture-types.js";
type ClassificationInput = {
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
 * Temporary 6502 syntax classifier. The stub backend does not encode yet, but
 * keeping classification behind its own registration avoids coupling the
 * eventual implementation to 65816 policy.
 * @param {OperandResolver} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export declare function classify6502Operand(resolver: OperandResolutionContext, operand: string): LoweredOperand;
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
export {};
//# sourceMappingURL=operand-classifiers.d.ts.map