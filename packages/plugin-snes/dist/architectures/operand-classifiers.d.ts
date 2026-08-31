import type { LoweredOperand, OperandResolutionContext } from "@uttori/asm-core";
/**
 * Operand facts after core expansion. `length` is the inferred byte width
 * (1/2/3) before architecture-specific width policy.
 */
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
 * Classifies 65816 operands (expand, then {@link apply65816WidthPolicy}).
 * @param {OperandResolutionContext} resolver Operand resolver dependency.
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
 * Classifies SPC700 operands. No 65816 bank-shortening; hex spelling owns width.
 * @param {OperandResolutionContext} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export declare function classifySpc700Operand(resolver: OperandResolutionContext, operand: string): LoweredOperand;
/**
 * Classifies Super FX operands (register / `#imm` / `(Rn)` / RAM forms).
 * @param {OperandResolutionContext} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Lowered operand metadata.
 */
export declare function classifySuperFxOperand(resolver: OperandResolutionContext, operand: string): LoweredOperand;
//# sourceMappingURL=operand-classifiers.d.ts.map