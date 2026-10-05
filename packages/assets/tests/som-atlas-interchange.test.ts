import { test } from "../../../tests/ava-helper.js";
import { spriteFixture } from "../../../tests/fixtures/sprite-source.js";
import { inspectAtlasChanges } from "../src/atlas-interchange.js";
import { createIndexedPng } from "../src/png-edit.js";
import { readAssetPng } from "../src/png.js";
import {
  createSomAtlasExport,
  planSomAtlasImport,
} from "../src/secret-of-mana/som-atlas-interchange.js";
import { renderStableFrameAtlas } from "../src/secret-of-mana/som-frame-edit.js";
import { spritePaletteColors } from "../src/secret-of-mana/som-sprite-palettes.js";
import type { FrameLayout } from "../src/secret-of-mana/som-types.js";

test("atlas imports refresh derived flipped poses, preserve metadata and retain stored palette bindings", (t) => {
  const { catalog, layout, png, tiles } = spriteFixture();
  const annotated = { ...layout, editorHints: { label: "retained source declaration" } };
  const atlas = {
    id: "sprite.png",
    source: { bytes: png, mediaType: "image/png" },
    layout: annotated,
  };
  const { document, policy } = createSomAtlasExport(
    atlas,
    catalog,
    "a0000000-0000-0000-0000-000000000000",
  );
  const noEdit = planSomAtlasImport(
    atlas,
    catalog,
    inspectAtlasChanges(document, document, policy),
  );
  t.deepEqual(noEdit.png, png);
  t.deepEqual(noEdit.layout, annotated);
  const first = layout.segments.tiles.tiles[0];
  const indexes = document.indexes.slice();
  indexes[first.y * document.width + first.x] ^= 1;
  const palette = document.palette.map((color): [number, number, number, number] => [...color]);
  palette[1] = [16, 0, 0, 255];
  const changes = inspectAtlasChanges(document, { ...document, indexes, palette }, policy);
  const plan = planSomAtlasImport(atlas, catalog, changes);
  const expectedTiles = new Map(
    [...tiles].map(([name, values]) => [
      name,
      values.map((tile) => ({ ...tile, indexes: tile.indexes.slice() })),
    ]),
  );
  expectedTiles.get("tiles")![0].indexes[0] ^= 1;
  const stored = readAssetPng(plan.png).toIndexed();
  t.deepEqual(stored.indexes, renderStableFrameAtlas(expectedTiles, layout).indexes);
  t.true(stored.indexes.some((slot, index) => slot !== indexes[index]));
  t.true("editorHints" in plan.layout);
  if ("editorHints" in plan.layout) {
    t.deepEqual(plan.layout.editorHints, annotated.editorHints);
  }
  t.deepEqual(plan.layout.frames, layout.frames);
  t.deepEqual(stored.palette, readAssetPng(png).toIndexed().palette);
  t.is(plan.catalog.palettes.C00100.words[0], "8002");
  t.is(plan.catalog.palettes.C00100.words[1], "0001");
  t.deepEqual(plan.palette[1], [16, 0, 0, 255]);
});

test("multiple SoM palette banks retain native index identity and reject painting with another bank", (t) => {
  const { catalog } = spriteFixture();
  catalog.palettes.C00200 = {
    romAddress: "C00200",
    firstIndex: 1,
    words: ["0002", ...Array(14).fill("0000")],
    users: [],
  };
  const layout: FrameLayout = {
    version: 1,
    width: 8,
    height: 8,
    guideIndex: 32,
    tileSources: "native-strip",
    frames: [],
    paletteRefs: ["C00100", "C00200"],
    segments: {
      tiles: {
        palette: 1,
        romAddress: "C00300",
        tiles: [{ x: 0, y: 0 }],
        tileAtlas: { bounds: [0, 0, 8, 8], columns: 1, step: 8, sourceOnly: [0] },
      },
    },
  };
  const png = createIndexedPng({
    width: 8,
    height: 8,
    indexes: new Uint8Array(64).fill(17),
    palette: [
      ...spritePaletteColors(catalog, "C00100"),
      ...spritePaletteColors(catalog, "C00200"),
      [255, 0, 255, 255],
    ],
  });
  const atlas = { id: "two-banks.png", source: { bytes: png, mediaType: "image/png" }, layout };
  const { document, policy } = createSomAtlasExport(
    atlas,
    catalog,
    "a0000000-0000-0000-0000-000000000000",
  );
  const indexes = document.indexes.slice();
  indexes[0] = 1;
  t.throws(() => inspectAtlasChanges(document, { ...document, indexes }, policy), {
    message: /Unmapped/,
  });
  indexes[0] = 0;
  const palette = document.palette.map((color): [number, number, number, number] => [...color]);
  palette[17] = [24, 0, 0, 255];
  const delta = inspectAtlasChanges(document, { ...document, indexes, palette }, policy);
  t.is(delta.pixels[0].indexes[0], 0);
  const plan = planSomAtlasImport(atlas, catalog, delta);
  t.is(plan.catalog.palettes.C00200.words[0], "0003");
  t.is(plan.catalog.palettes.C00100.words[0], "8001");
  t.is(readAssetPng(plan.png).toIndexed().indexes[0], 0);
});

test("atlas palette edits propagate physical aliases and reject conflicting duplicate slot requests", (t) => {
  const { catalog, layout, png } = spriteFixture();
  catalog.palettes.C00102 = { romAddress: "C00102", firstIndex: 1, words: ["0001"], users: [] };
  const atlas = { id: "sprite.png", source: { bytes: png, mediaType: "image/png" }, layout };
  const plan = planSomAtlasImport(atlas, catalog, {
    pixels: [],
    colors: [{ index: 2, color: [16, 0, 0, 255] }],
  });
  t.is(plan.catalog.palettes.C00100.words[1], "0002");
  t.is(plan.catalog.palettes.C00102.words[0], "0002");
  t.deepEqual(plan.png, png);
  t.deepEqual(plan.palettes, ["C00100", "C00102"]);
  t.throws(
    () =>
      planSomAtlasImport(atlas, catalog, {
        pixels: [],
        colors: [
          { index: 1, color: [16, 0, 0, 255] },
          { index: 1, color: [24, 0, 0, 255] },
        ],
      }),
    { message: /Duplicate palette edit/ },
  );
});
