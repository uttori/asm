import type { AssetCodec, AssetValue } from "@uttori/asm-disassembler";

import {
  arrayValue,
  decodedObject,
  defaultPath,
  integerValue,
  jsonFile,
  optionsFor,
  readBytes,
  resolveCount,
  stringOption,
} from "./common.js";

/** Stable id of the SNES 2bpp planar-tile codec. */
export const SNES_TILE_2BPP_ASSET_CODEC_ID = "snes.asset.tile.2bpp";
/** Stable id of the SNES 3bpp planar-tile codec. */
export const SNES_TILE_3BPP_ASSET_CODEC_ID = "snes.asset.tile.3bpp";
/** Stable id of the SNES 4bpp planar-tile codec. */
export const SNES_TILE_4BPP_ASSET_CODEC_ID = "snes.asset.tile.4bpp";
/** Stable id of the SNES 8bpp planar-tile codec. */
export const SNES_TILE_8BPP_ASSET_CODEC_ID = "snes.asset.tile.8bpp";
/** Stable id of the SNES Mode 7 chunky-tile codec. */
export const SNES_MODE7_TILE_ASSET_CODEC_ID = "snes.asset.tile.mode7";

const planeOffset = (bitsPerPixel: number, plane: number, row: number): number => {
  if (bitsPerPixel === 3 && plane === 2) {
    return 16 + row;
  }
  return Math.floor(plane / 2) * 16 + row * 2 + (plane % 2);
};

const decodePlanarTile = (
  bytes: Uint8Array,
  start: number,
  bitsPerPixel: number,
): readonly (readonly number[])[] =>
  Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, column) => {
      let pixel = 0;
      for (let plane = 0; plane < bitsPerPixel; plane++) {
        const byte = bytes[start + planeOffset(bitsPerPixel, plane, row)] ?? 0;
        pixel |= ((byte >> (7 - column)) & 1) << plane;
      }
      return pixel;
    }),
  );

const encodeTilePixels = (
  value: AssetValue,
  owner: string,
  tileIndex: number,
  maximum: number,
): readonly (readonly number[])[] => {
  const rows = arrayValue(value, `SNES tile ${tileIndex} pixels`);
  if (rows.length !== 8) {
    throw new Error(`SNES tile ${tileIndex} must contain exactly 8 rows.`);
  }
  return rows.map((row, rowIndex) => {
    const pixels = arrayValue(row, `SNES tile ${tileIndex} row ${rowIndex}`);
    if (pixels.length !== 8) {
      throw new Error(`SNES tile ${tileIndex} row ${rowIndex} must contain exactly 8 pixels.`);
    }
    return pixels.map((pixel, column) =>
      integerValue(pixel, `SNES tile '${owner}' pixel ${rowIndex},${column}`, 0, maximum),
    );
  });
};

const planarTileCodec = (id: string, bitsPerPixel: 2 | 3 | 4 | 8): AssetCodec => {
  const bytesPerTile = bitsPerPixel * 8;
  return Object.freeze({
    id,
    version: "1.0.0",
    sizeBounds: { minimum: bytesPerTile, alignment: 1 },
    inspect: (context) => {
      const { count, size } = resolveCount(context, bytesPerTile);
      return {
        size,
        metadata: { format: "snes-planar", bitsPerPixel, tileWidth: 8, tileHeight: 8, count },
      };
    },
    decode: (context) => {
      const options = optionsFor(context);
      const { count, size } = resolveCount(context, bytesPerTile, options);
      const bytes = readBytes(
        context.source,
        context.request.sourceOffset,
        size,
        context.request.id,
      );
      const tiles = Array.from({ length: count }, (_, index) =>
        decodePlanarTile(bytes, index * bytesPerTile, bitsPerPixel),
      );
      const value: AssetValue = {
        kind: "snes-planar-tiles",
        bitsPerPixel,
        tileWidth: 8,
        tileHeight: 8,
        tiles,
      };
      const path = stringOption(
        options,
        "path",
        defaultPath(context.request.id, `${bitsPerPixel}bpp.json`),
      );
      return { value, files: [jsonFile(path, value)] };
    },
    encode: (context) => {
      const { count, size } = resolveCount(context, bytesPerTile);
      const value = decodedObject(context.decoded.value, context.request.id);
      const tiles = arrayValue(value.tiles, `SNES tile asset '${context.request.id}' tiles`);
      if (tiles.length !== count) {
        throw new Error(`SNES tile asset '${context.request.id}' requires exactly ${count} tiles.`);
      }
      const bytes = new Uint8Array(size);
      tiles.forEach((tile, tileIndex) => {
        const pixels = encodeTilePixels(tile, context.request.id, tileIndex, 2 ** bitsPerPixel - 1);
        for (let row = 0; row < 8; row++) {
          for (let column = 0; column < 8; column++) {
            const pixel = pixels[row][column];
            for (let plane = 0; plane < bitsPerPixel; plane++) {
              if ((pixel & (1 << plane)) !== 0) {
                const offset = tileIndex * bytesPerTile + planeOffset(bitsPerPixel, plane, row);
                bytes[offset] |= 1 << (7 - column);
              }
            }
          }
        }
      });
      return bytes;
    },
  } satisfies AssetCodec);
};

