import type { ExpressionNode, ReferenceExpressionNode } from "./expression-node.js";
/** Member and index segments remain separate until the owning symbol/struct service resolves them. */
export type ReferencePath = {
    /** Base identifier before member or index chaining. */
    readonly root: string;
    /** Left-to-right member and index steps after the root identifier. */
    readonly segments: readonly ({
        kind: "member";
        name: string;
    } | {
        kind: "index";
        expression: ExpressionNode;
    })[];
};
/** Missing values remain distinguishable from real zeroes; only the caller may accept a deferred zero. */
export type ReferenceResolution = {
    kind: "resolved";
    value: number;
} | {
    kind: "missing";
    name: string;
    deferred: boolean;
} | {
    kind: "error";
    error: Error;
};
/** Decompose syntax without rendering or reparsing; defines must bind before this boundary. */
export declare function referencePath(node: ReferenceExpressionNode): ReferencePath | undefined;
//# sourceMappingURL=reference-path.d.ts.map