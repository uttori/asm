/** Native map tile-ID compression; separate from the boot/graphics LZ format. */
import assert from "node:assert/strict";

/** One compressed token, retaining both the requested and native row-clipped run lengths. */
interface MapCommand {
  offset: number;
  opcode: number;
  destination: number;
  count: number;
  emitted: number;
}

/** Pointer-bounded deferred rectangle; tiles describe its first observed insertion, when used. */
interface MapMotif {
  offset: number;
  dimensions: number;
  width: number;
  height: number;
  bytes: Uint8Array;
  consumed?: number;
  tiles?: number[];
  commands?: MapCommand[];
}

/** Context from independently known tile bytes; the decoder never mutates this input. */
interface MapHistory {
  /** Byte offsets 0..65535 in bank 7F mapped to known byte values; absent cells remain unknown. */
  history?: ReadonlyMap<number, number>;
  /** Physical bank-7F byte offset of the parent origin, default 0; rows have a 128-byte stride. */
  origin?: number;
}

/** A fully consumed stream; base placeholders are resolved by its ordered motif insertions. */
interface DecodedMapStream {
  width: number;
  height: number;
  consumed: number;
  tiles: number[];
  commands: MapCommand[];
  baseTiles: (number | null)[];
  insertions: { index: number; destination: number }[];
  /** Context-dependent insertion results, kept out of serialized geometry snapshots. */
  motifInstances: DecodedMapStream[];
}

/** Public geometry; motif workspace is available only when the header declares deferred rectangles. */
interface DecodedMapPiece {
  width: number;
  height: number;
  consumed: number;
  tiles: number[];
  commands: MapCommand[];
  dataOffset?: number;
  motifs?: MapMotif[];
  baseTiles?: (number | null)[];
  insertions?: { index: number; destination: number }[];
  motifInstances?: DecodedMapStream[];
}

/**
 * Decode a complete pointer-bounded map piece. C0CD93..C0D032
 * emits into 128-byte WRAM rows and advances pattern history with an eight-bit column. This returns
 * compact row-major tile IDs, not SNES graphics or a reconstructed capture RAM image.
 * Motif commands reserve one unwritten base cell; C0CD4D applies their rectangles afterward.
 * Motifs decode in queue order against the completed parent and earlier insertions. Narrow motifs
 * can read outside their own rectangle through the native eight-bit history cursor. Optional
 * physical history supplies such cells when they also lie outside the parent; missing cells fail.
 * Insertions can also write beyond the parent rectangle. Their full physical writes affect later
 * motifs; the returned parent tiles project only its own cells after all insertions finish.
 * The input history is copied and never mutated. Recursive motifs and truncated input fail closed.
 * @param {Uint8Array} bytes Pointer-bounded map piece.
 * @returns {object} Compact row-major tile IDs and the consumed extent.
 */
export function decodeMapPiece(
  bytes: Uint8Array,
  { history, origin = 0 }: MapHistory = {},
): DecodedMapPiece {
  assert(bytes.length >= 3, "Missing map header/data.");
  assert(Number.isInteger(origin) && origin >= 0 && origin <= 65535, "Invalid map origin.");
  const width = (bytes[0] >>> 1) + 1;
  const height = (bytes[1] >>> 1) + 1;
  let dataOffset = 2;
  const motifs: MapMotif[] = [];
  const memory = new Map(history);
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
      // Definitions are recipes, not independently decoded images: a motif can consume
      // parent cells which do not exist until the base pass has finished.
      const motif: MapMotif = {
        offset: start,
        dimensions,
        width: (dimensions & 15) + 1,
        height: (dimensions >>> 4) + 1,
        bytes: bytes.slice(start, dataOffset - 1),
      };
      // Recipes are decoder workspace; keeping them non-enumerable preserves the
      // existing serialized geometry contract used by retained research proofs.
      Object.defineProperty(motif, "bytes", { enumerable: false });
      motifs.push(motif);
      assert(motifs.length <= 8, "Motif definitions exceed the native eight-record workspace.");
    } while (marker !== 0xff);
  }
  const decoded = decodeMapStream(bytes.slice(dataOffset), width, height, motifs, memory, origin);
  const consumed = dataOffset + decoded.consumed;
  const commands = decoded.commands.map((c) => ({ ...c, offset: c.offset + dataOffset }));
  if (!motifs.length) {
    return { width, height, consumed, tiles: decoded.tiles, commands };
  }
  const result = {
    ...decoded,
    consumed,
    commands,
    dataOffset,
    motifs,
    motifInstances: decoded.motifInstances,
  };
  Object.defineProperty(result, "motifInstances", { enumerable: false });
  return result;
}

