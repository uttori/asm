import { test } from "../../../tests/ava-helper.js";
import { createIndexedPng } from "../src/png-edit.js";
import {
  bindFrameAtlasPalette,
  encodeFrameAtlas,
  inspectFrameAtlas,
} from "../src/secret-of-mana/som-frame-atlas.js";
import { planSpritePaletteEdits } from "../src/secret-of-mana/som-palette-edit.js";
import {
  spritePaletteColors,
  spritePaletteBytes,
  parseSpritePaletteCatalog,
  type SpritePaletteCatalog,
} from "../src/secret-of-mana/som-sprite-palettes.js";
import type { FrameLayout, SpriteAtlasSource } from "../src/secret-of-mana/som-types.js";

test("palette slices bound physical ownership and overlapping views must agree", (t) => {
  const catalog: SpritePaletteCatalog = {
    version: 1,
    palettes: {
      C08000: { romAddress: "C08000", firstIndex: 1, words: ["0001", "0002", "0003"], users: [] },
      C08004: { romAddress: "C08004", firstIndex: 1, words: ["0003", "0004"], users: [] },
    },
  };
  t.deepEqual(
    spritePaletteBytes(catalog, "C08000", { wordCount: 2 }),
    new Uint8Array([1, 0, 2, 0]),
  );
  t.deepEqual(spritePaletteBytes(catalog, "C08000", { wordOffset: 2 }), new Uint8Array([3, 0]));
  for (const range of [{ wordOffset: -1 }, { wordCount: 0 }, { wordCount: 4 }, { wordOffset: 0.5 }])
    t.throws(() => spritePaletteBytes(catalog, "C08000", range), { message: /word slice/ });
  t.deepEqual(parseSpritePaletteCatalog(Buffer.from(JSON.stringify(catalog))), catalog);
  const edited = planSpritePaletteEdits(
    catalog,
    [],
    [{ palette: "C08000", index: 3, rgb: [255, 0, 0] }],
  );
  t.deepEqual(edited.palettes, ["C08000", "C08004"]);
  t.is(edited.catalog.palettes.C08004.words[0], "001F");
  t.throws(
    () =>
      planSpritePaletteEdits(
        catalog,
        [],
        [
          { palette: "C08000", index: 3, rgb: [255, 0, 0] },
          { palette: "C08004", index: 1, rgb: [0, 0, 0] },
        ],
      ),
    { message: /Duplicate palette edit/ },
  );
  catalog.palettes.C08004.words[0] = "FFFF";
  t.throws(() => parseSpritePaletteCatalog(Buffer.from(JSON.stringify(catalog))), {
    message: /Conflicting palette aliases/,
  });
});

test("shared ROM words refresh both atlas users without changing tile indexes", (t) => {
  const catalog: SpritePaletteCatalog = { version: 1, palettes: {} };
  const words = Array.from({ length: 18 }, (_, index) => index.toString(16).padStart(4, "0"));
  const atlases: SpriteAtlasSource[] = ["C08000", "C08004"].map((id, index) => {
    const name = `alias-${index}.png`;
    catalog.palettes[id] = {
      romAddress: id,
      firstIndex: 0,
      words: words.slice(index * 2, index * 2 + 16),
      users: [{ atlas: name, role: "primary", segments: ["tile"] }],
    };
    const layout: FrameLayout = {
      version: 1,
      width: 8,
      height: 8,
      guideIndex: 16,
      frames: [],
      paletteRefs: [id],
      segments: { tile: { romAddress: "C09000", palette: 0, tiles: [{ x: 0, y: 0 }] } },
    };
    const palette: [number, number, number, number][] = [
      ...spritePaletteColors(catalog, id),
      [255, 0, 255, 255],
    ];
    const bytes = createIndexedPng({
      width: 8,
      height: 8,
      indexes: new Uint8Array(64).fill(3 - index * 2),
      palette,
    });
    return { id: name, layout, source: { bytes, mediaType: "image/png" } };
  });
  const plan = planSpritePaletteEdits(catalog, atlases, [
    { palette: "C08000", index: 3, rgb: [0, 255, 0] },
  ]);
  t.is(plan.images.size, 2);
  for (const [index, atlas] of atlases.entries()) {
    const before = inspectFrameAtlas(atlas.source, atlas.layout, catalog, { whole: true });
    const after = inspectFrameAtlas(
      { bytes: plan.images.get(atlas.id)!, mediaType: "image/png" },
      atlas.layout,
      plan.catalog,
      { whole: true },
    );
    t.deepEqual(after.image.indexes, before.image.indexes);
    t.deepEqual(after.image.palette[3 - index * 2], [0, 255, 0, 255]);
  }
});

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
