import type { LoweredOperand, OperandResolutionContext } from "@uttori/asm-core";
/**
 * Classifies baseline 6502 syntax without importing SNES addressing policy.
 * @param {OperandResolutionContext} resolver Operand resolver dependency.
 * @param {string} operand Raw operand text.
 * @returns {LoweredOperand} Architecture-owned operand classification.
 */
export declare function classify65xxOperand(resolver: OperandResolutionContext, operand: string): LoweredOperand;
//# sourceMappingURL=classifier.d.ts.map