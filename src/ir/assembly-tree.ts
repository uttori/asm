import type { ExpressionNode } from "./expression-node.js";
import type { NormalizedCommand } from "./normalized-command.js";

export type LoopNode = {
  type: "for" | "while";
  condition: string;
  conditionNode?: ExpressionNode;
  variable?: string;
  start?: number;
  end?: number;
  commands: Array<string | NormalizedCommand | LoopNode>;
  startLine: number;
  endLine?: number;
};

export type ConditionalBranchNode = {
  type: "if";
  condition?: ExpressionNode;
  commands: NormalizedCommand[];
  elseIfBranches?: ConditionalBranchNode[];
  elseBranch?: NormalizedCommand[];
};

export type MacroDefinitionNode = {
  type: "macroDefinition";
  name: string;
  params: string[];
  variadic: boolean;
  body: NormalizedCommand[];
  sourceFile?: string;
};

export type IncludeNode = {
  type: "include";
  file: string;
  commands: NormalizedCommand[];
};

export type AssemblyTreeNode = LoopNode | ConditionalBranchNode | MacroDefinitionNode | IncludeNode;
