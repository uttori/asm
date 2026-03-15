import type { MacroDefinition } from "../assembler.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
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
    currentMacroBody: NormalizedCommand[];
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
    readonly host: MacroEngineHost;
    constructor(host: MacroEngineHost);
    /**
     * Handles a macro definition command.
     * @param {NormalizedCommand} commandNode The command node to handle.
     * @returns {boolean} `true` if the command was handled, `false` otherwise.
     */
    handleDefinitionCommand(commandNode: NormalizedCommand): boolean;
    /**
     * Rewrites macro label references.
     * @param {string} command The command to rewrite.
     * @returns {string} The rewritten command.
     */
    rewriteMacroLabelReferences(command: string): string;
    /**
     * Calls a macro.
     * @param {string} invocation The invocation to call.
     */
    callMacro(invocation: string): void;
    /**
     * Expands a macro line.
     * @param {string} line The line to expand.
     * @param {Map<string, string>} fixedArgs The fixed arguments.
     * @param {string[]} variadicArgs The variadic arguments.
     * @param {number} variadicCount The variadic count.
     * @returns {string} The expanded line.
     */
    expandMacroLine(line: string, fixedArgs: Map<string, string>, variadicArgs: string[], variadicCount: number): string;
    /**
     * Resolves variadic placeholders.
     * @param {string} command The command to resolve.
     * @returns {string} The resolved command.
     */
    resolveVariadicPlaceholders(command: string): string;
    /**
     * Processes a macro line.
     * @param {string} line The line to process.
     */
    processMacroLine(line: string): void;
}
//# sourceMappingURL=macro-engine.d.ts.map