import { test } from "../../../tests/ava-helper.js";
import { createIndexedPng } from "../src/png-edit.js";
import {
  bindFrameAtlasPalette,
  encodeFrameAtlas,
  inspectFrameAtlas,
} from "../src/secret-of-mana/som-frame-atlas.js";
import {
  spritePaletteColors,
  type SpritePaletteCatalog,
} from "../src/secret-of-mana/som-sprite-palettes.js";
import type { FrameLayout } from "../src/secret-of-mana/som-types.js";

test("catalog color edits preserve PNG/native indices while previews use current colors", (t) => {
  const catalog: SpritePaletteCatalog = {
    version: 1,
    palettes: {
      C08000: {
        romAddress: "C08000",
        firstIndex: 1,
        words: Array.from({ length: 15 }, (_, index) => (index + 1).toString(16).padStart(4, "0")),
      },
    },
  };
  const palette: [number, number, number, number][] = [
    ...spritePaletteColors(catalog, "C08000"),
    [255, 0, 255, 255],
  ];
  const pixels = { width: 8, height: 8, indexes: new Uint8Array(64).fill(1), palette };
  const source = { mediaType: "image/png", bytes: createIndexedPng(pixels) };
  const layout: FrameLayout = {
    version: 1,
    width: 8,
    height: 8,
    guideIndex: 16,
    frames: [],
    paletteRefs: ["C08000"],
    segments: { tile: { romAddress: "C08000", palette: 0, tiles: [{ x: 0, y: 0 }] } },
  };
  const binding = bindFrameAtlasPalette(source, layout, catalog);
  const baseline = encodeFrameAtlas(source, binding, "tile", catalog);
  const next = structuredClone(catalog);
  next.palettes.C08000.words[0] = "03E0";
  t.deepEqual(encodeFrameAtlas(source, binding, "tile", next), baseline);
  const inspected = inspectFrameAtlas(source, binding, next, { segmentName: "tile" });
  t.deepEqual(inspected.image.palette[1], [0, 255, 0, 255]);
  t.deepEqual(inspected.image.indexes, pixels.indexes);
  const reordered = [...palette];
  [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
  t.throws(
    () =>
      encodeFrameAtlas(
        { ...source, bytes: createIndexedPng({ ...pixels, palette: reordered }) },
        binding,
        "tile",
        next,
      ),
    { message: /stable index binding/ },
  );
});
