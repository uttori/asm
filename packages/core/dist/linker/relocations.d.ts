import type { AssemblyLinkRecipe, AssemblyModule } from "../relocatable.js";
import { LinkSymbols } from "./symbols.js";
/** Apply checked typed fields only after every contribution and global binding has a final value. */
export declare function applyRelocations(output: Uint8Array, modules: readonly AssemblyModule[], recipe: AssemblyLinkRecipe, symbols: LinkSymbols): void;
//# sourceMappingURL=relocations.d.ts.map