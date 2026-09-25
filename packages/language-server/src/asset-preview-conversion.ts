/** Portable conversion used by the editor worker; the assembler uses the same asset library. */
import { AssetRegistry, convertAsset, type AssetInput } from "@uttori/asm-assets";
import {
  decodeBrrPcm,
  waveImporter,
  withAudioEncoder,
  writePcmWave,
  type PcmAudio,
} from "@uttori/asm-assets/audio";
import { rawEncoder, rawImporter, jsonImporter } from "@uttori/asm-assets/data";
import { pngImporter, withImageEncoders, type IndexedImage } from "@uttori/asm-assets/image";
import { rgbaPreviewPng, waveformPreviewPng } from "@uttori/asm-assets/preview";
import { snesNativeEncoders } from "@uttori/asm-assets/snes";

import {
  convertBossImage,
  sliceBrrSegment,
  verifiedBrrFromWave,
} from "../../assets/plugins/secret-of-mana/som-asset-plugin.mjs";
import {
  encodeFrameAtlas,
  readFrameLayout,
} from "../../assets/plugins/secret-of-mana/som-frame-atlas.mjs";
import {
  parseSpritePaletteCatalog,
  readSpritePaletteCatalog,
  spritePaletteBytes,
  spritePalettePreview,
} from "../../assets/plugins/secret-of-mana/som-sprite-palettes.mjs";

/** Inputs are already resolved and size checked in the language server. */
export interface AssetPreviewInput {
  readonly source: AssetInput;
  readonly resources: Readonly<Record<string, AssetInput>>;
  readonly format: string;
  readonly options: Readonly<Record<string, unknown>>;
  readonly output?: string;
}

/** Small wire result. Encoded audio is returned only for explicit playback. */
export interface AssetPreviewResult {
  readonly kind: "image" | "audio" | "binary";
  readonly sourceBytes: number;
  readonly encodedBytes: number;
  readonly format: string;
  readonly output: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly thumbnailPngBase64?: string;
  readonly composedPngBase64?: string;
  readonly storagePngBase64?: string;
  readonly waveformPngBase64?: string;
  readonly sourceWavBase64?: string;
  readonly decodedWavBase64?: string;
}

const registry = new AssetRegistry()
  .registerImporter(rawImporter)
  .registerImporter(jsonImporter)
  .registerImporter(pngImporter)
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

interface SomPreviewLayout {
  readonly paletteRefs: readonly string[];
  readonly segments: Readonly<Record<string, { readonly palette: number }>>;
}

interface SomPreviewCatalog {
  readonly palettes: Readonly<
    Record<string, { readonly romAddress: string; readonly users: unknown[] }>
  >;
}

/** Preview the authored frame arrangement while validating the same source tiles as assembly.
 * @param {AssetPreviewInput} input Resolved source and sidecars from the editor.
 * @returns {AssetPreviewResult} Display PNG and the validated native byte count.
 */
function convertSomFramePreview(input: AssetPreviewInput): AssetPreviewResult {
  const layout = readFrameLayout(input.options, input.resources) as SomPreviewLayout;
  const catalog = readSpritePaletteCatalog(input.options, input.resources) as SomPreviewCatalog;
  const segment = input.options.segment;
  if (typeof segment !== "string") {
    throw new Error("Frame atlas preview requires a segment name.");
  }
  let encodedBytes: number;
  let output: string;
  if (input.format === "som.boss.graphics") {
    const result = convertBossImage(input.source, input.options, input.resources) as {
      outputs: { graphics: { bytes: Uint8Array } };
    };
    encodedBytes = result.outputs.graphics.bytes.length;
    output = "graphics";
  } else {
    encodedBytes = encodeFrameAtlas(input.source, layout, segment, catalog).length;
    output = "tiles";
  }
  if (input.output !== undefined && input.output !== output) {
    throw new Error(`Asset format '${input.format}' has no output '${input.output}'.`);
  }
  const image = pngImporter.import(input.source).value as IndexedImage;
  if (image.kind !== "indexed-image") {
    throw new Error("Frame atlas preview requires an indexed PNG.");
  }
  const rgba = new Uint8Array(image.width * image.height * 4);
  for (let pixel = 0; pixel < image.indexes.length; pixel++) {
    const color = image.palette[image.indexes[pixel]];
    if (!color) {
      throw new Error(`Frame atlas pixel ${pixel} has no palette color.`);
    }
    rgba.set(color, pixel * 4);
  }
  const paletteId = layout.paletteRefs[layout.segments[segment].palette];
  const palette = catalog.palettes[paletteId];
  if (!palette) {
    throw new Error(`Unknown sprite palette ${paletteId}.`);
  }
  return {
    kind: "image",
    sourceBytes: input.source.bytes.length,
    encodedBytes,
    format: input.format,
    output,
    metadata: {
      segment,
      paletteId,
      paletteRomAddress: palette.romAddress,
      paletteUsers: palette.users,
    },
    thumbnailPngBase64: Buffer.from(rgbaPreviewPng(rgba, image.width, image.height, 192)).toString(
      "base64",
    ),
    // The source PNG already carries the grid, frame labels and full native tile strip.
    composedPngBase64: Buffer.from(input.source.bytes).toString("base64"),
  };
}

