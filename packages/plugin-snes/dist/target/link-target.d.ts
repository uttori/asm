import { type LinkTargetPolicy, type AddressedAssemblySection } from "@uttori/asm-core";
import type { TargetFactoryContext } from "@uttori/asm-core/plugin";
/** Source mapper/checksum directives seed a recipe; sections themselves remain fully relocatable. */
export declare function createSnesSourceLinkRecipe(context: TargetFactoryContext, sections: readonly AddressedAssemblySection[]): {
    targetOptions?: Readonly<Record<string, unknown>>;
    assumptions?: readonly import("@uttori/asm-core/linker").LinkAssumption[];
    assertions?: readonly import("@uttori/asm-core/linker").LinkAssertion[];
    target: string;
    regions: readonly import("@uttori/asm-core").LinkMemoryRegion[];
    placements: readonly import("@uttori/asm-core").LinkSectionPlacement[];
    symbols?: readonly import("@uttori/asm-core").LinkRecipeSymbol[];
    checksumPolicy: "preserve" | "recompute";
};
/** Existing mapper/checksum implementations are reused by the linker; container headers stay outside ROM arithmetic. */
export declare function createSnesLinkTarget(): LinkTargetPolicy;
//# sourceMappingURL=link-target.d.ts.map