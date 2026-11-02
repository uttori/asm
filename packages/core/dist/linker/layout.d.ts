import type { AssemblyLinkRecipe, AssemblyModule } from "../relocatable.js";
import { type LinkAllocation, type LinkRegionReport } from "./types.js";
export interface LinkLayout {
    readonly allocations: readonly LinkAllocation[];
    readonly regions: readonly LinkRegionReport[];
    readonly output: Uint8Array;
}
/** Deterministic recipe order, then object order, then section order. No instruction is resized during placement. */
export declare function allocateSections(modules: readonly AssemblyModule[], recipe: AssemblyLinkRecipe): LinkLayout;
//# sourceMappingURL=layout.d.ts.map