const mode7TileCodec: AssetCodec = Object.freeze({
  id: SNES_MODE7_TILE_ASSET_CODEC_ID,
  version: "1.0.0",
  sizeBounds: { minimum: 64 },
  inspect: (context) => {
    const { count, size } = resolveCount(context, 64);
    return {
      size,
      metadata: {
        format: "snes-mode7-chunky",
        bitsPerPixel: 8,
        tileWidth: 8,
        tileHeight: 8,
        count,
      },
    };
  },
  decode: (context) => {
    const options = optionsFor(context);
    const { count, size } = resolveCount(context, 64, options);
    const bytes = readBytes(context.source, context.request.sourceOffset, size, context.request.id);
    const tiles = Array.from({ length: count }, (_, tileIndex) =>
      Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 8 }, (_, column) => bytes[tileIndex * 64 + row * 8 + column]),
      ),
    );
    const value: AssetValue = {
      kind: "snes-mode7-tiles",
      bitsPerPixel: 8,
      tileWidth: 8,
      tileHeight: 8,
      tiles,
    };
    const path = stringOption(options, "path", defaultPath(context.request.id, "mode7.json"));
    return { value, files: [jsonFile(path, value)] };
  },
  encode: (context) => {
    const { count, size } = resolveCount(context, 64);
    const value = decodedObject(context.decoded.value, context.request.id);
    const tiles = arrayValue(value.tiles, `SNES Mode 7 asset '${context.request.id}' tiles`);
    if (tiles.length !== count) {
      throw new Error(`SNES Mode 7 asset '${context.request.id}' requires exactly ${count} tiles.`);
    }
    const bytes = new Uint8Array(size);
    tiles.forEach((tile, tileIndex) => {
      const pixels = encodeTilePixels(tile, context.request.id, tileIndex, 0xff);
      pixels.forEach((row, rowIndex) =>
        row.forEach((pixel, column) => {
          bytes[tileIndex * 64 + rowIndex * 8 + column] = pixel;
        }),
      );
    });
    return bytes;
  },
} satisfies AssetCodec);

/** SNES 2bpp planar tiles. */
export const snesTile2BppAssetCodec = planarTileCodec(SNES_TILE_2BPP_ASSET_CODEC_ID, 2);
/** SNES 3bpp planar tiles. */
export const snesTile3BppAssetCodec = planarTileCodec(SNES_TILE_3BPP_ASSET_CODEC_ID, 3);
/** SNES 4bpp planar tiles. */
export const snesTile4BppAssetCodec = planarTileCodec(SNES_TILE_4BPP_ASSET_CODEC_ID, 4);
/** SNES 8bpp planar tiles. */
export const snesTile8BppAssetCodec = planarTileCodec(SNES_TILE_8BPP_ASSET_CODEC_ID, 8);
/** SNES Mode 7 row-major 8bpp tiles. */
export const snesMode7TileAssetCodec = mode7TileCodec;
