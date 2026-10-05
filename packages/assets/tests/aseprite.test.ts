import { test } from "../../../tests/ava-helper.js";
import { asepriteFile, rasterHeaders, rasterCel } from "../../../tests/fixtures/aseprite-file.js";
import { encodeAsepriteAtlas, decodeAsepriteAtlas } from "../src/aseprite.js";

const exportId = "a0000000-0000-0000-0000-000000000000";

test("direct Aseprite file round trip preserves exact slots, duplicate colors, transparency and identity", async (t) => {
  const document = {
    width: 3,
    height: 5,
    transparentIndex: 2,
    exportId,
    palette: [
      [8, 16, 24, 255],
      [8, 16, 24, 255],
      [1, 2, 3, 0],
    ] as const,
    indexes: Uint8Array.from({ length: 15 }, (_, index) => index % 3),
  };
  const file = encodeAsepriteAtlas(document);
  const result = await decodeAsepriteAtlas(file);
  t.deepEqual(result, document);
  result.indexes.fill(2);
  t.deepEqual((await decodeAsepriteAtlas(file)).indexes, document.indexes);
});

test("legacy packet starts, six-bit expansion and partial modern palette updates match editor semantics", async (t) => {
  const layer = rasterHeaders()[1];
  const packets = {
    type: 0x11,
    data: Uint8Array.of(2, 0, 0, 1, 11, 48, 63, 1, 2, 0, 0, 0, 1, 2, 3),
  };
  const old = await decodeAsepriteAtlas(asepriteFile({ chunks: [packets, layer] }));
  t.deepEqual(old.palette, [
    [44, 195, 255, 255],
    [0, 0, 0, 255],
    [4, 8, 12, 255],
  ]);
  const partial = Buffer.alloc(26);
  partial.writeUInt32LE(3, 0);
  partial.writeUInt32LE(2, 4);
  partial.writeUInt32LE(2, 8);
  partial.set([0, 0, 1, 2, 3, 0], 20);
  const updated = await decodeAsepriteAtlas(
    asepriteFile({
      chunks: [packets, { type: 0x2019, data: partial }, packets, layer],
    }),
  );
  t.deepEqual(updated.palette, [
    [44, 195, 255, 255],
    [0, 0, 0, 255],
    [1, 2, 3, 0],
  ]);
  await t.throwsAsync(
    () =>
      decodeAsepriteAtlas(
        asepriteFile({
          chunks: [{ type: 0x2019, data: partial }, layer],
        }),
      ),
    { message: /every slot/ },
  );
});

test("raw/compressed trimmed cels and absent blank cels normalize into the fixed canvas", async (t) => {
  for (const compressed of [false, true]) {
    const decoded = await decodeAsepriteAtlas(
      asepriteFile({ chunks: [...rasterHeaders(), rasterCel([0, 1], compressed)] }),
    );
    const expected = new Uint8Array(15).fill(2);
    expected[7] = 0;
    expected[8] = 1;
    t.deepEqual(decoded.indexes, expected);
    t.deepEqual(decoded.palette[0], decoded.palette[1]);
  }
  const blank = await decodeAsepriteAtlas(asepriteFile({ chunks: rasterHeaders() }));
  t.deepEqual(blank.indexes, new Uint8Array(15).fill(2));
});

test("legacy palette decoding and modern precedence preserve slot identities", async (t) => {
  const [modern, layer] = rasterHeaders();
  const legacy = { type: 4, data: Uint8Array.of(1, 0, 0, 3, 8, 16, 24, 8, 16, 24, 0, 0, 0) };
  const old = await decodeAsepriteAtlas(asepriteFile({ chunks: [legacy, layer] }));
  t.deepEqual(old.palette, [
    [8, 16, 24, 255],
    [8, 16, 24, 255],
    [0, 0, 0, 255],
  ]);
  const merged = await decodeAsepriteAtlas(asepriteFile({ chunks: [modern, legacy, layer] }));
  t.deepEqual(merged.palette[2], [0, 0, 0, 0]);
  const sixBit = { type: 0x11, data: Uint8Array.of(1, 0, 0, 3, 0, 63, 0, 63, 0, 63, 0, 0, 0) };
  t.deepEqual(
    (await decodeAsepriteAtlas(asepriteFile({ chunks: [sixBit, layer] }))).palette[0],
    [0, 255, 0, 255],
  );
});

