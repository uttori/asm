import type { ArchitectureDefinition } from "../architecture-registry.js";
import { isCoreDataDirective } from "../directives/data.js";
import type { DirectiveRegistry } from "../directives/registry.js";
import { recordExecutionParser, incrementInternalCounter } from "../internal-instrumentation.js";
import type {
  CaptureNode,
  ConditionalBranch,
  ConditionalBranchNode,
  ExecutableNode,
  LoopNode,
} from "../ir/assembly-tree.js";
import type { CommandOperation } from "../ir/command-operation.js";
import type { DeclarationNode } from "../ir/declaration-node.js";
import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { ContributionSyntax } from "../ir/source-syntax.js";
import {
  parseLabelStatement,
  parseNumericDataStatement,
  materializeNumericData,
  type LabelStatement,
  type AssignmentStatement,
  type NumericDataStatement,
} from "../ir/statement-node.js";
import { deriveTokenSpans } from "../source-location.js";
import type { ProgramModel } from "./program-model-builder.js";

/** Statement payloads are immutable across stages; execution binds the current scope and values. */
export type LoweredStatement = {
  command: NormalizedCommand;
  source: NormalizedCommand["source"];
} & (
  | { kind: "label"; statement: LabelStatement }
  | { kind: "assignment"; statement: AssignmentStatement }
  | { kind: "numericData"; statement: NumericDataStatement }
);

/** Plugin syntax carries data only; the registry reconstructs the session binding. */
export type LoweredPluginSyntax = {
  kind: "pluginSyntax";
  statement: ContributionSyntax;
  command: NormalizedCommand;
  source: NormalizedCommand["source"];
};
/** No expanded strings or legacy words participate in typed instruction execution. */
export type LoweredTypedInstruction = {
  kind: "typedInstruction";
  architecture: string;
  grammarVersion: string;
  instruction: import("../ir/resolved-instruction.js").ParsedInstruction;
  command: NormalizedCommand;
  source: NormalizedCommand["source"];
  resolved?: import("../ir/resolved-instruction.js").ResolvedInstruction;
  /** Rebuilt on every lowering; never shared with the immutable syntax cache. */
  prepared?: import("../ir/resolved-instruction.js").ResolvedInstruction;
};
export type LoweredCommand = LoweredPluginSyntax | LoweredTypedInstruction;

