/** Game-specific asset formats; ROM pointer tables remain in the research tools. */
import { AssetRegistry, convertAsset } from "@uttori/asm-assets";
import {
  decodeBrrPcm,
  waveImporter,
  withAudioEncoder,
  resolveBrrAudioOptions,
} from "@uttori/asm-assets/audio";
import { pngImporter, withImageEncoders } from "@uttori/asm-assets/image";
import { decodePlanarTiles, encodePlanarTiles, snesNativeEncoders } from "@uttori/asm-assets/snes";
import { definePlugin, PLUGIN_API_VERSION } from "@uttori/asm-core";

import type { PcmAudio } from "../audio.js";
import { readAssetPng } from "../png.js";
import type { AssetInput, AssetOutput } from "../registry.js";
import { encodeBossGraphics, expandBossGraphics } from "./som-boss-graphics.js";
import { encodeFrameAtlas, readFrameLayout } from "./som-frame-atlas.js";
import { compressSomLz, decompressSomLz } from "./som-lz.js";
import { convertRoomAsset } from "./som-room-assets.js";
import {
  parseSpritePaletteCatalog,
  readSpritePaletteCatalog,
  spritePaletteBytes,
} from "./som-sprite-palettes.js";
import { decodeWorldRow, encodeWorldRow } from "./som-world-rle.js";

const registry = new AssetRegistry().registerImporter(pngImporter);
for (const encoder of withImageEncoders(snesNativeEncoders)) {
  registry.registerEncoder(encoder);
}
const audioRegistry = new AssetRegistry().registerImporter(waveImporter);
for (const encoder of withAudioEncoder(snesNativeEncoders)) {
  audioRegistry.registerEncoder(encoder);
}

/** Read a private PNG chunk holding the exact native boss stream for one segment.
 * @param {Uint8Array} png PNG bytes.
 * @param {string} [wanted] Four-character chunk type.
 * @returns {Uint8Array | undefined} Chunk payload, excluding its CRC.
 */
function nativeBossChunk(png: Uint8Array, wanted = "soMz") {
  const image = readAssetPng(png);
  let native: Uint8Array | undefined;
  for (const { type, data } of image.chunks) {
    if (type === wanted) {
      if (native) {
        throw new Error("Duplicate native boss graphics PNG chunk.");
      }
      // The parsed payload borrows PNG storage; native outputs need independent ownership.
      native = Uint8Array.from(data);
    }
  }
  return native;
}

/** Decode the two graphics stages and reject any unused bytes in a preserved native stream.
 * @param {Uint8Array} native Preserved native chunk.
 * @param {string} storage `lz-rle` or `rle`.
 * @param {number} size Expected expanded size.
 * @returns {{bytes: Uint8Array, mode: number | undefined, unusedHeaderByte: number | undefined}} Expanded tiles and any LZ header fields.
 */
function decodeBossStream(native: Uint8Array, storage: string, size: number) {
  let intermediate = native;
  let mode: number | undefined;
  let unusedHeaderByte: number | undefined;
  if (storage === "lz-rle") {
    const decoded = decompressSomLz(native);
    if (decoded.compressedBytes !== native.length) {
      throw new Error("Boss LZ stream has trailing bytes.");
    }
    intermediate = decoded.data;
    mode = decoded.mode;
    unusedHeaderByte = decoded.unusedHeaderByte;
  }
  const expanded = expandBossGraphics(intermediate, size);
  if (expanded.consumed !== intermediate.length) {
    throw new Error("Boss mask stream has trailing bytes.");
  }
  return { bytes: expanded.data, mode, unusedHeaderByte };
}

/**
 * Rebuild native graphics from previewable pixels. An unchanged PNG retains its exact
 * token choices. Fixed sizing pads after the complete stream; encoded sizing exposes
 * growth to the source layout/relocation service instead of truncating or allocating here.
 * @param {AssetInput} source Indexed PNG, optionally carrying a native chunk.
 * @param {Readonly<Record<string, unknown>>} options Storage, original byteLength, optional native resource, sizePolicy (fixed by default or encoded), and atlas resources.
 * @param {Readonly<Record<string, AssetInput>>} [resources] Layout and palette sidecars.
 * @returns {{primaryOutput: string, outputs: {graphics: {bytes: Uint8Array}}}} Independently decoded native bytes.
 */
