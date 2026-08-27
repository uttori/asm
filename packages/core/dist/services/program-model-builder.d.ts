import type { ConditionalBranch, ConditionalBranchNode, ExecutableNode, LoopNode } from "../ir/assembly-tree.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { SourcedCommand } from "./command-text-service.js";
export type ProgramModel = {
    sourceFile: string;
    startLine: number;
    nodes: ExecutableNode[];
};
export type IncludeProgramNode = {
    type: "include";
    file: string;
    commands: ExecutableNode[];
};
export type IncrementalProgramParseState = {
    roots: ExecutableNode[];
    loopStack: LoopNode[];
    ifStack: ConditionalBranchNode[];
    branchStack: ConditionalBranch[];
    inMacroDefinition: boolean;
    inFunctionDefinition: boolean;
};
export type ProgramModelBuilderHost = {
    currentFile: string;
    currentLine: number;
    passProgramCache: Map<string, ExecutableNode[]>;
    preprocessBlockCommands(source: string): string[];
    splitInlineCommands(commands: string[]): string[];
    preprocessSourcedBlockCommands(source: string): SourcedCommand[];
    splitSourcedInlineCommands(commands: SourcedCommand[]): SourcedCommand[];
    createLoopCommandNode(command: string, sourceFile?: string, sourceLine?: number): NormalizedCommand;
    shouldEndifCloseInnermostWhile(loopType?: "for" | "while", loopStartLine?: number, ifStartLine?: number): boolean;
};
/**
 * Builds reusable program models from command streams.
 */
export declare class ProgramModelBuilder {
    readonly host: ProgramModelBuilderHost;
    constructor(host: ProgramModelBuilderHost);
    /**
     * Creates an incremental parser state for line-by-line assembly.
     * @returns {IncrementalProgramParseState} The parser state.
     */
    createIncrementalParseState(): IncrementalProgramParseState;
    /**
     * Resets an incremental parser state in place.
     * @param {IncrementalProgramParseState} state The parser state.
     */
    resetIncrementalParseState(state: IncrementalProgramParseState): void;
    /**
     * Builds a program model from raw source text.
     * @param {string} source The source block to parse.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [startLine] Optional starting line number.
     * @returns {ProgramModel} The parsed program model.
     */
    buildProgramModel(source: string, sourceFile?: string, startLine?: number): ProgramModel;
    /**
     * Creates a typed include node from a source file body.
     * @param {string} file The include file name.
     * @param {string} source The include source content.
     * @returns {IncludeProgramNode} The include node.
     */
    createIncludeNode(file: string, source: string): IncludeProgramNode;
    /**
     * Returns cached executable nodes for a command stream.
     * @param {Array<string | SourcedCommand>} commands The command stream.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [startLine] Optional starting line number.
     * @returns {ExecutableNode[]} The cached or parsed nodes.
     */
    getOrBuildPassProgram(commands: Array<string | SourcedCommand>, sourceFile?: string, startLine?: number): ExecutableNode[];
    /**
     * Consumes one raw command into an incremental parse state and returns newly
     * completed top-level executable nodes.
     * @param {IncrementalProgramParseState} state The parser state.
     * @param {string} rawCommand The raw command to consume.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [sourceLine] Optional source line override.
     * @returns {ExecutableNode[]} Newly completed top-level nodes.
     */
    consumeIncrementalCommand(state: IncrementalProgramParseState, rawCommand: string, sourceFile?: string, sourceLine?: number): ExecutableNode[];
    /**
     * Parses a flat command stream into nested executable nodes.
     * @param {Array<string | SourcedCommand>} commands The command stream.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [startLine] Optional starting line number.
     * @returns {ExecutableNode[]} The executable nodes.
     */
    parseCommandStreamToNodes(commands: Array<string | SourcedCommand>, sourceFile?: string, startLine?: number): ExecutableNode[];
    /**
     * Pushes to current.
     * @param {IncrementalProgramParseState} state The state.
     * @param {ExecutableNode} node The node.
     */
    pushToCurrent(state: IncrementalProgramParseState, node: ExecutableNode): void;
    /**
     * Consumes command into state.
     * @param {IncrementalProgramParseState} state The state.
     * @param {string} rawCommand The raw command.
     * @param {string} sourceFile The source file.
     * @param {number} sourceLine The source line.
     */
    consumeCommandIntoState(state: IncrementalProgramParseState, rawCommand: string, sourceFile: string, sourceLine: number): void;
    /**
     * Checks whether node complete.
     * @param {ExecutableNode} node The node.
     * @returns {boolean} The result.
     */
    isNodeComplete(node: ExecutableNode): boolean;
    /**
     * Drains completed roots.
     * @param {IncrementalProgramParseState} state The state.
     * @returns {ExecutableNode[]} The result.
     */
    drainCompletedRoots(state: IncrementalProgramParseState): ExecutableNode[];
}
//# sourceMappingURL=program-model-builder.d.ts.map