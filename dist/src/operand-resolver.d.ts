import type { ExpandedOperand } from "./architecture-types.js";
import type { ExpressionNode } from "./ir/expression-node.js";
export type OperandResolverDependencies = {
    resolveDefines(input: string): string;
    resolveStructLabel(input: string): number;
    resolveLabel(input: string, requireStatic: boolean): number;
    hasLabel(input: string): boolean;
    evaluateMath(input: string | ExpressionNode): number;
    getPass(): number;
    requireStaticLabelLookup(): boolean;
};
export declare class OperandResolver {
    private readonly deps;
    constructor(deps: OperandResolverDependencies);
    determineValueLength(value: string | number, forceTwoBytes?: boolean): number;
    isMathExpression(expression: string): boolean;
    tryResolveLabelInOperand(operand: string): string;
    getnum(operand: string | ExpressionNode): number;
    private getnumFromNode;
    private resolveReferenceValue;
    private renderReference;
    expandOperand(operand: string): ExpandedOperand;
}
//# sourceMappingURL=operand-resolver.d.ts.map