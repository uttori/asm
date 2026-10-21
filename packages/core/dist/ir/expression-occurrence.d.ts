import type { SourceSpan } from "../source-location.js";
import type { ExpressionNode } from "./expression-node.js";
/** Store each physical range once: columnStart/End duplicate start/end for these occurrences. */
export declare function compactExpressionSpans(node: ExpressionNode, relocate?: (span: SourceSpan) => SourceSpan): void;
/**
 * Continuations remove comments, whitespace and a trailing backslash. Map lexical characters
 * back to the physical extent without evaluating or guessing across a profile rewrite.
 */
export declare function locateContinuedExpression(text: string, physical: string, start: number): number[] | undefined;
//# sourceMappingURL=expression-occurrence.d.ts.map