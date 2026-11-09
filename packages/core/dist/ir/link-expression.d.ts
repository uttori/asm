import type { BinaryOperator, ExpressionNode, ReferenceExpressionNode } from "./expression-node.js";
/** Link-time integer syntax. It contains no source templates, session objects, or effectful calls. */
export type LinkExpression = {
    readonly kind: "constant";
    readonly value: number;
} | {
    readonly kind: "symbol";
    readonly name: string;
    readonly module?: string;
} | {
    readonly kind: "section";
    readonly module: string;
    readonly section: string;
    readonly offset: number;
} | {
    readonly kind: "unary";
    readonly operator: "-" | "~" | "low" | "high" | "bank";
    readonly argument: LinkExpression;
} | {
    readonly kind: "binary";
    readonly operator: BinaryOperator;
    readonly left: LinkExpression;
    readonly right: LinkExpression;
};
/** Assembly-owned name/template binding; only literal evaluation may borrow the numeric evaluator. */
export interface LinkExpressionContext {
    /** Lowers a symbol, member, index or relative reference to a link-time term. */
    reference(expression: ReferenceExpressionNode): LinkExpression;
    /** Term for the current location, used by `*` and `pc()`. */
    current(): LinkExpression;
    /** Evaluates a literal or string leaf to its numeric value. */
    literal(expression: ExpressionNode): number;
    /** Substitutes a define or template node; returning undefined or the same node rejects it as unbound. */
    bind?(expression: ExpressionNode): ExpressionNode;
    /** Expand pure source functions or resolve assembly-owned metadata; unknown/effectful calls stay rejected. */
    call?(expression: Extract<ExpressionNode, {
        type: "call";
    }>, compile: (node: ExpressionNode) => LinkExpression): LinkExpression | undefined;
}
/** Link arithmetic uses safe integers and truncating division; overflow is always an error. */
export declare function linkInteger(value: number): number;
/** Create an owned scalar, rejecting fractional/non-finite values at the assembly boundary. */
export declare function linkConstant(value: number): LinkExpression;
/** Fold only placement-independent operations; addresses remain symbolic until the linker assigns them. */
export declare function linkBinary(operator: BinaryOperator, left: LinkExpression, right: LinkExpression): LinkExpression;
/** Extraction is explicit, so masking a bank byte cannot be confused with a checked near address. */
export declare function linkUnary(operator: "-" | "~" | "low" | "high" | "bank", argument: LinkExpression): LinkExpression;
/** Lower expanded assembly syntax into a pure, portable expression without looking up provisional addresses. */
export declare function compileLinkExpression(expression: ExpressionNode, context: LinkExpressionContext, depth?: number): LinkExpression;
/** Reject size/preprocessing dependencies instead of substituting a provisional zero for an address. */
export declare function requireLinkConstant(expression: LinkExpression, purpose: string): number;
//# sourceMappingURL=link-expression.d.ts.map