import type { ExpressionNode, RangeExpressionNode } from "./expression-node.js";
import type { NormalizedCommand } from "./normalized-command.js";
export type LoopNode = {
    type: "for" | "while";
    header?: NormalizedCommand;
    conditionNode?: ExpressionNode;
    rangeNode?: RangeExpressionNode;
    variable?: string;
    start?: number;
    end?: number;
    startExpression?: ExpressionNode;
    endExpression?: ExpressionNode;
    commands: ExecutableNode[];
    startLine: number;
    endLine?: number;
};
export type ConditionalBranch = {
    kind: "if" | "elseif" | "else";
    header?: NormalizedCommand;
    conditionNode?: ExpressionNode;
    commands: ExecutableNode[];
    startLine: number;
    endLine?: number;
};
export type ConditionalBranchNode = {
    type: "if";
    header?: NormalizedCommand;
    branches: ConditionalBranch[];
    startLine: number;
    endLine?: number;
};
export type ExecutableNode = NormalizedCommand | LoopNode | ConditionalBranchNode;
//# sourceMappingURL=assembly-tree.d.ts.map