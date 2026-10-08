import { computeBytes } from "@uttori/data-tools/data-hash-crc32";
import ImagePNG from "@uttori/data-tools/image/data-image-png";
import { validateIndexedPixels } from "./indexed-edit.js";
import { indexedPalette } from "./indexed-values.js";
import { ASSET_LIMITS } from "./limits.js";
import { ASSET_PNG_OPTIONS, readAssetPng } from "./png.js";
/** Frame one PNG chunk, including its CRC over the type and payload. */
function pngChunk(type, data) {
    const result = new Uint8Array(data.length + 12);
    const view = new DataView(result.buffer);
    view.setUint32(0, data.length);
    result.set(new TextEncoder().encode(type), 4);
    result.set(data, 8);
    view.setUint32(data.length + 8, computeBytes(result.subarray(4, data.length + 8)));
    return result;
}
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
/** Extend an eight-bit indexed palette without changing IDAT or existing slot identities.
 * Palette-only source views can use new slots without assigning them native pixels. Unsafe ancillary
 * chunks require the same explicit validation/retention policy as ordinary PNG edits.
 */
export function extendIndexedPngPalette(source, colors, preserveChunks = []) {
    const image = readAssetPng(source);
    const palette = indexedPalette(colors);
    const before = image.toIndexed({ copy: false });
    if (palette.length === before.palette.length) {
        return rewriteIndexedPng(source, { palette, preserveChunks });
    }
    if (image.bitDepth !== 8 || palette.length < before.palette.length) {
        throw new Error("Source palette extension requires eight-bit indexes and cannot remove existing slots.");
    }
    const parts = [source.slice(0, 8)];
    for (const entry of image.chunks) {
        if (entry.type === "PLTE") {
            parts.push(pngChunk("PLTE", Uint8Array.from(palette.flatMap((color) => color.slice(0, 3)))));
            parts.push(pngChunk("tRNS", Uint8Array.from(palette.map((color) => color[3]))));
        }
        else if (entry.type !== "tRNS" &&
            (entry.critical || entry.safeToCopy || preserveChunks.includes(entry.type))) {
            parts.push(entry.raw);
        }
    }
    const length = parts.reduce((total, part) => total + part.length, 0);
    if (length > ASSET_LIMITS.pngBytes) {
        throw new Error("Extended source PNG exceeds the asset byte budget.");
    }
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.length;
    }
    readAssetPng(output);
    return output;
}
//# sourceMappingURL=png-edit.js.map