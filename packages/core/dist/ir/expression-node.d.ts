import { type SourceSpan } from "../source-location.js";
import { type DefineTemplate } from "./define-template.js";
import { type ExpressionParseOutcome, type ExpressionParseSite } from "./expression-parse-state.js";
/** Fields shared by every expression node variant. */
type ExpressionNodeBase = {
    span?: SourceSpan;
    /** Explicit grouping is a rounding boundary even when the group has one literal. */
    parenthesized?: boolean;
};
/** Parsed assembler expression; `type` discriminates every variant. */
export type ExpressionNode = IdentifierExpressionNode | LiteralExpressionNode | StringExpressionNode | DefineReferenceExpressionNode | MemberExpressionNode | IndexExpressionNode | CallExpressionNode | UnaryExpressionNode | BinaryExpressionNode | RangeExpressionNode | RelativeReferenceExpressionNode | SourceTextExpressionNode | TemplateExpressionNode | ErrorExpressionNode | RawExpressionNode;
/** Bare or dot-prefixed symbol name, including local `.name` spellings. */
export type IdentifierExpressionNode = ExpressionNodeBase & {
    type: "identifier";
    name: string;
};
/** Numeric literal kept in its lexical spelling. */
export type LiteralExpressionNode = ExpressionNodeBase & {
    type: "literal";
    value: string;
    /** Parsed numeric value; lexical spelling remains authoritative for width intent. */
    numericValue?: number;
};
/** Quoted string literal; `value` excludes the delimiters. */
export type StringExpressionNode = ExpressionNodeBase & {
    type: "string";
    value: string;
    quote: '"' | "'";
};
/** `!name` or `!{content}` define reference left unexpanded; `name` is set when unbraced, `content` when braced. */
export type DefineReferenceExpressionNode = ExpressionNodeBase & {
    type: "defineReference";
    name?: string;
    content?: string;
    braced: boolean;
};
/** Expression forms that name a symbol and can be rendered as a lookup key. */
export type ReferenceExpressionNode = IdentifierExpressionNode | RelativeReferenceExpressionNode | DefineReferenceExpressionNode | MemberExpressionNode | IndexExpressionNode;
/** `object.property` access on a reference. */
export type MemberExpressionNode = ExpressionNodeBase & {
    type: "member";
    object: ReferenceExpressionNode;
    property: IdentifierExpressionNode;
};
/** `object[index]` access on a reference; the index is evaluated numerically. */
export type IndexExpressionNode = ExpressionNodeBase & {
    type: "index";
    object: ReferenceExpressionNode;
    index: ExpressionNode;
};
/** Function call; only bare identifiers can be called. */
export type CallExpressionNode = ExpressionNodeBase & {
    type: "call";
    callee: IdentifierExpressionNode;
    arguments: ExpressionNode[];
};
/** Prefix operators, including byte-select (`<`, `>`, `^`) and `<:` bank forms. */
export type UnaryOperator = "<:" | "<" | ">" | "^" | "~" | "-" | "+";
/** Prefix operator applied to one operand. */
export type UnaryExpressionNode = ExpressionNodeBase & {
    type: "unary";
    operator: UnaryOperator;
    argument: ExpressionNode;
};
/** Infix operators; precedence is defined by `binaryPrecedence`. */
export type BinaryOperator = "**" | "*" | "/" | "%" | "+" | "-" | "<<" | ">>" | "&" | "|" | "^" | "<" | ">" | "<=" | ">=" | "==" | "=" | "!=" | "&&" | "||";
/** Infix operation; chains are left-associative at equal precedence. */
export type BinaryExpressionNode = ExpressionNodeBase & {
    type: "binary";
    operator: BinaryOperator;
    left: ExpressionNode;
    right: ExpressionNode;
};
/** `start..end` range used by `for` headers and `incbin` slices. */
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
/** Unparsed expression text; must be parsed before evaluation and is never executable. */
export type RawExpressionNode = ExpressionNodeBase & {
    type: "raw";
    value: string;
};
/**
 * Parses portable expression syntax without resolving values or activating diagnostics.
 * @param input The expression source text.
 * @returns The parsed expression node.
 */
export declare function parseExpressionNode(input: string, source?: ExpressionSource): ExpressionNode;
/** Internal adapter retains the public node-only API while labeling the real parser caller. */
export declare function parseExpressionAtSite(input: string, site: ExpressionParseSite, source?: ExpressionSource): ExpressionNode;
/** Internal outcome separates grammar coverage from legacy acceptance and evaluation errors. */
export type ExpressionParseResult = {
    /** Parsed node, or a diagnostic/template node when the input is not fully native grammar. */
    node: ExpressionNode;
    /** Grammar coverage classification for this parse. */
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
 * @param node The expression node to render.
 * @returns The rendered expression text.
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
 * @param node The expression node to inspect.
 * @returns `true` when the node is a reference expression.
 */
export declare function isReferenceExpressionNode(node: ExpressionNode): node is ReferenceExpressionNode;
/** Overrides applied while rendering reference lookup keys. */
type RenderReferenceExpressionOptions = {
    renderIndex?: (node: ExpressionNode) => string;
};
/**
 * Renders a canonical lookup key. Root/object grouping is intentionally omitted
 * for symbol lookup; numeric index expressions keep their grouping. Use
 * renderExpressionNode when rendering a reference as a numeric expression.
 * @param node The reference node to render.
 * @param [options] Optional rendering overrides.
 * @returns The rendered reference text.
 */
export declare function renderReferenceExpressionNode(node: ReferenceExpressionNode, options?: RenderReferenceExpressionOptions): string;
/**
 * Parses a leading reference-expression prefix from a larger source string.
 * @param input The source text to scan.
 * @returns The parsed node and consumed length.
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