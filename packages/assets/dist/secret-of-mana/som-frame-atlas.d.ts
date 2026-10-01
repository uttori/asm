import type { IndexedImage } from "../image.js";
import type { IndexedPixels } from "../indexed-edit.js";
import type { AssetInput } from "../registry.js";
import { type SpritePaletteCatalog } from "./som-sprite-palettes.js";
import type { FrameLayout, FrameLayoutScope } from "./som-types.js";
/** Validate one assembly segment, or all segments and editor metadata in whole-atlas mode.
 * @param {FrameLayout} layout Frame atlas sidecar.
 * @param {string} [segmentName] Segment validated for assembly.
 * @param {boolean} [whole] Validate every segment and frame record.
 * @returns {FrameLayout} The same layout after validation.
 */
export declare function validateFrameLayout(layout: FrameLayout, { segmentName, whole }?: FrameLayoutScope): FrameLayout;
export interface InspectedFrameAtlas {
    image: IndexedImage;
    layout: FrameLayout;
    tiles: Map<string, IndexedPixels[]>;
}
/** Record an already verified PNG slot binding before making independent catalog color edits. */
export declare function bindFrameAtlasPalette(source: AssetInput, layout: FrameLayout, catalog: SpritePaletteCatalog): FrameLayout;
/** Parse and validate the authored pixels once, keeping SoM palette/group policy in this adapter.
 * @param {AssetInput} source Indexed PNG.
 * @param {FrameLayout} layout Frame atlas sidecar.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @param {FrameLayoutScope} [options] Segment or whole-atlas scope.
 * @returns {InspectedFrameAtlas} Validated image, layout, and extracted tiles.
 */
export declare function inspectFrameAtlas(source: AssetInput, layout: FrameLayout, catalog: SpritePaletteCatalog, options?: FrameLayoutScope): InspectedFrameAtlas;
/** Encode the already inspected native indexes with the game's 4bpp storage codec.
 * @param {InspectedFrameAtlas} inspected Validated atlas.
 * @param {string} segmentName Segment to encode.
 * @returns {Uint8Array} Native 4bpp tile bytes.
 */
export declare function encodeInspectedFrameSegment(inspected: InspectedFrameAtlas, segmentName: string): Uint8Array<ArrayBufferLike>;
/** Existing assembly entry point; inspection/extraction is also available without native encoding.
 * @param {AssetInput} source Indexed PNG.
 * @param {FrameLayout} layout Frame atlas sidecar.
 * @param {string} segmentName Segment to encode.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @returns {Uint8Array} Native 4bpp tile bytes.
 */
export declare function encodeFrameAtlas(source: AssetInput, layout: FrameLayout, segmentName: string, catalog: SpritePaletteCatalog): Uint8Array<ArrayBufferLike>;
/**
 * Refresh every recorded occurrence and bottom strip from current authoritative pixels.
 * Composition is additive metadata from reviewed evidence; it cannot be inferred from RGB.
 * Returns owned indexes, retaining guides outside painted pixels and all source-only tiles.
 * @param {InspectedFrameAtlas} inspected Whole-atlas inspection.
 * @returns {IndexedPixels} Rebuilt atlas indexes.
 */
export declare function refreshFrameAtlas(inspected: InspectedFrameAtlas): IndexedPixels;
/** Parse the declared layout resource. Validation occurs at the consumer's selected scope.
 * @param {Readonly<Record<string, unknown>>} options Include options naming `layout`.
 * @param {Readonly<Record<string, AssetInput>>} resources Declared sidecar files.
 * @returns {FrameLayout} Parsed layout sidecar.
 */
export declare function readFrameLayout(options: Readonly<Record<string, unknown>>, resources: Readonly<Record<string, AssetInput>>): FrameLayout;
//# sourceMappingURL=som-frame-atlas.d.ts.map