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
/** One frame on the macro control-flow stack tracking active branches and loops. */
export type MacroExpansionControlEntry = {
    /** Control construct represented by this stack frame. */
    type: "if" | "while" | "for";
    /** Whether commands on this frame should execute in the current expansion path. */
    active: boolean;
    /** For if frames, records whether a true branch already executed. */
    branchTaken?: boolean;
};
/** Assembler surface required to define, invoke, and expand macros. */
export interface MacroEngineHost {
    /** Current source file path during macro capture or expansion. */
    currentFile: string;
    /** Logical address active while macro lines execute. */
    currentTargetAddress: number;
    /** Define name to expansion text map for macro parameter binding. */
    defines: Map<string, string>;
    /** Label table consulted when macro lines resolve symbols. */
    labelTable: Map<string, LabelEntry>;
    /** Name of the macro currently being expanded, if any. */
    currentMacroName: string;
    /** Variadic argument count for the active macro invocation. */
    currentVariadicCount: number | undefined;
    /** Variadic argument strings for the active macro invocation. */
    currentVariadicArgs: string[];
    /** Math evaluator used for macro control-flow conditions. */
    mathCore: MathCore;
    /** Captured macro definitions keyed by qualified name. */
    macros: Map<string, MacroDefinition>;
    /** Monotonic instance id assigned to macro-local labels. */
    macroLabelInstance: number;
    /** Whether the assembler is inside a macro expansion pass. */
    inMacroExpansion: boolean;
    /** Innermost parent label used for cheap-local and sublabel resolution. */
    currentParentLabel: string;
    /** Whether the current parent label is a global root label. */
    currentParentIsGlobal: boolean;
    /** Whether the pass collects definitions without emitting bytes. */
    isDefinitionCollectionStage: boolean;
    /** Active syntax profile controlling macro argument parsing. */
    syntaxProfile: SyntaxProfile;
    /** Symbol scope service shared with the hosting assembler. */
    symbolScope: SymbolScopeService;
    /** Evaluate a boolean expression for macro if/while conditions. */
    evaluateExpression(input: string): boolean;
    /** Expand define references in macro text before dispatch. */
    resolvedefines(input: string): string;
    /** Optional hook to rewrite define fragments during macro binding. */
    resolveDefineFragment?(fragment: SourceFragment): SourceFragment;
    /** Dispatch one normalized command line during macro expansion. */
    processCommand(command: string, preprocessed?: boolean, template?: NormalizedCommand): void;
    /** Core hosts accept attributed fragments; older hosts use the explicit public adapter. */
    processSourceFragment(fragment: SourceFragment, preprocessed?: boolean, template?: NormalizedCommand): void;
    /** Optional for older hosts; scopes provenance without changing expansion semantics. */
    withSourceOrigin?(origin: SourceOrigin, execute: () => void): void;
    /** Apply a define assignment line encountered inside a macro body. */
    applyDefineAssignment(command: string): boolean;
    /** Record a macro symbol definition for analysis and cross-reference indexing. */
    recordSymbolDefinition(kind: "macro", name: string, options?: {
        value?: number | string;
        file?: string;
        line?: number;
    }): void;
}
/** Expands macro invocations and tracks nested macro control flow. */
export declare class MacroEngine {
    /** Hosting assembler state mutated during macro capture and expansion. */
    host: MacroEngineHost;
    /** Stack of active if/while/for frames during expansion. */
    macroExpansionControlStack: MacroExpansionControlEntry[];
    /** Weak ownership releases definitions when an assembly snapshot is discarded. */
    private readonly templates;
    constructor(host: MacroEngineHost);
    /**
     * Checks whether the current macro expansion line is in an active branch.
     * @returns `true` when the current expansion path is active.
     */
    isMacroExpansionActive(): boolean;
    /**
     * Checks whether the current macro expansion line is inside a deferred loop body.
     * @returns `true` when loop-body commands should defer placeholder resolution.
     */
    isMacroExpansionLoopActive(): boolean;
    /**
     * Evaluates a macro control-flow condition using the assembler expression engine.
     * @param expression The expression text to evaluate.
     * @returns The boolean result.
     */
    evaluateMacroControlExpression(expression: string): boolean;
    /**
     * Updates macro expansion control state after dispatching a control-flow line.
     * @param line The fully expanded line text.
     */
    updateMacroExpansionControlState(line: string): void;
    /** Install a captured declaration without executing or lowering its template body. */
    installDefinition(header: Extract<CommandOperation, {
        kind: "macroHeader";
    }>, body: NormalizedCommand[], source: CommandProvenance): void;
    /**
     * Calls a macro.
     * @param invocation The invocation to call.
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
     * @param line The line to expand.
     * @param fixedArgs The fixed arguments.
     * @param variadicArgs The variadic arguments.
     * @param variadicCount The variadic count.
     * @returns The expanded line.
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
     * @param line The line to process.
     */
    processMacroLine(line: string, template?: NormalizedCommand): void;
    /** Dispatch attributed fragments, never an anonymous command string, after active-branch selection. */
    processMacroFragment(fragment: SourceFragment, template?: NormalizedCommand): void;
}
//# sourceMappingURL=macro-engine.d.ts.map