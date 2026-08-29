/** Target-neutral directive metadata used by tooling contributions. */
export type DirectiveDocs = {
    keyword: string;
    summary: string;
    syntax: string;
};
/** Nested keyword valid after a directive or another operand (`bankcross`, `full`). */
export type DirectiveOperandDescriptor = DirectiveDocs & {
    operands?: readonly DirectiveOperandDescriptor[];
};
export type DirectiveDescriptor = DirectiveDocs & {
    group: string;
    operands?: readonly DirectiveOperandDescriptor[];
};
/** Metadata for directives implemented by the architecture-neutral core. */
export declare const directiveCatalog: DirectiveDescriptor[];
export declare function findDirective(keyword: string): DirectiveDescriptor | undefined;
//# sourceMappingURL=directive-catalog.d.ts.map