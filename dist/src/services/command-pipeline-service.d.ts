import { type NormalizedCommand } from "../ir/normalized-command.js";
export type CommandPipelineHost = {
    splitCommandIntoWords(command: string): string[];
    currentFile: string;
    currentLine: number;
    handleCharacterMapping(command: NormalizedCommand): void;
    recordCurrentAddress(): void;
};
export type FrontEndHandlers = {
    continueFunctionDefinition(command: string): boolean;
    startFunctionDefinition(command: NormalizedCommand): boolean;
    handleRelativeLabelDefinition(command: NormalizedCommand): boolean;
    handleGlobalLabel(command: NormalizedCommand): boolean;
    consumeNamedLabelDefinitions(command: NormalizedCommand): boolean;
    handleStaticLabelAssignment(command: NormalizedCommand): boolean;
};
export type MacroHandlers = {
    rewriteMacroLabelReferences(command: string): string;
    handleDefinitionCommand(command: NormalizedCommand): boolean;
};
export type DefineHandlers = {
    handleCommand(command: NormalizedCommand): boolean;
};
export type StructHandlers = {
    handleStructMode(command: NormalizedCommand): boolean;
};
export type PreDispatchHandlers = {
    interceptRawCommand(command: string): boolean;
    normalizeCommand(command: string): string;
    shouldSkipForCondition(command: NormalizedCommand): boolean;
    shouldSkipForInlineCondition(command: NormalizedCommand): boolean;
    resolveElseIf(command: NormalizedCommand): void;
};
export type PreprocessResult = "continue" | "handled" | "skipped_for_condition";
export declare class CommandPipelineService {
    readonly host: CommandPipelineHost;
    readonly frontEndHandlers: FrontEndHandlers;
    readonly macroHandlers: MacroHandlers;
    readonly defineHandlers: DefineHandlers;
    readonly structHandlers: StructHandlers;
    readonly preDispatchHandlers: PreDispatchHandlers;
    constructor(host: CommandPipelineHost, frontEndHandlers: FrontEndHandlers, macroHandlers: MacroHandlers, defineHandlers: DefineHandlers, structHandlers: StructHandlers, preDispatchHandlers: PreDispatchHandlers);
    rewriteRawCommand(command: string): string;
    interceptRawCommand(command: string): boolean;
    create(command: string): NormalizedCommand | null;
    preprocess(state: NormalizedCommand): PreprocessResult;
    prepareForDispatch(state: NormalizedCommand): boolean;
}
//# sourceMappingURL=command-pipeline-service.d.ts.map