export function convertBossImage(
  source: AssetInput,
  options: Readonly<Record<string, unknown>>,
  resources: Readonly<Record<string, AssetInput>> = {},
) {
  const { storage, byteLength, sizePolicy = "fixed", mode, unusedHeaderByte = 0 } = options;
  if (storage !== "lz-rle" && storage !== "rle") {
    throw new Error("Boss storage must be lz-rle or rle.");
  }
  if (typeof byteLength !== "number" || !Number.isSafeInteger(byteLength) || byteLength < 1) {
    throw new Error("Boss byteLength must be a positive integer.");
  }
  if (sizePolicy !== "fixed" && sizePolicy !== "encoded") {
    throw new Error("Boss sizePolicy must be fixed or encoded.");
  }
  // Frame atlases invert their recorded tile placements before the boss codecs.
  // Older native-order sheets remain supported for existing callers.
  const layout = options.layout ? readFrameLayout(options, resources) : undefined;
  let pixels: Uint8Array;
  let segmentName: string | undefined;
  if (layout) {
    if (typeof options.segment !== "string") {
      throw new Error("Frame atlas segment is required.");
    }
    segmentName = options.segment;
    pixels = encodeFrameAtlas(
      source,
      layout,
      segmentName,
      readSpritePaletteCatalog(options, resources),
    );
  } else {
    pixels = convertAsset(registry, { source, format: "snes.tile.4bpp" }).outputs.tiles.bytes;
  }
  const segmentIndex = segmentName ? Object.keys(layout?.segments ?? {}).indexOf(segmentName) : -1;
  if (segmentIndex > 25) {
    throw new Error("Boss atlas supports at most 26 native segments.");
  }
  const chunkName = segmentIndex < 0 ? "soMz" : `soM${String.fromCharCode(65 + segmentIndex)}`;
  let original: Uint8Array | undefined;
  if (options.native !== undefined) {
    if (typeof options.native !== "string" || !options.native || !resources[options.native]) {
      throw new Error("Boss native data requires an explicit original compressed resource.");
    }
    // A Git-tracked original stream survives ordinary PNG tools dropping private
    // chunks. It remains a compression reference, never a replacement for edited pixels.
    original = resources[options.native].bytes;
  } else {
    original = nativeBossChunk(source.bytes, chunkName);
  }
  if (original) {
    if (original.length !== byteLength) {
      throw new Error("Boss native data has the wrong byte length.");
    }
    const decoded = decodeBossStream(original, storage, pixels.length);
    if (decoded.bytes.every((byte, index) => byte === pixels[index])) {
      return { primaryOutput: "graphics", outputs: { graphics: { bytes: original } } };
    }
  }
  const intermediate = encodeBossGraphics(pixels);
  let encoded: Uint8Array = intermediate;
  if (storage === "lz-rle") {
    const selectedMode = original ? original[0] : mode;
    const selectedHeaderByte = original ? original[1] : unusedHeaderByte;
    encoded = compressSomLz(intermediate, {
      mode: selectedMode,
      unusedHeaderByte: selectedHeaderByte,
    });
  }
  if (sizePolicy === "fixed" && encoded.length > byteLength) {
    throw new Error(
      "Edited boss graphics exceed their fixed ROM span; use sizePolicy: encoded with a declared relocatable object.",
    );
  }
  const verified = decodeBossStream(encoded, storage, pixels.length).bytes;
  if (verified.some((byte, index) => byte !== pixels[index])) {
    throw new Error("Boss graphics inverse failed.");
  }
  if (sizePolicy === "encoded") {
    return { primaryOutput: "graphics", outputs: { graphics: { bytes: encoded } } };
  }
  const padded = new Uint8Array(byteLength);
  padded.set(encoded);
  if (original) {
    padded.set(original.subarray(encoded.length), encoded.length);
  }
  return { primaryOutput: "graphics", outputs: { graphics: { bytes: padded } } };
}

