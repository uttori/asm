import type { ExecutableNode } from "../ir/assembly-tree.js";
import { ProgramModelBuilder } from "./program-model-builder.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { SyntaxProfile } from "../syntax-profile.js";
export type AssemblyFrontEndHost = {
    currentFile: string;
    currentLine: number;
    passProgramCache: Map<string, ExecutableNode[]>;
    collectSourceMetadata: boolean;
    inMacroExpansion: boolean;
    isDefinitionCollectionStage: boolean;
    syntaxProfile: SyntaxProfile;
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
     * Splits statements according to the active target's source grammar.
     * @param {string[]} commands Commands to split.
     * @returns {string[]} Profile-aware command statements.
     */
    splitInlineCommands(commands: string[]): string[];
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
}
//# sourceMappingURL=assembly-front-end-service.d.ts.map