/** Decode one bounded stream; motif overlays cannot supply history to the earlier base pass.
 * @param {Uint8Array} bytes Command bytes for one piece or motif.
 * @param {number} width Logical tile width.
 * @param {number} height Logical tile height.
 * @param {readonly object[]} motifs Deferred recipes belonging to this piece.
 * @returns {object} Tiles, commands, and motif insertions.
 */
function decodeMapStream(
  bytes: Uint8Array,
  width: number,
  height: number,
  motifs: readonly MapMotif[],
  memory: Map<number, number>,
  origin: number,
): DecodedMapStream {
  const output: (number | null)[] = [];
  const commands: MapCommand[] = [];
  const insertions: { index: number; destination: number }[] = [];
  const motifInstances: DecodedMapStream[] = [];
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
      count = (parameter & 127) + 1;
      let sourceColumn = (output.length % width) - distance;
      let sourceRow = Math.floor(output.length / width) * 128;
      if (sourceColumn < 0) {
        // The CPU adds width only once after eight-bit underflow. Repeated logical
        // wrapping would select different cells for a narrow motif.
        sourceColumn = (sourceColumn + width) & 255;
        sourceRow -= 128;
      }
      emit = () => {
        const address = (origin + sourceRow + sourceColumn) & 65535;
        assert(
          memory.has(address),
          `Map pattern history needs physical tile ${address.toString(16)}.`,
        );
        const value = memory.get(address)!;
        sourceColumn = (sourceColumn + 1) & 255;
        if (sourceColumn >= width) {
          sourceColumn -= width;
          sourceRow += 128;
        }
        return value;
      };
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
      const value = emit();
      if (value !== null) {
        const address =
          (origin + Math.floor(output.length / width) * 128 + (output.length % width)) & 65535;
        memory.set(address, value);
      }
      output.push(value);
    }
    commands.push({ offset: start, opcode, destination, count, emitted });
  }
  assert.equal(offset, bytes.length, "Unconsumed bytes before adjacent piece pointer.");
  for (const insertion of insertions) {
    const motif = motifs[insertion.index],
      x = insertion.destination % width;
    const y = Math.floor(insertion.destination / width);
    const motifOrigin = (origin + y * 128 + x) & 65535;
    const decoded = decodeMapStream(
      motif.bytes,
      motif.width,
      motif.height,
      [],
      memory,
      motifOrigin,
    );
    motifInstances.push(decoded);
    // Keep first-insertion compatibility while retaining each contextual variant separately.
    if (!motif.tiles) {
      Object.assign(motif, decoded);
    }
  }
  // The native queue has no parent-edge clipping. Compact rectangle copies would
  // misplace escaped columns and miss writes that alias the next physical row.
  const tiles = output.map((_, index) => {
    const address = (origin + Math.floor(index / width) * 128 + (index % width)) & 65535;
    const value = memory.get(address);
    assert(value !== undefined, "Unfilled motif placeholder.");
    return value;
  });
  const result = {
    width,
    height,
    consumed: offset,
    tiles,
    commands,
    baseTiles: output,
    insertions,
    motifInstances,
  };
  // These per-placement variants are execution workspace. The composed tiles remain
  // the serialized geometry so historical proof snapshots keep their contract.
  Object.defineProperty(result, "motifInstances", { enumerable: false });
  return result;
}
