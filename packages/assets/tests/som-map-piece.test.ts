/** Synthetic compression fixtures exercise physical history without private ROM data. */
import { test } from "../../../tests/ava-helper.js";
import { decodeMapPiece } from "../src/secret-of-mana/som-map-piece.js";

/** A 2x8 deferred rectangle reads four escaped columns after its first twelve tiles. */
function narrowMotif(): Uint8Array {
  return Uint8Array.from([
    7,
    14,
    0x71,
    54,
    0xc4,
    6,
    6,
    0,
    0xc2,
    0xec,
    0x83,
    0xff,
    0xf8,
    ...Array.from({ length: 31 }, () => 1),
  ]);
}

test("deferred narrow motifs use eight-bit physical history and preserve supplied state", (t) => {
  const history = new Map([
    [888, 20],
    [1015, 21],
    [1142, 22],
    [1269, 23],
  ]);
  const original = [...history];
  const decoded = decodeMapPiece(narrowMotif(), { history });
  t.deepEqual(decoded.motifInstances![0].tiles.slice(-4), [20, 21, 22, 23]);
  t.deepEqual(decoded.tiles.slice(24, 26), [20, 21]);
  t.deepEqual(decoded.tiles.slice(28, 30), [22, 23]);
  t.deepEqual([...history], original);
  t.is(decoded.consumed, narrowMotif().length);
});

test("unknown external history is rejected instead of being filled with zero", (t) => {
  t.throws(() => decodeMapPiece(narrowMotif()), { message: /physical tile 378/ });
  t.throws(() => decodeMapPiece(narrowMotif(), { history: new Map([[888, 20]]) }), {
    message: /physical tile 3f7/,
  });
});

test("ordinary overlapping patterns still use newly emitted tiles across logical rows", (t) => {
  t.deepEqual(
    decodeMapPiece(Uint8Array.from([6, 2, 1, 2, 0xe8, 0x85])).tiles,
    [1, 2, 1, 2, 1, 2, 1, 2],
  );
  t.throws(() => decodeMapPiece(Uint8Array.from([0, 0, 0xc0])), { message: /history/ });
});

// Retained reports compare enumerable geometry while native checks still need contextual variants.
test("contextual motif workspace preserves the serialized geometry contract", (t) => {
  const decoded = decodeMapPiece(Uint8Array.from([7, 2, 1, 5, 6, 255, 248, 1, 2, 3, 4, 5, 6, 7]));
  t.is(decoded.motifInstances!.length, 1);
  const serialized = JSON.parse(JSON.stringify(decoded));
  t.false("motifInstances" in serialized);
  t.false("bytes" in serialized.motifs[0]);
  t.false("motifInstances" in serialized.motifs[0]);
});

test("deferred rectangles spill at the physical row stride, including wrapped origins", (t) => {
  // At column 127, the second motif column aliases column zero of the next row.
  const bytes = Uint8Array.from([
    255, 4, 0x11, 9, 10, 11, 12, 0xff,
    ...Array.from({ length: 127 }, () => 1), 0xf8,
    ...Array.from({ length: 256 }, () => 1),
  ]);
  for (const origin of [0, 0xfff0]) {
    const decoded = decodeMapPiece(bytes, { origin });
    t.is(decoded.tiles.length, 384);
    t.deepEqual([127, 128, 255, 256].map(index => decoded.tiles[index]), [9, 10, 11, 12]);
    t.is(decoded.tiles[129], 1);
    t.deepEqual(decoded.motifInstances![0].tiles, [9, 10, 11, 12]);
    t.is(decoded.consumed, bytes.length);
  }
});

test("motifs retain full geometry while parent output excludes physical padding", (t) => {
  const decoded = decodeMapPiece(Uint8Array.from([3, 0, 0x11, 9, 10, 11, 12, 0xff, 1, 0xf8]));
  t.deepEqual(decoded.tiles, [1, 9]);
  t.deepEqual(decoded.motifInstances![0].tiles, [9, 10, 11, 12]);
});
