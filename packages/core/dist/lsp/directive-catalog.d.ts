/** Target-neutral directive metadata used by tooling contributions. */
export type DirectiveDocs = {
    /** Canonical directive keyword as typed in source. */
    keyword: string;
    /** Short human-readable description for completion hovers. */
    summary: string;
    /** Example syntax string shown in documentation. */
    syntax: string;
};
/** Nested keyword valid after a directive or another operand (`bankcross`, `full`). */
export type DirectiveOperandDescriptor = DirectiveDocs & {
    operands?: readonly DirectiveOperandDescriptor[];
};
/** Directive documentation entry with group and nested operand forms. */
export type DirectiveDescriptor = DirectiveDocs & {
    /** Core directive family used for grouping in tooling UI. */
    group: string;
    operands?: readonly DirectiveOperandDescriptor[];
};
/** Metadata for directives implemented by the architecture-neutral core. */
export declare const directiveCatalog: DirectiveDescriptor[];
/** Looks up built-in directive documentation, stripping a leading `@` prefix. */
export declare function findDirective(keyword: string): DirectiveDescriptor | undefined;
//# sourceMappingURL=directive-catalog.d.ts.map