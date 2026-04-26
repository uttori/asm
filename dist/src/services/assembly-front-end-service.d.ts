import type { ExecutableNode } from "../ir/assembly-tree.js";
import { ProgramModelBuilder, type IncrementalProgramParseState, type ProgramModel } from "./program-model-builder.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
export type AssemblyFrontEndHost = {
    currentFile: string;
    currentLine: number;
    passProgramCache: Map<string, ExecutableNode[]>;
    inMacroExpansion: boolean;
    isDefinitionCollectionStage: boolean;
    resolveVariadicPlaceholders(command: string): string;
    shouldEndifCloseInnermostWhile(loopType?: "for" | "while", loopStartLine?: number, ifStartLine?: number): boolean;
};
/**
 * Owns command buffering, normalization, and typed program-tree construction so
 * the assembler session can focus on execution instead of front-end shaping.
 */
export declare class AssemblyFrontEndService {
    readonly host: AssemblyFrontEndHost;
    commandBuffer: string;
    readonly programModelBuilder: ProgramModelBuilder;
    constructor(host: AssemblyFrontEndHost);
    /**
     * Preprocesses raw source blocks while preserving continued-line buffering.
     * @param {string} block The raw source block.
     * @returns {string[]} The normalized commands.
     */
    preprocessBlockCommands(block: string): string[];
    /**
     * Builds a normalized command from raw source text.
     * @param {string} command The raw command text.
     * @param {string} sourceFile The command source file.
     * @param {number} sourceLine The source line number.
     * @param {boolean} [allowEmpty] When true, empty commands still produce nodes.
     * @returns {NormalizedCommand | null} The normalized command or null for empty input.
     */
    createNormalizedCommandFromRaw(command: string, sourceFile: string, sourceLine: number, allowEmpty?: boolean): NormalizedCommand | null;
    /**
     * Creates a loop-aware normalized command node for the typed parser.
     * @param {string} command The raw command text.
     * @param {string} [sourceFile] Optional source file.
     * @param {number} [sourceLine] Optional source line.
     * @returns {NormalizedCommand} The normalized node.
     */
    createLoopCommandNode(command: string, sourceFile?: string, sourceLine?: number): NormalizedCommand;
    createIncrementalParseState(): IncrementalProgramParseState;
    resetIncrementalParseState(state: IncrementalProgramParseState): void;
    buildProgramModel(source: string, sourceFile?: string, startLine?: number): ProgramModel;
    getOrBuildPassProgram(commands: string[], sourceFile?: string, startLine?: number): ExecutableNode[];
    createIncludeNode(file: string, source: string): import("./program-model-builder.js").IncludeProgramNode;
    consumeIncrementalCommand(state: IncrementalProgramParseState, rawCommand: string, sourceFile?: string, sourceLine?: number): ExecutableNode[];
    drainCompletedRoots(state: IncrementalProgramParseState): ExecutableNode[];
    parseCommandStreamToNodes(commands: string[], sourceFile?: string, startLine?: number): ExecutableNode[];
}
//# sourceMappingURL=assembly-front-end-service.d.ts.map