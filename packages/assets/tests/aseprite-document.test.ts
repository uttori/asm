import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

import { test } from "../../../tests/ava-helper.js";
import { asepriteFile, rasterHeaders } from "../../../tests/fixtures/aseprite-file.js";
import {
  decodeAsepriteDocument,
  encodeAsepriteDocument,
  resolveAsepriteCels,
  renderAsepriteFrame,
  validateAsepriteDocument,
  type AsepriteDocument,
} from "../src/aseprite.js";
import { ASSET_LIMITS } from "../src/limits.js";
import { pngImporter } from "../src/png.js";

/** Independent tilemap bytes exercise parsing without round-tripping the product writer. */
function tilemapFixture(
  options: {
    bits?: number;
    cells?: number[];
    tileCount?: number;
    masks?: number[];
    flags?: number;
    compressed?: Uint8Array;
  } = {},
): Uint8Array {
  const palette = rasterHeaders()[0];
  const set = Buffer.alloc(34);
  set.writeUInt32LE(17, 0);
  set.writeUInt32LE(options.flags ?? 6, 4);
  set.writeUInt32LE(options.tileCount ?? 3, 8);
  set.writeUInt16LE(3, 12);
  set.writeUInt16LE(5, 14);
  set.writeInt16LE(-2, 16);
  set.writeUInt16LE(0, 32);
  const pixels = deflateSync(Uint8Array.from({ length: 45 }, (_, i) => Math.floor(i / 15) % 3));
  const length = Buffer.alloc(4);
  length.writeUInt32LE(pixels.length);
  const layer = Buffer.alloc(22);
  layer.writeUInt16LE(3, 0);
  layer.writeUInt16LE(2, 2);
  layer[12] = 255;
  layer.writeUInt32LE(17, 18);
  const cel = Buffer.alloc(48);
  cel[6] = 255;
  cel.writeUInt16LE(3, 7);
  cel.writeUInt16LE(2, 16);
  cel.writeUInt16LE(1, 18);
  const bits = options.bits ?? 32;
  cel.writeUInt16LE(bits, 20);
  for (const [i, mask] of (
    options.masks ?? [0x1fffffff, 0x80000000, 0x40000000, 0x20000000]
  ).entries()) {
    cel.writeUInt32LE(mask, 22 + i * 4);
  }
  const words = Buffer.alloc(8);
  (options.cells ?? [1, 0]).forEach((word, i) => words.writeUInt32LE(word, i * 4));
  return asepriteFile({
    width: 6,
    height: 5,
    chunks: [
      palette,
      { type: 0x2023, data: Buffer.concat([set, length, pixels]) },
      { type: 0x2004, data: layer },
      { type: 0x2005, data: Buffer.concat([cel, options.compressed ?? deflateSync(words)]) },
    ],
  });
}

/** A small tagged/linkable document proves writer attachment order independently of retained native examples. */
function model(): AsepriteDocument {
  return {
    width: 6,
    height: 5,
    transparentIndex: 2,
    palette: [
      [8, 16, 24, 255],
      [8, 16, 24, 255],
      [0, 0, 0, 0],
    ],
    exportId: "a0000000-0000-0000-0000-000000000000",
    layers: [
      {
        kind: "tilemap",
        tileset: 17,
        flags: 3,
        name: "Tiles",
        userData: "role:inventory",
        uuid: "00000000000000000000000000000001",
      },
    ],
    tilesets: [
      {
        id: 17,
        flags: 6,
        name: "Existing owners",
        tileWidth: 3,
        tileHeight: 5,
        tileCount: 3,
        baseIndex: -2,
        indexes: Uint8Array.from({ length: 45 }, (_, i) => Math.floor(i / 15) % 3),
        tileData: [undefined, "view:one", "view:unused"],
        userData: "tileset:seventeen",
      },
    ],
    frames: [
      {
        durationMs: 17,
        cels: [
          {
            kind: "tilemap",
            layer: 0,
            x: 0,
            y: 0,
            zIndex: 0,
            columns: 2,
            rows: 1,
            bits: 32,
            idMask: 0x1fffffff,
            flipXMask: 0x80000000,
            flipYMask: 0x40000000,
            diagonalMask: 0x20000000,
            cells: Uint32Array.of(1, 0),
          },
        ],
      },
      { durationMs: 33, cels: [{ kind: "linked", layer: 0, x: 0, y: 0, zIndex: 0, frame: 0 }] },
    ],
    tags: [
      {
        name: "Measured",
        from: 0,
        to: 1,
        direction: 0,
        repeat: 1,
        userData: "evidence:observation",
      },
      { name: "Inventory", from: 0, to: 0, direction: 0, repeat: 1 },
    ],
  };
}

test("independent tilemap fixture retains non-8x8 dimensions, slot identity, empty sentinel and UI base index", async (t) => {
  const document = await decodeAsepriteDocument(tilemapFixture());
  t.is(document.tilesets[0].tileWidth, 3);
  t.is(document.tilesets[0].tileHeight, 5);
  t.is(document.tilesets[0].id, 17);
  t.is(document.tilesets[0].baseIndex, -2);
  const rendered = renderAsepriteFrame(document, 0);
  t.deepEqual([...rendered.indexes.subarray(0, 6)], [1, 1, 1, 2, 2, 2]);
});

test("production writer preserves metadata attachment, tags, UUIDs and linked payload sharing", async (t) => {
  const before = model();
  const document = await decodeAsepriteDocument(await encodeAsepriteDocument(before));
  t.deepEqual(document.tilesets, before.tilesets);
  t.deepEqual(document.layers, before.layers);
  t.deepEqual(document.frames, before.frames);
  t.deepEqual(document.tags, before.tags);
  t.is(document.exportId, before.exportId);
  const resolved = resolveAsepriteCels(document);
  t.is(resolved.get(document.frames[0].cels[0]), resolved.get(document.frames[1].cels[0]));
  t.deepEqual(renderAsepriteFrame(document, 0), renderAsepriteFrame(document, 1));
});

