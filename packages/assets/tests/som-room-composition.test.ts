import { test } from "../../../tests/ava-helper.js";
import {
  renderRoomAsset,
  type RoomAsset,
  type RoomPreview,
} from "../src/secret-of-mana/som-room-assets.js";
import {
  composeSomRoom,
  renderSomRoomComposition,
} from "../src/secret-of-mana/som-room-composition.js";

/** Independent planar fixture distinguishes native blank/unused tiles, flips and Mode-1 pass order. */
function fixture(): { room: RoomAsset; preview: RoomPreview } {
  const indexes = [
      new Uint8Array(64),
      new Uint8Array(64).fill(1),
      new Uint8Array(64).fill(2),
      new Uint8Array(64),
      new Uint8Array(64),
    ],
    graphics = new Uint8Array(indexes.length * 32);
  indexes[3][0] = 3;
  for (const [tile, pixels] of indexes.entries()) {
    for (let pixel = 0; pixel < pixels.length; pixel++) {
      for (let plane = 0; plane < 4; plane++) {
        graphics[tile * 32 + (plane >>> 1) * 16 + Math.floor(pixel / 8) * 2 + (plane & 1)] |=
          ((pixels[pixel] >>> plane) & 1) << (7 - (pixel % 8));
      }
    }
  }
  const words = [Array(768).fill(0), Array(768).fill(0)],
    bank = 1 << 10;
  words[0].splice(0, 4, bank | 2, 0, bank | 0x2000 | 0x8000 | 3, bank | 0x2000 | 1);
  words[1].splice(0, 4, bank | 1, bank | 0x2000 | 1, 0, bank | 0x2000 | 0x4000 | 3);
  words[0].fill(bank | 0x2000 | 1, 4, 8);
  words[1].fill(bank | 2, 4, 8);
  const colors = Array(128).fill(0);
  colors[17] = 0x801f;
  colors[18] = 0x03e0;
  colors[19] = 0x7c00;
  colors[20] = 0x0004;
  const piece = { variable: 0, minimum: 0, maximum: 1, layer: 1, layout: 1, x: 0, y: 0 };
  return {
    room: {
      format: "som.room",
      version: 1,
      id: 1,
      header: Array(8).fill(0),
      entities: [],
      triggers: [],
      previewStory: { 0: 1 },
      pieces: [
        piece,
        { ...piece, layer: 2 },
        { ...piece, layout: 2, x: 1 },
        { ...piece, minimum: 2, maximum: 2, layout: 3 },
      ],
    },
    preview: {
      format: "som.room.preview",
      version: 1,
      provenance: { kind: "fixture-observation" },
      layouts: {
        1: { width: 2, height: 1, tiles: [0, 1] },
        2: { width: 1, height: 1, tiles: [2] },
        3: { width: 1, height: 1, tiles: [1] },
      },
      tilesets: {
        "0:0:0": {
          graphics: Buffer.from(graphics).toString("hex"),
          graphicsKnown: "01".repeat(graphics.length),
          colors,
          layerWords: words,
        },
      },
    },
  };
}

test("shared room composition retains conditional overwrite, native identities, coverage, flips and priority ordering", (t) => {
  const { room, preview } = fixture(),
    composition = composeSomRoom(room, preview),
    render = renderSomRoomComposition(composition);
  t.deepEqual(
    composition.passes.map((pass) => [pass.layer, pass.priority]),
    [
      [2, 0],
      [1, 0],
      [2, 1],
      [1, 1],
    ],
  );
  t.deepEqual(
    composition.activePieces.map((piece) => piece.sourceIndex),
    [0, 1, 2],
  );
  t.deepEqual([...composition.metatiles[0]], [0, 2]);
  t.deepEqual([...composition.metatiles[1]], [0, 1]);
  t.is(composition.tiles.length, 5);
  t.deepEqual(composition.tiles[0], composition.tiles[4]);
  t.is(composition.paletteWords[17], 0x801f);
  t.deepEqual(composition.palette[20], [32, 0, 0, 255]);
  const pixel = (x: number, y: number) => [
    ...render.rgba.subarray((y * render.width + x) * 4, (y * render.width + x) * 4 + 4),
  ];
  t.deepEqual(pixel(0, 0), [0, 255, 0, 255]);
  t.deepEqual(pixel(8, 0), [255, 0, 0, 255]);
  t.deepEqual(pixel(0, 15), [0, 0, 255, 255]);
  t.deepEqual(pixel(15, 8), [255, 0, 0, 255]);
  t.deepEqual(pixel(16, 0), [0, 255, 0, 255]);
  t.deepEqual(renderRoomAsset(room, preview).rgba, render.rgba);
  preview.provenance = { kind: "changed" };
  t.deepEqual(composition.provenance, { kind: "fixture-observation" });
  t.deepEqual(room.pieces[0], {
    variable: 0,
    minimum: 0,
    maximum: 1,
    layer: 1,
    layout: 1,
    x: 0,
    y: 0,
  });
});

test("unknown physical bytes and invalid native placement reject rather than rendering invented tiles", (t) => {
  const { room, preview } = fixture(),
    graphics = preview.tilesets["0:0:0"];
  graphics.graphicsKnown =
    graphics.graphicsKnown.slice(0, 3 * 64 + 62) + "00" + graphics.graphicsKnown.slice(4 * 64);
  t.throws(() => composeSomRoom(room, preview), { message: /unknown physical graphics/ });
  const valid = fixture();
  valid.room.pieces[0].x = 127;
  t.throws(() => composeSomRoom(valid.room, valid.preview), { message: /native 128-tile/ });
  valid.room.pieces[0].x = 0;
  valid.preview.layouts[1].tiles[0] = 192;
  t.throws(() => composeSomRoom(valid.room, valid.preview), { message: /Static metatile/ });
});

test("native room compositions render above one megapixel and at the inclusive four-megapixel boundary", (t) => {
  for (const [columns, rows] of [
    [64, 65],
    [128, 128],
  ]) {
    const { room, preview } = fixture();
    room.pieces = [room.pieces[0]];
    preview.layouts[1] = { width: columns, height: rows, tiles: Array(columns * rows).fill(0) };
    const composition = composeSomRoom(room, preview),
      image = renderSomRoomComposition(composition);
    t.is(image.width * image.height, columns * rows * 256);
    t.is(image.rgba.length, columns * rows * 1024);
    t.true(image.rgba.every((value, index) => index % 4 !== 3 || value === 255));
  }
});
