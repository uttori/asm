import { type LinkExpression } from "../ir/link-expression.js";
import type { AssemblyLinkRecipe, AssemblyModule, RelocatableSource } from "../relocatable.js";
import { type LinkAllocation, type LinkedSymbol } from "./types.js";
/** Independent module/section namespaces cannot collide even when names contain punctuation. */
export declare const allocationKey: (module: string, section: string) => string;
/** Placement-dependent arithmetic is evaluated once per symbol, with an explicit cycle stack. */
export declare class LinkSymbols {
    readonly recipe: AssemblyLinkRecipe;
    /** Final section placements keyed by module/section allocation identity. */
    readonly allocations: ReadonlyMap<string, LinkAllocation>;
    private readonly modules;
    private readonly exports;
    private readonly recipeSymbols;
    private readonly bySection;
    private readonly cache;
    private readonly active;
    private readonly stack;
    constructor(modules: readonly AssemblyModule[], recipe: AssemblyLinkRecipe, allocations: readonly LinkAllocation[]);
    /** Section definitions use run addresses; load symbols are explicitly recipe-derived. */
    section(module: string, section: string, offset?: number): number;
    /** Recursively reduces link expressions with cycle detection and depth limits. */
    evaluate(expression: LinkExpression, source?: RelocatableSource, depth?: number): number;
    /** Globals bind only exports/recipe symbols. Locals require their owning module identity. */
    resolve(name: string, module?: string): number;
    /** Resolve every selected definition/import, so hidden cycles or unused explicit imports cannot escape validation. */
    all(): LinkedSymbol[];
    private recipeValue;
}
//# sourceMappingURL=symbols.d.ts.map