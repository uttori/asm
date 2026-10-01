import { test } from "../../../tests/ava-helper.js";
import { createIndexedPng } from "../src/png-edit.js";
import { convertBossImage } from "../src/secret-of-mana/som-asset-plugin.js";
import { expandBossGraphics } from "../src/secret-of-mana/som-boss-graphics.js";
import { decompressSomLz } from "../src/secret-of-mana/som-lz.js";

test("an explicit original boss stream preserves noncanonical tokens after PNG tools remove private metadata", (t) => {
  const blank = createIndexedPng({
    width: 8,
    height: 8,
    indexes: new Uint8Array(64),
    palette: [
      [0, 0, 0, 0],
      [255, 255, 255, 255],
    ],
  });
  // Four all-zero masks decode one blank 4bpp tile. The existing encoder emits
  // two explicit zero literals, so unchanged pixels must retain this shorter stream.
  const native = new Uint8Array(4);
  const options = { storage: "rle", byteLength: 4, native: "original.bin" };
  const resources = { "original.bin": { bytes: native, mediaType: "application/octet-stream" } };
  t.deepEqual(
    convertBossImage({ bytes: blank, mediaType: "image/png" }, options, resources).outputs.graphics
      .bytes,
    native,
  );
  t.throws(() => convertBossImage({ bytes: blank, mediaType: "image/png" }, options), {
    message: /explicit original/,
  });
  const edited = createIndexedPng({
    width: 8,
    height: 8,
    indexes: new Uint8Array(64).fill(1),
    palette: [
      [0, 0, 0, 0],
      [255, 255, 255, 255],
    ],
  });
  const changed = convertBossImage(
    { bytes: edited, mediaType: "image/png" },
    { ...options, sizePolicy: "encoded" },
    resources,
  ).outputs.graphics.bytes;
  t.notDeepEqual(changed, native);
  t.deepEqual(
    expandBossGraphics(changed, 32).data,
    Uint8Array.from({ length: 32 }, (_, index) => (index < 16 && index % 2 === 0 ? 255 : 0)),
  );
  t.throws(
    () =>
      convertBossImage({ bytes: blank, mediaType: "image/png" }, options, {
        "original.bin": {
          bytes: new Uint8Array([255, 0, 0, 0]),
          mediaType: "application/octet-stream",
        },
      }),
    { message: /Truncated/ },
  );
});

test("boss encoding exposes growth only with explicit sizing and decodes every edited pixel", (t) => {
  const source = {
    mediaType: "image/png",
    bytes: createIndexedPng({
      width: 8,
      height: 8,
      indexes: new Uint8Array(64).fill(1),
      palette: [
        [0, 0, 0, 0],
        [255, 255, 255, 255],
      ],
    }),
  };
  // A tile of index one sets plane zero and clears the other three bitplanes.
  const expected = Uint8Array.from({ length: 32 }, (_, index) =>
    index < 16 && index % 2 === 0 ? 255 : 0,
  );
  for (const storage of ["rle", "lz-rle"]) {
    const options = { storage, byteLength: 1, mode: 5 };
    t.throws(() => convertBossImage(source, options), { message: /fixed ROM span/ });
    const encoded = convertBossImage(source, { ...options, sizePolicy: "encoded" }).outputs.graphics
      .bytes;
    t.true(encoded.length > options.byteLength);
    const mask = storage === "rle" ? encoded : decompressSomLz(encoded).data;
    const decoded = expandBossGraphics(mask, expected.length);
    t.deepEqual(decoded.data, expected);
    t.is(decoded.consumed, mask.length);
    t.throws(() => convertBossImage(source, { ...options, sizePolicy: "truncate" }), {
      message: /sizePolicy/,
    });
  }
});
