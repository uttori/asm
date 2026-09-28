/** Game-specific asset formats; ROM pointer tables remain in the research tools. */
import { AssetRegistry, convertAsset } from "@uttori/asm-assets";
import { decodeBrrPcm, waveImporter } from "@uttori/asm-assets/audio";
import { pngImporter, withImageEncoders } from "@uttori/asm-assets/image";
import { decodePlanarTiles, encodePlanarTiles, snesNativeEncoders } from "@uttori/asm-assets/snes";
import { definePlugin, PLUGIN_API_VERSION } from "@uttori/asm-core";

import { compressSomLz, decompressSomLz } from "./som-lz.mjs";
import { encodeBossGraphics, expandBossGraphics } from "./som-boss-graphics.mjs";
import { encodeFrameAtlas, readFrameLayout } from "./som-frame-atlas.mjs";
import { parseSpritePaletteCatalog, readSpritePaletteCatalog, spritePaletteBytes } from "./som-sprite-palettes.mjs";
import { convertRoomAsset } from "./som-room-assets.mjs";
import { decodeWorldRow, encodeWorldRow } from "./som-world-rle.mjs";

const registry = new AssetRegistry().registerImporter(pngImporter);
for (const encoder of withImageEncoders(snesNativeEncoders)) registry.registerEncoder(encoder);

/** Read a private PNG chunk holding the exact native boss stream for one segment. */
function nativeBossChunk(png, wanted = "soMz") {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (png.length < 8 || signature.some((byte, index) => png[index] !== byte)) {
    throw new Error("Boss graphics require a PNG source.");
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let native;
  for (let offset = 8; offset < png.length;) {
    if (offset + 12 > png.length) throw new Error("Truncated boss graphics PNG chunk.");
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > png.length) throw new Error("Truncated boss graphics PNG payload.");
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type === wanted) {
      if (native) throw new Error("Duplicate native boss graphics PNG chunk.");
      native = png.slice(offset + 8, end - 4);
    }
    offset = end;
  }
  return native;
}

/** Decode the two graphics stages and reject any unused bytes in a preserved native stream. */
function decodeBossStream(native, storage, size) {
  let intermediate = native;
  let mode;
  let unusedHeaderByte;
  if (storage === "lz-rle") {
    const decoded = decompressSomLz(native);
    if (decoded.compressedBytes !== native.length) throw new Error("Boss LZ stream has trailing bytes.");
    intermediate = decoded.data;
    mode = decoded.mode;
    unusedHeaderByte = decoded.unusedHeaderByte;
  }
  const expanded = expandBossGraphics(intermediate, size);
  if (expanded.consumed !== intermediate.length) throw new Error("Boss mask stream has trailing bytes.");
  return { bytes: expanded.data, mode, unusedHeaderByte };
}

/**
 * Rebuild a fixed ROM span from previewable pixels. An unchanged PNG retains the
 * source's exact token choices; edited pixels use the two-stage encoder and pad
 * only after the decoder's complete stream, preserving later ROM addresses.
 */
