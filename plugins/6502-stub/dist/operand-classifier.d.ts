import type { LoweredOperand, OperandResolutionContext } from "@uttori/asm-core";
/**
 * Classifies baseline 6502 syntax without inheriting 65816, SPC700, Super FX,
 * direct-page, stack-relative, or bank-width policy.
 * @param {OperandResolutionContext} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Classified 6502 operand.
 */
export declare function classify6502Operand(resolver: OperandResolutionContext, operand: string): LoweredOperand;
//# sourceMappingURL=operand-classifier.d.ts.map