import { readFileSync } from "node:fs";

import { test } from "../../../tests/ava-helper.js";
import { decodeBrrPcm, waveImporter, withAudioEncoder } from "../src/audio.js";
import {
  decodeBgScreenMap,
  encodeBgScreenMap,
  encodeMode7MapLayout,
  pngImporter,
  withImageEncoders,
} from "../src/image.js";
import { AssetRegistry, convertAsset } from "../src/index.js";
import { rgbaPreviewPng } from "../src/preview.js";
import { snesNativeEncoders } from "../src/snes.js";

test("complete native room previews downscale four megapixels and reject larger inputs", (t) => {
  const rgba = new Uint8Array(2048 * 2048 * 4);
  rgba.set([240, 30, 10, 255]);
  const png = rgbaPreviewPng(rgba, 2048, 2048, 1024);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  t.is(view.getUint32(16), 1024);
  t.is(view.getUint32(20), 1024);
  t.throws(() => rgbaPreviewPng(rgba, 2048, 2049), { message: /four-megapixel/ });
  t.throws(() => rgbaPreviewPng(rgba.subarray(4), 2048, 2048), { message: /missing/ });
});

const fixture = (name: string): Uint8Array =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

const registry = new AssetRegistry().registerImporter(pngImporter).registerImporter(waveImporter);
for (const encoder of withAudioEncoder(withImageEncoders(snesNativeEncoders))) {
  registry.registerEncoder(encoder);
}

const image = (
  name: string,
  format = "snes.tile.4bpp",
  options: Readonly<Record<string, unknown>> = {},
  resources: Readonly<Record<string, { bytes: Uint8Array; mediaType: string }>> = {},
) =>
  convertAsset(registry, {
    source: { bytes: fixture(name), mediaType: "image/png" },
    format,
    options,
    resources,
  });

const wave = (name: string, options: Readonly<Record<string, unknown>> = {}) =>
  convertAsset(registry, {
    source: { bytes: fixture(name), mediaType: "audio/wav" },
    format: "snes.brr",
    options,
  });

test("colored multi-tile PNG emits independent planar, palette, map, and preview bytes", (t) => {
  const result = image("colored-4bpp.png");
  t.deepEqual(
    result.outputs.tiles.bytes.slice(0, 32),
    Uint8Array.of(
      0x55,
      0x33,
      0xaa,
      0x99,
      0x55,
      0xcc,
      0xaa,
      0x66,
      0x55,
      0x33,
      0xaa,
      0x99,
      0x55,
      0xcc,
      0xaa,
      0x66,
      0x0f,
      0x00,
      0x78,
      0x07,
      0xc3,
      0x3f,
      0x1e,
      0xfe,
      0xf0,
      0xf0,
      0x87,
      0x80,
      0x3c,
      0x03,
      0xe1,
      0x1f,
    ),
  );
  t.deepEqual(
    result.outputs.palette.bytes.slice(0, 8),
    Uint8Array.of(0xc0, 0x03, 0x82, 0x07, 0x44, 0x0b, 0x06, 0x0f),
  );
  t.deepEqual([...result.outputs.tilemap.bytes], [0, 0, 1, 0, 2, 0, 3, 0]);
  t.deepEqual(result.outputs.tiles.metadata?.tileIndexByCoordinate, [0, 1, 2, 3]);
  t.is(result.outputs.preview.bytes.length, 16 * 16 * 4);
  t.is(result.fidelity.kind, "exact");
});

test("packed indexed depths and Adam7 retain source indexes and native bytes", (t) => {
  for (const [depth, format] of [
    [1, "snes.tile.2bpp"],
    [2, "snes.tile.2bpp"],
    [4, "snes.tile.4bpp"],
    [8, "snes.tile.8bpp"],
  ] as const) {
    const result = image(`indexed-${depth}bpp.png`, format);
    t.is(result.document.kind, "indexed-image");
    const bytesPerTile = format === "snes.tile.2bpp" ? 16 : depth * 8;
    t.is(result.outputs.tiles.bytes.length, 4 * bytesPerTile);
    t.is(result.outputs.preview.bytes[3], 0);
  }
  t.is(image("indexed-2bpp.png", "snes.tile.3bpp").outputs.tiles.bytes.length, 4 * 24);
  const plain = image("indexed-4bpp.png");
  const adam7 = image("indexed-4bpp-adam7.png");
  for (const name of ["tiles", "palette", "tilemap", "preview"]) {
    t.deepEqual(adam7.outputs[name].bytes, plain.outputs[name].bytes);
  }
});

