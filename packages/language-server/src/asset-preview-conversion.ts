/** Portable conversion used by the editor worker; the assembler uses the same asset library. */
import { AssetRegistry, convertAsset, type AssetInput, type AssetOutput } from "@uttori/asm-assets";
import {
  decodeBrrPcm,
  readPcmAudio,
  waveImporter,
  withAudioEncoder,
  writePcmWave,
} from "@uttori/asm-assets/audio";
import { rawEncoder, rawImporter, jsonImporter } from "@uttori/asm-assets/data";
import { pngImporter, withImageEncoders } from "@uttori/asm-assets/image";
import { rgbaNativePng, rgbaPreviewPng, waveformPreviewPng } from "@uttori/asm-assets/preview";
import {
  convertBossImage,
  convertBrrWave,
  sliceBrrSegment,
} from "@uttori/asm-assets/secret-of-mana/som-asset-plugin";
import {
  encodeInspectedFrameSegment,
  inspectFrameAtlas,
  readFrameLayout,
} from "@uttori/asm-assets/secret-of-mana/som-frame-atlas";
import {
  convertRoomAsset,
  parseRoomAsset,
  parseRoomPreview,
  renderRoomAsset,
} from "@uttori/asm-assets/secret-of-mana/som-room-assets";
import {
  parseSpritePaletteCatalog,
  readSpritePaletteCatalog,
  spritePaletteBytes,
  spritePalettePreview,
  type SpritePaletteRecord,
} from "@uttori/asm-assets/secret-of-mana/som-sprite-palettes";
import { snesNativeEncoders } from "@uttori/asm-assets/snes";

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

/** Preview the authored frame arrangement while validating the same source tiles as assembly.
 * @param {AssetPreviewInput} input Resolved source and sidecars from the editor.
 * @returns {AssetPreviewResult} Display PNG and the validated native byte count.
 */
function convertSomFramePreview(input: AssetPreviewInput): AssetPreviewResult {
  const layout = readFrameLayout(input.options, input.resources);
  const catalog = readSpritePaletteCatalog(input.options, input.resources);
  const segment = input.options.segment;
  if (typeof segment !== "string") {
    throw new Error("Frame atlas preview requires a segment name.");
  }
  const inspected = inspectFrameAtlas(input.source, layout, catalog, { segmentName: segment });
  let encodedBytes: number;
  let output: string;
  if (input.format === "som.boss.graphics") {
    const result = convertBossImage(input.source, input.options, input.resources) as {
      outputs: { graphics: { bytes: Uint8Array } };
    };
    encodedBytes = result.outputs.graphics.bytes.length;
    output = "graphics";
  } else {
    encodedBytes = encodeInspectedFrameSegment(inspected, segment).length;
    output = "tiles";
  }
  if (input.output !== undefined && input.output !== output) {
    throw new Error(`Asset format '${input.format}' has no output '${input.output}'.`);
  }
  const image = inspected.image;
  const rgba = new Uint8Array(image.width * image.height * 4);
  for (let pixel = 0; pixel < image.indexes.length; pixel++) {
    const colorIndex = image.indexes[pixel];
    const color: readonly [number, number, number, number] | undefined =
      colorIndex >= 0 && colorIndex < image.palette.length ? image.palette[colorIndex] : undefined;
    if (!color) {
      throw new Error(`Frame atlas pixel ${pixel} has no palette color.`);
    }
    rgba.set(color, pixel * 4);
  }
  const paletteId = layout.paletteRefs[layout.segments[segment].palette];
  const palette: SpritePaletteRecord | undefined = Object.hasOwn(catalog.palettes, paletteId)
    ? catalog.palettes[paletteId]
    : undefined;
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
  const catalog = parseSpritePaletteCatalog(input.source.bytes);
  const bytes = spritePaletteBytes(catalog, id);
  const preview = spritePalettePreview(catalog, id);
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
 * Render current room placements after checking every encoded section.
 * @param {AssetPreviewInput} input Editable room JSON, selected section and captured preview-resource dependency.
 * @returns {AssetPreviewResult} Native-scale image preview with the selected section's encoded byte count.
 */
function convertSomRoomPreview(input: AssetPreviewInput): AssetPreviewResult {
  const converted = convertRoomAsset(input.source, input.options);
  const output = input.output ?? converted.primaryOutput;
  if (!Object.hasOwn(converted.outputs, output)) {
    throw new Error(`Unknown room output '${output}'.`);
  }
  const resourcePath = input.options.preview;
  const resource: AssetInput | undefined =
    typeof resourcePath === "string" && Object.hasOwn(input.resources, resourcePath)
      ? input.resources[resourcePath]
      : undefined;
  if (!resource) {
    throw new Error("Room preview requires its shared preview JSON resource.");
  }
  if (resource.mediaType !== "application/json") {
    throw new Error("Room preview resource must be JSON.");
  }
  const room = parseRoomAsset(input.source);
  const preview = renderRoomAsset(room, parseRoomPreview(resource.bytes), {
    layer: input.options.layer,
  });
  return {
    kind: "image",
    sourceBytes: input.source.bytes.length,
    encodedBytes: converted.outputs[output].bytes.length,
    format: input.format,
    output,
    metadata: {
      room: room.id,
      name: room.name,
      width: preview.width,
      height: preview.height,
      activePieces: preview.activePieces,
      tileset: preview.tileset,
      limitation: preview.limitation,
    },
    thumbnailPngBase64: Buffer.from(
      rgbaPreviewPng(preview.rgba, preview.width, preview.height, 192),
    ).toString("base64"),
    composedPngBase64: Buffer.from(
      rgbaNativePng(preview.rgba, preview.width, preview.height),
    ).toString("base64"),
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
  const converted = convertBrrWave(input.source, input.options).outputs.brr;
  const native = converted.bytes;
  const sourceAudio = readPcmAudio(waveImporter.import(input.source).value);
  const segment = input.format === "som.brr.segment";
  const selected = segment ? sliceBrrSegment(native, input.options) : native;
  const decoded = decodeBrrPcm(native);
  const metadata: Record<string, unknown> = { ...converted.metadata, previewScope: "full-stream" };
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
  if (input.format === "som.room") {
    return convertSomRoomPreview(input);
  }
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
