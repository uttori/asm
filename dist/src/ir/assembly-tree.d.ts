import type { ExpressionNode, RangeExpressionNode } from "./expression-node.js";
import type { NormalizedCommand } from "./normalized-command.js";
export type LoopNode = {
    type: "for" | "while";
    condition: string;
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
    conditionText?: string;
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
export type MacroDefinitionNode = {
    type: "macroDefinition";
    name: string;
    params: string[];
    variadic: boolean;
    body: ExecutableNode[];
    sourceFile?: string;
};
export type IncludeNode = {
    type: "include";
    file: string;
    commands: ExecutableNode[];
};
export type ExecutableNode = string | NormalizedCommand | LoopNode | ConditionalBranchNode;
export type AssemblyTreeNode = LoopNode | ConditionalBranchNode | MacroDefinitionNode | IncludeNode;
//# sourceMappingURL=assembly-tree.d.ts.map