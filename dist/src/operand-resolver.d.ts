import type { ExpandedOperand, LoweredOperand } from "./architecture-types.js";
import type { ExpressionNode, ReferenceExpressionNode } from "./ir/expression-node.js";
export type OperandResolverDependencies = {
    resolveDefines(input: string): string;
    resolveStructLabel(input: string): number;
    resolveLabel(input: string, requireStatic: boolean): number;
    hasLabel(input: string): boolean;
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
    isSameBankAddress(expanded: string): boolean;
    resolveArithmeticToken(token: string): number;
    tryResolveSimpleArithmetic(operand: string): number | null;
    determineValueLength(value: string | number, forceTwoBytes?: boolean): number;
    isMathExpression(expression: string): boolean;
    tryResolveLabelInOperand(operand: string): string;
    getnum(operand: string | ExpressionNode): number;
    getnumFromNode(operand: ExpressionNode): number;
    resolveReferenceValue(reference: string): number;
    renderReference(expression: ReferenceExpressionNode): string;
    expandOperand(operand: string): ExpandedOperand;
    lowerOperand(operand: string): LoweredOperand;
}
//# sourceMappingURL=operand-resolver.d.ts.map