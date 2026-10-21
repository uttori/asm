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

/** Captured syntax is selected as a unit; parsing its body never activates declaration effects. */
export type CaptureNode = {
  type: "capture";
  captureKind: "macro" | "function" | "struct" | "dataStructs";
  header: NormalizedCommand;
  commands: ExecutableNode[];
  footer?: NormalizedCommand;
  startLine: number;
  endLine?: number;
};

export type ExecutableNode = NormalizedCommand | LoopNode | ConditionalBranchNode | CaptureNode;
