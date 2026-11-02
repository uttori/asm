import { type LinkTargetPolicy, type AddressedAssemblySection } from "@uttori/asm-core";
import type { TargetFactoryContext } from "@uttori/asm-core/plugin";
/** Physical Asar ORG offsets and logical BASE addresses remain distinct from the iNES prefix. */
export declare function createNesSourceLinkRecipe(context: TargetFactoryContext, sections: readonly AddressedAssemblySection[]): import("@uttori/asm-core").AssemblyLinkRecipe;
/** The iNES container remains recipe-owned; all module header declarations must agree before publication. */
export declare function createNesLinkTarget(): LinkTargetPolicy;
//# sourceMappingURL=link-target.d.ts.map