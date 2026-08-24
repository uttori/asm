/** Target-neutral directive metadata used by tooling contributions. */
export type DirectiveDescriptor = {
    keyword: string;
    summary: string;
    syntax: string;
    group: string;
};
/** Metadata for directives implemented by the architecture-neutral core. */
export declare const directiveCatalog: DirectiveDescriptor[];
export declare function findDirective(keyword: string): DirectiveDescriptor | undefined;
//# sourceMappingURL=directive-catalog.d.ts.map