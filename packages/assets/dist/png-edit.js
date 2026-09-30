import ImagePNG from "@uttori/data-tools/image/data-image-png";
import { validateIndexedPixels } from "./indexed-edit.js";
import { ASSET_PNG_OPTIONS } from "./png.js";
/**
 * Rewrite same-slot palettes or complete indexed canvases. No-op edits return an
 * owned exact copy; palette-only edits retain IDAT, including Adam7. Unsafe private
 * chunks survive only when the caller explicitly validates and retains their names.
 * @param {Uint8Array} source Borrowed complete indexed PNG.
 * @param {IndexedPngEdit} edit Exact replacements, without quantization or palette remapping.
 * @returns {Uint8Array} Owned PNG bytes, encoded with deterministic unfiltered rows for pixel edits.
 */
export function rewriteIndexedPng(source, edit) {
    return ImagePNG.rewriteIndexed(source, edit, {
        ...ASSET_PNG_OPTIONS,
        filter: "none",
        level: 6,
        validateIndexed: validateIndexedPixels,
    });
}
/**
 * Create an editable PNG with eight-bit indexes and unchanged palette-slot identity.
 * @param {Pick<IndexedImage, "width" | "height" | "indexes" | "palette">} image Exact row-major pixels and RGBA8 palette slots; duplicate colors stay distinct.
 * @returns {Uint8Array} Owned PNG bytes within the asset limits.
 */
export function createIndexedPng(image) {
    validateIndexedPixels(image);
    return ImagePNG.encodeIndexed(image, {
        ...ASSET_PNG_OPTIONS,
        bitDepth: 8,
        filter: "none",
        level: 6,
    });
}
//# sourceMappingURL=png-edit.js.map