/**
 * A static description of an assembler directive or control-flow keyword for
 * editor tooling (hover, completion, signature help).
 */
export type DirectiveDescriptor = {
    /** The directive keyword as written in source, e.g. "org", "incsrc". */
    keyword: string;
    /** A short human-readable summary suitable for hover documentation. */
    summary: string;
    /** Example syntax, e.g. "org $address". */
    syntax: string;
    /** A coarse grouping used to organize completion. */
    group: "data" | "layout" | "include" | "memory" | "namespace" | "table" | "spc" | "struct" | "control" | "define" | "macro" | "compat" | "label";
};
/**
 * The directive catalog. Keywords mirror the registrations in
 * `src/directives/*` plus control-flow, macro, and define forms that are
 * handled outside the directive registry.
 */
export declare const directiveCatalog: DirectiveDescriptor[];
/**
 * Looks up a directive descriptor by keyword (case-insensitive).
 * @param {string} keyword The directive keyword.
 * @returns {DirectiveDescriptor | undefined} The descriptor, if known.
 */
export declare function findDirective(keyword: string): DirectiveDescriptor | undefined;
//# sourceMappingURL=directive-catalog.d.ts.map