test("linked cel cycles, missing targets, unsupported masks and decompression bombs reject", async (t) => {
  const before = model();
  const cycle = {
    ...before,
    frames: [
      {
        durationMs: 17,
        cels: [{ kind: "linked" as const, layer: 0, x: 0, y: 0, zIndex: 0, frame: 0 }],
      },
    ],
  };
  t.throws(() => resolveAsepriteCels(cycle), { message: /cycle/ });
  t.throws(
    () =>
      resolveAsepriteCels({ ...before, frames: [{ durationMs: 17, cels: [] }, before.frames[1]] }),
    { message: /no target/ },
  );
  for (const bytes of [
    tilemapFixture({ bits: 24 }),
    tilemapFixture({ cells: [4, 0] }),
    tilemapFixture({ masks: [0x1fffffff, 0x80000000, 0x80000000, 0x20000000] }),
    tilemapFixture({ flags: 7 }),
    tilemapFixture({ tileCount: 0xffffffff }),
    tilemapFixture({ compressed: deflateSync(new Uint8Array(1 << 20)) }),
    tilemapFixture({ compressed: deflateSync(new Uint8Array(7)) }),
  ]) {
    await t.throwsAsync(() => decodeAsepriteDocument(bytes));
  }
  const cancelled = new AbortController();
  cancelled.abort();
  await t.throwsAsync(() => decodeAsepriteDocument(tilemapFixture(), cancelled.signal));
  await t.throwsAsync(() => encodeAsepriteDocument(before, cancelled.signal));
});

test("retained native saves match every indexed pixel in sprite, room and transform sheets", async (t) => {
  for (const name of ["flip-grid", "spikey-tiger-tilemap", "potos-room-tilemap"]) {
    const file = readFileSync(
      new URL(`./fixtures/aseprite-native/${name}-editor-saved.aseprite`, import.meta.url),
    );
    const document = await decodeAsepriteDocument(file);
    const sheet = pngImporter.import({
      bytes: readFileSync(
        new URL(`./fixtures/aseprite-native/${name}-editor.png`, import.meta.url),
      ),
      mediaType: "image/png",
    }).value;
    if (
      !sheet ||
      typeof sheet !== "object" ||
      !("indexes" in sheet) ||
      !(sheet.indexes instanceof Uint8Array) ||
      !("width" in sheet) ||
      typeof sheet.width !== "number"
    ) {
      throw new Error("Expected indexed native-rendered sheet.");
    }
    const sheetIndexes = sheet.indexes,
      sheetWidth = sheet.width;
    for (let frame = 0; frame < document.frames.length; frame++) {
      const rendered = renderAsepriteFrame(document, frame);
      t.true(
        rendered.indexes.every(
          (index, offset) =>
            index ===
            sheetIndexes[
              Math.floor(offset / document.width) * sheetWidth +
                frame * document.width +
                (offset % document.width)
            ],
        ),
        `${name} frame ${frame}`,
      );
    }
  }
});

test("public link resolution rejects excessive frames, duplicate layers and fractional targets before traversal", (t) => {
  const before = model();
  t.throws(
    () =>
      resolveAsepriteCels({
        ...before,
        frames: Array(ASSET_LIMITS.frames + 1).fill(before.frames[0]),
      }),
    { message: /frames/ },
  );
  t.throws(
    () =>
      resolveAsepriteCels({
        ...before,
        frames: [
          { ...before.frames[0], cels: [before.frames[0].cels[0], before.frames[0].cels[0]] },
        ],
      }),
    { message: /Duplicate/ },
  );
  t.throws(
    () =>
      resolveAsepriteCels({
        ...before,
        frames: [
          {
            durationMs: 17,
            cels: [{ kind: "linked", layer: 0, x: 0, y: 0, zIndex: 0, frame: 0.5 }],
          },
        ],
      }),
    { message: /Linked frame/ },
  );
  t.throws(
    () =>
      validateAsepriteDocument({ ...before, tilesets: [{ ...before.tilesets[0], flags: 6.5 }] }),
    { message: /Tileset flags/ },
  );
});

test("encoder rejects excessive aggregate structure before invoking compression and cancels an in-flight stream", async (t) => {
  const before = model(),
    layers = Array.from({ length: 1024 }, (_, layer) => ({
      kind: "raster" as const,
      flags: 3,
      name: String(layer),
    })),
    links = layers.map((_, layer) => ({
      kind: "linked" as const,
      layer,
      frame: 0,
      x: 0,
      y: 0,
      zIndex: 0,
    })),
    empty = new Uint8Array(1);
  const oversized: AsepriteDocument = {
    ...before,
    layers,
    tilesets: [],
    tags: [],
    frames: Array.from({ length: 1024 }, (_, frame) => ({
      durationMs: 1,
      cels:
        frame === 0
          ? layers.map((_, layer) => ({
              kind: "raster" as const,
              layer,
              x: 0,
              y: 0,
              zIndex: 0,
              width: 1,
              height: 1,
              indexes: empty,
            }))
          : links,
    })),
  };
  await t.throwsAsync(() => encodeAsepriteDocument(oversized), { message: /output size/ });
  const controller = new AbortController(),
    pending = encodeAsepriteDocument(before, controller.signal);
  controller.abort(new Error("Cancel compression"));
  await t.throwsAsync(() => pending, { message: /Cancel compression/ });
});
