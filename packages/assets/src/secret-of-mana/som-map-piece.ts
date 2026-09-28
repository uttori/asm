/** Native map tile-ID compression; separate from the boot/graphics LZ format. */
import assert from "node:assert/strict";

interface MapCommand {
  offset: number;
  opcode: number;
  destination: number;
  count: number;
  emitted: number;
}

interface MapMotif {
  offset: number;
  dimensions: number;
  width: number;
  height: number;
  consumed: number;
  tiles: number[];
  commands: MapCommand[];
}

/**
 * Decode a complete pointer-bounded map piece. C0CD93..C0D032
 * emits into 128-byte WRAM rows, but its history wraps at the logical piece width. This returns
 * compact row-major tile IDs, not SNES graphics or a reconstructed capture RAM image.
 * Motif commands reserve one unwritten base cell; C0CD4D applies their rectangles afterward.
 * History references to those still-unwritten cells, recursive motifs and truncated input fail closed.
 * @param {Uint8Array} bytes Pointer-bounded map piece.
 * @returns {object} Compact row-major tile IDs and the consumed extent.
 */
export function decodeMapPiece(bytes: Uint8Array) {
  assert(bytes.length >= 3, "Missing map header/data.");
  const width = (bytes[0] >>> 1) + 1;
  const height = (bytes[1] >>> 1) + 1;
  let dataOffset = 2;
  const motifs = [];
  if ((bytes[0] | bytes[1]) & 1) {
    // The native header scanner stops at any byte >= F8. Only FE/FF separators
    // are accepted here, and each motif must decode exactly to that boundary.
    let marker;
    do {
      assert(dataOffset < bytes.length, "Missing motif dimensions.");
      const dimensions = bytes[dataOffset++],
        start = dataOffset;
      while (dataOffset < bytes.length && bytes[dataOffset] < 0xf8) {
        dataOffset++;
      }
      assert(dataOffset < bytes.length, "Unterminated motif definition.");
      marker = bytes[dataOffset++];
      assert(marker === 0xfe || marker === 0xff, "Unsupported motif separator.");
      const decoded = decodeMapStream(
        bytes.slice(start, dataOffset - 1),
        (dimensions & 15) + 1,
        (dimensions >>> 4) + 1,
        [],
      );
      motifs.push({ offset: start, dimensions, ...decoded });
      assert(motifs.length <= 8, "Motif definitions exceed the native eight-record workspace.");
    } while (marker !== 0xff);
  }
  const decoded = decodeMapStream(bytes.slice(dataOffset), width, height, motifs);
  const consumed = dataOffset + decoded.consumed;
  const commands = decoded.commands.map((c) => ({ ...c, offset: c.offset + dataOffset }));
  if (!motifs.length) {
    return { width, height, consumed, tiles: decoded.tiles, commands };
  }
  return { ...decoded, consumed, commands, dataOffset, motifs };
}

/** Decode one bounded stream; motif overlays cannot supply history to the earlier base pass.
 * @param {Uint8Array} bytes Command bytes for one piece or motif.
 * @param {number} width Logical tile width.
 * @param {number} height Logical tile height.
 * @param {readonly object[]} motifs Motifs already decoded for this piece.
 * @returns {object} Tiles, commands, and motif insertions.
 */
function decodeMapStream(
  bytes: Uint8Array,
  width: number,
  height: number,
  motifs: readonly MapMotif[],
) {
  const output: (number | null)[] = [];
  const commands: MapCommand[] = [];
  const insertions: { index: number; destination: number }[] = [];
  let offset = 0;
  const take = () => {
    assert(offset < bytes.length, "Truncated map command.");
    return bytes[offset++];
  };
  const previous = (distance: number) => {
    assert(distance > 0 && distance <= output.length, "Map history precedes decoded output.");
    const value = output[output.length - distance];
    assert(value !== null, "Map history depends on an unwritten motif placeholder.");
    return value;
  };
  while (output.length < width * height) {
    const start = offset;
    const destination = output.length;
    const opcode = take();
    let count = 1;
    let emit: () => number | null;
    if (opcode < 0xc0) {
      emit = () => opcode;
    } else if (opcode < 0xe0) {
      count = (opcode & 7) + 1;
      // Cx/Dx sample once, unlike E8..EF which advance through an overlapping pattern.
      const value = previous(((opcode >>> 3) & 3) + 1);
      emit = () => value;
    } else if (opcode < 0xe8) {
      let distance = width;
      count = (opcode & 7) + 1;
      if (opcode === 0xe0) {
        const parameter = take();
        count = (parameter & 127) + 1;
        if (parameter & 128) {
          distance *= 2;
        }
      }
      emit = () => previous(distance);
    } else if (opcode < 0xf0) {
      const parameter = take();
      const distance = (opcode & 7) * 2 + (parameter >>> 7) + 1;
      assert(
        distance <= (output.length % width) + width,
        "Pattern exceeds the native previous-row window.",
      );
      count = (parameter & 127) + 1;
      emit = () => previous(distance);
    } else if (opcode < 0xf8) {
      let step = 1;
      count = (opcode & 7) + 1;
      if (opcode === 0xf0) {
        const parameter = take();
        count = (parameter & 127) + 1;
        if (parameter & 128) {
          step = -1;
        }
      }
      emit = () => (previous(1) + step) & 255;
    } else {
      const index = opcode & 7;
      assert(index < motifs.length, "Undefined or recursive map motif.");
      insertions.push({ index, destination });
      emit = () => null;
    }
    // The native decoder returns immediately on its last row, even if a run has tiles left.
    const emitted = Math.min(count, width * height - output.length);
    for (let i = 0; i < emitted; i++) {
      output.push(emit());
    }
    commands.push({ offset: start, opcode, destination, count, emitted });
  }
  assert.equal(offset, bytes.length, "Unconsumed bytes before adjacent piece pointer.");
  const tiles = [...output];
  for (const insertion of insertions) {
    const motif = motifs[insertion.index],
      x = insertion.destination % width;
    const y = Math.floor(insertion.destination / width);
    assert(x + motif.width <= width && y + motif.height <= height, "Motif exceeds parent layout.");
    for (let dy = 0; dy < motif.height; dy++) {
      for (let dx = 0; dx < motif.width; dx++) {
        tiles[(y + dy) * width + x + dx] = motif.tiles[dy * motif.width + dx];
      }
    }
  }
  assert(
    tiles.every((value): value is number => value !== null),
    "Unfilled motif placeholder.",
  );
  return { width, height, consumed: offset, tiles, commands, baseTiles: output, insertions };
}