/**
 * Read the native BRR chunk from a playable PCM WAVE and verify every decoded sample.
 * @param {import('@uttori/asm-assets').AssetInput} source Authored WAVE with an sBRR chunk.
 * @returns {Uint8Array} Exact complete BRR stream owned by the caller.
 */
export function verifiedBrrFromWave(source: AssetInput) {
  const { audio, native } = readBrrWave(source);
  if (!native) {
    throw new Error("SoM WAVE is missing its native sBRR chunk.");
  }
  const decoded = decodeBrrPcm(native);
  if (
    decoded.length !== audio.samples.length ||
    decoded.some((sample, index) => sample !== audio.samples[index])
  ) {
    throw new Error("SoM WAVE PCM no longer matches its native BRR blocks.");
  }
  return native;
}

/** Read optional native bytes after the strict WAVE importer has checked every RIFF extent. */
function readBrrWave(source: AssetInput): { audio: PcmAudio; native?: Uint8Array } {
  const document = waveImporter.import(source);
  const audio = document.value as PcmAudio;
  const bytes = source.bytes;
  if (
    bytes.length < 12 ||
    String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF" ||
    String.fromCharCode(...bytes.subarray(8, 12)) !== "WAVE"
  ) {
    throw new Error("SoM BRR asset requires a RIFF/WAVE file.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) {
    throw new Error("SoM BRR WAVE has an invalid RIFF length.");
  }
  let native: Uint8Array | undefined;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) {
      throw new Error("Truncated SoM BRR WAVE chunk.");
    }
    const length = view.getUint32(offset + 4, true);
    const end = offset + 8 + length;
    if (end + (length & 1) > bytes.length) {
      throw new Error("Truncated SoM BRR WAVE data.");
    }
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (id === "sBRR") {
      if (native) {
        throw new Error("Duplicate native BRR chunk in SoM WAVE.");
      }
      native = bytes.slice(offset + 8, end);
    }
    offset = end + (length & 1);
  }
  return { audio, native };
}

/** Preserve unchanged BRR exactly; edited PCM uses the shared lossy encoder and review metadata.
 * Re-encoding requires an explicit loop policy because BRR flags do not contain the game's loop pointer.
 * Split streams retain their full byte count so a newly authored tail cannot disappear between bank slices.
 */
export function convertBrrWave(
  source: AssetInput,
  options: Readonly<Record<string, unknown>> = {},
): { primaryOutput: string; outputs: { brr: AssetOutput } } {
  const { audio, native } = readBrrWave(source);
  const decoded = native ? decodeBrrPcm(native) : undefined;
  const unchanged =
    decoded?.length === audio.samples.length &&
    decoded.every((sample, index) => sample === audio.samples[index]);
  let loop: ReturnType<typeof resolveBrrAudioOptions>["loop"] | undefined;
  if (options.loop !== undefined) {
    loop = resolveBrrAudioOptions({ loop: options.loop, padding: options.padding }, audio).loop;
  }
  const nativeLoop = native ? Boolean(native[native.length - 9] & 2) : false;
  let output: AssetOutput;
  if (native && unchanged && (loop === undefined || Boolean(loop) === nativeLoop)) {
    output = {
      bytes: native,
      mediaType: "application/octet-stream",
      metadata: {
        nativePreserved: true,
        sourceSamples: audio.samples.length,
        sampleRate: audio.sampleRate,
      },
    };
  } else {
    if (options.loop === undefined) {
      throw new Error(
        "SoM WAVE PCM no longer matches native BRR (or its chunk was removed). Declare loop: false, 'source', or { start, end } in sample frames to review re-encoding.",
      );
    }
    const result = convertAsset(audioRegistry, {
      source,
      format: "snes.brr",
      options: { loop: options.loop, padding: options.padding },
    });
    output = {
      ...result.outputs.brr,
      metadata: {
        ...result.outputs.brr.metadata,
        nativePreserved: false,
        fidelity: result.fidelity.kind,
      },
    };
  }
  if (options.startByte !== undefined) {
    const fullByteLength = options.fullByteLength ?? native?.length;
    if (!Number.isSafeInteger(fullByteLength) || output.bytes.length !== fullByteLength) {
      throw new Error(
        "Split BRR editing requires the exact fullByteLength; resize the complete stream and repair both bank slices before changing its length.",
      );
    }
  }
  return { primaryOutput: "brr", outputs: { brr: output } };
}

