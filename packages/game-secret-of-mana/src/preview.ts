import type { AssetInput } from "@uttori/asm-assets";
import { decodeBrrPcm, readPcmAudio, waveImporter, writePcmWave } from "@uttori/asm-assets/audio";
import { rgbaNativePng, rgbaPreviewPng, waveformPreviewPng } from "@uttori/asm-assets/preview";
import type {
  AssetPreviewAdapter,
  AssetPreviewInput,
  AssetPreviewResult,
} from "@uttori/asm-assets/preview-contracts";
import {
  encodeInspectedFrameSegment,
  encodeInspectedFrameSegments,
  frameAtlasSegmentOrder,
  inspectFrameAtlas,
  readFrameAtlasSelection,
  readFrameLayout,
} from "@uttori/asm-assets/secret-of-mana/som-frame-atlas";
import {
  convertRoomAsset,
  parseRoomAsset,
  parseRoomPreview,
  renderRoomAsset,
} from "@uttori/asm-assets/secret-of-mana/som-room-assets";
import {
  effectiveSomSourcePalette,
  normalizeSomSource,
} from "@uttori/asm-assets/secret-of-mana/som-source";
import {
  parseSpritePaletteCatalog,
  readSpritePaletteCatalog,
  spritePaletteBytes,
  spritePalettePreview,
  type SpritePaletteRecord,
} from "@uttori/asm-assets/secret-of-mana/som-sprite-palettes";

import { convertBossImage, convertBrrWave, sliceBrrSegment } from "./assembly.js";

/** Preview the authored frame arrangement while validating the same source tiles as assembly.
 * @param {AssetPreviewInput} input Resolved source and sidecars from the editor.
 * @returns {AssetPreviewResult} Display PNG and the validated native byte count.
 */
function convertSomFramePreview(input: AssetPreviewInput): AssetPreviewResult {
  let layout = readFrameLayout(input.options, input.resources);
  let catalog = readSpritePaletteCatalog(input.options, input.resources);
  let source = input.source;
  if (input.options.sourceBinding !== undefined || input.options.paletteSources !== undefined) {
    const normalized = normalizeSomSource(source, input.options, input.resources, catalog);
    source = normalized.source;
    layout = normalized.layout;
    catalog = normalized.catalog;
  }
  const selection = readFrameAtlasSelection(input.options);
  if (input.format === "som.boss.graphics" && typeof selection !== "string") {
    throw new Error("Frame atlas preview requires a segment name.");
  }
  const named = typeof selection === "string";
  const inspected = inspectFrameAtlas(source, layout, catalog, {
    segmentName: named ? selection : undefined,
    whole: !named,
  });
  const segments = named ? [selection] : frameAtlasSegmentOrder(layout, selection);
  let encodedBytes: number;
  let output: string;
  if (input.format === "som.boss.graphics") {
    const result = convertBossImage(input.source, input.options, input.resources) as {
      outputs: { graphics: { bytes: Uint8Array } };
    };
    encodedBytes = result.outputs.graphics.bytes.length;
    output = "graphics";
  } else {
    if (named) {
      encodedBytes = encodeInspectedFrameSegment(inspected, selection).length;
    } else {
      encodedBytes = encodeInspectedFrameSegments(inspected, segments).length;
    }
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
  const paletteIds = [
    ...new Set(segments.map((name) => layout.paletteRefs[layout.segments[name].palette])),
  ];
  const palettes = paletteIds.map((paletteId) => {
    const palette: SpritePaletteRecord | undefined = Object.hasOwn(catalog.palettes, paletteId)
      ? catalog.palettes[paletteId]
      : undefined;
    if (!palette) {
      throw new Error(`Unknown sprite palette ${paletteId}.`);
    }
    return { paletteId, paletteRomAddress: palette.romAddress, paletteUsers: palette.users };
  });
  // Preserve the single-palette metadata contract; combined spans also expose every palette user.
  const primaryPalette = palettes[0];
  return {
    kind: "image",
    sourceBytes: input.source.bytes.length,
    encodedBytes,
    format: input.format,
    output,
    metadata: {
      segment: named ? selection : undefined,
      segments,
      ...primaryPalette,
      palettes,
    },
    thumbnailPngBase64: Buffer.from(rgbaPreviewPng(rgba, image.width, image.height, 192)).toString(
      "base64",
    ),
    // The source PNG already carries the grid, frame labels and full native tile strip.
    composedPngBase64: Buffer.from(source.bytes).toString("base64"),
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
  const catalog = effectiveSomSourcePalette(
    parseSpritePaletteCatalog(input.source.bytes),
    input.options,
    input.resources,
  );
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

/** Game previews validate through the same portable codecs as assembly without publishing files. */
export const somPreviewAdapters: readonly AssetPreviewAdapter[] = Object.freeze([
  { formats: ["som.room"], convert: convertSomRoomPreview },
  { formats: ["som.brr.pcm", "som.brr.segment"], convert: convertSomBrrPreview },
  { formats: ["som.palette.bgr555"], convert: convertSomPalettePreview },
  { formats: ["som.sprite.frames", "som.boss.graphics"], convert: convertSomFramePreview },
]);
