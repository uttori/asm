import { test } from "../../../tests/ava-helper.js";
import { decodeAsepriteAtlas, encodeAsepriteAtlas } from "../src/aseprite.js";
import type { TilemapInterchangeBaseline } from "../src/interchange.js";
import {
  createRasterInterchange,
  inspectRasterInterchange,
  rasterInterchangeAtlas,
  rasterInterchangeDocument,
} from "../src/raster-interchange.js";

/** Rectangular second-game views include an independent duplicate owner and two palette aliases of native zero. */
function fixture() {
  const indexes = Uint8Array.of(0, 1, 0, 1, 0, 1);
  const source: TilemapInterchangeBaseline = {
    kind: "tilemap",
    nativeTransforms: [],
    editablePaletteSlots: [0, 1, 3, 4],
    capabilities: {
      pixelEdits: true,
      paletteEdits: true,
      tileReferences: true,
      previewTimeline: true,
    },
    document: rasterInterchangeDocument({
      width: 2,
      height: 3,
      indexes,
      transparentIndex: 2,
      exportId: "a0000000-0000-0000-0000-000000000000",
      palette: [
        [8, 0, 0, 255],
        [8, 0, 0, 255],
        [0, 0, 0, 0],
        [0, 8, 0, 255],
        [0, 8, 0, 255],
        [0, 0, 8, 255],
      ],
    }),
    ownership: {
      owners: [
        { id: "zero", width: 2, height: 3, indexes, allowedIndexes: [0, 1, 2] },
        {
          id: "duplicate-unused",
          width: 2,
          height: 3,
          indexes: indexes.slice(),
          allowedIndexes: [0, 1],
        },
      ],
      views: [
        {
          id: "primary",
          owner: "zero",
          width: 2,
          height: 3,
          indexes: indexes.slice(),
          indexMap: [0, 1, 2],
        },
        {
          id: "alias",
          owner: "zero",
          width: 2,
          height: 3,
          indexes: Uint8Array.from(indexes, (value) => value + 3),
          indexMap: [null, null, null, 0, 1, 2],
        },
        {
          id: "unused",
          owner: "duplicate-unused",
          width: 2,
          height: 3,
          indexes: indexes.slice(),
          indexMap: [0, 1],
        },
      ],
    },
  };
  return createRasterInterchange(source);
}

test("v1 raster normalization keeps duplicate slots, unused owners and consistent native aliases", async (t) => {
  const baseline = fixture(),
    atlas = rasterInterchangeAtlas(baseline.document);
  const saved = await decodeAsepriteAtlas(encodeAsepriteAtlas(atlas));
  t.deepEqual(inspectRasterInterchange(baseline, rasterInterchangeDocument(saved)), {
    pixels: [],
    colors: [],
  });
  const alias = baseline.placements[1],
    indexes = atlas.indexes.slice();
  indexes[alias.y * atlas.width + alias.x] = 4;
  const edited = rasterInterchangeDocument({ ...atlas, indexes });
  const result = inspectRasterInterchange(baseline, edited);
  t.is(result.pixels.length, 1);
  t.is(result.pixels[0].owner, "zero");
  t.deepEqual(result.pixels[0].indexes, Uint8Array.of(1, 1, 0, 1, 0, 1));
  t.false(baseline.capabilities.tileReferences);
  t.false(baseline.capabilities.previewTimeline);
});

test("fixed raster authority rejects padding, changed identities, conflicting aliases and corrupt private placements", (t) => {
  const baseline = fixture(),
    atlas = rasterInterchangeAtlas(baseline.document);
  const missing = rasterInterchangeDocument({ ...atlas, exportId: undefined });
  t.throws(() => inspectRasterInterchange(baseline, missing), { message: /identity/ });
  const conflicting = atlas.indexes.slice(),
    primary = baseline.placements[0],
    alias = baseline.placements[1];
  conflicting[primary.y * atlas.width + primary.x] = 1;
  conflicting[alias.y * atlas.width + alias.x] = 5;
  t.throws(
    () =>
      inspectRasterInterchange(
        baseline,
        rasterInterchangeDocument({ ...atlas, indexes: conflicting }),
      ),
    { message: /conflicting/ },
  );
  t.throws(
    () =>
      inspectRasterInterchange(
        { ...baseline, placements: baseline.placements.slice(1) },
        baseline.document,
      ),
    { message: /Incomplete/ },
  );
  const width = atlas.width + 1;
  const padded = new Uint8Array(width * atlas.height).fill(atlas.transparentIndex);
  for (let row = 0; row < atlas.height; row++) {
    padded.set(atlas.indexes.subarray(row * atlas.width, (row + 1) * atlas.width), row * width);
  }
  const paddedAtlas = { ...atlas, width, indexes: padded };
  const paddedBaseline = { ...baseline, document: rasterInterchangeDocument(paddedAtlas) };
  const padding = padded.slice();
  padding[width - 1] = 0;
  t.throws(
    () =>
      inspectRasterInterchange(
        paddedBaseline,
        rasterInterchangeDocument({ ...paddedAtlas, indexes: padding }),
      ),
    { message: /padding/ },
  );
});
