import type { ExpressionNode } from "./expression-node.js";
/** Internal grammar coverage, not an evaluation result or a promise of acceptance. */
export type ExpressionParseOutcome = {
    kind: "native";
} | {
    kind: "compatibility";
    reason: "relative-label" | "macro-argument" | "variadic-template";
} | {
    kind: "invalid";
    reason: "empty" | "literal" | "string" | "define" | "operand" | "delimiter" | "member" | "trailing-tokens";
} | {
    kind: "unsupported";
    reason: "token" | "postfix" | "unclassified";
};
/** Fixed call-site families keep metrics bounded and exclude source text. */
export type ExpressionParseSite = "generated-expression" | "public" | "command" | "operand" | "statement" | "assembler" | "reference" | "include" | "compatibility-probe" | "math-cache" | "instrumentation";
export type ExpressionFallbackSite = "numeric" | "call-argument";
export type ExpressionOutcomeKey = "native" | `${Exclude<ExpressionParseOutcome, {
    kind: "native";
}>["kind"]}:${Exclude<ExpressionParseOutcome, {
    kind: "native";
}>["reason"]}`;
/** Preserve coverage metadata for public raw adapters and detached parser nodes. */
export declare function setRawExpressionOutcome(node: ExpressionNode, outcome: ExpressionParseOutcome): void;
/** Hand-built raw nodes have no parser evidence; do not guess that they are valid dialect syntax. */
export declare function getRawExpressionOutcome(node: ExpressionNode): ExpressionParseOutcome;
/** Stable histogram key; never includes source, symbol names, or exception messages. */
export declare function expressionOutcomeKey(outcome: ExpressionParseOutcome): ExpressionOutcomeKey;
//# sourceMappingURL=expression-parse-state.d.ts.map