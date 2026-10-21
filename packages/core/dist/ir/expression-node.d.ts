import { type SourceSpan } from "../source-location.js";
import { type DefineTemplate } from "./define-template.js";
import { type ExpressionParseOutcome, type ExpressionParseSite } from "./expression-parse-state.js";
type ExpressionNodeBase = {
    span?: SourceSpan;
    /** Explicit grouping is a rounding boundary even when the group has one literal. */
    parenthesized?: boolean;
};
export type ExpressionNode = IdentifierExpressionNode | LiteralExpressionNode | StringExpressionNode | DefineReferenceExpressionNode | MemberExpressionNode | IndexExpressionNode | CallExpressionNode | UnaryExpressionNode | BinaryExpressionNode | RangeExpressionNode | RelativeReferenceExpressionNode | SourceTextExpressionNode | TemplateExpressionNode | ErrorExpressionNode | RawExpressionNode;
export type IdentifierExpressionNode = ExpressionNodeBase & {
    type: "identifier";
    name: string;
};
export type LiteralExpressionNode = ExpressionNodeBase & {
    type: "literal";
    value: string;
    /** Parsed numeric value; lexical spelling remains authoritative for width intent. */
    numericValue?: number;
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
export type ReferenceExpressionNode = IdentifierExpressionNode | RelativeReferenceExpressionNode | DefineReferenceExpressionNode | MemberExpressionNode | IndexExpressionNode;
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
/** Relative references retain direction, depth and stream instead of a lookup string. */
export type RelativeReferenceExpressionNode = ExpressionNodeBase & {
    type: "relativeReference";
    direction: 1 | -1;
    count: number;
    stream: "relative" | "unnamed" | "macro";
    text: string;
};
/** A function's source-valued slot; its text is data and must never be evaluated as a label. */
export type SourceTextExpressionNode = ExpressionNodeBase & {
    type: "sourceText";
    text: string;
    value: string;
};
/** Unbound macro syntax is valid input whose activation belongs to ordered expansion. */
export type TemplateExpressionNode = ExpressionNodeBase & {
    type: "template";
    form: "parameter" | "variadic" | "source";
    /** Ordered define sites for a fragment whose substitution can create expression grammar. */
    defines?: DefineTemplate;
    text: string;
    name?: string;
    index?: ExpressionNode;
};
/** A portable parser diagnostic, reported only when this occurrence is selected for evaluation. */
export type ErrorExpressionNode = ExpressionNodeBase & {
    type: "error";
    value: string;
    outcome: Exclude<ExpressionParseOutcome, {
        kind: "native";
    }>;
    message: string;
    code?: "MATH_INVALID_INPUT" | "MATH_MISMATCHED_PARENTHESES";
};
export type RawExpressionNode = ExpressionNodeBase & {
    type: "raw";
    value: string;
};
/**
 * Parses portable expression syntax without resolving values or activating diagnostics.
 * @param {string} input The expression source text.
 * @returns {ExpressionNode} The parsed expression node.
 */
export declare function parseExpressionNode(input: string, source?: ExpressionSource): ExpressionNode;
/** Internal adapter retains the public node-only API while labeling the real parser caller. */
export declare function parseExpressionAtSite(input: string, site: ExpressionParseSite, source?: ExpressionSource): ExpressionNode;
/** Internal outcome separates grammar coverage from legacy acceptance and evaluation errors. */
export type ExpressionParseResult = {
    node: ExpressionNode;
    outcome: ExpressionParseOutcome;
};
/**
 * Parse with bounded coverage evidence. Each entry counts once, including recursive
 * immediate/range slices and compatibility probes; cache misses are a separate metric. Malformed
 * and unknown syntax retain diagnostic nodes; valid unbound fragments retain their template sites.
 */
export declare function parseExpressionResult(input: string, site?: ExpressionParseSite, source?: ExpressionSource): ExpressionParseResult;
/** Literal interpretation is shared by parsed and externally constructed syntax. */
export declare function parseLiteralValue(value: string): number;
/**
 * Renders an expression node back into a source-like string.
 * Parsed trees retain their explicit rounding boundaries. Constructed trees that
 * require new groups to express precedence must mark those rounding boundaries
 * themselves; keep transformed trees as nodes when evaluating rounded arithmetic.
 * @param {ExpressionNode} node The expression node to render.
 * @returns {string} The rendered expression text.
 */
export declare function renderExpressionNode(node: ExpressionNode): string;
/**
 * Copy replacement syntax into an occurrence without mutating either input. Only
 * the root inherits the physical occurrence span: replacement-relative child
 * offsets do not identify characters in the invoking source. Explicit groups
 * on either root remain rounding boundaries.
 */
export declare function inheritExpressionOccurrence(replacement: ExpressionNode, occurrence: ExpressionNode): ExpressionNode;
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
 * Renders a canonical lookup key. Root/object grouping is intentionally omitted
 * for symbol lookup; numeric index expressions keep their grouping. Use
 * renderExpressionNode when rendering a reference as a numeric expression.
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
/** Optional physical provenance for identifier references in a continued expression. */
export type ExpressionSource = {
    /** Original command, with physical newlines and indentation preserved. */
    text: string;
    /** UTF-16 offset where the input expression starts within text. */
    offset: number;
    /** Zero-based physical line where text starts. */
    line: number;
    /** Reused physical-line offsets for every value in one large record. */
    lineStarts?: number[];
};
export {};
//# sourceMappingURL=expression-node.d.ts.map