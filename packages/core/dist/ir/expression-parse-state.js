// Legacy raw adapters retain side metadata without retaining dead syntax trees.
const rawOutcomes = new WeakMap();
/** Preserve coverage metadata for public raw adapters and detached parser nodes. */
export function setRawExpressionOutcome(node, outcome) {
    rawOutcomes.set(node, outcome);
}
/** Hand-built raw nodes have no parser evidence; do not guess that they are valid dialect syntax. */
export function getRawExpressionOutcome(node) {
    if (node.type === "error") {
        return node.outcome;
    }
    return rawOutcomes.get(node) ?? { kind: "unsupported", reason: "unclassified" };
}
/** Stable histogram key; never includes source, symbol names, or exception messages. */
export function expressionOutcomeKey(outcome) {
    return outcome.kind === "native" ? "native" : `${outcome.kind}:${outcome.reason}`;
}
//# sourceMappingURL=expression-parse-state.js.map