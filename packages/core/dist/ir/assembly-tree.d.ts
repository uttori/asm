import type { ExpressionNode, RangeExpressionNode } from "./expression-node.js";
import type { NormalizedCommand } from "./normalized-command.js";
/** `for`/`while` block whose body is re-executed per iteration rather than flattened at parse time. */
export type LoopNode = {
    /** Loop keyword that opened the block. */
    type: "for" | "while";
    /** Opening `for`/`while` command, retained for diagnostics and re-lowering. */
    header?: NormalizedCommand;
    /** `while` condition, or the `for` range expression; undefined when the header failed to parse. */
    conditionNode?: ExpressionNode;
    /** Parsed `for` range; undefined for `while` loops or malformed `for` headers. */
    rangeNode?: RangeExpressionNode;
    /** `for` iteration variable name; undefined for `while` loops. */
    variable?: string;
    /** Precomputed numeric start bound; undefined when only `startExpression` is available. */
    start?: number;
    /** Precomputed numeric end bound; undefined when only `endExpression` is available. */
    end?: number;
    /** Unevaluated `for` range start expression. */
    startExpression?: ExpressionNode;
    /** Unevaluated `for` range end expression. */
    endExpression?: ExpressionNode;
    /** Body nodes in source order, excluding the header and closing keyword. */
    commands: ExecutableNode[];
    /** Source line of the opening header. */
    startLine: number;
    /** Source line of the closing `endfor`/`endwhile`/`endif`; undefined while the loop is unterminated. */
    endLine?: number;
};
/** One arm of an `if` chain; arms are evaluated in order and at most one body executes. */
export type ConditionalBranch = {
    /** Keyword that opened this arm. */
    kind: "if" | "elseif" | "else";
    /** Command that opened this arm. */
    header?: NormalizedCommand;
    /** Arm condition; undefined for `else` arms and unparsable conditions. */
    conditionNode?: ExpressionNode;
    /** Arm body nodes in source order. */
    commands: ExecutableNode[];
    /** Source line of the arm's opening keyword. */
    startLine: number;
    /** Source line of the next `elseif`/`else`/`endif`; undefined while the arm is still open. */
    endLine?: number;
};
/** Complete `if`/`elseif`/`else`/`endif` chain. */
export type ConditionalBranchNode = {
    /** Discriminant shared by every conditional chain. */
    type: "if";
    /** Opening `if` command, also the header of the first branch. */
    header?: NormalizedCommand;
    /** Arms in source order; the first is always the `if` arm. */
    branches: ConditionalBranch[];
    /** Source line of the opening `if`. */
    startLine: number;
    /** Source line of the closing `endif`; undefined while the chain is unterminated. */
    endLine?: number;
};
/** Captured syntax is selected as a unit; parsing its body never activates declaration effects. */
export type CaptureNode = {
    /** Discriminant for captured declaration bodies. */
    type: "capture";
    /** Declaration family that owns the captured body and its closing keyword. */
    captureKind: "macro" | "function" | "struct" | "dataStructs";
    /** Opening declaration command. */
    header: NormalizedCommand;
    /** Body commands kept as inert syntax until the owning declaration consumes them. */
    commands: ExecutableNode[];
    /** Closing `end…` command; undefined for single-line functions and unterminated captures. */
    footer?: NormalizedCommand;
    /** Source line of the opening declaration. */
    startLine: number;
    /** Source line of the closing command or of a single-line function; undefined while unterminated. */
    endLine?: number;
};
/** Node of the structured program tree: a plain command or a block construct. */
export type ExecutableNode = NormalizedCommand | LoopNode | ConditionalBranchNode | CaptureNode;
//# sourceMappingURL=assembly-tree.d.ts.map