test("bounded Aseprite decoding rejects malformed lengths, unsupported rendering and ambiguous inventory", async (t) => {
  const good = asepriteFile({ chunks: [...rasterHeaders(), rasterCel([0, 1])] });
  const mutations: Uint8Array[] = [];
  for (const [offset, value] of [
    [4, 0],
    [6, 2],
    [12, 32],
    [8, 0],
    [28, 3],
  ]) {
    const bytes = good.slice();
    bytes[offset] = value;
    mutations.push(bytes);
  }
  mutations.push(good.subarray(0, good.length - 1));
  for (const type of [0x2008, 0x2023, 0xffff]) {
    mutations.push(
      asepriteFile({ chunks: [...rasterHeaders(), { type, data: new Uint8Array() }] }),
    );
  }
  const layer = rasterHeaders()[1];
  mutations.push(asepriteFile({ chunks: [...rasterHeaders(), layer] }));
  const hidden = Uint8Array.from(layer.data);
  hidden[0] = 2;
  mutations.push(
    asepriteFile({ chunks: [rasterHeaders()[0], { type: layer.type, data: hidden }] }),
  );
  const linked = rasterCel([0, 1]);
  linked.data[7] = 1;
  mutations.push(asepriteFile({ chunks: [...rasterHeaders(), linked] }));
  const outside = rasterCel([0, 1]);
  outside.data[2] = 2;
  mutations.push(asepriteFile({ chunks: [...rasterHeaders(), outside] }));
  for (const bytes of mutations) {
    await t.throwsAsync(() => decodeAsepriteAtlas(bytes));
  }
});

test("zlib inflation is bounded and rejects short, corrupt, trailing and oversized streams", async (t) => {
  const oversized = rasterCel(Array(4096).fill(0), true);
  const short = rasterCel([0], true);
  const corrupt = rasterCel([0, 1], true);
  corrupt.data[20] = 0;
  const trailing = rasterCel([0, 1], true);
  trailing.data = Buffer.concat([trailing.data, Uint8Array.of(0, 0)]);
  for (const cel of [oversized, short, corrupt, trailing]) {
    await t.throwsAsync(
      () => decodeAsepriteAtlas(asepriteFile({ chunks: [...rasterHeaders(), cel] })),
      { message: /zlib/ },
    );
  }
});

test("annotation metadata never authorizes geometry and input remains stable during async inflation", async (t) => {
  const annotation = { type: 0x2022, data: new Uint8Array(16) };
  const file = asepriteFile({ chunks: [...rasterHeaders(), rasterCel([0, 1], true), annotation] });
  const result = decodeAsepriteAtlas(file);
  file.fill(0);
  t.is((await result).indexes[8], 1);
});

test("profiles, precise bounds and sprite identity cannot silently alter raster meaning", async (t) => {
  const [palette, layer] = rasterHeaders();
  const user = Buffer.from("uttori-atlas-export:" + exportId);
  const identity = Buffer.alloc(6 + user.length);
  identity.writeUInt32LE(1, 0);
  identity.writeUInt16LE(user.length, 4);
  identity.set(user, 6);
  const metadata = { type: 0x2020, data: identity };
  const renamed = Buffer.from(layer.data);
  renamed[18] = 90;
  const profile = Buffer.alloc(16);
  profile.writeUInt16LE(1, 0);
  const precise = Buffer.alloc(36);
  precise.writeUInt32LE(1, 0);
  for (const [index, value] of [1, 2, 2, 1].entries()) {
    precise.writeInt32LE(value * 65536, 4 + index * 4);
  }
  const supported = [
    palette,
    metadata,
    { type: layer.type, data: renamed },
    rasterCel([0, 1]),
    { type: 0x2006, data: precise },
    { type: 0x2007, data: profile },
  ];
  t.is((await decodeAsepriteAtlas(asepriteFile({ chunks: supported }))).exportId, exportId);
  for (const chunks of [
    [palette, metadata, metadata, layer],
    [palette, layer, metadata],
  ]) {
    await t.throwsAsync(() => decodeAsepriteAtlas(asepriteFile({ chunks })), {
      message: /identity/,
    });
  }
  precise.writeInt32LE(65537, 4);
  await t.throwsAsync(() => decodeAsepriteAtlas(asepriteFile({ chunks: supported })), {
    message: /fractional/,
  });
  for (const [type, flags] of [
    [2, 0],
    [1, 1],
  ]) {
    profile.writeUInt16LE(type, 0);
    profile.writeUInt16LE(flags, 2);
    await t.throwsAsync(
      () =>
        decodeAsepriteAtlas(
          asepriteFile({ chunks: [palette, layer, { type: 0x2007, data: profile }] }),
        ),
      { message: /profile/ },
    );
  }
});
