/** Portable conversion used by the editor worker; the assembler uses the same asset library. */
import { AssetRegistry, convertAsset, type AssetOutput } from "@uttori/asm-assets";
import { readPcmAudio, waveImporter, withAudioEncoder } from "@uttori/asm-assets/audio";
import { rawEncoder, rawImporter, jsonImporter } from "@uttori/asm-assets/data";
import { pngImporter, readAssetPng, withImageEncoders } from "@uttori/asm-assets/image";
import { rgbaNativePng, rgbaPreviewPng, waveformPreviewPng } from "@uttori/asm-assets/preview";
import type {
  AssetPreviewAdapter,
  AssetPreviewInput,
  AssetPreviewResult,
} from "@uttori/asm-assets/preview-contracts";
import { snesNativeEncoders } from "@uttori/asm-assets/snes";
import { asepriteRasterImporter } from "@uttori/asm-assets/source-codecs";
import { NES_CHR_CODEC, nesAssetFormats } from "@uttori/asm-plugin-65xx";
export type { AssetPreviewInput, AssetPreviewResult } from "@uttori/asm-assets/preview-contracts";
const registry = new AssetRegistry()
  .registerImporter(rawImporter)
  .registerImporter(jsonImporter)
  .registerImporter(pngImporter)
  .registerImporter(asepriteRasterImporter)
  .registerImporter(waveImporter);
for (const encoder of [...withAudioEncoder(withImageEncoders(snesNativeEncoders)), rawEncoder]) {
  registry.registerEncoder(encoder);
}

/** Place each logical tile at its encoded storage index for an honest layout preview.
 * @param {Uint8Array} composed Logical row-major RGBA8 pixels.
 * @param {number} width Preview width in pixels.
 * @param {number} height Preview height in pixels.
 * @param {readonly number[]} indexByCoordinate Encoded tile index for each logical tile.
 * @returns {Uint8Array} Owned RGBA8 pixels in native tile storage order.
 */
function storagePixels(
  composed: Uint8Array,
  width: number,
  height: number,
  indexByCoordinate: readonly number[],
): Uint8Array {
  const widthTiles = width / 8;
  const heightTiles = height / 8;
  const result = new Uint8Array(composed.length);
  for (let logical = 0; logical < indexByCoordinate.length; logical++) {
    const storage = indexByCoordinate[logical];
    if (!Number.isSafeInteger(storage) || storage < 0 || storage >= widthTiles * heightTiles) {
      throw new Error("Image layout contains an invalid storage tile index.");
    }
    for (let row = 0; row < 8; row++) {
      const source =
        ((Math.floor(logical / widthTiles) * 8 + row) * width + (logical % widthTiles) * 8) * 4;
      const target =
        ((Math.floor(storage / widthTiles) * 8 + row) * width + (storage % widthTiles) * 8) * 4;
      result.set(composed.subarray(source, source + 32), target);
    }
  }
  return result;
}

/** Convert one bounded request and prepare display media outside the LSP event loop.
 * @param {AssetPreviewInput} input Resolved, owned source and resource bytes.
 * @returns {AssetPreviewResult} Display metadata and bounded PNG/WAVE media.
 */
export function convertAssetPreview(
  input: AssetPreviewInput,
  adapters: readonly AssetPreviewAdapter[] = [],
): AssetPreviewResult {
  if (input.format === NES_CHR_CODEC) {
    return convertNesChrPreview(input);
  }
  const matches = adapters.filter((adapter) => adapter.formats.includes(input.format));
  if (matches.length > 1) {
    throw new Error("Ambiguous asset preview registration.");
  }
  if (matches.length === 1) {
    return matches[0].convert(input);
  }
  const result = convertAsset(registry, input);
  const outputName = input.output ?? result.primaryOutput;
  const selected: AssetOutput | undefined = Object.hasOwn(result.outputs, outputName)
    ? result.outputs[outputName]
    : undefined;
  if (!selected) {
    throw new Error(`Asset format '${input.format}' has no output '${outputName}'.`);
  }
  const common = {
    sourceBytes: input.source.bytes.length,
    encodedBytes: selected.bytes.length,
    format: result.encoder.id,
    output: outputName,
    metadata: selected.metadata,
  };
  const preview: AssetOutput | undefined = Object.hasOwn(result.outputs, "preview")
    ? result.outputs.preview
    : undefined;
  if (preview?.mediaType === "application/x-rgba") {
    const width = Number(preview.metadata?.width);
    const height = Number(preview.metadata?.height);
    const thumbnail = rgbaPreviewPng(preview.bytes, width, height, 192);
    const composed = rgbaNativePng(preview.bytes, width, height);
    const indexes = preview.metadata?.tileIndexByCoordinate;
    let storage: Uint8Array | undefined;
    if (Array.isArray(indexes) && width % 8 === 0 && height % 8 === 0) {
      storage = rgbaNativePng(storagePixels(preview.bytes, width, height, indexes), width, height);
    }
    return {
      ...common,
      kind: "image",
      thumbnailPngBase64: Buffer.from(thumbnail).toString("base64"),
      composedPngBase64: Buffer.from(composed).toString("base64"),
      storagePngBase64: storage && Buffer.from(storage).toString("base64"),
    };
  }
  if (result.document.kind === "pcm-audio" && result.encoder.id === "snes.brr") {
    const audio = readPcmAudio(result.document.value);
    const reviewWav: AssetOutput | undefined = Object.hasOwn(result.outputs, "reviewWav")
      ? result.outputs.reviewWav
      : undefined;
    const decodedWav = reviewWav?.bytes;
    if (!decodedWav) {
      throw new Error("BRR preview omitted its decoded review WAVE.");
    }
    return {
      ...common,
      kind: "audio",
      waveformPngBase64: Buffer.from(waveformPreviewPng(audio.samples)).toString("base64"),
      sourceWavBase64: Buffer.from(input.source.bytes).toString("base64"),
      decodedWavBase64: Buffer.from(decodedWav).toString("base64"),
    };
  }
  return { ...common, kind: "binary" };
}

/** Validate with the assembly codec, then display native indexed pixels without inferring a game palette. */
function convertNesChrPreview(input: AssetPreviewInput): AssetPreviewResult {
  const codec = nesAssetFormats.find((format) => format.id === NES_CHR_CODEC)!;
  const result = codec.convert(input.source, input.options, input.resources);
  const output = input.output ?? result.primaryOutput;
  if (output !== result.primaryOutput) {
    throw new Error(`Asset format '${input.format}' has no output '${output}'.`);
  }
  const image = readAssetPng(input.source.bytes).toIndexed({ copy: false });
  const rgba = new Uint8Array(image.indexes.length * 4);
  for (let pixel = 0; pixel < image.indexes.length; pixel++) {
    rgba.set(image.palette[image.indexes[pixel]], pixel * 4);
  }
  const composed = Buffer.from(rgbaNativePng(rgba, image.width, image.height)).toString("base64");
  return {
    kind: "image",
    sourceBytes: input.source.bytes.length,
    encodedBytes: result.outputs[output].bytes.length,
    format: input.format,
    output,
    metadata: {
      width: image.width,
      height: image.height,
      tiles: image.indexes.length / 64,
      bitDepth: 2,
      tileOrder: "row-major",
      palette: "source PNG indexes; gameplay colors are not inferred",
    },
    thumbnailPngBase64: Buffer.from(rgbaPreviewPng(rgba, image.width, image.height, 192)).toString(
      "base64",
    ),
    // NES source atlases already follow native storage order; both views must show the same pixels.
    composedPngBase64: composed,
    storagePngBase64: composed,
  };
}
