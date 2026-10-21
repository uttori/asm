import { test } from "../../../tests/ava-helper.js";
import {
  withImageEncoders,
  encodeBgScreenMap,
  decodeBgScreenMap,
  encodeMode7MapLayout,
} from "../src/image-conversion.js";
import type { AssetDocument, AssetInput } from "../src/registry.js";
import { snesNativeEncoders } from "../src/snes.js";

const encoders = withImageEncoders(snesNativeEncoders);
const indexed = (width = 8, height = 8) => ({
  kind: "indexed-image",
  width,
  height,
  indexes: new Uint8Array(width * height),
  palette: [
    [0, 0, 0, 0],
    [255, 255, 255, 255],
  ],
  sourceBitDepth: 1,
});
const rgba = () => ({ kind: "rgba-image", width: 8, height: 8, rgba: new Uint8Array(256) });
function encode(
  value: unknown = indexed(),
  options: Record<string, unknown> = {},
  resources: Record<string, AssetInput> = {},
  kind = "indexed-image",
  format = "snes.tile.2bpp",
) {
  const encoder = encoders.find((item) => item.id === format);
  if (!encoder) {
    throw new Error("Missing test encoder.");
  }
  return encoder.encode({ kind, value }, options, resources);
}
const palette = (value: unknown): AssetInput => ({
  mediaType: "application/json",
  bytes: Buffer.from(JSON.stringify(value)),
});
const external = {
  version: 1,
  colors: [
    [0, 0, 0],
    [255, 255, 255],
  ],
  transparentIndex: 0,
};

test("image model validation rejects dimensions, buffers and palette tuples before allocation", (t) => {
  for (const value of [
    null,
    [],
    {},
    { ...indexed(), kind: "rgba-image" },
    ...[0, -1, 1.5, Infinity, 4194305, "8"].map((width) => Object.assign(indexed(), { width })),
    { ...indexed(), height: 4194304 },
    { ...indexed(), indexes: [] },
    { ...indexed(), indexes: new Uint8Array(1) },
    { ...indexed(), palette: [] },
    { ...indexed(), palette: Array.from({ length: 257 }, () => [0, 0, 0, 0]) },
    { ...indexed(), sourceBitDepth: 3 },
    ...[null, [0, 0, 0], [0, 0, 0, -1], [0, 0, 0, 256], [0, 0, 0, 1.5], [0, 0, 0, "0"]].map(
      (color) => Object.assign(indexed(), { palette: [color] }),
    ),
  ]) {
    t.throws(() => encode(value), { message: /requires imported PNG|model|palette entry/ });
  }
  for (const bytes of [[], new Uint8Array(1)]) {
    t.throws(() => encode({ ...rgba(), rgba: bytes }, { palette: "auto" }, {}, "rgba-image"), {
      message: /pixel bytes/,
    });
  }
  t.throws(() => encode(indexed(7, 8)), { message: /divisible by 8/ });
});

test("conversion options reject ambiguous layout and tilemap contracts", (t) => {
  for (const [options, message] of [
    [{ extra: true }, /Unknown image/],
    [{ paletteExpansion: "round" }, /paletteExpansion/],
    [{ tilemap: null }, /tilemap/],
    [{ tilemap: { extra: true } }, /tilemap/],
    [{ tilemap: { layout: "other" } }, /tilemap.layout/],
    [{ tilemap: { startTileIndex: "0" } }, /must be a number/],
    [{ tilemap: { horizontalFlip: 1 } }, /boolean/],
    [{ tilemap: { verticalFlip: 1 } }, /boolean/],
    [{ layout: [] }, /object/],
    [{ layout: { tileOrder: "other" } }, /tileOrder/],
    [{ layout: { tileOrder: "row-major", blockSize: [2, 2] } }, /Block options/],
    ...[undefined, [2], [1, 2], [2, 1]].map(
      (blockSize) => [{ layout: { tileOrder: "blocks", blockSize } }, /blockSize/] as const,
    ),
    ...[
      { blockOrder: "other" },
      { blockRows: "other" },
      { withinBlock: 42 },
      { withinBlock: ["tl"] },
      { withinBlock: ["tl", "tl", "bl", "br"] },
      { withinBlock: ["tl", "tr", "bl", "other"] },
      { extra: true },
    ].map(
      (change) =>
        [
          { layout: { tileOrder: "blocks", blockSize: [2, 2], ...change } },
          /traversal|permutation|quadrant|Unknown block/,
        ] as const,
    ),
  ] as const) {
    t.throws(() => encode(indexed(), options), { message });
  }
  t.throws(() => encode(indexed(), { layout: { tileOrder: "blocks", blockSize: [2, 2] } }), {
    message: /complete tile blocks/,
  });
  t.throws(() => encode(indexed(), { tilemap: { layout: "screen-blocks" } }), {
    message: /screen-block/,
  });
});

