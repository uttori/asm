import { test } from "../../../tests/ava-helper.js";
import { somRoomNativeFixture } from "../../../tests/fixtures/som-room-native.js";
import { encodeAsepriteDocument, decodeAsepriteDocument } from "../src/aseprite-document.js";
import { renderAsepriteFrame } from "../src/aseprite-render.js";
import { inspectTilemapInterchange } from "../src/interchange.js";
import {
  composeSomRoom,
  renderSomRoomComposition,
  somRoomPaletteColor,
  somRoomPaletteWord,
} from "../src/secret-of-mana/som-room-composition.js";
import { createSomRoomInterchange } from "../src/secret-of-mana/som-room-interchange.js";
import {
  loadSomRoomNative,
  decodeSomRoomMetatiles,
} from "../src/secret-of-mana/som-room-native.js";

const ID = "12456789-1234-5678-9012-123456789012";
function fixture() {
  const { room, rom } = somRoomNativeFixture();
  const read = (address: number, size: number): Uint8Array => {
    const result = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      result[i] = rom[(address - 0xc00000 + i) % rom.length];
    }
    return result;
  };
  const state = loadSomRoomNative(room, read),
    composition = composeSomRoom(room, state.preview);
  const bind = (tile: (typeof state.inventory)[number]) => ({
    ...tile,
    owner: `${tile.address}:${tile.depth}`,
    editable: true,
  });
  const baseline = createSomRoomInterchange(
    composition,
    state.inventory.map(bind),
    state.physical.map((tile) => tile && bind(tile)),
    [17, 18, 19, 20],
    ID,
  );
  return { room, rom, read, state, composition, baseline };
}

test("native room loader preserves complete unused/blank inventory, constant planes, aliases, flips and display policy", async (t) => {
  const { baseline, composition, state } = fixture();
  t.is(state.inventory.length, 39);
  t.is(baseline.ownership.owners.length, 11);
  t.deepEqual(state.inventory[32].indexes, state.inventory[34].indexes);
  const constants = state.inventory.filter((tile) => tile.depth === 3);
  t.is(constants[0].constant, 8);
  t.is(constants[0].indexes[0], 0);
  t.is(constants[1].indexes[0], 7);
  const rendered = renderAsepriteFrame(baseline.document, baseline.document.frames.length - 1),
    native = renderSomRoomComposition(composition);
  const rgba = new Uint8Array(rendered.indexes.length * 4);
  rendered.indexes.forEach((index, pixel) => rgba.set(baseline.document.palette[index], pixel * 4));
  for (let y = 0; y < native.height; y++) {
    t.deepEqual(
      rgba.slice(y * rendered.width * 4, y * rendered.width * 4 + native.width * 4),
      native.rgba.slice(y * native.width * 4, (y + 1) * native.width * 4),
    );
  }
  const saved = await decodeAsepriteDocument(await encodeAsepriteDocument(baseline.document));
  t.deepEqual(inspectTilemapInterchange(baseline, saved), { pixels: [], colors: [] });
  const view = baseline.ownership.views.findIndex((entry) => entry.owner === "12713984:3"),
    changed = structuredClone(saved);
  changed.tilesets[0].indexes[(view + 1) * 64] = 25;
  const plan = inspectTilemapInterchange(baseline, changed);
  t.is(plan.pixels[0].indexes[0], 1);
  changed.tilesets[0].indexes[(view + 1) * 64] = 17;
  t.throws(() => inspectTilemapInterchange(baseline, changed), { message: /unmapped/ });
});

test("native room bounds reject unsupported loader modes, truncated metatiles and incomplete reads", (t) => {
  const { room, rom, read } = fixture();
  rom[0xc1001] = 0xe0;
  t.throws(() => loadSomRoomNative(room, read), { message: /format 7/ });
  t.throws(() => decodeSomRoomMetatiles(new Uint8Array(383)), { message: /Truncated/ });
  t.throws(() => decodeSomRoomMetatiles(new Uint8Array(385)), { message: /trailing/ });
  t.throws(() => loadSomRoomNative(room, () => new Uint8Array(0)), { message: /Incomplete/ });
});

test("unproven source inverse is labeled in inventory and cannot gain authority through artwork", (t) => {
  const { composition, state } = fixture(),
    bind = (tile: (typeof state.inventory)[number]) => ({
      ...tile,
      owner: `${tile.address}:${tile.depth}`,
      editable: tile.address !== 0xc10000,
    });
  const baseline = createSomRoomInterchange(
    composition,
    state.inventory.map(bind),
    state.physical.map((tile) => tile && bind(tile)),
    [],
    ID,
  );
  t.true(baseline.document.layers.some((layer) => layer.name.includes("read-only")));
  const edited = structuredClone(baseline.document),
    view = baseline.ownership.views.findIndex((entry) => entry.owner === "12648448:2");
  edited.tilesets[0].indexes[(view + 1) * 64] = 17;
  t.throws(() => inspectTilemapInterchange(baseline, edited), { message: /read-only/ });
});

test("room palette inversion keeps floor expansion and hidden bits, and rejects colors between native steps", (t) => {
  const color = somRoomPaletteColor(0x8004, false);
  t.deepEqual(color, [32, 0, 0, 255]);
  t.is(somRoomPaletteWord(0x8000, color), 0x8004);
  t.throws(() => somRoomPaletteWord(0x8000, [33, 0, 0, 255]), { message: /exactly room/ });
});

test("native room reads map graphics across the 2 MiB mirror without inventing missing high planes", (t) => {
  const { room, rom, read } = fixture();
  rom.set([0xf8, 0xff, 0xdf], 0xce276); // First 4bpp tile straddles DFFFFF/E00000.
  rom[0x1ffff8] = 0x80;
  rom[0] = 0x80;
  const state = loadSomRoomNative(room, read),
    tile = state.inventory.at(-2)!;
  t.is(tile.address, 0xdffff8);
  t.is(tile.native[0], 0x80);
  t.is(tile.native[8], 0x80);
  t.is(tile.indexes[0], 1);
  t.is(tile.indexes[32], 1);
});
