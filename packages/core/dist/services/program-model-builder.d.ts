import type { CaptureNode, ConditionalBranch, ConditionalBranchNode, ExecutableNode, LoopNode } from "../ir/assembly-tree.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { SourcedCommand } from "./command-text-service.js";
/** Parsed executable tree for one source file or include block. */
export type ProgramModel = {
    /** Absolute path of the file that owns the model. */
    sourceFile: string;
    /** One-based line where parsing began for incremental models. */
    startLine: number;
    /** Top-level executable nodes in source order. */
    nodes: ExecutableNode[];
    /** Original input, including comments/continuations; syntax never stores bound values. */
    sourceText?: string;
    /** Optional grammar identity string when the host tracks profile revisions. */
    grammarIdentity?: string;
};
/** Include subtree embedding parsed commands from one resolved file. */
export type IncludeProgramNode = {
    /** Discriminator marking an include-shaped program fragment. */
    type: "include";
    /** Resolved absolute path of the included file. */
    file: string;
    /** Executable nodes parsed from the included file body. */
    commands: ExecutableNode[];
};
/** Mutable parser stacks while incrementally extending a program model. */
export type IncrementalProgramParseState = {
    /** Completed or in-progress root nodes awaiting closure checks. */
    roots: ExecutableNode[];
    /** Active loop frames opened but not yet closed. */
    loopStack: LoopNode[];
    /** Active conditional branch frames for if/elseif parsing. */
    ifStack: ConditionalBranchNode[];
    /** Flattened branch stack mirroring nested if structure. */
    branchStack: ConditionalBranch[];
    /** Capture frames own parser routing; values and execution bindings remain outside the AST. */
    captures: {
        node: CaptureNode;
        loopDepth: number;
        branchDepth: number;
    }[];
};
/** Host callbacks supplying preprocessing and loop-node construction during parsing. */
export type ProgramModelBuilderHost = {
    /** Current file path used for sourced command attribution. */
    currentFile: string;
    /** Current one-based line used when synthesizing nodes. */
    currentLine: number;
    /** Per-pass cache of parsed executable trees keyed by source identity. */
    passProgramCache: Map<string, ExecutableNode[]>;
    /** Optional grammar identity for cache keys and trace attribution. */
    grammarIdentity?(): string;
    /** Raw-source hits may skip preprocessing only when no incremental statement is buffered. */
    sourceBufferEmpty?(): boolean;
    /** Split and preprocess a block of raw source into command strings. */
    preprocessBlockCommands(source: string): string[];
    /** Split inline command chains after block preprocessing. */
    splitInlineCommands(commands: string[]): string[];
    /** Preprocess a block while retaining per-line source provenance. */
    preprocessSourcedBlockCommands(source: string): SourcedCommand[];
    /** Split inline chains on sourced command records. */
    splitSourcedInlineCommands(commands: SourcedCommand[]): SourcedCommand[];
    /** Build a normalized loop header command node with optional physical text. */
    createLoopCommandNode(command: string, sourceFile?: string, sourceLine?: number, physical?: string): NormalizedCommand;
    /** Decide whether endif closes the innermost while/for instead of the active if. */
    shouldEndifCloseInnermostWhile(loopType?: "for" | "while", loopStartLine?: number, ifStartLine?: number): boolean;
};
/**
 * Builds reusable program models from command streams.
 */
export declare class ProgramModelBuilder {
    readonly host: ProgramModelBuilderHost;
    private readonly identities;
    private nextProgramId;
    /** Release the lookup index together with the public program values at snapshot end/disposal. */
    clearCache(): void;
    constructor(host: ProgramModelBuilderHost);
    /**
     * Creates an incremental parser state for line-by-line assembly.
     * @returns The parser state.
     */
    createIncrementalParseState(): IncrementalProgramParseState;
    /**
     * Resets an incremental parser state in place.
     * @param state The parser state.
     */
    resetIncrementalParseState(state: IncrementalProgramParseState): void;
    /**
     * Builds a program model from raw source text.
     * @param source The source block to parse.
     * @param [sourceFile] Optional source file override.
     * @param [startLine] Optional starting line number.
     * @returns The parsed program model.
     */
    buildProgramModel(source: string, sourceFile?: string, startLine?: number, sourceKind?: "physical" | "generated"): ProgramModel;
    /**
     * Creates a typed include node from a source file body.
     * @param file The include file name.
     * @param source The include source content.
     * @returns The include node.
     */
    createIncludeNode(file: string, source: string): IncludeProgramNode;
    /**
     * Returns cached executable nodes for a command stream.
     * @param commands The command stream.
     * @param [sourceFile] Optional source file override.
     * @param [startLine] Optional starting line number.
     * @returns The cached or parsed nodes.
     */
    getOrBuildPassProgram(commands: Array<string | SourcedCommand>, sourceFile?: string, startLine?: number, sourceKind?: "physical" | "generated"): ExecutableNode[];
    /** Index text separately from short public cache identities; never retain a second joined source copy. */
    private getOrBuildCachedProgram;
    /**
     * Consumes one raw command into an incremental parse state and returns newly
     * completed top-level executable nodes.
     * @param state The parser state.
     * @param rawCommand The raw command to consume.
     * @param [sourceFile] Optional source file override.
     * @param [sourceLine] Optional source line override.
     * @returns Newly completed top-level nodes.
     */
    consumeIncrementalCommand(state: IncrementalProgramParseState, rawCommand: string, sourceFile?: string, sourceLine?: number, normalized?: NormalizedCommand): ExecutableNode[];
    /**
     * Parses a flat command stream into nested executable nodes.
     * @param commands The command stream.
     * @param [sourceFile] Optional source file override.
     * @param [startLine] Optional starting line number.
     * @returns The executable nodes.
     */
    parseCommandStreamToNodes(commands: Array<string | SourcedCommand>, sourceFile?: string, startLine?: number, sourceKind?: "physical" | "generated"): ExecutableNode[];
    /**
     * Pushes to current.
     * @param state The state.
     * @param node The node.
     */
    pushToCurrent(state: IncrementalProgramParseState, node: ExecutableNode): void;
    /**
     * Consumes command into state.
     * @param state The state.
     * @param rawCommand The raw command.
     * @param sourceFile The source file.
     * @param sourceLine The source line.
     */
    consumeCommandIntoState(state: IncrementalProgramParseState, rawCommand: string, sourceFile: string, sourceLine: number, normalized?: NormalizedCommand): void;
    /** Reports whether an executable node has enough metadata to leave the incremental buffer. */
    isNodeComplete(node: ExecutableNode): boolean;
    /** Moves fully closed root nodes out of the incremental parse state. */
    drainCompletedRoots(state: IncrementalProgramParseState): ExecutableNode[];
}
//# sourceMappingURL=program-model-builder.d.ts.map