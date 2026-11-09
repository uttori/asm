import type { QuantizedAnimationRun } from "../animation-evidence.js";
import { type TilemapInterchangeBaseline } from "../interchange.js";
import { type SpritePaletteCatalog } from "./som-sprite-palettes.js";
import type { SpriteAtlasSource } from "./som-types.js";
/** Display slots bind to catalogue words by identity; colors and file tile numbers never establish ownership. */
export interface SomInterchangePaletteSlot {
    /** Catalogue palette id bound to this display slot. */
    readonly palette: string;
    /** Word index within the catalogue palette record. */
    readonly index: number;
}
/**
 * Present every native owner in an obvious Tiles frame, and each pose as real per-block
 * tilemaps sharing the same inventory. Display layout is independent of source PNG geometry.
 * Measured runs use the same common pivot; the static pose frames are presentation state.
 */
export declare function createSomSpriteInterchange(atlas: SpriteAtlasSource, catalog: SpritePaletteCatalog, exportId: string, runs?: readonly QuantizedAnimationRun[]): {
    readonly baseline: TilemapInterchangeBaseline;
    readonly paletteSlots: readonly SomInterchangePaletteSlot[];
    readonly displayOrigin: {
        readonly x: number;
        readonly y: number;
    };
};
//# sourceMappingURL=som-sprite-interchange.d.ts.map