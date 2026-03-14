import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { LoopNode } from "../ir/assembly-tree.js";
export type ConditionalEntry = {
    cond: boolean;
};
export type PreDispatchPipelineHost = {
    collectingLoop: boolean;
    currentLoop: LoopNode | null;
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
    removeInlineComment(line: string): string;
    splitCommandIntoWords(command: string): string[];
    resolveVariadicPlaceholders(command: string): string;
    resolvedefines(input: string): string;
    loadTestRomData(): void;
    currentFile: string;
    currentLine: number;
};
export declare class PreDispatchPipelineService {
    private readonly host;
    private readonly conditionDirectives;
    constructor(host: PreDispatchPipelineHost);
    interceptRawCommand(command: string): boolean;
    normalizeCommand(command: string): string;
    shouldSkipForCondition(command: NormalizedCommand): boolean;
    shouldSkipForInlineCondition(command: NormalizedCommand): boolean;
    resolveElseIf(command: NormalizedCommand): void;
    parseConditionNode(command: NormalizedCommand): import("../ir/expression-node.js").ExpressionNode;
}
//# sourceMappingURL=pre-dispatch-pipeline-service.d.ts.map