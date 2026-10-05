import { test } from "../../../tests/ava-helper.js";
import { createIndexedPng } from "../src/png-edit.js";
import {
  encodeFrameAtlas,
  frameAtlasSegmentOrder,
  readFrameAtlasSelection,
} from "../src/secret-of-mana/som-frame-atlas.js";
import {
  spritePaletteColors,
  type SpritePaletteCatalog,
} from "../src/secret-of-mana/som-sprite-palettes.js";
import type { FrameLayout } from "../src/secret-of-mana/som-types.js";

/** Distinct PNG palette groups encode different native indexes, independent of segment declaration order. */
function fixture() {
  const catalog: SpritePaletteCatalog = {
    version: 1,
    palettes: {
      C08000: { romAddress: "C08000", firstIndex: 1, words: Array(15).fill("001F") },
      C08020: { romAddress: "C08020", firstIndex: 1, words: Array(15).fill("03E0") },
    },
  };
  const layout: FrameLayout = {
    version: 1,
    width: 16,
    height: 8,
    guideIndex: 32,
    frames: [],
    paletteRefs: ["C08000", "C08020"],
    segments: {
      later: { romAddress: "D00020", palette: 1, tiles: [{ x: 8, y: 0 }] },
      earlier: { romAddress: "D00000", palette: 0, tiles: [{ x: 0, y: 0 }] },
    },
  };
  const indexes = Uint8Array.from({ length: 128 }, (_, index) => (index % 16 < 8 ? 1 : 18));
  const source = {
    mediaType: "image/png",
    bytes: createIndexedPng({
      width: 16,
      height: 8,
      indexes,
      palette: [
        ...spritePaletteColors(catalog, "C08000"),
        ...spritePaletteColors(catalog, "C08020"),
        [255, 0, 255, 255],
      ],
    }),
  };
  return { catalog, layout, source };
}

test("continuous frame includes emit ROM order with palette-local native indexes", (t) => {
  const { catalog, layout, source } = fixture();
  const expected = new Uint8Array(64);
  for (let row = 0; row < 8; row++) {
    expected[row * 2] = 255; // Native color 1: first bitplane.
    expected[32 + row * 2 + 1] = 255; // Native color 2: second bitplane.
  }
  t.deepEqual(encodeFrameAtlas(source, layout, undefined, catalog), expected);
  t.deepEqual(encodeFrameAtlas(source, layout, ["later", "earlier"], catalog), expected);
  t.deepEqual(encodeFrameAtlas(source, layout, "later", catalog), expected.subarray(32));
});

test("continuous frame ownership rejects gaps, overlaps, duplicate selections and invalid addresses", (t) => {
  const { layout } = fixture();
  for (const address of ["D00040", "D00010", "D00000"]) {
    const gapped = structuredClone(layout);
    gapped.segments.later.romAddress = address;
    t.throws(() => frameAtlasSegmentOrder(gapped), { message: /gaps or overlaps/ });
    t.deepEqual(frameAtlasSegmentOrder(gapped, ["earlier"]), ["earlier"]);
  }
  t.throws(() => frameAtlasSegmentOrder(layout, []), { message: /nonempty/ });
  t.throws(() => frameAtlasSegmentOrder(layout, ["earlier", "earlier"]), { message: /unique/ });
  t.throws(() => frameAtlasSegmentOrder(layout, ["missing"]), { message: /Invalid native/ });
  layout.segments.later.romAddress = "NaN";
  t.throws(() => frameAtlasSegmentOrder(layout), { message: /Invalid native/ });
});

test("frame selectors distinguish omission from malformed declarations", (t) => {
  t.is(readFrameAtlasSelection({}), undefined);
  t.is(readFrameAtlasSelection({ segment: "earlier" }), "earlier");
  t.deepEqual(readFrameAtlasSelection({ segments: ["later", "earlier"] }), ["later", "earlier"]);
  t.throws(() => readFrameAtlasSelection({ segment: "earlier", segments: [] }), {
    message: /not both/,
  });
  for (const value of [false, 7, []])
    t.throws(() => readFrameAtlasSelection({ segment: value }), { message: /string/ });
  for (const value of ["earlier", [7], null])
    t.throws(() => readFrameAtlasSelection({ segments: value }), { message: /array of strings/ });
});