test("tile traversal and map utilities preserve logical positions", (t) => {
  const column = image("indexed-4bpp.png", "snes.tile.4bpp", {
    layout: { tileOrder: "column-major" },
  });
  t.deepEqual(column.outputs.tiles.metadata?.tileIndexByCoordinate, [0, 2, 1, 3]);
  const blocks = image("indexed-4bpp.png", "snes.tile.4bpp", {
    layout: {
      tileOrder: "blocks",
      blockSize: [2, 2],
      blockOrder: "row-major",
      blockRows: "bottom-to-top",
      withinBlock: "tl-bl-br-tr",
    },
  });
  t.deepEqual(blocks.outputs.tiles.metadata?.tileIndexByCoordinate, [0, 3, 1, 2]);
  t.deepEqual(blocks.outputs.preview.bytes, image("indexed-4bpp.png").outputs.preview.bytes);
  const flipped = image("indexed-4bpp.png", "snes.tile.4bpp", {
    tilemap: {
      startTileIndex: 7,
      paletteBank: 2,
      priority: 1,
      horizontalFlip: true,
      verticalFlip: true,
    },
  });
  t.deepEqual(flipped.outputs.preview.bytes, image("indexed-4bpp.png").outputs.preview.bytes);
  t.deepEqual(flipped.outputs.tilemap.bytes.slice(0, 2), Uint8Array.of(7, 0xe8));
  t.throws(
    () =>
      image("indexed-4bpp.png", "snes.tile.4bpp", {
        layout: { tileOrder: "blocks", blockSize: [2, 2], withinBlock: ["tl", "tl", "br", "tr"] },
      }),
    { message: /quadrant/ },
  );

  const logical = Array.from({ length: 64 * 32 }, (_, index) => ({
    tile: index % 1024,
    palette: index % 8,
    priority: 0,
    horizontalFlip: 0,
    verticalFlip: 0,
  }));
  const encoded = encodeBgScreenMap(logical, 64, 32);
  t.deepEqual(decodeBgScreenMap(encoded, 64, 32), logical);
  t.is(encoded[32 * 32 * 2] | (encoded[32 * 32 * 2 + 1] << 8), 32 | ((32 % 8) << 10));
  t.throws(() => encodeBgScreenMap(logical.slice(0, 48 * 32), 48, 32), { message: /screen-block/ });
  t.is(
    encodeMode7MapLayout(
      Array.from({ length: 128 * 128 }, () => 7),
      128,
      128,
      "full",
    ).length,
    128 * 128,
  );
  t.throws(() => encodeMode7MapLayout([1, 2, 3, 4], 2, 2, "full"), { message: /128×128/ });
});

test("RGB, RGBA, grayscale, transparency, external palette, and both expansion tables are exact", (t) => {
  for (const name of [
    "rgb-exact.png",
    "rgba-transparent.png",
    "gray8-exact.png",
    "gray2-exact.png",
    "gray-alpha8-exact.png",
    "rgb-transparency.png",
  ]) {
    t.is(image(name, "snes.tile.4bpp", { palette: "auto" }).fidelity.kind, "exact");
  }
  const external = image(
    "rgb-transparency.png",
    "snes.tile.4bpp",
    { palette: "palette-exact.json" },
    {
      "palette-exact.json": { bytes: fixture("palette-exact.json"), mediaType: "application/json" },
    },
  );
  t.is(external.outputs.palette.bytes[2], 0x1f);
  t.is(
    image("scale-floor-exact.png", "snes.tile.4bpp", {
      palette: "auto",
      paletteExpansion: "scale-floor",
    }).fidelity.kind,
    "exact",
  );
  t.throws(() => image("scale-floor-exact.png", "snes.tile.4bpp", { palette: "auto" }), {
    message: /not representable/,
  });
  t.is(image("indexed-4bpp.png", "snes.tile.mode7").outputs.tiles.bytes.length, 4 * 64);
  const sourceColors = Array.from({ length: 16 }, (_, index) => {
    const channel = (index << 3) | (index >> 2);
    return [channel, channel, channel];
  });
  sourceColors[2] = [...sourceColors[1]];
  [sourceColors[1], sourceColors[3]] = [sourceColors[3], sourceColors[1]];
  const remapped = image(
    "indexed-4bpp.png",
    "snes.tile.4bpp",
    { palette: "reordered" },
    {
      reordered: {
        bytes: new TextEncoder().encode(
          JSON.stringify({ version: 1, colors: sourceColors, transparentIndex: 0 }),
        ),
        mediaType: "application/json",
      },
    },
  );
  const mapping = remapped.outputs.tiles.metadata?.sourceToNativePaletteIndex;
  t.true(Array.isArray(mapping));
  if (Array.isArray(mapping)) {
    t.deepEqual(mapping.slice(0, 4), [0, 2, 3, 1]);
  }
  t.deepEqual(remapped.outputs.preview.bytes, image("indexed-4bpp.png").outputs.preview.bytes);
});

