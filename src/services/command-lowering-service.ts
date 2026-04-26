import type { LoweredInstruction } from "../architecture-types.js";
import type { ConditionalBranch, ConditionalBranchNode, ExecutableNode, LoopNode } from "../ir/assembly-tree.js";
import type { DirectiveRegistry } from "../directives/registry.js";
import type { ArchitectureDefinition } from "../architecture-registry.js";
import { cloneNormalizedCommand, type NormalizedCommand } from "../ir/normalized-command.js";
import type { ProgramModel } from "./program-model-builder.js";

export type LoweredDirective = {
  kind: "directive";
  keyword: string;
  words: string[];
  source: NormalizedCommand["source"];
  command?: NormalizedCommand;
};

export type LoweredCommand = LoweredDirective | LoweredInstruction;

export type LoweredPassthroughCommand = {
  kind: "command";
  command: NormalizedCommand;
  source: NormalizedCommand["source"];
};

export type LoweredLoopNode = Omit<LoopNode, "type" | "header" | "commands"> & {
  kind: "loop";
  loopType: LoopNode["type"];
  header?: NormalizedCommand;
  commands: LoweredExecutableNode[];
};

export type LoweredConditionalBranch = Omit<ConditionalBranch, "header" | "commands"> & {
  header?: NormalizedCommand;
  commands: LoweredExecutableNode[];
};

export type LoweredConditionalNode = Omit<ConditionalBranchNode, "type" | "header" | "branches"> & {
  kind: "conditional";
  header?: NormalizedCommand;
  branches: LoweredConditionalBranch[];
};

export type LoweredExecutableNode =
  | LoweredCommand
  | LoweredPassthroughCommand
  | LoweredLoopNode
  | LoweredConditionalNode;

export type LoweredProgram = {
  sourceFile: string;
  startLine: number;
  nodes: LoweredExecutableNode[];
};

// Data directives are intentionally absent for now: macro-heavy sources can
// depend on placeholder rewriting and byte-for-byte ASAR compatibility.
const DIRECTLY_LOWERABLE_DIRECTIVES = new Set([
  "arch",
  "base",
  "check",
  "exhirom",
  "exlorom",
  "fastrom",
  "fill",
  "fillbyte",
  "filldword",
  "filllong",
  "fillword",
  "fullsa1rom",
  "hirom",
  "lorom",
  "namespace",
  "norom",
  "optimize",
  "org",
  "pad",
  "padbyte",
  "paddword",
  "padlong",
  "padword",
  "pullbase",
  "pullns",
  "pullpc",
  "pulltable",
  "pushbase",
  "pushns",
  "pushpc",
  "pushtable",
  "sa1rom",
  "sfxrom",
  "startpos",
]);

export type CommandLoweringHost = {
  directiveRegistry: DirectiveRegistry;
  resolveActiveArchitecture(): { name: string; definition?: ArchitectureDefinition };
  classifyOperandForActiveArchitecture(operand: string): import("../architecture-types.js").LoweredOperand;
};

/**
 * Lowers stable front-end commands into directive or instruction work units used
 * by later layout and emission stages.
 */
export class CommandLoweringService {
  constructor(readonly host: CommandLoweringHost) {}

  /**
   * Lowers a normalized command into the execution-layer representation.
   * @param {NormalizedCommand} command The normalized command node.
   * @returns {LoweredCommand} The lowered execution work unit.
   */
  lowerCommand(command: NormalizedCommand): LoweredCommand {
    const keyword = command.keyword.toLowerCase();

    if (this.host.directiveRegistry.has(keyword)) {
      let directiveWords = command.words;
      if (command.parsed.includeTarget) {
        directiveWords = [command.parsed.includeTarget.directive, command.parsed.includeTarget.target];
      } else if (keyword === "incbin" && command.parsed.directiveArgs?.args?.length) {
        directiveWords = [keyword, ...command.parsed.directiveArgs.args];
      }

      return {
        kind: "directive",
        keyword,
        words: directiveWords,
        source: command.source,
        command,
      };
    }

    const architecture = this.host.resolveActiveArchitecture();
    const isaLoweredInstruction = architecture.definition?.encoder.lowerInstructionFromCommand?.(command);
    if (isaLoweredInstruction) {
      return isaLoweredInstruction;
    }

    const parsedOperands = command.parsed.opcodeOperands;
    const mnemonic = parsedOperands?.mnemonic ?? command.keyword;
    const operandText = parsedOperands?.operandText ?? command.words.slice(1).join(" ");
    const operands = parsedOperands?.operands ?? (operandText ? [operandText] : []);
    const loweredOperands = operands.map((operand) => this.host.classifyOperandForActiveArchitecture(operand));
    const loweredOperand = this.host.classifyOperandForActiveArchitecture(operandText);

    return {
      kind: "instruction",
      mnemonic,
      operandText,
      operands,
      loweredOperands,
      loweredOperand,
      words: command.words,
      sourceFile: command.source.file,
      sourceLine: command.source.line,
      sourceRaw: command.source.raw,
    };
  }

