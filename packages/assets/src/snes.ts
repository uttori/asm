import type { AssetDocument, AssetEncoder } from "./registry.js";
import { integer, unitCount } from "./validation.js";

/** One 8×8 tile of native palette indexes, with rows in display order. */
export type Tile = readonly (readonly number[])[];
/** Native planar depths; Mode 7 uses a separate byte-per-pixel layout. */
export type PlanarDepth = 2 | 3 | 4 | 8;
/** A CGRAM word retains bit 15 even though it has no displayed color channel. */
export interface Bgr555Color {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly unusedHighBit: number;
}
/** One SNES background map word, including attributes that previews may ignore. */
export interface BgMapEntry {
  readonly tile: number;
  readonly palette: number;
  readonly priority: number;
  readonly horizontalFlip: number;
  readonly verticalFlip: number;
}
/** A native BRR block; nibbles are signed integers, not decoded PCM samples. */
export interface BrrBlock {
  readonly range: number;
  readonly filter: number;
  readonly loop: number;
  readonly end: number;
  readonly nibbles: readonly number[];
}

const planeOffset = (depth: PlanarDepth, plane: number, row: number): number => {
  // Ordinary 3bpp stores plane 2 after both interleaved lower planes.
  if (depth === 3 && plane === 2) {
    return 16 + row;
  }
  return Math.floor(plane / 2) * 16 + row * 2 + (plane % 2);
};

const validateTile = (tile: Tile, label: string, maximum: number): void => {
  if (tile.length !== 8) {
    throw new RangeError(`${label} must contain exactly 8 rows.`);
  }
  tile.forEach((row, y) => {
    if (row.length !== 8) {
      throw new RangeError(`${label} row ${y} must contain exactly 8 pixels.`);
    }
    row.forEach((pixel, x) => integer(pixel, `${label} pixel ${x},${y}`, 0, maximum));
  });
};

/** Decode complete planar tiles; the caller retains ownership of input bytes.
 * @param {Uint8Array} bytes Borrowed complete tile stream.
 * @param {PlanarDepth} depth Native bit planes per pixel.
 * @returns {Tile[]} Display-order tiles with separate pixel arrays.
 */
export function decodePlanarTiles(bytes: Uint8Array, depth: PlanarDepth): Tile[] {
  const size = depth * 8;
  const count = unitCount(bytes, size, "Planar tile stream");
  return Array.from({ length: count }, (_, tileIndex) =>
    Array.from({ length: 8 }, (_row, row) =>
      Array.from({ length: 8 }, (_column, column) => {
        let pixel = 0;
        for (let plane = 0; plane < depth; plane++) {
          const byte = bytes[tileIndex * size + planeOffset(depth, plane, row)];
          pixel |= ((byte >> (7 - column)) & 1) << plane;
        }
        return pixel;
      }),
    ),
  );
}

/** Encode new planar tiles without a source ROM or fixed output capacity.
 * @param {Tile[]} tiles Display-order pixels, each exactly 8×8.
 * @param {PlanarDepth} depth Native bit planes per pixel.
 * @returns {Uint8Array} Owned planar tile bytes.
 */
export function encodePlanarTiles(tiles: readonly Tile[], depth: PlanarDepth): Uint8Array {
  const size = depth * 8;
  const bytes = new Uint8Array(tiles.length * size);
  tiles.forEach((tile, tileIndex) => {
    validateTile(tile, `Tile ${tileIndex}`, 2 ** depth - 1);
    tile.forEach((row, y) =>
      row.forEach((pixel, x) => {
        for (let plane = 0; plane < depth; plane++) {
          if ((pixel & (1 << plane)) !== 0) {
            bytes[tileIndex * size + planeOffset(depth, plane, y)] |= 1 << (7 - x);
          }
        }
      }),
    );
  });
  return bytes;
}

/** Decode Mode 7's chunky tile bytes, which differ from planar 8bpp.
 * @param {Uint8Array} bytes Borrowed complete tile stream.
 * @returns {Tile[]} Display-order tiles with byte indexes.
 */
export function decodeMode7Tiles(bytes: Uint8Array): Tile[] {
  const count = unitCount(bytes, 64, "Mode 7 tile stream");
  return Array.from({ length: count }, (_, tileIndex) =>
    Array.from({ length: 8 }, (_row, row) =>
      Array.from({ length: 8 }, (_column, column) => bytes[tileIndex * 64 + row * 8 + column]),
    ),
  );
}

