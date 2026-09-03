import {
  createBuiltinAssetCodecRegistry,
  decodePlannedAsset,
  encodePlannedAsset,
  planAssets,
  verifyAssetPlan,
  type AssetByteSource,
  type AssetRequest,
  type AssetValue,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import {
  registerSnesAssetCodecs,
  SNES_BG_TILEMAP_ASSET_CODEC_ID,
  SNES_BRR_ASSET_CODEC_ID,
  SNES_MODE7_TILE_ASSET_CODEC_ID,
  SNES_MODE7_TILEMAP_ASSET_CODEC_ID,
  SNES_PALETTE_ASSET_CODEC_ID,
  SNES_TILE_2BPP_ASSET_CODEC_ID,
  SNES_TILE_3BPP_ASSET_CODEC_ID,
  SNES_TILE_4BPP_ASSET_CODEC_ID,
  SNES_TILE_8BPP_ASSET_CODEC_ID,
  snesAssetCodecs,
} from "../src/index.js";

class Bytes implements AssetByteSource {
  readonly #bytes: Uint8Array;

  constructor(bytes: readonly number[]) {
    this.#bytes = Uint8Array.from(bytes);
  }

  get length(): number {
    return this.#bytes.length;
  }

  read(offset: number, length: number): Uint8Array | undefined {
    if (offset < 0 || length < 0 || offset + length > this.length) return undefined;
    return this.#bytes.slice(offset, offset + length);
  }
}

const request = (
  codecId: string,
  length: number | undefined,
  options?: AssetValue,
): AssetRequest => ({
  id: "fixture.snes-asset",
  codecId,
  sourceOffset: 0,
  addressSpace: "rom.file",
  address: 0x8000,
  ...(length === undefined ? {} : { length }),
  ...(options === undefined ? {} : { options }),
});

const registry = () => registerSnesAssetCodecs(createBuiltinAssetCodecRegistry());

test("SNES asset registry is stable and composes with target-neutral codecs", (t) => {
  const ids = snesAssetCodecs.map((codec) => codec.id);
  t.deepEqual(ids, [...ids].sort());
  const combined = registry()
    .list()
    .map((codec) => codec.id);
  t.true(combined.includes("uttori.asset.raw"));
  for (const id of ids) t.true(combined.includes(id));
});

test("SNES planar tile codecs reverse every supported bitplane layout", (t) => {
  const formats = [
    { id: SNES_TILE_2BPP_ASSET_CODEC_ID, bits: 2, planeOffsets: [0, 1] },
    { id: SNES_TILE_3BPP_ASSET_CODEC_ID, bits: 3, planeOffsets: [0, 1, 16] },
    { id: SNES_TILE_4BPP_ASSET_CODEC_ID, bits: 4, planeOffsets: [0, 1, 16, 17] },
    {
      id: SNES_TILE_8BPP_ASSET_CODEC_ID,
      bits: 8,
      planeOffsets: [0, 1, 16, 17, 32, 33, 48, 49],
    },
  ] as const;

  for (const format of formats) {
    const bytes = new Array<number>(format.bits * 8).fill(0);
    for (const offset of format.planeOffsets) bytes[offset] = 0x80;
    const source = new Bytes(bytes);
    const codecs = registry();
    const plan = planAssets(codecs, source, [request(format.id, bytes.length)]);
    const asset = plan.assets[0];
    const decoded = decodePlannedAsset(codecs, source, asset);
    const value = decoded.value as {
      readonly tiles: readonly (readonly (readonly number[])[])[];
    };

    t.is(value.tiles[0][0][0], 2 ** format.bits - 1);
    t.is(value.tiles[0][0][1], 0);
    const tiles = value.tiles.map((tile) => tile.map((row) => [...row]));
    tiles[0][0][1] = 2 ** format.bits - 1;
    const edited = encodePlannedAsset(codecs, source, asset, {
      value: { kind: "snes-planar-tiles", tiles },
    });
    for (const offset of format.planeOffsets) t.is(edited[offset], 0xc0);
    t.is(verifyAssetPlan(codecs, source, plan).assets.length, 1);
  }
});

test("SNES Mode 7 tiles use editable row-major chunky pixels", (t) => {
  const source = new Bytes(Array.from({ length: 64 }, (_, index) => index));
  const codecs = registry();
  const plan = planAssets(codecs, source, [request(SNES_MODE7_TILE_ASSET_CODEC_ID, 64)]);
  const asset = plan.assets[0];
  const decoded = decodePlannedAsset(codecs, source, asset);
  const value = decoded.value as {
    readonly tiles: readonly (readonly (readonly number[])[])[];
  };

  t.deepEqual(value.tiles[0][1], [8, 9, 10, 11, 12, 13, 14, 15]);
  const tiles = value.tiles.map((tile) => tile.map((row) => [...row]));
  tiles[0][7][7] = 0xaa;
  const edited = encodePlannedAsset(codecs, source, asset, {
    value: { kind: "snes-mode7-tiles", tiles },
  });
  t.is(edited[63], 0xaa);
  t.is(verifyAssetPlan(codecs, source, plan).assets.length, 1);
});

test("SNES palette codec preserves BGR555 channels and unused bit 15", (t) => {
  const source = new Bytes([0xff, 0xff, 0x10, 0x42]);
  const codecs = registry();
  const plan = planAssets(codecs, source, [request(SNES_PALETTE_ASSET_CODEC_ID, 4)]);
  const asset = plan.assets[0];
  const decoded = decodePlannedAsset(codecs, source, asset);

  t.deepEqual((decoded.value as { readonly colors: readonly AssetValue[] }).colors, [
    { red: 31, green: 31, blue: 31, unusedHighBit: 1 },
    { red: 16, green: 16, blue: 16, unusedHighBit: 0 },
  ]);
  t.deepEqual(
    [
      ...encodePlannedAsset(codecs, source, asset, {
        value: {
          kind: "snes-palette-bgr555",
          colors: [
            { red: 1, green: 2, blue: 3, unusedHighBit: 1 },
            { red: 16, green: 16, blue: 16, unusedHighBit: 0 },
          ],
        },
      }),
    ],
    [0x41, 0x8c, 0x10, 0x42],
  );
  t.is(verifyAssetPlan(codecs, source, plan).assets.length, 1);
});

test("SNES BG tilemap exposes every packed entry field", (t) => {
  const source = new Bytes([0x55, 0xf5, 0x00, 0x00]);
  const codecs = registry();
  const plan = planAssets(codecs, source, [
    request(SNES_BG_TILEMAP_ASSET_CODEC_ID, 4, { width: 2, height: 1 }),
  ]);
  const asset = plan.assets[0];
  const decoded = decodePlannedAsset(codecs, source, asset);
  const value = decoded.value as { readonly entries: readonly AssetValue[] };

  t.deepEqual(value.entries[0], {
    tile: 0x155,
    palette: 5,
    priority: 1,
    horizontalFlip: 1,
    verticalFlip: 1,
  });
  t.deepEqual(
    [
      ...encodePlannedAsset(codecs, source, asset, {
        value: {
          kind: "snes-bg-tilemap",
          entries: [
            {
              tile: 1,
              palette: 2,
              priority: 0,
              horizontalFlip: 1,
              verticalFlip: 0,
            },
            { tile: 0, palette: 0, priority: 0, horizontalFlip: 0, verticalFlip: 0 },
          ],
        },
      }),
    ],
    [0x01, 0x48, 0, 0],
  );
  t.is(verifyAssetPlan(codecs, source, plan).assets.length, 1);
});

test("SNES Mode 7 tilemap preserves its byte tile indexes and dimensions", (t) => {
  const source = new Bytes([1, 2, 3, 4]);
  const codecs = registry();
  const plan = planAssets(codecs, source, [
    request(SNES_MODE7_TILEMAP_ASSET_CODEC_ID, 4, { width: 2, height: 2 }),
  ]);
  const asset = plan.assets[0];
  const decoded = decodePlannedAsset(codecs, source, asset);

  t.like(decoded.value, { width: 2, height: 2, indexes: [1, 2, 3, 4] });
  t.deepEqual(
    [
      ...encodePlannedAsset(codecs, source, asset, {
        value: { kind: "snes-mode7-tilemap", indexes: [4, 3, 2, 1] },
      }),
    ],
    [4, 3, 2, 1],
  );
  t.is(verifyAssetPlan(codecs, source, plan).assets.length, 1);
});

test("SNES BRR codec discovers end blocks and reverses signed nibbles", (t) => {
  const sourceBytes = [
    0x24, 0x8f, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xff, 0x10, 0x32, 0x54, 0x76, 0x98, 0xba,
    0xdc, 0xfe,
  ];
  const source = new Bytes(sourceBytes);
  const codecs = registry();
  const plan = planAssets(codecs, source, [
    request(SNES_BRR_ASSET_CODEC_ID, undefined, { maxBlocks: 2 }),
  ]);
  const asset = plan.assets[0];
  const decoded = decodePlannedAsset(codecs, source, asset);
  const value = decoded.value as {
    readonly blocks: readonly (Readonly<Record<string, AssetValue>> & {
      readonly nibbles: readonly number[];
    })[];
  };

  t.is(asset.inspection.size, 18);
  t.like(value.blocks[0], { range: 2, filter: 1, loop: 0, end: 0 });
  t.deepEqual(value.blocks[0].nibbles.slice(0, 4), [-8, -1, 0, 1]);
  t.like(value.blocks[1], { range: 15, filter: 3, loop: 1, end: 1 });
  t.is(decoded.files?.[0].mediaType, "audio/x-snes-brr");

  const blocks = value.blocks.map((block) => ({ ...block, nibbles: [...block.nibbles] }));
  blocks[0].nibbles[0] = 7;
  const edited = encodePlannedAsset(codecs, source, asset, {
    value: { kind: "snes-brr", blocks },
  });
  t.is(edited[1], 0x7f);
  t.is(verifyAssetPlan(codecs, source, plan).assets.length, 1);
});

test("SNES codecs reject malformed extents, grids, pixels, and BRR streams", (t) => {
  const codecs = registry();
  t.throws(
    () =>
      planAssets(codecs, new Bytes(new Array(17).fill(0)), [
        request(SNES_TILE_2BPP_ASSET_CODEC_ID, 17),
      ]),
    { message: /not divisible by 16/ },
  );
  const tileSource = new Bytes(new Array(16).fill(0));
  const tilePlan = planAssets(codecs, tileSource, [request(SNES_TILE_2BPP_ASSET_CODEC_ID, 16)]);
  const invalidPixels = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  invalidPixels[0][0] = 4;
  t.throws(
    () =>
      encodePlannedAsset(codecs, tileSource, tilePlan.assets[0], {
        value: { kind: "snes-planar-tiles", tiles: [invalidPixels] },
      }),
    { message: /integer in 0\.\.3/ },
  );
  t.throws(
    () =>
      planAssets(codecs, new Bytes([0, 0, 0, 0]), [
        request(SNES_MODE7_TILEMAP_ASSET_CODEC_ID, 4, { width: 3, height: 1 }),
      ]),
    { message: /requires 3 bytes, not 4/ },
  );
  t.throws(
    () =>
      planAssets(codecs, new Bytes(new Array(10).fill(0)), [request(SNES_BRR_ASSET_CODEC_ID, 10)]),
    { message: /multiple of 9/ },
  );
  t.throws(
    () =>
      planAssets(codecs, new Bytes(new Array(9).fill(0)), [
        request(SNES_BRR_ASSET_CODEC_ID, undefined, { maxBlocks: 1 }),
      ]),
    { message: /no end block/ },
  );
});
