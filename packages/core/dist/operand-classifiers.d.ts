import type { LoweredOperand } from "./architecture-types.js";
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
//# sourceMappingURL=operand-classifiers.d.ts.map