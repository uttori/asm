export { pngImporter } from "./png.js";
export { rewriteIndexedPng, createIndexedPng, extendIndexedPngPalette } from "./png-edit.js";
export { readAssetPng } from "./png.js";
export type { IndexedPngEdit } from "./png-edit.js";
export { expandIndexedGrid, extractIndexedRegion, renderIndexedPlacements, validateIndexedPixels, } from "./indexed-edit.js";
export type { IndexedGridCell, IndexedGridBlock, IndexedPixels, PixelBounds, IndexedRegion, IndexedPlacement, } from "./indexed-edit.js";
export { withImageEncoders, encodeBgScreenMap, decodeBgScreenMap, encodeMode7MapLayout, } from "./image-conversion.js";
/** Indexed pixels retain their original palette order and duplicate entries. */
export interface IndexedImage {
    /** Model discriminator for imported PNG encoders. */
    readonly kind: "indexed-image";
    /** Raster width in pixels. */
    readonly width: number;
    /** Raster height in pixels. */
    readonly height: number;
    /** Row-major palette slots, length `width * height`. */
    readonly indexes: Uint8Array;
    /** Display palette preserving slot identity and duplicates. */
    readonly palette: readonly (readonly [number, number, number, number])[];
    /** Original PNG index bit depth before planar conversion. */
    readonly sourceBitDepth: 1 | 2 | 4 | 8;
}
/** Truecolor channels are byte-exact, including RGB hidden by alpha zero. */
export interface RgbaImage {
    /** Model discriminator for imported PNG encoders. */
    readonly kind: "rgba-image";
    /** Raster width in pixels. */
    readonly width: number;
    /** Raster height in pixels. */
    readonly height: number;
    /** Row-major RGBA8 bytes, length `width * height * 4`. */
    readonly rgba: Uint8Array;
}
//# sourceMappingURL=image.d.ts.map