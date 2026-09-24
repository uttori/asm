import { test } from "../../../tests/ava-helper.js";
import { TransformRegistry, reverseTransforms, transformBytes } from "../src/compression.js";
import {
  jsonImporter,
  rawEncoder,
  rawImporter,
  decodeScalarArray,
  decodeStructRecords,
  encodeStructRecords,
  decodePointerTable,
  encodePointerTable,
  decodeIndexTable,
  encodeIndexTable,
  decodeSingleByteText,
  encodeSingleByteText,
  encodeScalarArray,
} from "../src/data.js";
import { AssetRegistry, convertAsset } from "../src/index.js";
import {
  decodeBgMap,
  decodeBgr555,
  decodeBrrBlocks,
  decodeMode7Map,
  decodeMode7Tiles,
  decodePlanarTiles,
  encodeBgMap,
  encodeBgr555,
  encodeBrrBlocks,
  encodeMode7Map,
  encodeMode7Tiles,
  encodePlanarTiles,
  snesNativeEncoders,
} from "../src/snes.js";

test("native tile layouts retain independent golden bytes for 2/3/4/8bpp and Mode 7", (t) => {
  for (const depth of [2, 3, 4, 8] as const) {
    const tile = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
    tile[0][0] = 2 ** depth - 1;
    const bytes = encodePlanarTiles([tile], depth);
    const offsets =
      depth === 3
        ? [0, 1, 16]
        : Array.from({ length: depth }, (_, plane) => Math.floor(plane / 2) * 16 + (plane % 2));
    t.deepEqual(
      [...bytes.entries()]
        .filter(([, value]) => value !== 0)
        .map(([offset, value]) => [offset, value]),
      offsets.map((offset) => [offset, 0x80]),
    );
    t.deepEqual(decodePlanarTiles(bytes, depth), [tile]);
  }
  const mode7 = Uint8Array.from({ length: 64 }, (_, index) => index);
  t.deepEqual(encodeMode7Tiles(decodeMode7Tiles(mode7)), mode7);
  t.is(decodeMode7Tiles(mode7)[0][1][0], 8);
});

test("native palette, maps and BRR preserve all packed fields", (t) => {
  const palette = Uint8Array.of(0xff, 0xff, 0x10, 0x42);
  t.deepEqual(encodeBgr555(decodeBgr555(palette)), palette);
  const bg = Uint8Array.of(0x55, 0xf5);
  t.deepEqual(encodeBgMap(decodeBgMap(bg)), bg);
  t.deepEqual(decodeBgMap(bg)[0], {
    tile: 0x155,
    palette: 5,
    priority: 1,
    horizontalFlip: 1,
    verticalFlip: 1,
  });
  const mode7 = Uint8Array.of(0, 255, 1, 42);
  t.deepEqual(encodeMode7Map(decodeMode7Map(mode7)), mode7);
  const brr = Uint8Array.of(0xff, 0x8f, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd);
  t.deepEqual(encodeBrrBlocks(decodeBrrBlocks(brr)), brr);
  t.deepEqual(decodeBrrBlocks(brr)[0].nibbles.slice(0, 4), [-8, -1, 0, 1]);
});

test("native and scalar creation rejects values that would be truncated", (t) => {
  const tile = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  tile[0][0] = 16;
  t.throws(() => encodePlanarTiles([tile], 4), { instanceOf: RangeError });
  t.throws(() => decodePlanarTiles(Uint8Array.of(0), 4), { instanceOf: RangeError });
  t.throws(() => encodeScalarArray([256], { width: 1, endian: "little" }), {
    instanceOf: RangeError,
  });
  const scalar = Uint8Array.of(0xff, 0x7f, 0x00, 0x80);
  t.deepEqual(
    decodeScalarArray(scalar, { width: 2, endian: "little", signed: true }),
    [32767, -32768],
  );
  t.deepEqual(
    encodeScalarArray([32767, -32768], { width: 2, endian: "little", signed: true }),
    scalar,
  );
});

test("structured records preserve unknown bits and require explicit new padding", (t) => {
  const layout = {
    stride: 3,
    fields: [
      { name: "code", kind: "scalar" as const, offset: 0, width: 1 as const },
      { name: "enabled", kind: "bitfield" as const, bitOffset: 8, bits: 1 },
    ],
  };
  const original = Uint8Array.of(0x42, 0xff, 0xa5);
  const decoded = decodeStructRecords(original, layout);
  t.deepEqual(decoded.records, [{ code: 0x42, enabled: 1 }]);
  t.deepEqual(
    encodeStructRecords([{ code: 0x43, enabled: 0 }], layout, decoded.raw),
    Uint8Array.of(0x43, 0xfe, 0xa5),
  );
  t.throws(() => encodeStructRecords(decoded.records, layout), { message: /padding/ });
  t.deepEqual(
    encodeStructRecords(decoded.records, layout, undefined, "zero"),
    Uint8Array.of(0x42, 1, 0),
  );
  t.throws(() => encodeStructRecords([{ code: 256, enabled: 1 }], layout, original), {
    instanceOf: RangeError,
  });
});