export function convertBossImage(source, options, resources = {}) {
  const { storage, byteLength, mode, unusedHeaderByte = 0 } = options;
  if (!["lz-rle", "rle"].includes(storage)) throw new Error("Boss storage must be lz-rle or rle.");
  if (!Number.isSafeInteger(byteLength) || byteLength < 1) {
    throw new Error("Boss byteLength must be a positive integer.");
  }
  // Frame atlases invert their recorded tile placements before the boss codecs.
  // Older native-order sheets remain supported for existing callers.
  const layout = options.layout ? readFrameLayout(options, resources) : undefined;
  const pixels = layout
    ? encodeFrameAtlas(source, layout, options.segment, readSpritePaletteCatalog(options, resources))
    : convertAsset(registry, { source, format: "snes.tile.4bpp" }).outputs.tiles.bytes;
  const segmentIndex = layout ? Object.keys(layout.segments).indexOf(options.segment) : -1;
  if (segmentIndex > 25) throw new Error("Boss atlas supports at most 26 native segments.");
  const chunkName = segmentIndex < 0 ? "soMz" : `soM${String.fromCharCode(65 + segmentIndex)}`;
  const original = nativeBossChunk(source.bytes, chunkName);
  if (original) {
    if (original.length !== byteLength) throw new Error("Boss PNG native chunk has the wrong byte length.");
    const decoded = decodeBossStream(original, storage, pixels.length);
    if (decoded.bytes.every((byte, index) => byte === pixels[index])) {
      return { primaryOutput: "graphics", outputs: { graphics: { bytes: original } } };
    }
  }
  const intermediate = encodeBossGraphics(pixels);
  let encoded = intermediate;
  if (storage === "lz-rle") {
    const selectedMode = original ? original[0] : mode;
    const selectedHeaderByte = original ? original[1] : unusedHeaderByte;
    encoded = compressSomLz(intermediate, { mode: selectedMode, unusedHeaderByte: selectedHeaderByte });
  }
  if (encoded.length > byteLength) throw new Error("Edited boss graphics exceed their fixed ROM span.");
  const verified = decodeBossStream(encoded, storage, pixels.length).bytes;
  if (verified.some((byte, index) => byte !== pixels[index])) throw new Error("Boss graphics inverse failed.");
  const padded = new Uint8Array(byteLength);
  padded.set(encoded);
  if (original) padded.set(original.subarray(encoded.length), encoded.length);
  return { primaryOutput: "graphics", outputs: { graphics: { bytes: padded } } };
}

/**
 * Read the native BRR chunk from a playable PCM WAVE and verify every decoded sample.
 * @param {import('@uttori/asm-assets').AssetInput} source Authored WAVE with an sBRR chunk.
 * @returns {Uint8Array} Exact complete BRR stream owned by the caller.
 */
export function verifiedBrrFromWave(source) {
  const document = waveImporter.import(source);
  const pcm = document.value.samples;
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
  let native;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw new Error("Truncated SoM BRR WAVE chunk.");
    const length = view.getUint32(offset + 4, true);
    const end = offset + 8 + length;
    if (end + (length & 1) > bytes.length) throw new Error("Truncated SoM BRR WAVE data.");
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (id === "sBRR") {
      if (native) throw new Error("Duplicate native BRR chunk in SoM WAVE.");
      native = bytes.slice(offset + 8, end);
    }
    offset = end + (length & 1);
  }
  if (!native) throw new Error("SoM WAVE is missing its native sBRR chunk.");
  const decoded = decodeBrrPcm(native);
  if (decoded.length !== pcm.length || decoded.some((sample, index) => sample !== pcm[index])) {
    throw new Error("SoM WAVE PCM no longer matches its native BRR blocks.");
  }
  return native;
}

/**
 * Select the ROM-owned part of a verified stream after decoding the complete WAVE.
 * A bank split may occur inside a nine-byte BRR block, so slices are not decoded alone.
 * @param {Uint8Array} brr Complete native BRR stream.
 * @param {Readonly<Record<string, unknown>>} options Half-open byte slice in that stream.
 * @returns {Uint8Array} Owned bytes for the selected ROM bank span.
 */
