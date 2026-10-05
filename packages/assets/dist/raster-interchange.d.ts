import { type AsepriteDocument } from "./aseprite-document.js";
import { type AtlasDocument } from "./atlas-interchange.js";
import { type IndexedOwnership } from "./indexed-ownership.js";
import type { InterchangeCapabilities, InterchangeChanges, TilemapInterchangeBaseline } from "./interchange.js";
/** Fixed raster rectangles identify views through private authority; file positions never identify native resources. */
export interface RasterInterchangeBaseline {
    readonly kind: "raster";
    readonly document: AsepriteDocument;
    readonly ownership: IndexedOwnership;
    readonly placements: readonly {
        readonly view: string;
        readonly x: number;
        readonly y: number;
    }[];
    readonly editablePaletteSlots: readonly number[];
    readonly capabilities: InterchangeCapabilities;
}
/** Reuse the v1 raster file contract while retaining the structural codec's one normalized document value. */
export declare function rasterInterchangeDocument(atlas: AtlasDocument): AsepriteDocument;
/** Normalize trimmed saved raster cels without color conversion, transparency inference or geometry edits. */
export declare function rasterInterchangeAtlas(document: AsepriteDocument): AtlasDocument;
/**
 * Pack every declared view, including unused/blank/duplicate owners, into one fixed raster.
 * A raster file has no shared tile references or measured preview timeline; those capabilities remain explicit.
 */
export declare function createRasterInterchange(source: TilemapInterchangeBaseline): RasterInterchangeBaseline;
/** Reconcile raster aliases through the same native owner planner used by tilemap inventories. */
export declare function inspectRasterInterchange(baseline: RasterInterchangeBaseline, document: AsepriteDocument): InterchangeChanges;
//# sourceMappingURL=raster-interchange.d.ts.map