/** Encode Mode 7's row-major byte-per-pixel tiles.
 * @param {Tile[]} tiles Display-order pixels, each exactly 8×8.
 * @returns {Uint8Array} Owned chunky tile bytes.
 */
export function encodeMode7Tiles(tiles: readonly Tile[]): Uint8Array {
  const bytes = new Uint8Array(tiles.length * 64);
  tiles.forEach((tile, tileIndex) => {
    validateTile(tile, `Mode 7 tile ${tileIndex}`, 255);
    tile.forEach((row, y) =>
      row.forEach((pixel, x) => {
        bytes[tileIndex * 64 + y * 8 + x] = pixel;
      }),
    );
  });
  return bytes;
}

/** Decode exact CGRAM words, including the unused high bit.
 * @param {Uint8Array} bytes Borrowed little-endian CGRAM words.
 * @returns {Bgr555Color[]} 5-bit channels and preserved bit 15.
 */
export function decodeBgr555(bytes: Uint8Array): Bgr555Color[] {
  const count = unitCount(bytes, 2, "BGR555 palette");
  return Array.from({ length: count }, (_, index) => {
    const word = bytes[index * 2] | (bytes[index * 2 + 1] << 8);
    return {
      red: word & 31,
      green: (word >> 5) & 31,
      blue: (word >> 10) & 31,
      unusedHighBit: (word >> 15) & 1,
    };
  });
}

/** Encode fresh CGRAM colors; callers choose any desired palette padding.
 * @param {Bgr555Color[]} colors 5-bit channels and explicit bit 15.
 * @returns {Uint8Array} Owned little-endian CGRAM words.
 */
export function encodeBgr555(colors: readonly Bgr555Color[]): Uint8Array {
  const bytes = new Uint8Array(colors.length * 2);
  colors.forEach((color, index) => {
    const word =
      integer(color.red, `Color ${index} red`, 0, 31) |
      (integer(color.green, `Color ${index} green`, 0, 31) << 5) |
      (integer(color.blue, `Color ${index} blue`, 0, 31) << 10) |
      (integer(color.unusedHighBit, `Color ${index} unusedHighBit`, 0, 1) << 15);
    bytes[index * 2] = word & 255;
    bytes[index * 2 + 1] = word >> 8;
  });
  return bytes;
}

/** Decode packed BG map words in storage order; screen layout is a separate concern.
 * @param {Uint8Array} bytes Borrowed little-endian map words.
 * @returns {BgMapEntry[]} Every tile index and attribute field.
 */
export function decodeBgMap(bytes: Uint8Array): BgMapEntry[] {
  const count = unitCount(bytes, 2, "BG tilemap");
  return Array.from({ length: count }, (_, index) => {
    const word = bytes[index * 2] | (bytes[index * 2 + 1] << 8);
    return {
      tile: word & 0x3ff,
      palette: (word >> 10) & 7,
      priority: (word >> 13) & 1,
      horizontalFlip: (word >> 14) & 1,
      verticalFlip: (word >> 15) & 1,
    };
  });
}

/** Encode BG map words without assigning physical screen blocks.
 * @param {BgMapEntry[]} entries Map entries already arranged in storage order.
 * @returns {Uint8Array} Owned little-endian map words.
 */
export function encodeBgMap(entries: readonly BgMapEntry[]): Uint8Array {
  const bytes = new Uint8Array(entries.length * 2);
  entries.forEach((entry, index) => {
    const word =
      integer(entry.tile, `Entry ${index} tile`, 0, 0x3ff) |
      (integer(entry.palette, `Entry ${index} palette`, 0, 7) << 10) |
      (integer(entry.priority, `Entry ${index} priority`, 0, 1) << 13) |
      (integer(entry.horizontalFlip, `Entry ${index} horizontalFlip`, 0, 1) << 14) |
      (integer(entry.verticalFlip, `Entry ${index} verticalFlip`, 0, 1) << 15);
    bytes[index * 2] = word & 255;
    bytes[index * 2 + 1] = word >> 8;
  });
  return bytes;
}

/** Decode byte-indexed Mode 7 maps, retaining index zero as an ordinary value.
 * @param {Uint8Array} bytes Borrowed map index bytes.
 * @returns {number[]} A copied array of tile indexes.
 */
export function decodeMode7Map(bytes: Uint8Array): number[] {
  return [...bytes];
}

/** Encode byte-indexed Mode 7 maps.
 * @param {number[]} indexes Tile indexes in native map storage order.
 * @returns {Uint8Array} Owned map bytes.
 */
