import fs from "node:fs";
import path from "node:path";

import { waveImporter, writePcmWave, type PcmAudio } from "@uttori/asm-assets/audio";
import { rgbaNativePng } from "@uttori/asm-assets/preview";

import { test } from "../../../tests/ava-helper.js";
import { convertAssetPreview } from "../src/asset-preview-conversion.js";
import { supportsPortableAssetPreview } from "../src/asset-preview-service.js";

function isPcmAudio(value: unknown): value is PcmAudio {
  return (
    typeof value === "object" &&
    value !== null &&
    "samples" in value &&
    value.samples instanceof Int16Array &&
    "sampleRate" in value &&
    typeof value.sampleRate === "number" &&
    "sourceBitDepth" in value &&
    (value.sourceBitDepth === 8 || value.sourceBitDepth === 16)
  );
}

const fixture = (name: string): Uint8Array =>
  fs.readFileSync(path.resolve("packages/assets/tests/fixtures", name));

test("editor image preview renders composed and native storage PNGs from direct conversion", (t) => {
  const converted = convertAssetPreview({
    source: { bytes: fixture("colored-4bpp.png"), mediaType: "image/png" },
    resources: {},
    format: "snes.tile.4bpp",
    options: { layout: { tileOrder: "column-major" } },
  });
  t.is(converted.kind, "image");
  t.true(converted.encodedBytes > 0);
  for (const media of [
    converted.thumbnailPngBase64,
    converted.composedPngBase64,
    converted.storagePngBase64,
  ]) {
    t.deepEqual(
      Buffer.from(media ?? "", "base64").subarray(0, 8),
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  }
});

test("full previews retain original dimensions beyond thumbnail and 1024-pixel limits", (t) => {
  const width = 2048;
  const height = 8;
  const pixels = new Uint8Array(width * height * 4);
  for (let offset = 3; offset < pixels.length; offset += 4) pixels[offset] = 255;
  const preview = convertAssetPreview({
    source: { bytes: rgbaNativePng(pixels, width, height), mediaType: "image/png" },
    resources: {},
    format: "snes.tile.4bpp",
    options: { palette: "auto" },
  });
  for (const media of [preview.composedPngBase64, preview.storagePngBase64]) {
    const png = Buffer.from(media ?? "", "base64");
    t.is(png.readUInt32BE(16), width);
    t.is(png.readUInt32BE(20), height);
  }
  t.true(Buffer.from(preview.thumbnailPngBase64 ?? "", "base64").readUInt32BE(16) <= 192);
});

test("editor audio preview keeps source PCM distinct from decoded BRR", (t) => {
  const source = fixture("pcm8-silence.wav");
  const converted = convertAssetPreview({
    source: { bytes: source, mediaType: "audio/wav" },
    resources: {},
    format: "snes.brr",
    options: { padding: "reject", loop: false },
  });
  t.is(converted.kind, "audio");
  t.deepEqual(Buffer.from(converted.sourceWavBase64 ?? "", "base64"), Buffer.from(source));
  t.is(Buffer.from(converted.decodedWavBase64 ?? "", "base64").toString("ascii", 0, 4), "RIFF");
  t.true(converted.encodedBytes > 0);
  t.truthy(converted.waveformPngBase64);
});

test("SoM native BRR preview exposes its playable WAVE and exact ROM byte count", (t) => {
  const source = fs.readFileSync(
    path.resolve("secret-of-mana/disassembly/assets/audio/brr/034784-waveform-01.wav"),
  );
  t.true(supportsPortableAssetPreview("som.brr.pcm"));
  const preview = convertAssetPreview({
    source: { bytes: source, mediaType: "audio/wav" },
    resources: {},
    format: "som.brr.pcm",
    options: {},
  });
  t.is(preview.kind, "audio");
  t.is(preview.output, "brr");
  t.is(preview.encodedBytes, 0x06e4);
  t.deepEqual(Buffer.from(preview.sourceWavBase64 ?? "", "base64"), source);
  t.is(Buffer.from(preview.decodedWavBase64 ?? "", "base64").toString("ascii", 0, 4), "RIFF");
  t.deepEqual(
    Buffer.from(preview.waveformPngBase64 ?? "", "base64").subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
});

test("edited SoM WAVE preview exposes the same decoded audio and fidelity as assembly", (t) => {
  const source = fs.readFileSync(
    path.resolve("secret-of-mana/disassembly/assets/audio/brr/034784-waveform-01.wav"),
  );
  const pcm = waveImporter.import({ bytes: source, mediaType: "audio/wav" }).value;
  if (!isPcmAudio(pcm)) {
    throw new Error("Expected PCM audio.");
  }
  const samples = pcm.samples.slice();
  samples[0] = 12000;
  const changed = writePcmWave(samples, pcm.sampleRate);
  const preview = convertAssetPreview({
    source: { bytes: changed, mediaType: "audio/wav" },
    resources: {},
    format: "som.brr.pcm",
    options: { loop: false },
  });
  t.is(preview.encodedBytes, 0x06e4);
  t.is(preview.metadata?.nativePreserved, false);
  t.is(preview.metadata?.fidelity, "lossy-audio");
  t.is(typeof preview.metadata?.rmsError, "number");
  t.deepEqual(Buffer.from(preview.sourceWavBase64 ?? "", "base64"), Buffer.from(changed));
  t.truthy(preview.decodedWavBase64);
});

test("SoM BRR bank segment reports its slice while previewing the complete stream", (t) => {
  const source = fs.readFileSync(
    path.resolve("secret-of-mana/disassembly/assets/audio/brr/03fbcc-title-instrument-s13.wav"),
  );
  t.true(supportsPortableAssetPreview("som.brr.segment"));
  const input = {
    source: { bytes: source, mediaType: "audio/wav" },
    resources: {},
    format: "som.brr.segment",
    options: { startByte: 1076, byteLength: 5638 },
  };
  const preview = convertAssetPreview(input);
  t.is(preview.kind, "audio");
  t.is(preview.encodedBytes, 5638);
  t.is(preview.metadata?.fullStreamBytes, 6714);
  t.is(preview.metadata?.previewScope, "full-stream");
  t.deepEqual(Buffer.from(preview.sourceWavBase64 ?? "", "base64"), source);
  t.throws(() => convertAssetPreview({ ...input, options: { startByte: 6710, byteLength: 9 } }), {
    message: /extends beyond/,
  });
});

test("SoM frame preview validates a shared ROM palette and renders the authored atlas", (t) => {
  const root = path.resolve("secret-of-mana/disassembly/assets");
  const layoutName = "../assets/images/enemy/rabite-frames.layout.json";
  const paletteName = "../assets/palettes/rom-palettes.json";
  const source = fs.readFileSync(path.join(root, "images/enemy/rabite-frames.png"));
  const input = {
    source: { bytes: source, mediaType: "image/png" },
    resources: {
      [layoutName]: {
        bytes: fs.readFileSync(path.join(root, "images/enemy/rabite-frames.layout.json")),
        mediaType: "application/json",
      },
      [paletteName]: {
        bytes: fs.readFileSync(path.join(root, "palettes/rom-palettes.json")),
        mediaType: "application/json",
      },
    },
    format: "som.sprite.frames",
    options: { layout: layoutName, palettes: paletteName, segment: "rabite-tiles-1" },
  };
  const preview = convertAssetPreview(input);
  t.is(preview.kind, "image");
  t.is(preview.metadata?.paletteId, "C81000");
  t.deepEqual(Buffer.from(preview.composedPngBase64 ?? "", "base64"), source);
  t.true(preview.encodedBytes > 0);
  const changed = JSON.parse(Buffer.from(input.resources[paletteName].bytes).toString("utf8"));
  changed.palettes.C81000.words[0] = "7FFF";
  t.throws(
    () =>
      convertAssetPreview({
        ...input,
        resources: {
          ...input.resources,
          [paletteName]: {
            bytes: Buffer.from(JSON.stringify(changed)),
            mediaType: "application/json",
          },
        },
      }),
    { message: /palette no longer matches its stable index binding/i },
  );
});

test("combined SoM frame previews retain the atlas and all palette users", (t) => {
  const root = path.resolve("secret-of-mana/disassembly/assets");
  const palettes = {
    bytes: fs.readFileSync(path.join(root, "palettes/rom-palettes.json")),
    mediaType: "application/json",
  };
  const preview = (name: string, segments?: string[]) => {
    const source = fs.readFileSync(path.join(root, `images/${name}-frames.png`));
    const result = convertAssetPreview({
      source: { bytes: source, mediaType: "image/png" },
      resources: {
        "layout.json": {
          bytes: fs.readFileSync(path.join(root, `images/${name}-frames.layout.json`)),
          mediaType: "application/json",
        },
        "palettes.json": palettes,
      },
      format: "som.sprite.frames",
      options: { layout: "layout.json", palettes: "palettes.json", segments },
    });
    t.deepEqual(Buffer.from(result.composedPngBase64 ?? "", "base64"), source);
    return result;
  };
  const woman = preview("npc/potos-old-woman");
  t.is(woman.encodedBytes, 1760);
  t.is(woman.metadata?.paletteId, "C827AC");
  t.is((woman.metadata?.segments as string[]).length, 7);
  const cannon = preview("objects/cannon", [
    "cannon-bottom-right-tiles",
    "cannon-top-corner-tiles",
    "cannon-middle-left-tiles",
    "cannon-middle-right-tiles",
    "cannon-bottom-left-tiles",
  ]);
  t.is(cannon.encodedBytes, 1728);
  t.deepEqual(
    (cannon.metadata?.palettes as { paletteId: string }[]).map((palette) => palette.paletteId),
    ["C8296E", "C8298C", "C829E6", "C829C8", "C82A04"],
  );
  t.throws(() => preview("objects/cannon"), { message: /gaps or overlaps/ });
});

test("SoM boss frame preview reports its fixed compressed ROM span", (t) => {
  const root = path.resolve("secret-of-mana/disassembly/assets");
  const layoutName = "../assets/images/enemy/mantis-ant-frames.layout.json";
  const paletteName = "../assets/palettes/rom-palettes.json";
  const source = fs.readFileSync(path.join(root, "images/enemy/mantis-ant-frames.png"));
  const preview = convertAssetPreview({
    source: { bytes: source, mediaType: "image/png" },
    resources: {
      [layoutName]: {
        bytes: fs.readFileSync(path.join(root, "images/enemy/mantis-ant-frames.layout.json")),
        mediaType: "application/json",
      },
      [paletteName]: {
        bytes: fs.readFileSync(path.join(root, "palettes/rom-palettes.json")),
        mediaType: "application/json",
      },
    },
    format: "som.boss.graphics",
    options: {
      layout: layoutName,
      palettes: paletteName,
      segment: "mantis-ant-tiles",
      byteLength: 3299,
      storage: "lz-rle",
    },
  });
  t.is(preview.kind, "image");
  t.is(preview.output, "graphics");
  t.is(preview.encodedBytes, 3299);
});

test("SoM palette preview shows sixteen 8×8 squares from the ROM source object", (t) => {
  const source = fs.readFileSync(
    path.resolve("secret-of-mana/disassembly/assets/palettes/rom-palettes.json"),
  );
  const preview = convertAssetPreview({
    source: { bytes: source, mediaType: "application/json" },
    resources: {},
    format: "som.palette.bgr555",
    options: { palette: "C81000" },
  });
  const png = Buffer.from(preview.composedPngBase64 ?? "", "base64");
  t.is(preview.kind, "image");
  t.is(preview.encodedBytes, 30);
  t.is(preview.metadata?.paletteId, "C81000");
  t.is(png.readUInt32BE(16), 37);
  t.is(png.readUInt32BE(20), 37);
});

test("SoM background palette preview preserves its 15-column, 105-word grid", (t) => {
  const source = fs.readFileSync(
    path.resolve("secret-of-mana/disassembly/assets/palettes/rom-palettes.json"),
  );
  const preview = convertAssetPreview({
    source: { bytes: source, mediaType: "application/json" },
    resources: {},
    format: "som.palette.bgr555",
    options: { palette: "CC93B0" },
  });
  const png = Buffer.from(preview.composedPngBase64 ?? "", "base64");
  t.is(preview.encodedBytes, 210);
  t.is(preview.metadata?.previewWidth, 136);
  t.is(png.readUInt32BE(16), 136);
  t.is(png.readUInt32BE(20), 64);
});

test("SoM room preview validates section output and responds to edited room placement", (t) => {
  const base = path.resolve("secret-of-mana/disassembly/assets/rooms");
  const bytes = fs.readFileSync(path.join(base, "room-001e.json"));
  const previewPath = "room-001e.preview.json";
  const resources = {
    [previewPath]: {
      bytes: fs.readFileSync(path.join(base, previewPath)),
      mediaType: "application/json",
    },
  };
  const input = {
    source: { bytes, mediaType: "application/json" },
    resources,
    format: "som.room",
    options: { section: "assembly", preview: previewPath },
  };
  t.true(supportsPortableAssetPreview("som.room"));
  const original = convertAssetPreview(input);
  t.is(original.kind, "image");
  t.is(original.output, "assembly");
  t.is(original.encodedBytes, 27);
  const edited = JSON.parse(bytes.toString());
  edited.previewStory[95] = 3;
  const next = convertAssetPreview({
    ...input,
    source: { ...input.source, bytes: Buffer.from(JSON.stringify(edited)) },
  });
  t.not(original.composedPngBase64, next.composedPngBase64);
  t.throws(() => convertAssetPreview({ ...input, output: "missing" }), {
    message: /Unknown room output/,
  });
});