/**
 * Select the ROM-owned part of a verified stream after decoding the complete WAVE.
 * A bank split may occur inside a nine-byte BRR block, so slices are not decoded alone.
 * @param {Uint8Array} brr Complete native BRR stream.
 * @param {Readonly<Record<string, unknown>>} options Half-open byte slice in that stream.
 * @returns {Uint8Array} Owned bytes for the selected ROM bank span.
 */
export function sliceBrrSegment(brr: Uint8Array, options: Readonly<Record<string, unknown>>) {
  const { startByte, byteLength } = options;
  if (typeof startByte !== "number" || !Number.isSafeInteger(startByte) || startByte < 0) {
    throw new Error("BRR segment startByte must be a non-negative integer.");
  }
  if (typeof byteLength !== "number" || !Number.isSafeInteger(byteLength) || byteLength < 1) {
    throw new Error("BRR segment byteLength must be a positive integer.");
  }
  if (startByte + byteLength > brr.length) {
    throw new Error("BRR segment extends beyond the authored block stream.");
  }
  return brr.slice(startByte, startByte + byteLength);
}

/**
 * Convert native 4bpp group indexes to the game's 24-byte interleaved rows.
 * Only zero and the five colors of the selected actor group are representable;
 * native source colors 6/7 both render transparent and cannot be reconstructed.
 * @param {Uint8Array} planar Native 4bpp tiles.
 * @param {number} group Actor palette group, 0 through 2.
 * @returns {Uint8Array} Interleaved 3bpp rows.
 */
export function encodeActor3bpp(planar: Uint8Array, group: number) {
  if (!Number.isInteger(group) || group < 0 || group > 2) {
    throw new Error("actor group must be 0..2.");
  }
  const tiles = decodePlanarTiles(planar, 4);
  const native = tiles.map((tile, tileIndex) =>
    tile.map((row, y) =>
      row.map((pixel, x) => {
        if (pixel !== 0 && (pixel < group * 5 + 1 || pixel > group * 5 + 5)) {
          throw new Error(
            `Actor tile ${tileIndex} pixel ${x},${y}: palette index ${pixel} is outside group ${group}.`,
          );
        }
        return pixel === 0 ? 0 : pixel - group * 5;
      }),
    ),
  );
  return encodeActor3bppNative(native);
}

/** Decode native interleaved rows to source indexes 0..7, retaining 0/6/7 separately.
 * @param {Uint8Array} bytes Interleaved 3bpp tiles.
 * @returns {number[][][]} Tile, row, and pixel indexes.
 */
export function decodeActor3bppNative(bytes: Uint8Array) {
  if (!(bytes instanceof Uint8Array) || bytes.length % 24) {
    throw new Error("Actor stream requires complete 24-byte tiles.");
  }
  return Array.from({ length: bytes.length / 24 }, (_, tileIndex) =>
    Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => {
        const offset = tileIndex * 24 + y * 3;
        const bit = 7 - x;
        return (
          ((bytes[offset] >>> bit) & 1) |
          (((bytes[offset + 1] >>> bit) & 1) << 1) |
          (((bytes[offset + 2] >>> bit) & 1) << 2)
        );
      }),
    ),
  );
}

/** Re-encode native source indexes exactly, including transparent aliases 6 and 7.
 * @param {readonly (readonly (readonly number[])[])[]} tiles Native 3bpp indexes.
 * @returns {Uint8Array} Interleaved 3bpp rows.
 */
