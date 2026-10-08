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
