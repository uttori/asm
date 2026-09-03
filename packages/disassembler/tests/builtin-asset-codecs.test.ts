import { test } from "../../../tests/ava-helper.js";
import {
  builtinAssetCodecs,
  createBuiltinAssetCodecRegistry,
  decodePlannedAsset,
  encodePlannedAsset,
  INDEX_TABLE_ASSET_CODEC_ID,
  planAssets,
  POINTER_TABLE_ASSET_CODEC_ID,
  RAW_ASSET_CODEC_ID,
  SCALAR_ARRAY_ASSET_CODEC_ID,
  STRUCT_ARRAY_ASSET_CODEC_ID,
  TEXT_ASSET_CODEC_ID,
  verifyAssetPlan,
  type AssetByteSource,
  type AssetRequest,
  type AssetValue,
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
  id: "fixture.asset",
  codecId,
  sourceOffset: 0,
  addressSpace: "rom.file",
  address: 0x100,
  ...(length === undefined ? {} : { length }),
  ...(options === undefined ? {} : { options }),
});

test("built-in asset registry exposes codecs in stable-id order", (t) => {
  const ids = builtinAssetCodecs.map((codec) => codec.id);
  t.deepEqual(ids, [...ids].sort());
  t.deepEqual(
    createBuiltinAssetCodecRegistry()
      .list()
      .map((codec) => codec.id),
    ids,
  );
});

test("raw/incbin codec extracts bytes and enforces fixed ownership", (t) => {
  const registry = createBuiltinAssetCodecRegistry();
  const source = new Bytes([1, 2, 3, 4]);
  const plan = planAssets(registry, source, [request(RAW_ASSET_CODEC_ID, 4)]);
  const asset = plan.assets[0];
  const decoded = decodePlannedAsset(registry, source, asset);

  t.deepEqual((decoded.value as { readonly bytes: readonly number[] }).bytes, [1, 2, 3, 4]);
  t.is(decoded.files?.[0].path, "assets/fixture.asset.bin");
  t.deepEqual(
    [
      ...encodePlannedAsset(registry, source, asset, {
        value: { kind: "raw", bytes: [9, 8, 7, 6] },
      }),
    ],
    [9, 8, 7, 6],
  );
  t.throws(
    () => encodePlannedAsset(registry, source, asset, { value: { kind: "raw", bytes: [1] } }),
    { message: /expected exactly 4/ },
  );
  t.throws(
    () =>
      encodePlannedAsset(registry, source, asset, {
        value: { kind: "raw", bytes: [1, 2, 3, 256] },
      }),
    { message: /range 0\.\.255/ },
  );
  t.is(verifyAssetPlan(registry, source, plan).assets.length, 1);
});

test("scalar arrays decode and edit signed fixed-width values", (t) => {
  const registry = createBuiltinAssetCodecRegistry();
  const source = new Bytes([0xfe, 0xff, 0x12, 0x34]);
  const plan = planAssets(registry, source, [
    request(SCALAR_ARRAY_ASSET_CODEC_ID, 4, { width: 2, signed: true, endian: "little" }),
  ]);
  const asset = plan.assets[0];
  const decoded = decodePlannedAsset(registry, source, asset);

  t.deepEqual((decoded.value as { readonly values: readonly number[] }).values, [-2, 0x3412]);
  t.deepEqual(
    [
      ...encodePlannedAsset(registry, source, asset, {
        value: { kind: "scalar-array", values: [-3, 1] },
      }),
    ],
    [0xfd, 0xff, 1, 0],
  );
  t.is(verifyAssetPlan(registry, source, plan).assets.length, 1);
});

test("struct arrays preserve padding while editing scalars and LSB0 bitfields", (t) => {
  const registry = createBuiltinAssetCodecRegistry();
  const source = new Bytes([0xad, 0x34, 0x12, 0xee]);
  const options = {
    count: 1,
    stride: 4,
    fields: [
      { name: "kind", bitOffset: 0, bits: 3 },
      { name: "enabled", bitOffset: 3, bits: 1 },
      { name: "value", offset: 1, width: 2, endian: "little" },
    ],
  };
  const plan = planAssets(registry, source, [request(STRUCT_ARRAY_ASSET_CODEC_ID, 4, options)]);
  const asset = plan.assets[0];
  const decoded = decodePlannedAsset(registry, source, asset);
  const value = decoded.value as {
    readonly raw: readonly number[];
    readonly records: readonly Record<string, number>[];
  };

  t.deepEqual(value.records, [{ kind: 5, enabled: 1, value: 0x1234 }]);
  t.deepEqual(
    [
      ...encodePlannedAsset(registry, source, asset, {
        value: {
          kind: "struct-array",
          raw: value.raw,
          records: [{ kind: 2, enabled: 1, value: 0x5678 }],
        },
      }),
    ],
    [0xaa, 0x78, 0x56, 0xee],
  );
  t.is(verifyAssetPlan(registry, source, plan).assets.length, 1);
});

