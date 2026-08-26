import { type SourceSpan } from "../source-location.js";
type ExpressionNodeBase = {
    span?: SourceSpan;
};
export type ExpressionNode = IdentifierExpressionNode | LiteralExpressionNode | StringExpressionNode | DefineReferenceExpressionNode | MemberExpressionNode | IndexExpressionNode | CallExpressionNode | UnaryExpressionNode | BinaryExpressionNode | RangeExpressionNode | RawExpressionNode;
export type IdentifierExpressionNode = ExpressionNodeBase & {
    type: "identifier";
    name: string;
};
export type LiteralExpressionNode = ExpressionNodeBase & {
    type: "literal";
    value: string;
};
export type StringExpressionNode = ExpressionNodeBase & {
    type: "string";
    value: string;
    quote: '"' | "'";
};
export type DefineReferenceExpressionNode = ExpressionNodeBase & {
    type: "defineReference";
    name?: string;
    content?: string;
    braced: boolean;
};
export type ReferenceExpressionNode = IdentifierExpressionNode | DefineReferenceExpressionNode | MemberExpressionNode | IndexExpressionNode;
export type MemberExpressionNode = ExpressionNodeBase & {
    type: "member";
    object: ReferenceExpressionNode;
    property: IdentifierExpressionNode;
};
export type IndexExpressionNode = ExpressionNodeBase & {
    type: "index";
    object: ReferenceExpressionNode;
    index: ExpressionNode;
};
export type CallExpressionNode = ExpressionNodeBase & {
    type: "call";
    callee: IdentifierExpressionNode;
    arguments: ExpressionNode[];
};
export type UnaryOperator = "<:" | "<" | ">" | "^" | "~" | "-" | "+";
export type UnaryExpressionNode = ExpressionNodeBase & {
    type: "unary";
    operator: UnaryOperator;
    argument: ExpressionNode;
};
export type BinaryOperator = "**" | "*" | "/" | "%" | "+" | "-" | "<<" | ">>" | "&" | "|" | "^" | "<" | ">" | "<=" | ">=" | "==" | "=" | "!=" | "&&" | "||";
export type BinaryExpressionNode = ExpressionNodeBase & {
    type: "binary";
    operator: BinaryOperator;
    left: ExpressionNode;
    right: ExpressionNode;
};
export type RangeExpressionNode = ExpressionNodeBase & {
    type: "range";
    start: ExpressionNode;
    end: ExpressionNode;
};
export type RawExpressionNode = ExpressionNodeBase & {
    type: "raw";
    value: string;
};
/**
 * Parses a minimal expression node used by the early IR/tree stages.
 * @param {string} input The expression source text.
 * @returns {ExpressionNode} The parsed expression node.
 */
export declare function parseExpressionNode(input: string): ExpressionNode;
/**
 * Renders an expression node back into a source-like string.
 * @param {ExpressionNode} node The expression node to render.
 * @returns {string} The rendered expression text.
 */
export declare function renderExpressionNode(node: ExpressionNode): string;
/**
 * Checks whether an expression belongs to the reference-expression subtree.
 * @param {ExpressionNode} node The expression node to inspect.
 * @returns {boolean} `true` when the node is a reference expression.
 */
export declare function isReferenceExpressionNode(node: ExpressionNode): node is ReferenceExpressionNode;
type RenderReferenceExpressionOptions = {
    renderIndex?: (node: ExpressionNode) => string;
};
/**
 * Renders a reference-expression subtree back into a source-like string.
 * @param {ReferenceExpressionNode} node The reference node to render.
 * @param {RenderReferenceExpressionOptions} [options] Optional rendering overrides.
 * @returns {string} The rendered reference text.
 */
export declare function renderReferenceExpressionNode(node: ReferenceExpressionNode, options?: RenderReferenceExpressionOptions): string;
/**
 * Parses a leading reference-expression prefix from a larger source string.
 * @param {string} input The source text to scan.
 * @returns {{ node: ReferenceExpressionNode; length: number } | undefined} The parsed node and consumed length.
 */
export declare function parseLeadingReferenceExpression(input: string): {
    node: ReferenceExpressionNode;
    length: number;
} | undefined;
export {};
//# sourceMappingURL=expression-node.d.ts.map