export function encodeMode7Map(indexes: readonly number[]): Uint8Array {
  return Uint8Array.from(indexes.map((value, index) => integer(value, `Index ${index}`, 0, 255)));
}

/** Decode native BRR block fields only; this does not reconstruct PCM.
 * @param {Uint8Array} bytes Borrowed complete nine-byte blocks.
 * @returns {BrrBlock[]} Signed nibbles and exact header fields.
 */
export function decodeBrrBlocks(bytes: Uint8Array): BrrBlock[] {
  const count = unitCount(bytes, 9, "BRR stream");
  return Array.from({ length: count }, (_, blockIndex) => {
    const offset = blockIndex * 9;
    const header = bytes[offset];
    const nibbles = Array.from({ length: 16 }, (_sample, sampleIndex) => {
      const byte = bytes[offset + 1 + Math.floor(sampleIndex / 2)];
      const nibble = sampleIndex % 2 === 0 ? byte >> 4 : byte & 15;
      return nibble >= 8 ? nibble - 16 : nibble;
    });
    return {
      range: header >> 4,
      filter: (header >> 2) & 3,
      loop: (header >> 1) & 1,
      end: header & 1,
      nibbles,
    };
  });
}

/** Encode signed BRR nibbles byte-exactly; PCM encoding is a different, lossy operation.
 * @param {BrrBlock[]} blocks Native BRR headers and signed nibbles.
 * @returns {Uint8Array} Owned nine-byte blocks.
 */
export function encodeBrrBlocks(blocks: readonly BrrBlock[]): Uint8Array {
  const bytes = new Uint8Array(blocks.length * 9);
  blocks.forEach((block, index) => {
    if (block.nibbles.length !== 16) {
      throw new RangeError(`BRR block ${index} requires exactly 16 nibbles.`);
    }
    const offset = index * 9;
    bytes[offset] =
      (integer(block.range, `BRR block ${index} range`, 0, 15) << 4) |
      (integer(block.filter, `BRR block ${index} filter`, 0, 3) << 2) |
      (integer(block.loop, `BRR block ${index} loop`, 0, 1) << 1) |
      integer(block.end, `BRR block ${index} end`, 0, 1);
    for (let sampleIndex = 0; sampleIndex < 16; sampleIndex += 2) {
      const high = integer(block.nibbles[sampleIndex], `BRR nibble ${sampleIndex}`, -8, 7) & 15;
      const low =
        integer(block.nibbles[sampleIndex + 1], `BRR nibble ${sampleIndex + 1}`, -8, 7) & 15;
      bytes[offset + 1 + sampleIndex / 2] = (high << 4) | low;
    }
  });
  return bytes;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sameModelValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((entry, index) => sameModelValue(entry, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) {
    return false;
  }
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) && sameModelValue(left[key], right[key]))
  );
};

const readNumber = (value: unknown, label: string): number => {
  if (typeof value !== "number") {
    throw new TypeError(`${label} must be a number.`);
  }
  return value;
};

const readTiles = (value: unknown): Tile[] => {
  if (!Array.isArray(value)) {
    throw new TypeError("Native tile model 'tiles' must be an array.");
  }
  return value.map((tile, tileIndex) => {
    if (!Array.isArray(tile)) {
      throw new TypeError(`Tile ${tileIndex} must be an array of rows.`);
    }
    return tile.map((row, rowIndex) => {
      if (!Array.isArray(row)) {
        throw new TypeError(`Tile ${tileIndex} row ${rowIndex} must be an array of pixels.`);
      }
      return row.map((pixel, column) =>
        readNumber(pixel, `Tile ${tileIndex} pixel ${column},${rowIndex}`),
      );
    });
  });
};

const readColors = (value: unknown): Bgr555Color[] => {
  if (!Array.isArray(value)) {
    throw new TypeError("Native palette model 'colors' must be an array.");
  }
  return value.map((color, index) => {
    if (!isRecord(color)) {
      throw new TypeError(`Color ${index} must be an object.`);
    }
    return {
      red: readNumber(color.red, `Color ${index} red`),
      green: readNumber(color.green, `Color ${index} green`),
      blue: readNumber(color.blue, `Color ${index} blue`),
      unusedHighBit: readNumber(color.unusedHighBit, `Color ${index} unusedHighBit`),
    };
  });
};