test("pointer tables qualify references and reverse base/scale encoding", (t) => {
  const registry = createBuiltinAssetCodecRegistry();
  const source = new Bytes([0x10, 0, 0xff, 0xff]);
  const options = {
    width: 2,
    count: 2,
    base: 0x8000,
    scale: 2,
    nullValue: 0xffff,
    addressSpace: "snes.cpu",
    targetAssetIds: ["asset.target", null],
  };
  const plan = planAssets(registry, source, [request(POINTER_TABLE_ASSET_CODEC_ID, 4, options)]);
  const asset = plan.assets[0];
  const decoded = decodePlannedAsset(registry, source, asset);

  t.like(asset.inspection.references?.[0], {
    addressSpace: "snes.cpu",
    address: 0x8020,
    targetAssetId: "asset.target",
  });
  t.deepEqual(
    [
      ...encodePlannedAsset(registry, source, asset, {
        value: { kind: "pointer-table", addresses: [0x8022, null] },
      }),
    ],
    [0x11, 0, 0xff, 0xff],
  );
  t.deepEqual((decoded.value as { readonly addresses: readonly AssetValue[] }).addresses, [
    0x8020,
    null,
  ]);
  t.is(verifyAssetPlan(registry, source, plan).assets.length, 1);
});

test("index tables retain unresolved indexes and stable target references", (t) => {
  const registry = createBuiltinAssetCodecRegistry();
  const source = new Bytes([1, 0xff, 3]);
  const options = {
    count: 3,
    nullValue: 0xff,
    targets: [{ index: 1, id: "asset.one", addressSpace: "rom.file", address: 0x200 }],
  };
  const plan = planAssets(registry, source, [request(INDEX_TABLE_ASSET_CODEC_ID, 3, options)]);
  const asset = plan.assets[0];

  t.deepEqual(asset.inspection.metadata?.unresolvedIndexes, [3]);
  t.like(asset.inspection.references?.[0], { targetAssetId: "asset.one", address: 0x200 });
  t.deepEqual(
    [
      ...encodePlannedAsset(registry, source, asset, {
        value: { kind: "index-table", indexes: [3, null, 1] },
      }),
    ],
    [3, 0xff, 1],
  );
  t.is(verifyAssetPlan(registry, source, plan).assets.length, 1);
});

test("text tables discover terminators and reverse tokens and unknown-byte escapes", (t) => {
  const registry = createBuiltinAssetCodecRegistry();
  const source = new Bytes([0x48, 0x49, 0x80, 0, 0xff]);
  const options = { terminator: 0, maxLength: 5, table: { $80: "♥" } };
  const plan = planAssets(registry, source, [request(TEXT_ASSET_CODEC_ID, undefined, options)]);
  const asset = plan.assets[0];
  const decoded = decodePlannedAsset(registry, source, asset);

  t.is(asset.inspection.size, 4);
  t.like(decoded.value, { text: "HI♥", terminated: true });
  t.is(new TextDecoder().decode(decoded.files?.[0].bytes), "HI♥");
  t.deepEqual(
    [
      ...encodePlannedAsset(registry, source, asset, {
        value: { kind: "text", text: "BY♥", terminated: true },
      }),
    ],
    [0x42, 0x59, 0x80, 0],
  );
  t.is(verifyAssetPlan(registry, source, plan).assets.length, 1);

  const escapedSource = new Bytes([0x81, 0]);
  const escapedPlan = planAssets(registry, escapedSource, [
    request(TEXT_ASSET_CODEC_ID, undefined, { ascii: false, terminator: 0, maxLength: 2 }),
  ]);
  t.like(decodePlannedAsset(registry, escapedSource, escapedPlan.assets[0]).value, {
    text: "\\x81",
  });
  t.is(verifyAssetPlan(registry, escapedSource, escapedPlan).assets.length, 1);
});

test("built-in codecs reject ambiguous layouts and unbounded text", (t) => {
  const registry = createBuiltinAssetCodecRegistry();
  t.throws(
    () =>
      planAssets(registry, new Bytes([0]), [
        request(TEXT_ASSET_CODEC_ID, undefined, { terminator: 0xff, maxLength: 1 }),
      ]),
    { message: /no terminator/ },
  );
  t.throws(
    () =>
      planAssets(registry, new Bytes([0]), [
        request(STRUCT_ARRAY_ASSET_CODEC_ID, 1, {
          fields: [
            { name: "left", bitOffset: 0, bits: 4 },
            { name: "right", bitOffset: 3, bits: 4 },
          ],
        }),
      ]),
    { message: /overlap/ },
  );
  t.throws(
    () =>
      planAssets(registry, new Bytes([0]), [
        request(TEXT_ASSET_CODEC_ID, 1, { table: { $80: "AA" } }),
      ]),
    { message: /not prefix-free/ },
  );
});