export function encodeActor3bppNative(tiles: readonly (readonly (readonly number[])[])[]) {
  const bytes = new Uint8Array(tiles.length * 24);
  tiles.forEach((tile, tileIndex) => {
    if (tile.length !== 8) {
      throw new Error(`Actor tile ${tileIndex} needs eight rows.`);
    }
    tile.forEach((row, y) => {
      if (row.length !== 8) {
        throw new Error(`Actor tile ${tileIndex} row ${y} needs eight pixels.`);
      }
      row.forEach((color, x) => {
        if (!Number.isInteger(color) || color < 0 || color > 7) {
          throw new Error(`Actor tile ${tileIndex} pixel ${x},${y} needs a 3bpp index.`);
        }
        for (let plane = 0; plane < 3; plane++) {
          bytes[tileIndex * 24 + y * 3 + plane] |= ((color >>> plane) & 1) << (7 - x);
        }
      });
    });
  });
  return bytes;
}

/** Decode authored tiles to 4bpp group indexes, refusing lossy 6/7 aliases.
 * @param {Uint8Array} bytes Interleaved 3bpp tiles.
 * @param {number} group Actor palette group, 0 through 2.
 * @returns {Uint8Array} Native 4bpp tiles.
 */
export function decodeActor3bpp(bytes: Uint8Array, group: number) {
  if (!Number.isInteger(group) || group < 0 || group > 2) {
    throw new Error("actor group must be 0..2.");
  }
  const tiles = decodeActor3bppNative(bytes).map((tile) =>
    tile.map((row) =>
      row.map((color) => {
        if (color >= 6) {
          throw new Error("Actor source color 6/7 has no unique 4bpp inverse.");
        }
        return color === 0 ? 0 : color + group * 5;
      }),
    ),
  );
  return encodePlanarTiles(tiles, 4);
}

/** Reviewed forest title traversal: bottom block rows, TL/BL/BR/TR within each block. */
export const somTitleLayout = Object.freeze({
  tileOrder: "blocks",
  blockSize: [2, 2],
  blockOrder: "row-major",
  blockRows: "bottom-to-top",
  withinBlock: "tl-bl-br-tr",
});

/** Group is game metadata; native PNG conversion handles palette and tile layout.
 * @param {Readonly<Record<string, unknown>>} options Actor options, including `group`.
 * @returns {Readonly<Record<string, unknown>>} Options without `group`.
 */
const imageOptions = (options: Readonly<Record<string, unknown>>) => {
  const { group, ...rest } = options;
  if (typeof group !== "number" || !Number.isInteger(group) || group < 0 || group > 2) {
    throw new Error("actor group must be 0..2.");
  }
  return rest;
};