test("palette resources reject malformed identities, media, colors and lossy mappings", (t) => {
  for (const resource of [
    { mediaType: "text/plain", bytes: Buffer.from("{}") },
    { mediaType: "application/json", bytes: Buffer.alloc(65537) },
    ...[
      null,
      {},
      { ...external, version: 2 },
      { ...external, colors: [] },
      { ...external, colors: Array.from({ length: 257 }, () => [0, 0, 0]) },
      { ...external, transparentIndex: "0" },
      { ...external, colors: [[0, 0]] },
      { ...external, colors: [[0, 0, "0"]] },
    ].map(palette),
  ]) {
    t.throws(() => encode(indexed(), { palette: "colors" }, { colors: resource }), {
      message: /palette|Palette|transparentIndex/,
    });
  }
  t.throws(() => encode(indexed(), { palette: "missing" }), { message: /Missing palette/ });
  t.throws(() => encode(indexed(), { palette: "auto" }), { message: /preserve palette identity/ });
  t.throws(
    () =>
      encode(
        indexed(),
        { palette: "colors" },
        { colors: palette({ ...external, colors: [[0, 0, 0]] }) },
      ),
    { message: /loses source entry/ },
  );
  for (const [value, message] of [
    [{ ...indexed(), palette: [[0, 0, 0, 128]] }, /partial alpha/],
    [{ ...indexed(), palette: [[0, 0, 0, 255]] }, /Opaque index-zero/],
    [
      {
        ...indexed(),
        indexes: new Uint8Array(64).fill(1),
        palette: [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      },
      /rendered opaque/,
    ],
    [{ ...indexed(), indexes: new Uint8Array(64).fill(4) }, /Pixel index exceeds/],
    [{ ...indexed(), palette: Array.from({ length: 5 }, () => [0, 0, 0, 0]) }, /one bank holds/],
  ] as const) {
    t.throws(() => encode(value), { message });
  }
  for (const options of [{}, { palette: "embedded" }, { palette: "missing" }]) {
    t.throws(() => encode(rgba(), options, {}, "rgba-image"), {
      message: /Truecolor|Missing palette/,
    });
  }
  const partial = rgba();
  partial.rgba[3] = 128;
  t.throws(() => encode(partial, { palette: "auto" }, {}, "rgba-image"), {
    message: /partial alpha/,
  });
  const hidden = rgba();
  hidden.rgba[4] = 8;
  t.throws(() => encode(hidden, { palette: "auto" }, {}, "rgba-image"), { message: /hidden RGB/ });
  const absent = rgba();
  absent.rgba.set([255, 0, 0, 255]);
  t.throws(
    () => encode(absent, { palette: "colors" }, { colors: palette(external) }, "rgba-image"),
    { message: /absent from the exact/ },
  );
});

test("external palette permutation and block traversal reconstruct the same logical pixels", (t) => {
  const value = indexed(32, 32);
  value.indexes.fill(1, 32);
  const colors = palette({
    version: 1,
    colors: [
      [255, 255, 255],
      [0, 0, 0],
      [255, 255, 255],
    ],
    transparentIndex: 1,
  });
  const canonical = encode(value).outputs.preview.bytes;
  for (const layout of [
    { tileOrder: "column-major" },
    {
      tileOrder: "blocks",
      blockSize: [2, 2],
      blockOrder: "column-major",
      blockRows: "bottom-to-top",
      withinBlock: ["br", "bl", "tr", "tl"],
    },
    { tileOrder: "blocks", blockSize: [2, 2], withinBlock: "tl-tr-bl-br" },
  ]) {
    const result = encode(
      value,
      { palette: "colors", layout, tilemap: { horizontalFlip: true, verticalFlip: true } },
      { colors },
    );
    t.deepEqual(result.outputs.preview.bytes, canonical);
  }
  const truecolor = { kind: "rgba-image", width: 32, height: 32, rgba: canonical };
  t.deepEqual(
    encode(truecolor, { palette: "colors" }, { colors }, "rgba-image").outputs.preview.bytes,
    canonical,
  );
});

test("native map layout validates cell counts, dimensions and format fallbacks", (t) => {
  t.throws(() => encodeBgScreenMap([], 32, 32), { message: /cell count/ });
  t.throws(() => decodeBgScreenMap(new Uint8Array(2), 32, 32), { message: /byte count/ });
  for (const [width, height, layout] of [
    [0, 1, "partial"],
    [1, 0, "partial"],
    [129, 1, "partial"],
    [1, 129, "partial"],
    [1.5, 1, "partial"],
    [1, 1.5, "partial"],
    [1, 1, "full"],
    [1, 1, "unknown"],
  ] as const) {
    t.throws(() => encodeMode7MapLayout([0], width, height, layout), { message: /128×128/ });
  }
  const fallback = {
    ...snesNativeEncoders.find((item) => item.id === "snes.tile.2bpp")!,
    id: "snes.tile.5bpp",
  };
  const encoder = withImageEncoders([fallback])[0];
  const doc: AssetDocument = { kind: "indexed-image", value: indexed() };
  t.throws(() => encoder.encode(doc, {}, {}), { message: /Unsupported planar/ });
});
