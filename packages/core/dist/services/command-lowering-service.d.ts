import type { ArchitectureDefinition } from "../architecture-registry.js";
import type { DirectiveRegistry } from "../directives/registry.js";
import type { CaptureNode, ConditionalBranch, ConditionalBranchNode, ExecutableNode, LoopNode } from "../ir/assembly-tree.js";
import type { CommandOperation } from "../ir/command-operation.js";
import type { DeclarationNode } from "../ir/declaration-node.js";
import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { ContributionSyntax } from "../ir/source-syntax.js";
import { type LabelStatement, type AssignmentStatement, type NumericDataStatement } from "../ir/statement-node.js";
import type { ProgramModel } from "./program-model-builder.js";
/** Statement payloads are immutable across stages; execution binds the current scope and values. */
export type LoweredStatement = {
    command: NormalizedCommand;
    source: NormalizedCommand["source"];
} & ({
    kind: "label";
    statement: LabelStatement;
} | {
    kind: "assignment";
    statement: AssignmentStatement;
} | {
    kind: "numericData";
    statement: NumericDataStatement;
});
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
    invocation: Extract<CommandOperation, {
        kind: "macroCall";
    }>;
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
export type LoweredExecutableNode = LoweredCaptureNode | LoweredCommand | LoweredStatement | LoweredOperation | LoweredDeclaration | LoweredSourceTemplate | LoweredBareInvocation | LoweredLoopNode | LoweredConditionalNode;
export type LoweredProgram = {
    sourceFile: string;
    startLine: number;
    nodes: LoweredExecutableNode[];
};
export type CommandLoweringHost = {
    syntaxProfile: {
        readonly bareMacroInvocations?: boolean;
        readonly leadingDotLabels?: boolean;
    };
    directiveRegistry: {
        has(keyword: string): boolean;
        lookup?: DirectiveRegistry["lookup"];
        parseSyntax?(command: NormalizedCommand): ContributionSyntax | undefined;
    };
    resolveActiveArchitecture(): {
        name: string;
        definition?: ArchitectureDefinition;
    };
    canonicalizeDirectiveKeyword(keyword: string): string;
    prepareTypedInstruction?(node: LoweredTypedInstruction): void;
};
/**
 * Lowers stable front-end commands into directive or instruction work units used
 * by later layout and emission stages.
 */
export declare class CommandLoweringService {
    host: CommandLoweringHost;
    /** Command snapshots are immutable; weak ownership releases included/reparsed programs. */
    private readonly statements;
    /** Pure syntax is cached by command and selected grammar, never by resolved values or processor state. */
    private readonly instructionSyntax;
    constructor(host: CommandLoweringHost);
    /** Select a native statement without bypassing directive ownership or macro-template syntax. */
    lowerStatement(command: NormalizedCommand): LoweredStatement | undefined;
    /** Parse once per command/grammar for analysis and execution; never prepare or evaluate operands here. */
    parseInstruction(command: NormalizedCommand): import("../ir/resolved-instruction.js").ParsedInstruction | undefined;
    /**
     * Lowers a normalized command into the execution-layer representation.
     * @param {NormalizedCommand} command The normalized command node.
     * @returns {LoweredCommand} The lowered execution work unit.
     */
    lowerCommand(command: NormalizedCommand): LoweredCommand;
    /**
     * Lowers an executable tree node into a durable execution-layer node.
     * Commands retain their immutable front-end snapshots. Legacy preprocessing
     * creates its mutable execution copy at dispatch time, avoiding a redundant
     * clone for every stage-owned lowered node.
     * @param {ExecutableNode} node The node to lower.
     * @returns {LoweredExecutableNode} The lowered node.
     */
    lowerExecutableNode(node: ExecutableNode, scope?: "struct"): LoweredExecutableNode;
    /**
     * Lowers a full program model into a stage-owned execution program.
     * @param {ProgramModel} program The program to lower.
     * @returns {LoweredProgram} The lowered program.
     */
    lowerProgram(program: ProgramModel): LoweredProgram;
}
//# sourceMappingURL=command-lowering-service.d.ts.map