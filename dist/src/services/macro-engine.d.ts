import type { MacroDefinition } from "../assembler.js";
export type MacroLabelEntry = {
    value: number;
    isStatic: boolean;
    isMacroLabel?: boolean;
    macroInstance?: number;
    modifiesHierarchy?: boolean;
};
export type MacroConditionalEntry = {
    cond: boolean;
};
export interface MacroEngineHost {
    pass: number;
    currentFile: string;
    snespos: number;
    collectingLoop: boolean;
    condStack: MacroConditionalEntry[];
    defines: Map<string, string>;
    labelTable: Map<string, MacroLabelEntry>;
    inMacroDefinition: boolean;
    currentMacroName: string;
    currentMacroParams: string[];
    currentMacroBody: string[];
    currentVariadicCount: number | undefined;
    currentVariadicArgs: string[];
    macros: Map<string, MacroDefinition>;
    macroLabelInstance: number;
    inMacroExpansion: boolean;
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    resolvedefines(input: string): string;
    processNestedCommand(command: string): void;
    setLabel(label: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;
    handleRelativeLabel(label: string): number;
    getLabelValue(label: string, requireStatic: boolean): number;
    findNextLabel(label: string, currentAddressOverride?: number): number;
    findPreviousLabel(label: string, currentAddressOverride?: number): number;
    evaluateMath(input: string): number;
}
export declare class MacroEngine {
    private readonly host;
    constructor(host: MacroEngineHost);
    handleDefinitionCommand(command: string, keyword: string, words: string[]): boolean;
    rewriteMacroLabelReferences(command: string): string;
    callMacro(invocation: string): void;
    expandMacroLine(line: string, fixedArgs: Map<string, string>, variadicArgs: string[], variadicCount: number): string;
    resolveVariadicPlaceholders(command: string): string;
    processMacroLine(line: string): void;
}
//# sourceMappingURL=macro-engine.d.ts.map