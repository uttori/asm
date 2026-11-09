import type { NormalizedCommand } from "./normalized-command.js";
import { type SourceFragment } from "./source-fragment.js";
import { type NumericDataStatement } from "./statement-node.js";
/** Replacement phases preserve the dialect's ordered textual substitution, including cascades. */
export type MacroPlaceholderKind = "defineName" | "deprecated" | "named" | "backslash" | "variadic" | "count";
/** Half-open UTF-16 offsets in template.text; payload is the parameter name or index expression. */
export type MacroPlaceholder = {
    /** Inclusive start offset of the placeholder spelling. */
    readonly start: number;
    /** Exclusive end offset of the placeholder spelling. */
    readonly end: number;
    /** Full placeholder spelling as matched, including its delimiters. */
    readonly text: string;
    /** Parameter name or variadic index expression; empty for `count` placeholders. */
    readonly payload: string;
};
/** Syntax captured once per body occurrence. Values and control state remain invocation-local. */
export type MacroLineTemplate = {
    /** Captured body command whose text is substituted per invocation. */
    readonly command: NormalizedCommand;
    /** Normalized command text that placeholder offsets index into. */
    readonly text: string;
    /** Placeholder sites grouped by replacement phase; each list is empty when the phase has no sites. */
    readonly placeholders: Readonly<Record<MacroPlaceholderKind, readonly MacroPlaceholder[]>>;
    /** Data grammar can bind atomic parameter values without generating another expression grammar. */
    readonly numericData?: NumericDataStatement;
};
/** Capture replacement positions without resolving parameters, defines, or control expressions. */
export declare function createMacroLineTemplate(command: NormalizedCommand): MacroLineTemplate;
/** Bind atomic data parameters as syntax; separator/identifier/string-generating values use fragments. */
export declare function bindNumericMacroTemplate(template: MacroLineTemplate, args: ReadonlyMap<string, string>, fragment: SourceFragment): NormalizedCommand | undefined;
/** Rescan a phase after earlier substitutions change its input; cached positions never index changed text. */
export declare function replaceMacroPlaceholders(template: MacroLineTemplate | undefined, text: string, kind: MacroPlaceholderKind, resolve: (text: string, payload: string) => string): string;
/** Parse one ordered phase against its actual input, then bind sites without losing source contributors. */
export declare function bindMacroFragment(template: MacroLineTemplate | undefined, fragment: SourceFragment, kind: MacroPlaceholderKind, resolve: (part: MacroPlaceholder) => SourceFragment): SourceFragment;
export { parseMacroArguments, type MacroInvocationArgument } from "./macro-arguments.js";
//# sourceMappingURL=macro-template.d.ts.map