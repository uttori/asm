import type { MathCore } from "../mathcore.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { LabelEntry, SymbolScopeService } from "./symbol-scope-service.js";
/** Represents a macro definition. */
export type MacroDefinition = {
    /** The name of the macro. */
    name: string;
    /** Fixed parameter names. */
    params: string[];
    /** Whether the macro has a variable number of parameters. */
    variadic: boolean;
    /** Typed commands captured inside the macro body. */
    body: NormalizedCommand[];
    /** The file where this macro was defined. */
    sourceFile?: string;
};
export type MacroExpansionControlEntry = {
    type: "if" | "while" | "for";
    active: boolean;
    branchTaken?: boolean;
};
export interface MacroEngineHost {
    currentFile: string;
    currentTargetAddress: number;
    defines: Map<string, string>;
    labelTable: Map<string, LabelEntry>;
    inMacroDefinition: boolean;
    currentMacroName: string;
    currentMacroParams: string[];
    currentMacroBody: NormalizedCommand[];
    currentVariadicCount: number | undefined;
    currentVariadicArgs: string[];
    mathCore: MathCore;
    macros: Map<string, MacroDefinition>;
    macroLabelInstance: number;
    inMacroExpansion: boolean;
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    isDefinitionCollectionStage: boolean;
    symbolScope: SymbolScopeService;
    evaluateExpression(input: string): boolean;
    resolvedefines(input: string): string;
    processCommand(command: string): void;
    applyDefineAssignment(command: string): boolean;
    recordSymbolDefinition(kind: "macro", name: string, options?: {
        value?: number | string;
    }): void;
}
export declare class MacroEngine {
    host: MacroEngineHost;
    macroExpansionControlStack: MacroExpansionControlEntry[];
    pendingMacroSourceFile: string;
    constructor(host: MacroEngineHost);
    /**
     * Checks whether the current macro expansion line is in an active branch.
     * @returns {boolean} `true` when the current expansion path is active.
     */
    isMacroExpansionActive(): boolean;
    /**
     * Checks whether the current macro expansion line is inside a deferred loop body.
     * @returns {boolean} `true` when loop-body commands should defer placeholder resolution.
     */
    isMacroExpansionLoopActive(): boolean;
    /**
     * Evaluates a macro control-flow condition using the assembler expression engine.
     * @param {string} expression The expression text to evaluate.
     * @returns {boolean} The boolean result.
     */
    evaluateMacroControlExpression(expression: string): boolean;
    /**
     * Updates macro expansion control state after dispatching a control-flow line.
     * @param {string} line The fully expanded line text.
     */
    updateMacroExpansionControlState(line: string): void;
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