/** Preview one shared ROM palette with native 8×8 swatches and its exact encoded size.
 * @param {AssetPreviewInput} input Catalogue source and selected address.
 * @returns {AssetPreviewResult} BGR555 metadata and a magnifiable swatch PNG.
 */
function convertSomPalettePreview(input: AssetPreviewInput): AssetPreviewResult {
  const id = input.options.palette;
  if (input.source.mediaType !== "application/json" || typeof id !== "string") {
    throw new Error("SoM palette preview requires a JSON catalogue and palette address.");
  }
  if (input.output !== undefined && input.output !== "palette") {
    throw new Error(`Asset format '${input.format}' has no output '${input.output}'.`);
  }
  const catalog = parseSpritePaletteCatalog(input.source.bytes) as SomPreviewCatalog;
  const bytes = spritePaletteBytes(catalog, id);
  const preview = spritePalettePreview(catalog, id) as {
    rgba: Uint8Array;
    width: number;
    height: number;
  };
  const png = Buffer.from(rgbaPreviewPng(preview.rgba, preview.width, preview.height));
  const palette = catalog.palettes[id];
  return {
    kind: "image",
    sourceBytes: input.source.bytes.length,
    encodedBytes: bytes.length,
    format: input.format,
    output: "palette",
    metadata: {
      paletteId: id,
      paletteRomAddress: palette.romAddress,
      paletteUsers: palette.users,
      previewWidth: preview.width,
    },
    thumbnailPngBase64: png.toString("base64"),
    composedPngBase64: png.toString("base64"),
  };
}

/**
 * Preview the playable source and verified native BRR stream used by the SoM plugin.
 * Segment playback uses the complete stream because a bank split can cut through a BRR block.
 * @param {AssetPreviewInput} input Authored WAVE and literal segment options, when present.
 * @returns {AssetPreviewResult} Full-stream audio with the selected ROM byte count.
 */
function convertSomBrrPreview(input: AssetPreviewInput): AssetPreviewResult {
  if (input.output !== undefined && input.output !== "brr") {
    throw new Error(`Asset format '${input.format}' has no output '${input.output}'.`);
  }
  const native = verifiedBrrFromWave(input.source);
  const sourceAudio = waveImporter.import(input.source).value as PcmAudio;
  const segment = input.format === "som.brr.segment";
  const selected = segment ? sliceBrrSegment(native, input.options) : native;
  const decoded = decodeBrrPcm(native);
  const metadata: Record<string, unknown> = { previewScope: "full-stream" };
  if (segment) {
    metadata.segmentStartByte = input.options.startByte;
    metadata.segmentByteLength = selected.length;
    metadata.fullStreamBytes = native.length;
  }
  return {
    kind: "audio",
    sourceBytes: input.source.bytes.length,
    encodedBytes: selected.length,
    format: input.format,
    output: "brr",
    metadata,
    waveformPngBase64: Buffer.from(waveformPreviewPng(sourceAudio.samples)).toString("base64"),
    sourceWavBase64: Buffer.from(input.source.bytes).toString("base64"),
    decodedWavBase64: Buffer.from(writePcmWave(decoded, sourceAudio.sampleRate)).toString("base64"),
  };
}

/** Convert one bounded request and prepare display media outside the LSP event loop.
 * @param {AssetPreviewInput} input Resolved, owned source and resource bytes.
 * @returns {AssetPreviewResult} Display metadata and bounded PNG/WAVE media.
 */
export function convertAssetPreview(input: AssetPreviewInput): AssetPreviewResult {
  if (input.format === "som.brr.pcm" || input.format === "som.brr.segment") {
    return convertSomBrrPreview(input);
  }
  if (input.format === "som.palette.bgr555") {
    return convertSomPalettePreview(input);
  }
  if (input.format === "som.sprite.frames" || input.format === "som.boss.graphics") {
    return convertSomFramePreview(input);
  }
  const result = convertAsset(registry, input);
  const outputName = input.output ?? result.primaryOutput;
  const selected = result.outputs[outputName];
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
  const preview = result.outputs.preview;
  if (preview?.mediaType === "application/x-rgba") {
    const width = Number(preview.metadata?.width);
    const height = Number(preview.metadata?.height);
    const thumbnail = rgbaPreviewPng(preview.bytes, width, height, 192);
    const composed = rgbaPreviewPng(preview.bytes, width, height, 1024);
    const indexes = preview.metadata?.tileIndexByCoordinate;
    let storage: Uint8Array | undefined;
    if (Array.isArray(indexes) && width % 8 === 0 && height % 8 === 0) {
      storage = rgbaPreviewPng(
        storagePixels(preview.bytes, width, height, indexes),
        width,
        height,
        1024,
      );
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
    const audio = result.document.value as PcmAudio;
    const decodedWav = result.outputs.reviewWav?.bytes;
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
