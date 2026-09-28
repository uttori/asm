/** Shared ROM palette catalogue for graphics, frame atlases and editor previews. */
import type { AssetInput } from "../registry.js";
/** One address-owned run of BGR555 words. */
export interface SpritePaletteRecord {
    romAddress: string;
    firstIndex: 0 | 1;
    words: string[];
    previewColumns?: number;
    users?: {
        atlas: string;
        segments: string[];
        role: string;
    }[];
}
/** Version 1 catalogue shared by frame atlases and palette includes. */
export interface SpritePaletteCatalog {
    version: 1;
    palettes: Record<string, SpritePaletteRecord>;
}
/**
 * Resolve the sixteen indexed PNG colors for one ROM palette span. Actor spans
 * store only opaque colors 1–15; boss spans also store a hidden color-zero word.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @param {string} id Six-digit ROM address.
 * @returns {Array<[number, number, number, number]>} Sixteen RGBA8 display colors.
 */
export declare function spritePaletteColors(catalog: SpritePaletteCatalog, id: string): [number, number, number, number][];
/** Emit the catalogue's exact little-endian ROM words, including unused high bits.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @param {string} id Six-digit ROM address.
 * @returns {Uint8Array} Little-endian BGR555 words.
 */
export declare function spritePaletteBytes(catalog: SpritePaletteCatalog, id: string): Uint8Array<ArrayBuffer>;
/** Show stored colors as 8×8 swatches with a one-pixel grid and source grouping.
 * @param {SpritePaletteCatalog} catalog Shared palette catalogue.
 * @param {string} id Six-digit ROM address.
 * @returns {{rgba: Uint8Array, width: number, height: number}} Swatch image.
 */
export declare function spritePalettePreview(catalog: SpritePaletteCatalog, id: string): {
    rgba: Uint8Array<ArrayBuffer>;
    width: number;
    height: number;
};
/** Decode the catalogue as the source file of a ROM palette includeAsset.
 * @param {Uint8Array} bytes UTF-8 JSON catalogue.
 * @returns {SpritePaletteCatalog} Parsed version 1 catalogue.
 */
export declare function parseSpritePaletteCatalog(bytes: Uint8Array): SpritePaletteCatalog;
/** Parse a palette sidecar named by includeAsset; every atlas shares this resource.
 * @param {Readonly<Record<string, unknown>>} options Include options naming `palettes`.
 * @param {Readonly<Record<string, AssetInput>>} resources Declared sidecar files.
 * @returns {SpritePaletteCatalog} Parsed shared catalogue.
 */
export declare function readSpritePaletteCatalog(options: Readonly<Record<string, unknown>>, resources: Readonly<Record<string, AssetInput>>): SpritePaletteCatalog;
//# sourceMappingURL=som-sprite-palettes.d.ts.map