export type ConditionalEntry = {
    cond: boolean;
};
export type LoopBlock = {
    type: "for" | "while";
    commands: (string | LoopBlock)[];
};
export type PreDispatchPipelineHost = {
    collectingLoop: boolean;
    currentLoop: LoopBlock | null;
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
};
export declare class PreDispatchPipelineService {
    private readonly host;
    private readonly conditionDirectives;
    constructor(host: PreDispatchPipelineHost);
    interceptRawCommand(command: string): boolean;
    normalizeCommand(command: string): string;
    shouldSkipForCondition(keyword: string): boolean;
    shouldSkipForInlineCondition(keyword: string): boolean;
    resolveElseIfWords(keyword: string, command: string, words: string[]): string[];
}
//# sourceMappingURL=pre-dispatch-pipeline-service.d.ts.map