  /**
   * Lowers an executable tree node into a durable execution-layer node.
   * Commands that still need legacy preprocessing are preserved as detached
   * command snapshots so the cached program tree never gets mutated at runtime.
   * @param {ExecutableNode} node The node to lower.
   * @returns {LoweredExecutableNode} The lowered node.
   */
  lowerExecutableNode(node: ExecutableNode): LoweredExecutableNode {
    if ("source" in node) {
      const detached = cloneNormalizedCommand(node);
      if (this.shouldPreserveCommand(detached)) {
        return {
          kind: "command",
          command: detached,
          source: detached.source,
        };
      }
      return this.lowerCommand(detached);
    }

    if (node.type === "for" || node.type === "while") {
      return {
        kind: "loop",
        loopType: node.type,
        header: node.header ? cloneNormalizedCommand(node.header) : undefined,
        conditionNode: node.conditionNode,
        rangeNode: node.rangeNode,
        variable: node.variable,
        start: node.start,
        end: node.end,
        startExpression: node.startExpression,
        endExpression: node.endExpression,
        commands: node.commands.map((command) => this.lowerExecutableNode(command)),
        startLine: node.startLine,
        endLine: node.endLine,
      };
    }

    if (node.type !== "if") {
      throw new Error(`Unknown executable node type: ${String((node as { type?: string }).type)}`);
    }

    const conditionalNode: ConditionalBranchNode = node;
    return {
      kind: "conditional",
      header: conditionalNode.header ? cloneNormalizedCommand(conditionalNode.header) : undefined,
      branches: conditionalNode.branches.map((branch): LoweredConditionalBranch => ({
        kind: branch.kind,
        header: branch.header ? cloneNormalizedCommand(branch.header) : undefined,
        conditionNode: branch.conditionNode,
        commands: branch.commands.map((command) => this.lowerExecutableNode(command)),
        startLine: branch.startLine,
        endLine: branch.endLine,
      })),
      startLine: conditionalNode.startLine,
      endLine: conditionalNode.endLine,
    };
  }

  /**
   * Lowers a full program model into a stage-owned execution program.
   * @param {ProgramModel} program The program to lower.
   * @returns {LoweredProgram} The lowered program.
   */
  lowerProgram(program: ProgramModel): LoweredProgram {
    return {
      sourceFile: program.sourceFile,
      startLine: program.startLine,
      nodes: program.nodes.map((node) => this.lowerExecutableNode(node)),
    };
  }

  /**
   * Commands that still require legacy preprocess / control handlers must remain
   * as detached command snapshots rather than direct lowered directives.
   * @param {NormalizedCommand} command The command to inspect.
   * @returns {boolean} True when the command should stay in passthrough form.
   */
  shouldPreserveCommand(command: NormalizedCommand): boolean {
    const keyword = command.keyword.toLowerCase();
    if (/<[^>]+>/.test(command.command)) {
      // Macro bodies use ASAR-style `<param>` placeholders that are resolved
      // during normalized dispatch. Lowering them early would send placeholders
      // like `<value>` straight into numeric evaluation.
      return true;
    }
    // Only bypass normalized preprocessing for directives whose ordering and
    // side effects are already represented by parsed command metadata. Defines,
    // labels, macros, structs, and control-flow headers still use passthrough.
    if (this.host.directiveRegistry.has(keyword) && DIRECTLY_LOWERABLE_DIRECTIVES.has(keyword)) {
      return false;
    }
    return command.kind !== "opcodeCandidate";
  }
}
