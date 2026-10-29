import { test } from "../../../tests/ava-helper.js";
import { createIndexedPng } from "../src/png-edit.js";
import {
  bindFrameAtlasPalette,
  encodeFrameAtlas,
  inspectFrameAtlas,
  refreshFrameAtlas,
} from "../src/secret-of-mana/som-frame-atlas.js";
import { inspectSpritePaletteUsers, planSpritePaletteEdits } from "../src/secret-of-mana/som-palette-edit.js";
import { renderStableFrameAtlas } from "../src/secret-of-mana/som-frame-edit.js";
import { deriveFramePlacements } from "../src/secret-of-mana/som-frame-composition.js";
import {
  spritePaletteColors,
  spritePaletteBytes,
  parseSpritePaletteCatalog,
  type SpritePaletteCatalog,
} from "../src/secret-of-mana/som-sprite-palettes.js";
import type { FrameLayout, SpriteAtlasSource } from "../src/secret-of-mana/som-types.js";

/** Two poses share one native tile but display red and green palette groups. */
function displayPaletteFixture() {
  const catalog: SpritePaletteCatalog = { version: 1, palettes: {
    C08000: { romAddress: "C08000", firstIndex: 0, words: Array(16).fill("001F"),
      users: [{ atlas: "shared.png", role: "primary", segments: ["tile"] }] },
    C08020: { romAddress: "C08020", firstIndex: 0, words: Array(16).fill("03E0"),
      users: [{ atlas: "shared.png", role: "runtime-variant", segments: ["tile"] }] },
  } };
  const layout: FrameLayout = { version: 1, width: 16, height: 16, paletteRefs: ["C08000", "C08020"],
    guideIndex: 32, tileSources: "native-strip", segments: { tile: {
      romAddress: "C09000", palette: 0, tiles: [{ x: 0, y: 8 }],
      tileAtlas: { bounds: [0, 8, 8, 8], columns: 1, step: 8, sourceOnly: [] },
    } }, frames: [
      { id: "red", bounds: [0, 0, 8, 8], origin: [0, 0],
        placements: [{ id: "one", x: 0, y: 0, segment: "tile", tile: 0 }] },
      { id: "green", bounds: [8, 0, 8, 8], origin: [8, 0], paletteGroup: 1,
        placements: [{ id: "one", x: 0, y: 0, segment: "tile", tile: 0 }] },
    ] };
  const indexes = new Uint8Array(256);
  for (const frame of layout.frames!) {
    frame.blocks = [{ id: "one", x: 0, y: 0, size: 8, flipX: false, flipY: false, tiles: [["tile", 0]] }];
    frame.placements = deriveFramePlacements(layout, frame);
  }
  for (let y = 8; y < 16; y++) indexes.fill(1, y * 16, y * 16 + 8);
  const palette: [number, number, number, number][] = [
    ...layout.paletteRefs.flatMap(id => spritePaletteColors(catalog, id)), [255, 0, 255, 255],
  ];
  const source = { bytes: createIndexedPng({ width: 16, height: 16, indexes, palette }), mediaType: "image/png" };
  return { catalog, layout, source };
}

test("shared tiles retain distinct displayed palettes through refresh and stable rendering", (t) => {
  const { catalog, layout, source } = displayPaletteFixture();
  const before = encodeFrameAtlas(source, layout, "tile", catalog);
  const inspected = inspectFrameAtlas(source, layout, catalog, { whole: true });
  for (const rendered of [refreshFrameAtlas(inspected), renderStableFrameAtlas(inspected.tiles, layout)]) {
    t.is(rendered.indexes[0], 1);
    t.is(rendered.indexes[8], 17);
    t.is(rendered.indexes[128], 1);
    t.notDeepEqual(inspected.image.palette[1], inspected.image.palette[17]);
    const updated = { bytes: createIndexedPng({ ...rendered, palette: inspected.image.palette }), mediaType: "image/png" };
    t.deepEqual(encodeFrameAtlas(updated, layout, "tile", catalog), before);
  }
  t.deepEqual(inspectSpritePaletteUsers(catalog, [{ id: "shared.png", layout }]).errors, []);
});

test("display palette groups reject invalid references even for a selected native segment", (t) => {
  const { catalog, layout, source } = displayPaletteFixture();
  for (const invalid of [-1, 0.5, 2, NaN]) {
    layout.frames![1].paletteGroup = invalid;
    t.throws(() => encodeFrameAtlas(source, layout, "tile", catalog), { message: /display palette group/ });
  }
});

test("block display palettes override pose colors and remain part of retained composition", (t) => {
  const { catalog, layout, source } = displayPaletteFixture();
  const frame = layout.frames![0];
  frame.blocks![0].paletteGroup = 1;
  t.throws(() => inspectFrameAtlas(source, layout, catalog, { whole: true }), { message: /Derived placements disagree/ });
  frame.placements = deriveFramePlacements(layout, frame);
  const inspected = inspectFrameAtlas(source, layout, catalog, { whole: true });
  t.is(refreshFrameAtlas(inspected).indexes[0], 17);
  t.is(renderStableFrameAtlas(inspected.tiles, layout).indexes[0], 17);
  frame.blocks![0].paletteGroup = 2;
  t.throws(() => deriveFramePlacements(layout, frame), { message: /invalid display palette group/ });
  t.throws(() => encodeFrameAtlas(source, layout, "tile", catalog), { message: /invalid display palette group/ });
});

test("blank poses retain an explicit display palette without inventing a native tile owner", (t) => {
  const { catalog, layout } = displayPaletteFixture();
  const frame = layout.frames![1];
  frame.blocks![0].tiles = [0xc09020];
  frame.placements = [{ id: "blank", x: 0, y: 0,
    external: { romAddress: "C09020", indexes: Array(64).fill(0) } }];
  frame.placements = deriveFramePlacements(layout, frame);
  catalog.palettes.C08020.users![0].segments = [];
  t.deepEqual(inspectSpritePaletteUsers(catalog, [{ id: "shared.png", layout }]).errors, []);
  delete frame.paletteGroup;
  t.true(inspectSpritePaletteUsers(catalog, [{ id: "shared.png", layout }]).errors.some(error => error.includes("has no segment")));
});

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
  for (const range of [
    { wordOffset: -1 },
    { wordCount: 0 },
    { wordCount: 4 },
    { wordOffset: 0.5 },
  ]) {
    t.throws(() => spritePaletteBytes(catalog, "C08000", range), { message: /word slice/ });
  }
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
