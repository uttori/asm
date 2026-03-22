import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { ExpressionNode } from "../ir/expression-node.js";
export type ConditionalEntry = {
    cond: boolean;
};
export type PreDispatchPipelineHost = {
    collectingLoop: boolean;
    currentLoop: {
        type: "for" | "while";
        conditionNode?: ExpressionNode;
        commands: unknown[];
    } | null;
    inMacroDefinition: boolean;
    inMacroExpansion: boolean;
    pass: number;
    condStack: ConditionalEntry[];
    moreonlinecond: boolean;
    numtrue: number;
    numif: number;
    handleEndIf(): void;
    handleFor(args: string[]): void;
    handleWhile(args: string[]): void;
    handleEndFor(): void;
    handleEndWhile(): void;
    resolveVariadicPlaceholders(command: string): string;
    resolvedefines(input: string): string;
    loadTestRomData(): void;
    currentFile: string;
    currentLine: number;
};
export declare class PreDispatchPipelineService {
    readonly host: PreDispatchPipelineHost;
    readonly conditionDirectives: Set<string>;
    constructor(host: PreDispatchPipelineHost);
    /**
     * Intercepts a raw command.
     * @param {string} command The command to intercept.
     * @returns {boolean} `true` if the command was intercepted, `false` otherwise.
     */
    interceptRawCommand(command: string): boolean;
    /**
     * Normalizes a command.
     * @param {string} command The command to normalize.
     * @returns {string} The normalized command.
     */
    normalizeCommand(command: string): string;
    /**
     * Checks if a command should be skipped for condition.
     * @param {NormalizedCommand} command The command to check.
     * @returns {boolean} `true` if the command should be skipped for condition, `false` otherwise.
     */
    shouldSkipForCondition(command: NormalizedCommand): boolean;
    /**
     * Checks if a command should be skipped for inline condition.
     * @param {NormalizedCommand} command The command to check.
     * @returns {boolean} `true` if the command should be skipped for inline condition, `false` otherwise.
     */
    shouldSkipForInlineCondition(command: NormalizedCommand): boolean;
    /**
     * Resolves an else if command.
     * @param {NormalizedCommand} command The command to resolve.
     */
    resolveElseIf(command: NormalizedCommand): void;
    /**
     * Parses a condition node.
     * @param {NormalizedCommand} command The command to parse.
     * @returns {ExpressionNode | undefined} The parsed condition node.
     */
    parseConditionNode(command: NormalizedCommand): ExpressionNode | undefined;
}
//# sourceMappingURL=pre-dispatch-pipeline-service.d.ts.map