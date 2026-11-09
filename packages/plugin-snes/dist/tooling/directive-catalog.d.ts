import type { DirectiveDescriptor } from "@uttori/asm-core/tooling";
/**
 * The directive catalog. Keywords mirror the registrations in
 * `src/directives/*` plus control-flow, macro, and define forms that are
 * handled outside the directive registry.
 */
export declare const directiveCatalog: DirectiveDescriptor[];
/**
 * Looks up a directive descriptor by keyword (case-insensitive).
 * @param keyword The directive keyword.
 * @returns The descriptor, if known.
 */
export declare function findDirective(keyword: string): DirectiveDescriptor | undefined;
//# sourceMappingURL=directive-catalog.d.ts.map