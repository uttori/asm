/** Synthetic fixtures cover the background pose grammar independently of private game data. */
import { test } from "../../../tests/ava-helper.js";
import {
  decodeBossBackgroundFrame,
  encodeBossBackgroundFrame,
  decodeBossTilemap,
  encodeBossTilemap,
} from "../src/secret-of-mana/som-boss-background.js";
import { expandBossGraphics, expandBossMask } from "../src/secret-of-mana/som-boss-graphics.js";

test("background pose prefixes preserve signed origins, packed placement and bounded pointers", (t) => {
  const bytes = Uint8Array.from([
    2, 255, 144, 255, 208, 255, 0, 0, 28, 11, 9, 94, 7, 6, 4, 4, 114, 96,
  ]);
  const decoded = decodeBossBackgroundFrame(Uint8Array.from([...bytes, 99, 88]));
  t.deepEqual(decoded.frame, {
    originX: -112,
    originY: -48,
    rectangles: [
      { x: 0, y: 0, width: 28, height: 11, source: 0x5e09 },
      { x: 7, y: 6, width: 4, height: 4, source: 0x6072 },
    ],
  });
  t.is(decoded.consumed, bytes.length);
  t.deepEqual(encodeBossBackgroundFrame(decoded.frame), bytes);
  t.throws(() => decodeBossBackgroundFrame(bytes.slice(0, -1)), { message: /Truncated/ });
  t.throws(() => encodeBossBackgroundFrame({ ...decoded.frame, originX: 32768 }));
  t.throws(() => decodeBossBackgroundFrame(Uint8Array.from([1, 0, 0, 0, 0, 0])));
  t.throws(() => decodeBossBackgroundFrame(Uint8Array.from([0, 255, 0, 0, 0, 0])));
});

test("raw and masked tilemap streams round-trip without graphics-style output rounding", (t) => {
  for (const tag of [0, 1, 255]) {
    const data = Uint8Array.from([0, 3, 0, 3, 42, 7, 42, 7, 0, 3]);
    const encoded = encodeBossTilemap(data, tag);
    const decoded = decodeBossTilemap(encoded, data.length);
    t.deepEqual(decoded.data, data);
    t.is(decoded.consumed, encoded.length);
    t.is(decoded.tag, tag);
    t.deepEqual(encodeBossTilemap(decoded.data, decoded.tag), encoded);
    t.throws(() => decodeBossTilemap(encoded.slice(0, -1), data.length));
  }
  const native = Uint8Array.from([1, 0x40, 3, ...Array(127).fill(0)]);
  const decoded = decodeBossTilemap(native, 1024);
  t.is(decoded.consumed, 130);
  t.true(decoded.data.every((value, index) => value === (index % 2 ? 3 : 0)));
  t.deepEqual(encodeBossTilemap(decoded.data), native);
});

test("graphics retain eight-byte rounding while tilemaps stop within a mask group", (t) => {
  const source = Uint8Array.from([0x80, 7]);
  t.deepEqual([...expandBossMask(source, 3).data], [7, 0, 7]);
  t.is(expandBossGraphics(source, 3).data.length, 8);
  t.throws(() => decodeBossTilemap(new Uint8Array(), 2));
  t.throws(() => decodeBossTilemap(Uint8Array.from([0, 1]), 2));
  t.throws(() => decodeBossTilemap(source, 0));
  t.throws(() => decodeBossTilemap(source, 3), { message: /complete two-byte/ });
  t.throws(() => encodeBossTilemap(Uint8Array.from([1, 2, 3])), { message: /complete two-byte/ });
  t.is(expandBossGraphics(new Uint8Array(8192), 65535).data.length, 65536);
});
