import type { ExpressionNode } from "./expression-node.js";

/** Internal grammar coverage, not an evaluation result or a promise of acceptance. */
export type ExpressionParseOutcome =
  | { kind: "native" }
  | { kind: "compatibility"; reason: "relative-label" | "macro-argument" | "variadic-template" }
  | {
      kind: "invalid";
      reason:
        | "empty"
        | "literal"
        | "string"
        | "define"
        | "operand"
        | "delimiter"
        | "member"
        | "trailing-tokens";
    }
  | { kind: "unsupported"; reason: "token" | "postfix" | "unclassified" };

/** Fixed call-site families keep metrics bounded and exclude source text. */
export type ExpressionParseSite =
  | "generated-expression"
  | "public"
  | "command"
  | "operand"
  | "statement"
  | "assembler"
  | "reference"
  | "include"
  | "compatibility-probe"
  | "math-cache"
  | "instrumentation";
/** Raw-fallback call-site families counted separately from parse sites. */
export type ExpressionFallbackSite = "numeric" | "call-argument";
/** Metrics key: `native`, or `kind:reason` for every non-native outcome. */
export type ExpressionOutcomeKey =
  | "native"
  | `${Exclude<ExpressionParseOutcome, { kind: "native" }>["kind"]}:${Exclude<ExpressionParseOutcome, { kind: "native" }>["reason"]}`;

// Legacy raw adapters retain side metadata without retaining dead syntax trees.
const rawOutcomes = new WeakMap<ExpressionNode, ExpressionParseOutcome>();

/** Preserve coverage metadata for public raw adapters and detached parser nodes. */
export function setRawExpressionOutcome(
  node: ExpressionNode,
  outcome: ExpressionParseOutcome,
): void {
  rawOutcomes.set(node, outcome);
}

/** Hand-built raw nodes have no parser evidence; do not guess that they are valid dialect syntax. */
export function getRawExpressionOutcome(node: ExpressionNode): ExpressionParseOutcome {
  if (node.type === "error") {
    return node.outcome;
  }
  return rawOutcomes.get(node) ?? { kind: "unsupported", reason: "unclassified" };
}

/** Stable histogram key; never includes source, symbol names, or exception messages. */
export function expressionOutcomeKey(outcome: ExpressionParseOutcome): ExpressionOutcomeKey {
  return outcome.kind === "native" ? "native" : `${outcome.kind}:${outcome.reason}`;
}