test("pointer and index tables reject unrepresentable values and keep null sentinels", (t) => {
  const pointerOptions = {
    width: 2 as const,
    endian: "little" as const,
    base: 0x8000,
    scale: 2,
    nullValue: 0xffff,
  };
  const pointers = Uint8Array.of(0, 0, 1, 0, 0xff, 0xff);
  t.deepEqual(decodePointerTable(pointers, pointerOptions), [0x8000, 0x8002, null]);
  t.deepEqual(encodePointerTable([0x8000, 0x8002, null], pointerOptions), pointers);
  t.throws(() => encodePointerTable([0x8001], pointerOptions), { instanceOf: RangeError });
  const indexOptions = {
    width: 1 as const,
    endian: "little" as const,
    baseIndex: 10,
    nullValue: 255,
  };
  t.deepEqual(decodeIndexTable(Uint8Array.of(0, 2, 255), indexOptions), [10, 12, null]);
  t.deepEqual(encodeIndexTable([10, 12, null], indexOptions), Uint8Array.of(0, 2, 255));
  t.throws(() => encodeIndexTable([9], indexOptions), { instanceOf: RangeError });
});

test("single-byte text preserves unknown bytes and explicit terminators", (t) => {
  const options = { terminator: 0, table: { $80: "♥" } };
  const original = Uint8Array.of(65, 0x80, 0x5c, 0);
  const value = decodeSingleByteText(original, options);
  t.deepEqual(value, { text: "A♥\\x5C", terminated: true });
  t.deepEqual(encodeSingleByteText(value, options), original);
  t.throws(() => encodeSingleByteText({ text: "A", terminated: true }), { message: /terminator/ });
  t.throws(() => encodeSingleByteText({ text: "A", terminated: false }, { table: { $80: "A" } }), {
    message: /prefix-free/,
  });
});

test("standalone conversion accepts supplied JSON and raw bytes with owned output", (t) => {
  const registry = new AssetRegistry()
    .registerImporter(jsonImporter)
    .registerImporter(rawImporter)
    .registerEncoder(rawEncoder);
  for (const encoder of snesNativeEncoders) {
    registry.registerEncoder(encoder);
  }
  const source = new TextEncoder().encode(
    JSON.stringify({
      kind: "snes-palette-bgr555",
      colors: [{ red: 1, green: 2, blue: 3, unusedHighBit: 1 }],
    }),
  );
  const result = convertAsset(registry, {
    source: { bytes: source, mediaType: "application/json" },
    format: "snes.palette.bgr555",
  });
  t.deepEqual([...result.outputs.palette.bytes], [0x41, 0x8c]);
  t.deepEqual(result.fidelity, { kind: "exact", verification: "native model round trip" });
  const bytes = Uint8Array.of(1, 2, 3);
  const raw = convertAsset(registry, {
    source: { bytes, mediaType: "application/octet-stream" },
    format: "uttori.data.raw",
  });
  bytes[0] = 99;
  t.deepEqual([...raw.outputs.data.bytes], [1, 2, 3]);
  t.throws(() => registry.registerEncoder(rawEncoder), { message: /duplicate/ });
  registry.registerEncoder({
    id: "test.false-lossy",
    version: "1",
    inputKinds: ["raw"],
    primaryOutput: "data",
    encode: () => ({
      outputs: { data: { bytes: Uint8Array.of(0), mediaType: "application/octet-stream" } },
      fidelity: {
        kind: "lossy-audio",
        sampleRate: 32000,
        sourceSamples: 1,
        paddedSamples: 1,
        paddingSamples: 0,
        decodedSamples: 1,
        peakError: 0,
        rmsError: 0,
      },
      normalizedOptions: {},
    }),
  });
  t.throws(
    () =>
      convertAsset(registry, {
        source: { bytes, mediaType: "application/octet-stream" },
        format: "test.false-lossy",
      }),
    { message: /cannot declare lossy fidelity/ },
  );
});

test("byte transforms verify exact recovery and reverse chains", (t) => {
  const registry = new TransformRegistry().register({
    id: "test.xor",
    version: "1.0.0",
    encode: (bytes) => Uint8Array.from(bytes, (byte) => byte ^ 0x5a),
    decode: (bytes, _options, limit) => {
      if (bytes.length > limit) {
        throw new Error("limit exceeded");
      }
      return Uint8Array.from(bytes, (byte) => byte ^ 0x5a);
    },
  });
  const source = Uint8Array.of(1, 2, 3);
  const steps = [{ id: "test.xor" }, { id: "test.xor" }];
  t.deepEqual(
    reverseTransforms(registry, transformBytes(registry, source, steps), steps, 3),
    source,
  );
  t.throws(() => reverseTransforms(registry, source, steps, -1), {
    message: /Invalid output byte limit/,
  });
  t.throws(() => reverseTransforms(registry, source, steps, 2), {
    message: /exceed output byte limit/,
  });
  registry.register({
    id: "test.lossy",
    version: "1",
    encode: (bytes) => bytes.slice(1),
    decode: (bytes) => bytes,
  });
  t.throws(() => transformBytes(registry, source, [{ id: "test.lossy" }]), {
    message: /not lossless/,
  });
});
