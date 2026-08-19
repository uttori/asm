import type { ExpandedOperand, LoweredOperand } from "./architecture-types.js";
import type { ExpressionNode } from "./ir/expression-node.js";
export type OperandResolverDependencies = {
    resolveDefines(input: string): string;
    isStructReference(input: string): boolean;
    resolveStructLabel(input: string): number;
    tryResolveLabel(input: string, requireStatic: boolean): number | undefined;
    resolveLabel(input: string, requireStatic: boolean): number;
    evaluateMath(input: string | ExpressionNode): number;
    shouldDeferExpressionEvaluation(): boolean;
    getCurrentAddress(): number;
    requireStaticLabelLookup(): boolean;
};
export declare class OperandResolver {
    readonly deps: OperandResolverDependencies;
    constructor(deps: OperandResolverDependencies);
    /**
     * Normalizes numeric base member.
     * @param {string} operand The operand.
     * @returns {string} The result.
     */
    normalizeNumericBaseMember(operand: string): string;
    /**
     * Splits math operand suffix.
     * @param {string} operand The operand.
     * @returns {{ expression: string; suffix: string }} The result.
     */
    splitMathOperandSuffix(operand: string): {
        expression: string;
        suffix: string;
    };
    /**
     * Checks whether numeric token.
     * @param {string} token The token.
     * @returns {boolean} The result.
     */
    isNumericToken(token: string): boolean;
    /**
     * Checks whether same bank address.
     * @param {string} expanded The expanded.
     * @returns {boolean} The result.
     */
    isSameBankAddress(expanded: string): boolean;
    /**
     * Resolves arithmetic token.
     * @param {string} token The token.
     * @returns {number} The result.
     */
    resolveArithmeticToken(token: string): number;
    /**
     * Attempts to resolve simple arithmetic.
     * @param {string} operand The operand.
     * @returns {number | null} The result.
     */
    tryResolveSimpleArithmetic(operand: string): number | null;
    /**
     * Determines value length.
     * @param {string | number} value The value.
     * @param {boolean} [forceTwoBytes] The force two bytes.
     * @returns {number} The result.
     */
    determineValueLength(value: string | number, forceTwoBytes?: boolean): number;
    /**
     * Checks whether math expression.
     * @param {string} expression The expression.
     * @returns {boolean} The result.
     */
    isMathExpression(expression: string): boolean;
    /**
     * Attempts to resolve label in operand.
     * @param {string} operand The operand.
     * @returns {string} The result.
     */
    tryResolveLabelInOperand(operand: string): string;
    /**
     * Gets num.
     * @param {string | ExpressionNode} operand The operand.
     * @returns {number} The result.
     */
    getnum(operand: string | ExpressionNode): number;
    /**
     * Gets num from node.
     * @param {ExpressionNode} operand The operand.
     * @returns {number} The result.
     */
    getnumFromNode(operand: ExpressionNode): number;
    /**
     * Resolves reference value.
     * @param {string} reference The reference.
     * @returns {number} The result.
     */
    resolveReferenceValue(reference: string): number;
    /**
     * Expands operand.
     * @param {string} operand The operand.
     * @returns {ExpandedOperand} The result.
     */
    expandOperand(operand: string): ExpandedOperand;
    /**
     * Lowers operand.
     * @param {string} operand The operand.
     * @returns {LoweredOperand} The result.
     */
    lowerOperand(operand: string): LoweredOperand;
}
//# sourceMappingURL=operand-resolver.d.ts.map