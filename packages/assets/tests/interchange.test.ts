import { test } from "../../../tests/ava-helper.js";
import {
  decodeAsepriteDocument,
  encodeAsepriteDocument,
  type AsepriteDocument,
} from "../src/aseprite.js";
import {
  inspectTilemapInterchange,
  interchangeIdentity,
  type TilemapInterchangeBaseline,
} from "../src/interchange.js";

/** Independent second-game authority: rectangular tiles, nonzero transparency, two palette views and an unused owner. */
function baseline(): TilemapInterchangeBaseline {
  const indexes = Uint8Array.from({ length: 15 }, (_, i) => i % 3);
  const ownership = {
    owners: [
      { id: "native-zero", width: 3, height: 5, indexes, allowedIndexes: [0, 1, 2] },
      {
        id: "unused",
        width: 3,
        height: 5,
        indexes: new Uint8Array(15).fill(2),
        allowedIndexes: [0, 1, 2],
      },
    ],
    views: [
      {
        id: "view-a",
        owner: "native-zero",
        width: 3,
        height: 5,
        indexes: indexes.slice(),
        indexMap: [0, 1, 2],
      },
      {
        id: "view-b",
        owner: "native-zero",
        width: 3,
        height: 5,
        indexes: Uint8Array.from(indexes, (i) => i + 3),
        indexMap: [null, null, null, 0, 1, 2],
      },
      {
        id: "unused-view",
        owner: "unused",
        width: 3,
        height: 5,
        indexes: new Uint8Array(15).fill(2),
        indexMap: [0, 1, 2],
      },
    ],
  };
  const strip = new Uint8Array(60).fill(2);
  ownership.views.forEach((view, index) => strip.set(view.indexes, (index + 1) * 15));
  const document: AsepriteDocument = {
    width: 9,
    height: 5,
    transparentIndex: 2,
    exportId: "a0000000-0000-0000-0000-000000000000",
    palette: [
      [8, 0, 0, 255],
      [0, 8, 0, 255],
      [0, 0, 0, 0],
      [0, 0, 8, 255],
      [8, 8, 0, 255],
      [1, 2, 3, 0],
    ],
    layers: [
      {
        kind: "tilemap",
        flags: 3,
        name: "Tiles",
        tileset: 17,
        userData: interchangeIdentity.role("inventory"),
      },
    ],
    tilesets: [
      {
        id: 17,
        flags: 6,
        name: "Owners",
        baseIndex: 1,
        tileWidth: 3,
        tileHeight: 5,
        tileCount: 4,
        indexes: strip,
        userData: interchangeIdentity.tileset("native-pixels"),
        tileData: [undefined, ...ownership.views.map((view) => interchangeIdentity.view(view.id))],
      },
    ],
    frames: [
      {
        durationMs: 100,
        cels: [
          {
            kind: "tilemap",
            layer: 0,
            x: 0,
            y: 0,
            zIndex: 0,
            columns: 3,
            rows: 1,
            bits: 32,
            idMask: 0x1fffffff,
            flipXMask: 0x80000000,
            flipYMask: 0x40000000,
            diagonalMask: 0x20000000,
            cells: Uint32Array.of(1, 2, 3),
          },
        ],
      },
    ],
    tags: [],
  };
  return {
    kind: "tilemap",
    document,
    ownership,
    editablePaletteSlots: [0, 1, 3, 4],
    capabilities: {
      pixelEdits: true,
      paletteEdits: true,
      tileReferences: true,
      previewTimeline: true,
    },
    nativeTransforms: ["flipX", "flipY"],
  };
}

/** Product encode/decode is used only to obtain owned editable copies; assertions exercise native contracts. */
async function copy(document: AsepriteDocument): Promise<AsepriteDocument> {
  return decodeAsepriteDocument(await encodeAsepriteDocument(document));
}

test("file normalization accepts an edit through one palette variant without repainting unchanged aliases", async (t) => {
  const before = baseline(),
    after = await copy(before.document);
  after.tilesets[0].indexes[30] = 4;
  const changes = inspectTilemapInterchange(before, after);
  t.is(changes.pixels.length, 1);
  t.is(changes.pixels[0].owner, "native-zero");
  t.is(changes.pixels[0].indexes[0], 1);
  t.deepEqual(inspectTilemapInterchange(before, await copy(before.document)), {
    pixels: [],
    colors: [],
  });
});

test("complete identified storage reorder is harmless only when all references normalize consistently", async (t) => {
  const before = baseline(),
    decoded = await copy(before.document),
    set = decoded.tilesets[0];
  const indexes = set.indexes.slice();
  indexes.set(set.indexes.subarray(30, 45), 15);
  indexes.set(set.indexes.subarray(15, 30), 30);
  const data = [...set.tileData];
  [data[1], data[2]] = [data[2], data[1]];
  const cel = decoded.frames[0].cels[0];
  if (cel.kind !== "tilemap") {
    throw new Error("Expected tilemap.");
  }
  const after = {
    ...decoded,
    tilesets: [{ ...set, indexes, tileData: data }],
    frames: [{ ...decoded.frames[0], cels: [{ ...cel, cells: Uint32Array.of(2, 1, 3) }] }],
  };
  t.deepEqual(inspectTilemapInterchange(before, after), { pixels: [], colors: [] });
  t.throws(() => inspectTilemapInterchange(before, { ...after, frames: decoded.frames }), {
    message: /references/,
  });
});

test("inventory, native transforms, timing and derived preview edits reject before planning sources", async (t) => {
  const before = baseline(),
    after = await copy(before.document);
  const cel = after.frames[0].cels[0];
  if (cel.kind !== "tilemap") {
    throw new Error("Expected tilemap.");
  }
  cel.cells[0] = 0x20000001;
  t.throws(() => inspectTilemapInterchange(before, after), {
    message: /unsupported native transform diagonal/,
  });
  cel.cells[0] = 1;
  t.throws(
    () =>
      inspectTilemapInterchange(before, {
        ...after,
        frames: [{ ...after.frames[0], durationMs: 101 }],
      }),
    { message: /timing/ },
  );
  const duplicate = [...after.tilesets[0].tileData];
  duplicate[3] = duplicate[1];
  t.throws(
    () =>
      inspectTilemapInterchange(before, {
        ...after,
        tilesets: [{ ...after.tilesets[0], tileData: duplicate }],
      }),
    { message: /Duplicate view/ },
  );
  const preview = {
    kind: "raster" as const,
    layer: 1,
    x: 0,
    y: 0,
    zIndex: 0,
    width: 1,
    height: 1,
    indexes: Uint8Array.of(0),
  };
  const document = {
    ...before.document,
    layers: [
      ...before.document.layers,
      {
        kind: "raster" as const,
        flags: 3,
        name: "Preview",
        userData: interchangeIdentity.role("preview"),
      },
    ],
    frames: [{ ...before.document.frames[0], cels: [...before.document.frames[0].cels, preview] }],
  };
  const snapshot = { ...before, document };
  const changed = await copy(document);
  const image = changed.frames[0].cels[1];
  if (image.kind !== "raster") {
    throw new Error("Expected raster.");
  }
  image.indexes[0] = 1;
  t.throws(() => inspectTilemapInterchange(snapshot, changed), { message: /derived raster/ });
});

test("renaming, hiding and locking do not grant or remove authority", async (t) => {
  const before = baseline(),
    after = await copy(before.document);
  const renamed = {
    ...after,
    layers: [{ ...after.layers[0], name: "My renamed layer", flags: 4 }],
  };
  t.deepEqual(inspectTilemapInterchange(before, renamed), { pixels: [], colors: [] });
});
