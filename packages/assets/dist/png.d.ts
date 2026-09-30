import ImagePNG from "@uttori/data-tools/image/data-image-png";
import type { AssetImporter } from "./registry.js";
/** Asset policy is narrower than the general image library: static, at most one megapixel. */
export declare const ASSET_PNG_OPTIONS: Readonly<{
    maxInputBytes: number;
    maxPixels: number;
    maxInflatedBytes: number;
    maxOutputBytes: number;
    maxChunks: number;
    allow16Bit: false;
    animation: "reject";
    copyInput: false;
}>;
/**
 * Parse a PNG under the asset import policy. Chunk spans borrow the input; callers
 * must finish synchronous inspection before changing it and copy any escaping spans.
 * Pixel decoding is deferred until a conversion method is called.
 * @param {Uint8Array} bytes Borrowed, complete PNG container.
 * @returns {ImagePNG} Validated container with bounded lazy decoding.
 */
export declare function readAssetPng(bytes: Uint8Array): ImagePNG;
/** Browser-safe PNG importer preserving original indexes, duplicate slots and hidden RGB. */
export declare const pngImporter: AssetImporter;
//# sourceMappingURL=png.d.ts.map