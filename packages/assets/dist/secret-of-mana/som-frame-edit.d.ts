import type { IndexedPixels } from "../indexed-edit.js";
import type { SpritePaletteCatalog } from "./som-sprite-palettes.js";
import type { FrameLayout, SpriteAtlasSource } from "./som-types.js";
/**
 * Lay out poses independently of native tile storage. One common cell size keeps origins
 * explicit; the native strip is always the authoritative source, including occluded tiles.
 * This adapter owns SNES tile dimensions; portable rendering knows only pixel rectangles.
 * @param layout Current frame atlas sidecar.
 * @returns Layout with poses and native strips separated.
 */
export declare function layoutStableFrameAtlas(layout: FrameLayout): FrameLayout;
/**
 * Render derived poses and independent native strip pixels from previously extracted tiles.
 * @param tiles Native tiles keyed by segment.
 * @param layout Stable frame atlas sidecar.
 * @returns Composited atlas indexes.
 */
export declare function renderStableFrameAtlas(tiles: ReadonlyMap<string, readonly IndexedPixels[]>, layout: FrameLayout): IndexedPixels;
/**
 * Plan body geometry changes as one owned layout/PNG result. Raw native bytes and derived
 * occurrences update together, while native tile bytes must remain exact. No filesystem writes.
 * Frame-record ROM publication still requires a declared include at each record's owned span.
 * @param atlas Current atlas source and layout.
 * @param catalog Shared palette catalogue.
 * @param edits Body coordinate edits.
 * @returns Owned layout and PNG bytes.
 */
export declare function planBodyFrameEdits(atlas: SpriteAtlasSource, catalog: SpritePaletteCatalog, edits: readonly {
    frame: string | number;
    block: string;
    x?: number;
    y?: number;
}[]): {
    layout: FrameLayout;
    bytes: Uint8Array<ArrayBufferLike>;
};
//# sourceMappingURL=som-frame-edit.d.ts.map