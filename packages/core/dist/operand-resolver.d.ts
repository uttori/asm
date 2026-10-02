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
    normalizeNumericBaseMember(operand: string): string;
    splitMathOperandSuffix(operand: string): {
        expression: string;
        suffix: string;
    };
    isNumericToken(token: string): boolean;
    resolveArithmeticToken(token: string): number;
    tryResolveSimpleArithmetic(operand: string): number | null;
    determineValueLength(value: unknown): number;
    isMathExpression(expression: unknown): boolean;
    tryResolveLabelInOperand(operand: string): string;
    /**
     * Resolve defines, labels, struct references, and arithmetic under the current assembly stage.
     * Deferred expression failures yield zero during sizing passes and throw during final emission.
     * @param {string | ExpressionNode} operand Source operand or parsed expression, including an optional immediate prefix.
     * @returns {number} Resolved value, or the deferred sizing placeholder.
     */
    getnum(operand: string | ExpressionNode): number;
    /**
     * Evaluate an already parsed operand with the same deferred-expression policy as getnum.
     * @param {ExpressionNode} operand Numeric expression. Range nodes are rejected.
     * @returns {number} Resolved value, or zero for a deferred expression failure.
     */
    getnumFromNode(operand: ExpressionNode): number;
    resolveReferenceValue(reference: string): number;
    expandOperand(operand: string): ExpandedOperand;
    lowerOperand(operand: string): LoweredOperand;
    /**
     * Returns the current logical address without applying architecture policy.
     * @returns {number} Current logical address.
     */
    getCurrentAddress(): number;
}
//# sourceMappingURL=operand-resolver.d.ts.map