/** Ordered declarations carry parsed payloads, never a generic dispatch request. */
export type LoweredOperation = {
  kind: "operation";
  operation: CommandOperation;
  command: NormalizedCommand;
  source: NormalizedCommand["source"];
};
export type LoweredDeclaration = {
  kind: "declaration";
  declaration: DeclarationNode;
  command: NormalizedCommand;
  source: NormalizedCommand["source"];
};
/** Deferred macro placeholders bind generated source at their selected loop occurrence. */
export type LoweredSourceTemplate = {
  kind: "sourceTemplate";
  command: NormalizedCommand;
  source: NormalizedCommand["source"];
};
/** A bare call is resolved against declarations in order, before selecting an instruction. */
export type LoweredBareInvocation = {
  kind: "bareInvocation";
  invocation: Extract<CommandOperation, { kind: "macroCall" }>;
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

/** A capture's declaration runtime owns its body; nested control nodes keep their ordered bindings. */
export type LoweredCaptureNode = Omit<CaptureNode, "type" | "commands"> & {
  kind: "capture";
  commands: ExecutableNode[];
};

export type LoweredExecutableNode =
  | LoweredCaptureNode
  | LoweredCommand
  | LoweredStatement
  | LoweredOperation
  | LoweredDeclaration
  | LoweredSourceTemplate
  | LoweredBareInvocation
  | LoweredLoopNode
  | LoweredConditionalNode;

export type LoweredProgram = {
  sourceFile: string;
  startLine: number;
  nodes: LoweredExecutableNode[];
};

export type CommandLoweringHost = {
  syntaxProfile: { readonly bareMacroInvocations?: boolean; readonly leadingDotLabels?: boolean };
  directiveRegistry: {
    has(keyword: string): boolean;
    lookup?: DirectiveRegistry["lookup"];
    parseSyntax?(command: NormalizedCommand): ContributionSyntax | undefined;
  };
  resolveActiveArchitecture(): { name: string; definition?: ArchitectureDefinition };
  canonicalizeDirectiveKeyword(keyword: string): string;
  prepareTypedInstruction?(node: LoweredTypedInstruction): void;
};

/**
 * Lowers stable front-end commands into directive or instruction work units used
 * by later layout and emission stages.
 */
export class CommandLoweringService {
  host: CommandLoweringHost;
  /** Command snapshots are immutable; weak ownership releases included/reparsed programs. */
  private readonly statements = new WeakMap<NormalizedCommand, LoweredStatement | null>();

  /** Pure syntax is cached by command and selected grammar, never by resolved values or processor state. */
  private readonly instructionSyntax = new WeakMap<
    NormalizedCommand,
    Map<
      object,
      { version: string; instruction: import("../ir/resolved-instruction.js").ParsedInstruction }
    >
  >();

  constructor(host: CommandLoweringHost) {
    this.host = host;
  }

  /** Select a native statement without bypassing directive ownership or macro-template syntax. */
  lowerStatement(command: NormalizedCommand): LoweredStatement | undefined {
    const keyword = this.host.canonicalizeDirectiveKeyword(command.keyword);
    const registry = this.host.directiveRegistry;
    if (/<[^>]+>/.test(command.command) || /\\[A-Z_a-z]/.test(command.command)) {
      return undefined;
    }
    const hasDirective = registry.has(keyword);
    const coreData =
      registry.lookup && isCoreDataDirective({ lookup: registry.lookup.bind(registry) }, keyword);
    // Prefixed directives outrank dot labels; assignments retain their semantic priority.
    if (
      hasDirective &&
      !coreData &&
      (command.keyword.startsWith(".") || command.kind !== "staticAssignment")
    ) {
      return undefined;
    }
    const cached = this.statements.get(command);
    if (cached !== undefined) {
      return cached ?? undefined;
    }
    let lowered: LoweredStatement | undefined;
    const common = { command, source: command.source };
    // Named label consumption precedes assignments in the source dialect, including malformed
    // `.local = value` forms. Keep that ordering instead of silently accepting a new declaration.
    const namedLabelPrefix =
      command.words[0]?.endsWith(":") ||
      (this.host.syntaxProfile.leadingDotLabels && command.keyword.startsWith("."));
    if (command.kind === "staticAssignment" && command.parsed.assignment && !namedLabelPrefix) {
      lowered = {
        ...common,
        kind: "assignment",
        statement: {
          ...command.parsed.assignment,
          text: command.words[2],
          span: command.source.tokenSpans[0] ?? command.source.normalizedSpan,
        },
      };
    } else if (
      (command.kind === "labelDefinition" ||
        (command.kind === "staticAssignment" && namedLabelPrefix)) &&
      !hasDirective
    ) {
      // Inline function declarations have historically been captured before their label prefix.
      if (!command.parsed.labelSplit?.trailing?.toLowerCase().startsWith("function")) {
        let statement: LabelStatement | undefined;
        if (command.syntax?.kind === "sequence") {
          let trailing: NormalizedCommand;
          const following = command.syntax.following;
          if (following.kind === "numericDataFragment") {
            // The cache shares the physical occurrence and tokens; no grammar is reparsed here.
            const words = command.words.slice(following.wordOffset);
            trailing = {
              kind: "directive",
              command: following.command,
              words,
              keyword: words[0],
              source: {
                ...command.source,
                normalized: following.command,
                tokenSpans: command.source.tokenSpans.length
                  ? deriveTokenSpans(command.source.raw, words, command.source.line)
                  : [],
              },
              parsed: {
                dataDirective: {
                  directive: words[0],
                  operands: materializeNumericData(following.statement).operands.map(
                    (operand) => operand.text,
                  ),
                },
              },
              syntax: { kind: "numericData", statement: following.statement },
            };
          } else {
            trailing = following;
          }
          statement = { ...command.syntax.declaration, trailing };
        } else if (command.syntax?.kind === "label") {
          statement = command.syntax.statement;
        } else {
          statement = parseLabelStatement(
            command,
            this.host.syntaxProfile.leadingDotLabels ?? false,
          );
        }
        if (statement) {
          lowered = { ...common, kind: "label", statement };
        }
      }
    } else if (coreData) {
      const statement =
        command.syntax?.kind === "numericData"
          ? command.syntax.statement
          : parseNumericDataStatement(command);
      if (statement) {
        lowered = { ...common, kind: "numericData", statement };
      }
    }
    this.statements.set(command, lowered ?? null);
    return lowered;
  }

  /** Parse once per command/grammar for analysis and execution; never prepare or evaluate operands here. */
  parseInstruction(
    command: NormalizedCommand,
  ): import("../ir/resolved-instruction.js").ParsedInstruction | undefined {
    const grammar = this.host.resolveActiveArchitecture().definition?.operandGrammar;
    if (!grammar) {
      return undefined;
    }
    const mnemonic = command.parsed.opcodeOperands?.mnemonic ?? command.keyword;
    const operandText =
      command.parsed.opcodeOperands?.operandText ?? command.words.slice(1).join(" ");
    const cache =
      this.instructionSyntax.get(command) ??
      new Map<
        object,
        {
          version: string;
          instruction: import("../ir/resolved-instruction.js").ParsedInstruction;
        }
      >();
    this.instructionSyntax.set(command, cache);
    let parsed = cache.get(grammar);
    if (!parsed || parsed.version !== grammar.version) {
      recordExecutionParser("operand");
      parsed = {
        version: grammar.version,
        instruction: { mnemonic, operands: grammar.parse(mnemonic, operandText) },
      };
      cache.set(grammar, parsed);
    }
    return parsed.instruction;
  }

  /**
   * Lowers a normalized command into the execution-layer representation.
   * @param {NormalizedCommand} command The normalized command node.
   * @returns {LoweredCommand} The lowered execution work unit.
   */
  lowerCommand(command: NormalizedCommand): LoweredCommand {
    const keyword = this.host.canonicalizeDirectiveKeyword(command.keyword);

    if (this.host.directiveRegistry.has(keyword)) {
      const syntax =
        command.syntax?.kind === "plugin"
          ? command.syntax
          : this.host.directiveRegistry.parseSyntax?.(command);
      if (syntax) {
        return { kind: "pluginSyntax", statement: syntax, command, source: command.source };
      }
      throw new Error(`Directive '${keyword}' requires parsed syntax.`);
    }

    const architecture = this.host.resolveActiveArchitecture();
    const grammar = architecture.definition?.operandGrammar;
    if (architecture.definition?.encoder.typed) {
      if (!grammar) {
        throw new Error(`Typed encoder '${architecture.name}' requires an operand grammar.`);
      }
      const instruction = this.parseInstruction(command)!;
      const node: LoweredTypedInstruction = {
        kind: "typedInstruction",
        architecture: architecture.name,
        grammarVersion: grammar.version,
        instruction,
        command,
        source: command.source,
      };
      this.host.prepareTypedInstruction?.(node);
      return node;
    }
    throw new Error(
      `Architecture '${architecture.name}' requires a typed encoder and operand grammar.`,
    );
  }

  /**
   * Lowers an executable tree node into a durable execution-layer node.
   * Commands retain their immutable front-end snapshots. Legacy preprocessing
   * creates its mutable execution copy at dispatch time, avoiding a redundant
   * clone for every stage-owned lowered node.
   * @param {ExecutableNode} node The node to lower.
   * @returns {LoweredExecutableNode} The lowered node.
   */
  lowerExecutableNode(node: ExecutableNode, scope?: "struct"): LoweredExecutableNode {
    incrementInternalCounter("runtimeNodesLowered");
    if ("source" in node) {
      const source = node.source;
      const operation = node.parsed.operation;
      if (operation) {
        return { kind: "operation", operation, command: node, source };
      }
      const declaration = node.parsed.declaration;
      if (
        declaration &&
        (declaration.kind === "function" ||
          declaration.kind === "character" ||
          declaration.kind === "dataStructRow" ||
          (declaration.kind === "invalid" && declaration.context !== "struct") ||
          (scope === "struct" && declaration.kind === "structField"))
      ) {
        return { kind: "declaration", declaration, command: node, source };
      }
      if (scope === "struct" && !["endstruct", "struct"].includes(node.keyword.toLowerCase())) {
        // Struct bodies historically ignore executable instructions; only field declarations reserve bytes.
        return {
          kind: "operation",
          operation: { kind: "empty", seedBaseImage: false },
          command: node,
          source,
        };
      }
      if (/<[^>]+>/.test(node.command) || /\\[A-Z_a-z]/.test(node.command)) {
        const data = node.parsed.dataDirective && parseNumericDataStatement(node);
        // Placeholder-looking text inside quoted data is a string value, including outside macros.
        if (data && data.operands.every((operand) => operand.expression.type === "string")) {
          return { kind: "numericData", statement: data, command: node, source };
        }
        return { kind: "sourceTemplate", command: node, source };
      }
      const statement = this.lowerStatement(node);
      if (statement) {
        return statement;
      }
      if (this.host.syntaxProfile.bareMacroInvocations && node.kind === "opcodeCandidate") {
        const invocation = node.parsed.bareInvocation;
        if (invocation) {
          return { kind: "bareInvocation", invocation, command: node, source };
        }
      }
      return this.lowerCommand(node);
    }

    if (node.type === "capture") {
      const { type: _type, commands, ...syntax } = node;
      return {
        ...syntax,
        kind: "capture",
        commands,
      };
    }

    if (node.type === "for" || node.type === "while") {
      return {
        kind: "loop",
        loopType: node.type,
        header: node.header,
        conditionNode: node.conditionNode,
        rangeNode: node.rangeNode,
        variable: node.variable,
        start: node.start,
        end: node.end,
        startExpression: node.startExpression,
        endExpression: node.endExpression,
        commands: node.commands.map((command) => this.lowerExecutableNode(command, scope)),
        startLine: node.startLine,
        endLine: node.endLine,
      };
    }

    assertConditionalNode(node);
    return {
      kind: "conditional",
      header: node.header,
      branches: node.branches.map((branch): LoweredConditionalBranch => ({
        kind: branch.kind,
        header: branch.header,
        conditionNode: branch.conditionNode,
        commands: branch.commands.map((command) => this.lowerExecutableNode(command, scope)),
        startLine: branch.startLine,
        endLine: branch.endLine,
      })),
      startLine: node.startLine,
      endLine: node.endLine,
    };
  }

  /**
   * Lowers a full program model into a stage-owned execution program.
   * @param {ProgramModel} program The program to lower.
   * @returns {LoweredProgram} The lowered program.
   */
  lowerProgram(program: ProgramModel): LoweredProgram {
    incrementInternalCounter("loweredProgramBuilds");
    return {
      sourceFile: program.sourceFile,
      startLine: program.startLine,
      nodes: program.nodes.map((node) => this.lowerExecutableNode(node)),
    };
  }
}

function assertConditionalNode(
  node: LoopNode | ConditionalBranchNode,
): asserts node is ConditionalBranchNode {
  if (node.type !== "if") {
    throw new Error(`Unknown executable node type: ${node.type}`);
  }
}
