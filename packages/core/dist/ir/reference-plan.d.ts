import type { ExpressionNode } from "./expression-node.js";
import type { NormalizedCommand } from "./normalized-command.js";
import type { ParsedInstructionOperands } from "./parsed-operand.js";
/** An observation leaf, or a struct path whose container still resolves in the current stage. */
type ReferenceLeaf = Extract<ExpressionNode, {
    type: "identifier" | "defineReference" | "member" | "index" | "call";
}>;
/**
 * Syntax-only reference walks owned by one assembler. Plans retain original occurrences, never
 * resolved names, scope, values, or recorded metadata; replay still observes the current stage.
 * Weak keys let includes and generated fragments be reclaimed with their owning syntax.
 */
export declare class ReferencePlanner {
    private readonly expressions;
    private readonly instructions;
    /** Flatten only reference-bearing work; literal-only syntax needs no allocation or cache entry. */
    expression(expression: ExpressionNode): readonly ReferenceLeaf[];
    /** Reuse physical projection only while both target grammar syntax and source occurrence match. */
    instruction(operands: ParsedInstructionOperands, command: NormalizedCommand): readonly ExpressionNode[];
}
export {};
//# sourceMappingURL=reference-plan.d.ts.map