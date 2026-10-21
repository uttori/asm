import { type CommandOperation } from "../ir/command-operation.js";
import { type MacroLineTemplate } from "../ir/macro-template.js";
import { type CommandProvenance, type NormalizedCommand } from "../ir/normalized-command.js";
import { type SourceFragment } from "../ir/source-fragment.js";
import type { MathCore } from "../mathcore.js";
import type { MacroArgumentOrigin, SourceOrigin } from "../source-provenance.js";
import type { SyntaxProfile } from "../syntax-profile.js";
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
    /** Header occurrence, including the include chain in which this definition was captured. */
    source?: CommandProvenance;
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
    currentMacroName: string;
    currentVariadicCount: number | undefined;
    currentVariadicArgs: string[];
    mathCore: MathCore;
    macros: Map<string, MacroDefinition>;
    macroLabelInstance: number;
    inMacroExpansion: boolean;
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    isDefinitionCollectionStage: boolean;
    syntaxProfile: SyntaxProfile;
    symbolScope: SymbolScopeService;
    evaluateExpression(input: string): boolean;
    resolvedefines(input: string): string;
    resolveDefineFragment?(fragment: SourceFragment): SourceFragment;
    processCommand(command: string, preprocessed?: boolean, template?: NormalizedCommand): void;
    /** Core hosts accept attributed fragments; older hosts use the explicit public adapter. */
    processSourceFragment(fragment: SourceFragment, preprocessed?: boolean, template?: NormalizedCommand): void;
    /** Optional for older hosts; scopes provenance without changing expansion semantics. */
    withSourceOrigin?(origin: SourceOrigin, execute: () => void): void;
    applyDefineAssignment(command: string): boolean;
    recordSymbolDefinition(kind: "macro", name: string, options?: {
        value?: number | string;
        file?: string;
        line?: number;
    }): void;
}
export declare class MacroEngine {
    host: MacroEngineHost;
    macroExpansionControlStack: MacroExpansionControlEntry[];
    /** Weak ownership releases definitions when an assembly snapshot is discarded. */
    private readonly templates;
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
    /** Install a captured declaration without executing or lowering its template body. */
    installDefinition(header: Extract<CommandOperation, {
        kind: "macroHeader";
    }>, body: NormalizedCommand[], source: CommandProvenance): void;
    /**
     * Calls a macro.
     * @param {string} invocation The invocation to call.
     */
    callMacro(invocation: string, source?: CommandProvenance): void;
    /** Bind parsed arguments once; the invocation owns all mutable expansion state. */
    executeInvocation(operation: Extract<CommandOperation, {
        kind: "macroCall";
    }>, source?: CommandProvenance): void;
    /** Expand one template at a time so define writes and active branches affect the next line. */
    private executeMacroBody;
    /**
     * Expands a macro line.
     * @param {string} line The line to expand.
     * @param {Map<string, string>} fixedArgs The fixed arguments.
     * @param {string[]} variadicArgs The variadic arguments.
     * @param {number} variadicCount The variadic count.
     * @returns {string} The expanded line.
     */
    expandMacroLine(line: string, fixedArgs: Map<string, string>, variadicArgs: string[], variadicCount: number, template?: MacroLineTemplate): string;
    /** Bind one macro occurrence in phase order while retaining each argument's physical source. */
    expandMacroFragment(line: SourceFragment, fixedArgs: Map<string, string>, variadicArgs: string[], variadicCount: number, template?: MacroLineTemplate, argumentsOrigin?: readonly MacroArgumentOrigin[]): SourceFragment;
    /** One numeric/index contract for eager expansion and loop-time rebinding. */
    /** Return the selected index with its value so provenance never requires evaluating an index twice. */
    private resolveVariadicBinding;
    /** Public string adapter for the ordered fragment binder. */
    resolveVariadicPlaceholders(command: string): string;
    /** Loop iterations bind count before indexes, after the loop variable/define state is refreshed. */
    resolveVariadicFragment(fragment: SourceFragment, argumentsOrigin?: readonly MacroArgumentOrigin[]): SourceFragment;
    /**
     * Processes a macro line.
     * @param {string} line The line to process.
     */
    processMacroLine(line: string, template?: NormalizedCommand): void;
    /** Dispatch attributed fragments, never an anonymous command string, after active-branch selection. */
    processMacroFragment(fragment: SourceFragment, template?: NormalizedCommand): void;
}
//# sourceMappingURL=macro-engine.d.ts.map