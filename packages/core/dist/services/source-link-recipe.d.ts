import type { AddressedAssemblySection, AssemblyLinkRecipe } from "../relocatable.js";
/** Convert authored load/run hints into replaceable regions/placements, retaining gaps and container prefixes explicitly. */
export declare function addressedSourceLinkRecipe(options: {
    readonly target: string;
    readonly sections: readonly AddressedAssemblySection[];
    readonly outputOffset: (address: number) => number;
    readonly targetOptions?: Readonly<Record<string, unknown>>;
    readonly fillByte: number;
    readonly prefix?: readonly number[];
    /** Complete fixed container extent, including prefix bytes; omitted for growable ROM output. */
    readonly outputSize?: number;
    readonly checksumPolicy?: "preserve" | "recompute";
}): AssemblyLinkRecipe;
//# sourceMappingURL=source-link-recipe.d.ts.map