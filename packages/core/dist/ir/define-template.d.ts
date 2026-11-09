import { type SourceFragment } from "./source-fragment.js";
/** Define syntax keeps dynamic names unbound; offsets refer to the template's original UTF-16 text. */
export type DefineTemplatePart = {
    readonly kind: "escape";
    readonly start: number;
    readonly end: number;
    readonly value: string;
} | {
    readonly kind: "define";
    readonly start: number;
    readonly end: number;
    readonly name: string;
    readonly braced: boolean;
    readonly children: readonly DefineTemplatePart[];
} | {
    readonly kind: "error";
    readonly start: number;
    readonly end: number;
};
/** Parsed define template; literal text between parts is not materialized. */
export type DefineTemplate = {
    /** Original template text that every part offset indexes into. */
    readonly text: string;
    /** Escape, define and error sites in ascending offset order; empty when the text has none. */
    readonly parts: readonly DefineTemplatePart[];
};
/** Parse replacement sites without lookup or evaluation; escaped exclamation marks never become references. */
export declare function parseDefineTemplate(text: string, escapes?: "basic" | "string" | "none"): DefineTemplate;
/** Binding owns errors and lookup. Replacement output is not scanned again in the same phase. */
export declare function bindDefineTemplate(template: DefineTemplate, fragment: SourceFragment, resolve: (part: Extract<DefineTemplatePart, {
    kind: "define";
}>) => SourceFragment, errorMessage?: string): SourceFragment;
//# sourceMappingURL=define-template.d.ts.map