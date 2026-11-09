import type { AssemblyLinkRecipe, AssemblyModule } from "../relocatable.js";
import { type LinkAllocation, type LinkRegionReport } from "./types.js";
/** Final section placements, region usage reports, and contiguous output image. */
export interface LinkLayout {
    /** Per-module section run addresses and sizes after layout. */
    readonly allocations: readonly LinkAllocation[];
    /** Human-readable region fill summaries for diagnostics. */
    readonly regions: readonly LinkRegionReport[];
    /** Contiguous ROM/RAM image sized to the highest used address. */
    readonly output: Uint8Array;
}
/** Deterministic recipe order, then object order, then section order. No instruction is resized during placement. */
export declare function allocateSections(modules: readonly AssemblyModule[], recipe: AssemblyLinkRecipe): LinkLayout;
//# sourceMappingURL=layout.d.ts.map