test("PNG rejects bad CRC, truncated chunks, unrepresentable alpha/colors, and dimensions", (t) => {
  t.throws(() => image("malformed-crc.png"), { message: /CRC mismatch/ });
  t.throws(() => image("malformed-truncated.png"), { message: /Truncated/ });
  t.throws(() => image("malformed-huge-dimensions.png"), { message: /pixel limit/ });
  t.throws(() => image("rgb16-unsupported.png"), { message: /16-bit PNG samples are disabled/ });
  t.throws(() => image("bad-dimensions.png", "snes.tile.4bpp", { palette: "auto" }), {
    message: /divisible by 8/,
  });
  t.throws(() => image("indexed-opaque-zero.png"), { message: /Opaque index-zero/ });
  t.throws(() => image("indexed-partial-alpha.png"), { message: /partial alpha/ });
  t.throws(() => image("rgba-partial-alpha.png", "snes.tile.4bpp", { palette: "auto" }), {
    message: /partial alpha/,
  });
  t.throws(
    () =>
      image(
        "rgb-transparency.png",
        "snes.tile.4bpp",
        { palette: "palette-reject.json" },
        {
          "palette-reject.json": {
            bytes: fixture("palette-reject.json"),
            mediaType: "application/json",
          },
        },
      ),
    { message: /absent from the exact external palette/ },
  );
});

test("PCM8 and PCM16 WAVE encode deterministic BRR within quality thresholds", (t) => {
  t.deepEqual(
    [...decodeBrrPcm(fixture("brr-silence.bin"))],
    Array.from({ length: 16 }, () => 0),
  );
  t.deepEqual(
    [...decodeBrrPcm(fixture("brr-transient.bin"))],
    [28672, -32768, ...Array.from({ length: 14 }, () => 0)],
  );
  const silence = wave("pcm8-silence.wav");
  t.deepEqual([...silence.outputs.brr.bytes], [1, 0, 0, 0, 0, 0, 0, 0, 0]);
  t.is(silence.fidelity.kind, "lossy-audio");
  const transient = wave("pcm16-transient.wav");
  t.true(
    transient.fidelity.kind === "lossy-audio" &&
      transient.fidelity.peakError <= 8192 &&
      transient.fidelity.rmsError <= 4096,
  );
  t.deepEqual(transient.outputs.brr.bytes, wave("pcm16-transient.wav").outputs.brr.bytes);
  t.is(transient.outputs.reviewWav.bytes.length, 44 + 32 * 2);
  t.is(
    waveImporter.import({ bytes: transient.outputs.reviewWav.bytes, mediaType: "audio/wav" }).kind,
    "pcm-audio",
  );
});

test("smpl loops above 255 retain exclusive bounds and predictor history on replay", (t) => {
  const result = wave("pcm16-loop.wav");
  t.deepEqual(result.outputs.brr.metadata?.sourceLoop, { start: 256, end: 512 });
  t.is(result.outputs.brr.metadata?.loopOffset, 144);
  t.is(result.outputs.brr.bytes.at(-9)! & 3, 3);
  t.true(Number(result.outputs.brr.metadata?.loopPeakError) <= 8192);
  t.is(decodeBrrPcm(result.outputs.brr.bytes, 144, 1).length, 512 + 256);
  const disabled = wave("pcm16-loop.wav", { loop: false });
  t.is(disabled.outputs.brr.bytes.at(-9)! & 3, 1);
  t.deepEqual(disabled.outputs.brr.metadata?.sourceLoop, { start: 256, end: 512 });
  t.throws(() => wave("pcm16-loop.wav", { loop: { start: 255, end: 512 } }), {
    message: /16-sample boundary/,
  });
});

test("WAVE rejects unsupported variants and incomplete blocks unless padding is explicit", (t) => {
  t.throws(() => wave("pcm16-short.wav"), { message: /complete 16-sample blocks/ });
  const padded = wave("pcm16-short.wav", { padding: "zero" });
  t.is(padded.outputs.brr.metadata?.paddingSamples, 1);
  t.true(
    padded.fidelity.kind === "lossy-audio" &&
      padded.fidelity.paddingSamples === 1 &&
      padded.fidelity.sampleRate === 32000,
  );
  t.is(padded.outputs.brr.bytes.length, 9);
  const stereo = fixture("pcm16-transient.wav").slice();
  stereo[22] = 2;
  t.throws(() => waveImporter.import({ bytes: stereo, mediaType: "audio/wav" }), {
    message: /Unsupported WAVE format/,
  });
  const float = fixture("pcm16-transient.wav").slice();
  float[20] = 3;
  t.throws(() => waveImporter.import({ bytes: float, mediaType: "audio/wav" }), {
    message: /Unsupported WAVE format/,
  });
  const truncated = fixture("pcm16-transient.wav").slice(0, -1);
  t.throws(() => waveImporter.import({ bytes: truncated, mediaType: "audio/wav" }), {
    message: /RIFF\/WAVE/,
  });
});
