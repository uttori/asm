/** Shared ROM palette catalogue for graphics, frame atlases and editor previews. */
import type { AssetInput } from "../registry.js";
/** One address-owned run of BGR555 words. */
export interface SpritePaletteRecord {
    /** ROM address label owning the palette word run. */
    romAddress: string;
    /** Whether word zero is transparent index zero in previews. */
    firstIndex: 0 | 1;
    /** Hex-encoded BGR555 words in catalogue order. */
    words: string[];
    /** Optional column count for catalogue preview layouts. */
    previewColumns?: number;
    /** Optional cross references to atlas segments consuming this palette. */
    users?: {
        atlas: string;
        segments: string[];
        role: string;
    }[];
}
/** Version 1 catalogue shared by frame atlases and palette includes. */
export interface SpritePaletteCatalog {
    /** Catalogue schema revision. */
    version: 1;
    /** Named palette records keyed by catalogue id. */
    palettes: Record<string, SpritePaletteRecord>;
}
/**
 * Resolve the sixteen indexed PNG colors for one ROM palette span. Actor spans
 * store only opaque colors 1–15; boss spans also store a hidden color-zero word.
 * @param catalog Shared palette catalogue.
 * @param id Six-digit ROM address.
 * @returns Sixteen RGBA8 display colors.
 */
export declare function spritePaletteColors(catalog: SpritePaletteCatalog, id: string): [number, number, number, number][];
/**
 * Emit the catalogue's exact little-endian ROM words, including unused high bits.
 * @param catalog Shared palette catalogue.
 * @param id Six-digit ROM address.
 * @param range Optional zero-based word slice; omitted count emits the remaining words.
 * @returns Little-endian BGR555 words. Invalid or empty slices throw.
 */
export declare function spritePaletteBytes(catalog: SpritePaletteCatalog, id: string, { wordOffset, wordCount }?: {
    wordOffset?: number;
    wordCount?: number;
}): Uint8Array<ArrayBuffer>;
/** Overlapping display views must agree on each physical ROM word; neither can silently win. */
export declare function validateSpritePaletteAliases(catalog: SpritePaletteCatalog): void;
/**
 * Show stored colors as 8×8 swatches with a one-pixel grid and source grouping.
 * @param catalog Shared palette catalogue.
 * @param id Six-digit ROM address.
 * @returns Swatch image.
 */
export declare function spritePalettePreview(catalog: SpritePaletteCatalog, id: string): {
    rgba: Uint8Array<ArrayBuffer>;
    width: number;
    height: number;
};
/**
 * Decode the catalogue as the source file of a ROM palette includeAsset.
 * @param bytes UTF-8 JSON catalogue.
 * @returns Parsed version 1 catalogue.
 */
export declare function parseSpritePaletteCatalog(bytes: Uint8Array): SpritePaletteCatalog;
/**
 * Parse a palette sidecar named by includeAsset; every atlas shares this resource.
 * @param options Include options naming `palettes`.
 * @param resources Declared sidecar files.
 * @returns Parsed shared catalogue.
 */
export declare function readSpritePaletteCatalog(options: Readonly<Record<string, unknown>>, resources: Readonly<Record<string, AssetInput>>): SpritePaletteCatalog;
//# sourceMappingURL=som-sprite-palettes.d.ts.map