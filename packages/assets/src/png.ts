import ImagePNG, { type DecodeOptions } from "@uttori/data-tools/image/data-image-png";

import type { RgbaImage } from "./image.js";
import { ASSET_LIMITS } from "./limits.js";
import type { AssetImporter, AssetInput } from "./registry.js";

/** Asset policy is narrower than the general image library: static, at most four megapixels. */
export const ASSET_PNG_OPTIONS = Object.freeze({
  maxInputBytes: ASSET_LIMITS.pngBytes,
  maxPixels: ASSET_LIMITS.rasterPixels,
  maxInflatedBytes: ASSET_LIMITS.pngInflatedBytes,
  maxOutputBytes: ASSET_LIMITS.pngBytes,
  maxChunks: 16384,
  allow16Bit: false,
  animation: "reject",
  copyInput: false,
} satisfies DecodeOptions);

/**
 * Parse a PNG under the asset import policy. Chunk spans borrow the input; callers
 * must finish synchronous inspection before changing it and copy any escaping spans.
 * Pixel decoding is deferred until a conversion method is called.
 * @param bytes Borrowed, complete PNG container.
 * @returns Validated container with bounded lazy decoding.
 */
export function readAssetPng(bytes: Uint8Array): ImagePNG {
  return ImagePNG.fromFile(bytes, ASSET_PNG_OPTIONS);
}

/** Browser-safe PNG importer preserving original indexes, duplicate slots and hidden RGB. */
export const pngImporter: AssetImporter = Object.freeze({
  id: "uttori.import.png",
  version: "2.0.0",
  mediaTypes: ["image/png"],
  import: (input: AssetInput) => {
    const image = readAssetPng(input.bytes);
    // Decoded pixels own separate storage. The local decoder never escapes, so
    // returning its pixel buffer transfers ownership without another full copy.
    if (image.colorType === 3) {
      const value = image.toIndexed({ copy: false });
      return { kind: value.kind, value };
    }
    const surface = image.toRGBA({ copy: false });
    const value: RgbaImage = {
      kind: "rgba-image",
      width: surface.width,
      height: surface.height,
      rgba: surface.rgba,
    };
    return { kind: value.kind, value };
  },
});
