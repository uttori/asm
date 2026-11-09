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
    /** Discriminant for plugin-owned directive syntax. */
    kind: "pluginSyntax";
    /** Parsed directive payload the registry executes. */
    statement: ContributionSyntax;
    /** Front-end command the syntax was parsed from. */
    command: NormalizedCommand;
    /** Source occurrence used for diagnostics and source maps. */
    source: NormalizedCommand["source"];
};
/** No expanded strings or legacy words participate in typed instruction execution. */
export type LoweredTypedInstruction = {
    /** Discriminant for typed-encoder instructions. */
    kind: "typedInstruction";
    /** Canonical architecture name active when the instruction was lowered. */
    architecture: string;
    /** Operand grammar version the instruction was parsed with. */
    grammarVersion: string;
    /** Mnemonic and grammar-parsed operands; operand values are not yet evaluated. */
    instruction: import("../ir/resolved-instruction.js").ParsedInstruction;
    /** Front-end command the instruction was parsed from. */
    command: NormalizedCommand;
    /** Source occurrence used for diagnostics and source maps. */
    source: NormalizedCommand["source"];
    /** Operands resolved against the current stage, when already computed. */
    resolved?: import("../ir/resolved-instruction.js").ResolvedInstruction;
    /** Rebuilt on every lowering; never shared with the immutable syntax cache. */
    prepared?: import("../ir/resolved-instruction.js").ResolvedInstruction;
};
/** Front-end command lowered to plugin directive syntax or a typed instruction. */
export type LoweredCommand = LoweredPluginSyntax | LoweredTypedInstruction;
/** Ordered declarations carry parsed payloads, never a generic dispatch request. */
export type LoweredOperation = {
    /** Discriminant for parsed command operations. */
    kind: "operation";
    /** Parsed operation payload executed in source order. */
    operation: CommandOperation;
    /** Front-end command the operation was parsed from. */
    command: NormalizedCommand;
    /** Source occurrence used for diagnostics and source maps. */
    source: NormalizedCommand["source"];
};
/** Declaration (function, character, data-struct row or struct field) executed in source order. */
export type LoweredDeclaration = {
    /** Discriminant for declarations. */
    kind: "declaration";
    /** Parsed declaration payload. */
    declaration: DeclarationNode;
    /** Front-end command the declaration was parsed from. */
    command: NormalizedCommand;
    /** Source occurrence used for diagnostics and source maps. */
    source: NormalizedCommand["source"];
};
/** Deferred macro placeholders bind generated source at their selected loop occurrence. */
export type LoweredSourceTemplate = {
    /** Discriminant for source templates that still contain macro placeholders. */
    kind: "sourceTemplate";
    /** Front-end command whose text is expanded at execution time. */
    command: NormalizedCommand;
    /** Source occurrence used for diagnostics and source maps. */
    source: NormalizedCommand["source"];
};
/** A bare call is resolved against declarations in order, before selecting an instruction. */
export type LoweredBareInvocation = {
    /** Discriminant for bare macro invocations. */
    kind: "bareInvocation";
    /** Macro call parsed from the bare invocation. */
    invocation: Extract<CommandOperation, {
        kind: "macroCall";
    }>;
    /** Front-end command the invocation was parsed from. */
    command: NormalizedCommand;
    /** Source occurrence used for diagnostics and source maps. */
    source: NormalizedCommand["source"];
};
/** `for` or `while` loop whose body is lowered once and re-executed per iteration. */
export type LoweredLoopNode = Omit<LoopNode, "type" | "header" | "commands"> & {
    kind: "loop";
    loopType: LoopNode["type"];
    header?: NormalizedCommand;
    commands: LoweredExecutableNode[];
};
/** One `if`/`elseif`/`else` branch with its lowered body. */
export type LoweredConditionalBranch = Omit<ConditionalBranch, "header" | "commands"> & {
    header?: NormalizedCommand;
    commands: LoweredExecutableNode[];
};
/** `if` chain whose branches are lowered once and selected at execution time. */
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
/** Any node in a lowered execution tree. */
export type LoweredExecutableNode = LoweredCaptureNode | LoweredCommand | LoweredStatement | LoweredOperation | LoweredDeclaration | LoweredSourceTemplate | LoweredBareInvocation | LoweredLoopNode | LoweredConditionalNode;
/** Lowered execution tree for one program model; owned by the stage that built it. */
export type LoweredProgram = {
    /** File the program was read from. */
    sourceFile: string;
    /** Zero-based line offset of the program within its source file. */
    startLine: number;
    /** Top-level lowered nodes in source order. */
    nodes: LoweredExecutableNode[];
};
/** Assembler services consulted while lowering commands. */
export type CommandLoweringHost = {
    /** Dialect flags that change how labels and bare names are lowered. */
    syntaxProfile: {
        readonly bareMacroInvocations?: boolean;
        readonly leadingDotLabels?: boolean;
    };
    /** Directive lookup; keywords it owns are lowered as directive syntax instead of instructions. */
    directiveRegistry: {
        has(keyword: string): boolean;
        lookup?: DirectiveRegistry["lookup"];
        parseSyntax?(command: NormalizedCommand): ContributionSyntax | undefined;
    };
    /** Returns the active architecture; `definition` is undefined when it is not registered. */
    resolveActiveArchitecture(): {
        name: string;
        definition?: ArchitectureDefinition;
    };
    /** Maps a directive keyword or alias to its canonical registry keyword. */
    canonicalizeDirectiveKeyword(keyword: string): string;
    /** Optional hook that precomputes `node.prepared` for a typed instruction. */
    prepareTypedInstruction?(node: LoweredTypedInstruction): void;
};
/**
 * Lowers stable front-end commands into directive or instruction work units used
 * by later layout and emission stages.
 */
export declare class CommandLoweringService {
    /** Assembler callbacks for directive lookup, keyword canonicalization and architecture selection. */
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
     * @param command The normalized command node.
     * @returns The lowered execution work unit.
     */
    lowerCommand(command: NormalizedCommand): LoweredCommand;
    /**
     * Lowers an executable tree node into a durable execution-layer node.
     * Commands retain their immutable front-end snapshots. Legacy preprocessing
     * creates its mutable execution copy at dispatch time, avoiding a redundant
     * clone for every stage-owned lowered node.
     * @param node The node to lower.
     * @returns The lowered node.
     */
    lowerExecutableNode(node: ExecutableNode, scope?: "struct"): LoweredExecutableNode;
    /**
     * Lowers a full program model into a stage-owned execution program.
     * @param program The program to lower.
     * @returns The lowered program.
     */
    lowerProgram(program: ProgramModel): LoweredProgram;
}
//# sourceMappingURL=command-lowering-service.d.ts.map