export function sliceBrrSegment(brr, options) {
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
 */
export function encodeActor3bpp(planar, group) {
  if (!Number.isInteger(group) || group < 0 || group > 2)
    throw new Error("actor group must be 0..2.");
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

/** Decode native interleaved rows to source indexes 0..7, retaining 0/6/7 separately. */
export function decodeActor3bppNative(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length % 24)
    throw new Error("Actor stream requires complete 24-byte tiles.");
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

/** Re-encode native source indexes exactly, including transparent aliases 6 and 7. */
export function encodeActor3bppNative(tiles) {
  const bytes = new Uint8Array(tiles.length * 24);
  tiles.forEach((tile, tileIndex) => {
    if (tile.length !== 8) throw new Error(`Actor tile ${tileIndex} needs eight rows.`);
    tile.forEach((row, y) => {
      if (row.length !== 8) throw new Error(`Actor tile ${tileIndex} row ${y} needs eight pixels.`);
      row.forEach((color, x) => {
        if (!Number.isInteger(color) || color < 0 || color > 7)
          throw new Error(`Actor tile ${tileIndex} pixel ${x},${y} needs a 3bpp index.`);
        for (let plane = 0; plane < 3; plane++) {
          bytes[tileIndex * 24 + y * 3 + plane] |= ((color >>> plane) & 1) << (7 - x);
        }
      });
    });
  });
  return bytes;
}

/** Decode authored tiles to 4bpp group indexes, refusing lossy 6/7 aliases. */
export function decodeActor3bpp(bytes, group) {
  if (!Number.isInteger(group) || group < 0 || group > 2)
    throw new Error("actor group must be 0..2.");
  const tiles = decodeActor3bppNative(bytes).map((tile) =>
    tile.map((row) =>
      row.map((color) => {
        if (color >= 6) throw new Error("Actor source color 6/7 has no unique 4bpp inverse.");
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

/** Group is game metadata; native PNG conversion handles palette and tile layout. */
const imageOptions = (options) => {
  const { group, ...imageOptions } = options;
  if (!Number.isInteger(group) || group < 0 || group > 2)
    throw new Error("actor group must be 0..2.");
  return imageOptions;
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
      resourcePaths: (options) => typeof options.preview === "string" ? [options.preview] : [],
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
      version: "1.0.0",
      targets: ["snes.sfc"],
      resourcePaths: (options) => typeof options.layout === "string"
        ? [options.layout, options.palettes].filter((path) => typeof path === "string")
        : [],
      convert: convertBossImage,
    });
    context.registerAssetFormat({
      id: "som.sprite.frames",
      version: "1.0.0",
      targets: ["snes.sfc"],
      resourcePaths: (options) => [options.layout, options.palettes].filter((path) => typeof path === "string"),
      convert(source, options, resources) {
        const tiles = encodeFrameAtlas(
          source,
          readFrameLayout(options, resources),
          options.segment,
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
        const packed = encodeActor3bpp(native, options.group);
        const decoded = decodeActor3bpp(packed, options.group);
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
      convert(source) {
        return {
          primaryOutput: "brr",
          outputs: { brr: { bytes: verifiedBrrFromWave(source) } },
        };
      },
    });
    context.registerAssetFormat({
      id: "som.brr.segment",
      version: "1.0.0",
      targets: ["snes.sfc"],
      convert(source, options) {
        const brr = verifiedBrrFromWave(source);
        // The violin stream crosses a ROM bank inside one nine-byte BRR block.
        // Slice only after native encoding so both banks share one editable source.
        return {
          primaryOutput: "brr",
          outputs: { brr: { bytes: sliceBrrSegment(brr, options) } },
        };
      },
    });
    context.registerAssetTransform({
      id: "som.world.rle",
      version: "1.0.0",
      targets: ["snes.sfc"],
      optionSchema: { size: { type: "integer", minimum: 1, maximum: 65536 } },
      encode: (bytes, options) => {
        if (bytes.length !== (options.size ?? 512)) throw new Error("World row size mismatch.");
        return encodeWorldRow(bytes);
      },
      decode: (bytes, options, maxOutputBytes) => {
        const size = options.size ?? 512;
        if (size > maxOutputBytes) throw new Error("World row exceeds output limit.");
        const result = decodeWorldRow(bytes, size);
        if (result.consumed !== bytes.length) throw new Error("Trailing bytes after world row.");
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
        if (result.compressedBytes !== bytes.length)
          throw new Error("Trailing bytes after SoM LZ stream.");
        return result.data;
      },
    });
  },
});

export default plugin;