const readEntries = (value: unknown): BgMapEntry[] => {
  if (!Array.isArray(value)) {
    throw new TypeError("Native tilemap model 'entries' must be an array.");
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new TypeError(`Entry ${index} must be an object.`);
    }
    return {
      tile: readNumber(entry.tile, `Entry ${index} tile`),
      palette: readNumber(entry.palette, `Entry ${index} palette`),
      priority: readNumber(entry.priority, `Entry ${index} priority`),
      horizontalFlip: readNumber(entry.horizontalFlip, `Entry ${index} horizontalFlip`),
      verticalFlip: readNumber(entry.verticalFlip, `Entry ${index} verticalFlip`),
    };
  });
};

const readIndexes = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    throw new TypeError("Native tilemap model 'indexes' must be an array.");
  }
  return value.map((entry, index) => readNumber(entry, `Index ${index}`));
};

const readBlocks = (value: unknown): BrrBlock[] => {
  if (!Array.isArray(value)) {
    throw new TypeError("Native BRR model 'blocks' must be an array.");
  }
  return value.map((block, index) => {
    if (!isRecord(block) || !Array.isArray(block.nibbles)) {
      throw new TypeError(`BRR block ${index} must be an object with nibbles.`);
    }
    return {
      range: readNumber(block.range, `BRR block ${index} range`),
      filter: readNumber(block.filter, `BRR block ${index} filter`),
      loop: readNumber(block.loop, `BRR block ${index} loop`),
      end: readNumber(block.end, `BRR block ${index} end`),
      nibbles: block.nibbles.map((nibble, sampleIndex) =>
        readNumber(nibble, `BRR nibble ${sampleIndex}`),
      ),
    };
  });
};

const nativeEncoder = (
  id: string,
  kind: string,
  output: string,
  modelField: string,
  encode: (value: Record<string, unknown>) => Uint8Array,
  decode: (bytes: Uint8Array) => unknown,
): AssetEncoder =>
  Object.freeze({
    id,
    version: "1.0.0",
    inputKinds: [kind],
    primaryOutput: output,
    encode: (document: AssetDocument, options: Readonly<Record<string, unknown>>) => {
      if (Object.keys(options).length !== 0) {
        throw new Error(`Native encoder '${id}' accepts no options.`);
      }
      if (!isRecord(document.value)) {
        throw new Error(`Native encoder '${id}' requires an object model.`);
      }
      const value = document.value;
      const bytes = encode(value);
      // The exact fidelity record is earned by reconstructing the supplied native model.
      if (!sameModelValue(decode(bytes), value[modelField])) {
        throw new Error(`Native encoder '${id}' did not preserve '${modelField}'.`);
      }
      return {
        outputs: { [output]: { bytes, mediaType: "application/octet-stream" } },
        fidelity: { kind: "exact" as const, verification: "native model round trip" },
        normalizedOptions: {},
      };
    },
  });

/** Native model encoders use the canonical short IDs and need no ROM or assembler. */
export const snesNativeEncoders: readonly AssetEncoder[] = Object.freeze(
  [
    ...([2, 3, 4, 8] as const).map((depth) =>
      nativeEncoder(
        `snes.tile.${depth}bpp`,
        "snes-planar-tiles",
        "tiles",
        "tiles",
        (value) => encodePlanarTiles(readTiles(value.tiles), depth),
        (bytes) => decodePlanarTiles(bytes, depth),
      ),
    ),
    nativeEncoder(
      "snes.tile.mode7",
      "snes-mode7-tiles",
      "tiles",
      "tiles",
      (value) => encodeMode7Tiles(readTiles(value.tiles)),
      decodeMode7Tiles,
    ),
    nativeEncoder(
      "snes.palette.bgr555",
      "snes-palette-bgr555",
      "palette",
      "colors",
      (value) => encodeBgr555(readColors(value.colors)),
      decodeBgr555,
    ),
    nativeEncoder(
      "snes.tilemap.bg",
      "snes-bg-tilemap",
      "tilemap",
      "entries",
      (value) => encodeBgMap(readEntries(value.entries)),
      decodeBgMap,
    ),
    nativeEncoder(
      "snes.tilemap.mode7",
      "snes-mode7-tilemap",
      "tilemap",
      "indexes",
      (value) => encodeMode7Map(readIndexes(value.indexes)),
      decodeMode7Map,
    ),
    nativeEncoder(
      "snes.brr",
      "snes-brr",
      "brr",
      "blocks",
      (value) => encodeBrrBlocks(readBlocks(value.blocks)),
      decodeBrrBlocks,
    ),
  ].toSorted((left, right) => left.id.localeCompare(right.id)),
);