const plugin = definePlugin({
  manifest: {
    id: "som.assets",
    name: "Secret of Mana assets",
    version: "1.0.0",
    apiVersion: PLUGIN_API_VERSION,
    requires: [{ pluginId: "uttori.asm-plugin-snes", version: "1.0.0" }],
  },
  activate(context) {
    context.registerAssetFormat({
      id: "som.room",
      version: "1.0.0",
      targets: ["snes.sfc"],
      resourcePaths: (options) => (typeof options.preview === "string" ? [options.preview] : []),
      convert: convertRoomAsset,
    });
    context.registerAssetFormat({
      id: "som.palette.bgr555",
      version: "1.0.0",
      targets: ["snes.sfc"],
      convert(source, options) {
        if (source.mediaType !== "application/json" || typeof options.palette !== "string") {
          throw new Error("SoM palette asset requires a JSON catalogue and palette address.");
        }
        const bytes = spritePaletteBytes(parseSpritePaletteCatalog(source.bytes), options.palette);
        return { primaryOutput: "palette", outputs: { palette: { bytes } } };
      },
    });
    context.registerAssetFormat({
      id: "som.boss.graphics",
      version: "1.1.0",
      targets: ["snes.sfc"],
      resourcePaths: (options) =>
        [options.layout, options.palettes, options.native].filter(
          (path) => typeof path === "string",
        ),
      convert: convertBossImage,
    });
    context.registerAssetFormat({
      id: "som.sprite.frames",
      version: "1.0.0",
      targets: ["snes.sfc"],
      resourcePaths: (options) =>
        [options.layout, options.palettes].filter((path) => typeof path === "string"),
      convert(source, options, resources) {
        const tiles = encodeFrameAtlas(
          source,
          readFrameLayout(options, resources),
          typeof options.segment === "string" ? options.segment : "",
          readSpritePaletteCatalog(options, resources),
        );
        return { primaryOutput: "tiles", outputs: { tiles: { bytes: tiles } } };
      },
    });
    context.registerAssetFormat({
      id: "som.tile.actor3bpp",
      version: "1.0.0",
      targets: ["snes.sfc"],
      resourcePaths: (options) => {
        const palette = options.palette;
        return typeof palette === "string" && palette !== "embedded" && palette !== "auto"
          ? [palette]
          : [];
      },
      convert(source, options, resources) {
        const converted = convertAsset(registry, {
          source,
          format: "snes.tile.4bpp",
          options: imageOptions(options),
          resources,
        });
        const native = converted.outputs.tiles.bytes;
        const group = options.group;
        if (typeof group !== "number") {
          throw new Error("actor group must be 0..2.");
        }
        const packed = encodeActor3bpp(native, group);
        const decoded = decodeActor3bpp(packed, group);
        if (
          decoded.length !== native.length ||
          decoded.some((byte, index) => byte !== native[index])
        ) {
          throw new Error("Actor conversion failed exact inverse verification.");
        }
        return {
          primaryOutput: "tiles",
          outputs: {
            tiles: { bytes: packed },
            tilemap: { bytes: converted.outputs.tilemap.bytes },
            palette: { bytes: converted.outputs.palette.bytes },
          },
        };
      },
    });
    context.registerAssetFormat({
      id: "som.brr.pcm",
      version: "1.0.0",
      targets: ["snes.sfc"],
      convert: convertBrrWave,
    });
    context.registerAssetFormat({
      id: "som.brr.segment",
      version: "1.0.0",
      targets: ["snes.sfc"],
      convert(source, options) {
        const brr = convertBrrWave(source, options).outputs.brr;
        // The violin stream crosses a ROM bank inside one nine-byte BRR block.
        // Slice only after native encoding so both banks share one editable source.
        return {
          primaryOutput: "brr",
          outputs: { brr: { ...brr, bytes: sliceBrrSegment(brr.bytes, options) } },
        };
      },
    });
    context.registerAssetTransform({
      id: "som.world.rle",
      version: "1.0.0",
      targets: ["snes.sfc"],
      optionSchema: { size: { type: "integer", minimum: 1, maximum: 65536 } },
      encode: (bytes, options) => {
        const size = typeof options.size === "number" ? options.size : 512;
        if (bytes.length !== size) {
          throw new Error("World row size mismatch.");
        }
        return encodeWorldRow(bytes);
      },
      decode: (bytes, options, maxOutputBytes) => {
        const size = typeof options.size === "number" ? options.size : 512;
        if (size > maxOutputBytes) {
          throw new Error("World row exceeds output limit.");
        }
        const result = decodeWorldRow(bytes, size);
        if (result.consumed !== bytes.length) {
          throw new Error("Trailing bytes after world row.");
        }
        return result.data;
      },
    });
    context.registerAssetTransform({
      id: "som.lz",
      version: "1.0.0",
      targets: ["snes.sfc"],
      optionSchema: {
        mode: { type: "enum", enum: ["auto", 0, 1, 2, 3, 4, 5] },
        unusedHeaderByte: { type: "integer", minimum: 0, maximum: 255 },
      },
      validateOptions: (options) => {
        compressSomLz(new Uint8Array(), options);
      },
      encode: (bytes, options) => compressSomLz(bytes, options),
      decode: (bytes, _options, maxOutputBytes) => {
        const result = decompressSomLz(bytes, 0, maxOutputBytes);
        if (result.compressedBytes !== bytes.length) {
          throw new Error("Trailing bytes after SoM LZ stream.");
        }
        return result.data;
      },
    });
  },
});

export default plugin;
