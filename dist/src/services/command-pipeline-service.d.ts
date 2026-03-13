export type CommandPipelineState = {
    command: string;
    words: string[];
    keyword: string;
};
export type CommandPipelineHost = {
    splitCommandIntoWords(command: string): string[];
    handleCharacterMapping(words: string[]): void;
    recordCurrentAddress(): void;
};
export type FrontEndHandlers = {
    continueFunctionDefinition(command: string): boolean;
    startFunctionDefinition(keyword: string, words: string[]): boolean;
    handleRelativeLabelDefinition(keyword: string): boolean;
    handleGlobalLabel(words: string[]): boolean;
    consumeNamedLabelDefinitions(words: string[], keyword: string): string[];
    handleStaticLabelAssignment(words: string[], keyword: string): boolean;
};
export type MacroHandlers = {
    rewriteMacroLabelReferences(command: string): string;
    handleDefinitionCommand(command: string, keyword: string, words: string[]): boolean;
};
export type DefineHandlers = {
    handleCommand(command: string): boolean;
};
export type StructHandlers = {
    handleStructMode(words: string[]): boolean;
};
export type PreDispatchHandlers = {
    interceptRawCommand(command: string): boolean;
    normalizeCommand(command: string): string;
    shouldSkipForCondition(keyword: string): boolean;
    shouldSkipForInlineCondition(keyword: string): boolean;
    resolveElseIfWords(keyword: string, command: string, words: string[]): string[];
};
export type PreprocessResult = "continue" | "handled" | "skipped_for_condition";
export declare class CommandPipelineService {
    private readonly host;
    private readonly frontEndHandlers;
    private readonly macroHandlers;
    private readonly defineHandlers;
    private readonly structHandlers;
    private readonly preDispatchHandlers;
    constructor(host: CommandPipelineHost, frontEndHandlers: FrontEndHandlers, macroHandlers: MacroHandlers, defineHandlers: DefineHandlers, structHandlers: StructHandlers, preDispatchHandlers: PreDispatchHandlers);
    rewriteRawCommand(command: string): string;
    interceptRawCommand(command: string): boolean;
    create(command: string): CommandPipelineState | null;
    preprocess(state: CommandPipelineState): PreprocessResult;
    prepareForDispatch(state: CommandPipelineState): boolean;
}
//# sourceMappingURL=command-pipeline-service.d.ts.map