import fs from "node:fs";
import path from "node:path";

import { waveImporter, writePcmWave, type PcmAudio } from "@uttori/asm-assets/audio";
import { createIndexedPng, readAssetPng } from "@uttori/asm-assets/image";
import { rgbaNativePng } from "@uttori/asm-assets/preview";
import { normalizeSomSource } from "@uttori/asm-assets/secret-of-mana/som-source";
import { createSomSpriteInterchange } from "@uttori/asm-assets/secret-of-mana/som-sprite-interchange";
import { bindingResourceKey } from "@uttori/asm-assets/source-binding";
import { indexedSourceCodecs } from "@uttori/asm-assets/source-codecs";
import { nesChrPng } from "@uttori/asm-plugin-65xx";

import { test } from "../../../tests/ava-helper.js";
import { spriteFixture } from "../../../tests/fixtures/sprite-source.js";
import { assetCallContainingLine } from "../src/asset-language.js";
import { convertAssetPreview as convertRegisteredPreview } from "../src/asset-preview-conversion.js";
import { convertAssetPreview } from "../src/asset-preview-host.js";
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
const somFixture = (name: string): Buffer =>
  fs.readFileSync(new URL(`./fixtures/som-assets/${name}`, import.meta.url));
const json = (value: unknown) => ({
  bytes: new TextEncoder().encode(JSON.stringify(value)),
  mediaType: "application/json",
});

test("NES CHR preview validates native bitplanes and displays authored palette indexes in storage order", (t) => {
  const native = Uint8Array.from({ length: 32 }, (_, index) => index * 7);
  const image = readAssetPng(nesChrPng(native, 2)).toIndexed({ copy: false });
  const palette: [number, number, number, number][] = [
    [12, 34, 56, 255],
    [12, 34, 56, 255],
    [90, 100, 110, 255],
    [250, 240, 230, 255],
  ];
  const bytes = createIndexedPng({ ...image, palette });
  const input = {
    source: { bytes, mediaType: "image/png" },
    resources: {},
    format: "nes.chr.2bpp",
    options: {},
  };
  t.true(supportsPortableAssetPreview(input.format));
  const preview = convertAssetPreview(input);
  t.is(preview.kind, "image");
  t.is(preview.output, "chr");
  t.is(preview.encodedBytes, 32);
  t.is(preview.metadata?.tiles, 2);
  t.is(preview.composedPngBase64, preview.storagePngBase64);
  const rendered = readAssetPng(Buffer.from(preview.composedPngBase64!, "base64")).toRGBA();
  const expected = new Uint8Array(image.indexes.length * 4);
  for (let pixel = 0; pixel < image.indexes.length; pixel++) {
    expected.set(palette[image.indexes[pixel]], pixel * 4);
  }
  t.deepEqual(rendered.rgba, expected);
  t.throws(() => convertAssetPreview({ ...input, output: "tiles" }), { message: /no output/ });
  t.throws(() => convertAssetPreview({ ...input, options: { bitDepth: 4 } }), {
    message: /without options/,
  });
  const invalid = createIndexedPng({
    ...image,
    indexes: new Uint8Array(image.indexes.length).fill(4),
    palette: [...palette, [1, 2, 3, 255]],
  });
  t.throws(() => convertAssetPreview({ ...input, source: { ...input.source, bytes: invalid } }), {
    message: /indexes 0\.\.3/,
  });
});

test("explicit preview resolves multiline calls through assembly normalization", (t) => {
  const source =
    'org $808000\nincludeAsset(\n  "art.png", ; keep delimiters in quoted paths\n\n  "4bpp",\n  layout: { tileOrder: "row-major" }\n)\ndb $42';
  for (const line of [1, 2, 3, 4, 5, 6]) {
    t.is(assetCallContainingLine(source, line)?.path.value, "art.png");
  }
  t.is(assetCallContainingLine(source, 0), undefined);
  t.is(assetCallContainingLine(source, 7), undefined);
});

test("Aseprite raster preview encodes the same native bytes as its indexed PNG", async (t) => {
  const codecs = indexedSourceCodecs();
  const png = fixture("colored-4bpp.png");
  const bytes = await codecs.get("aseprite").encode(codecs.get("indexed-png").decode(png));
  const aseprite = convertAssetPreview({
    source: { bytes, mediaType: "image/x-aseprite" },
    resources: {},
    format: "snes.tile.4bpp",
    options: {},
  });
  const before = convertAssetPreview({
    source: { bytes: png, mediaType: "image/png" },
    resources: {},
    format: "snes.tile.4bpp",
    options: {},
  });
  t.is(aseprite.encodedBytes, before.encodedBytes);
  t.is(aseprite.storagePngBase64, before.storagePngBase64);
});

test("portable Aseprite source previews use the same normalized owners and palette as normal assembly", async (t) => {
  const { catalog, layout, png } = spriteFixture();
  const id = "a0000000-0000-0000-0000-000000000000";
  const source = { bytes: png, mediaType: "image/png" };
  const presentation = createSomSpriteInterchange({ id, source, layout }, catalog, id);
  const document = presentation.baseline.document;
  const palette = document.palette.map((color): [number, number, number, number] => [...color]);
  palette[1] = [16, 0, 0, 255];
  const authored = {
    bytes: await indexedSourceCodecs()
      .get("aseprite")
      .encode({ ...document, palette }),
    mediaType: "image/x-aseprite",
  };
  const resources = {
    "layout.json": json(layout),
    "palettes.json": json(catalog),
    "binding.json": json({
      format: "uttori-asset-source",
      version: 1,
      id,
      adapter: "som.sprite.native",
      source: { path: "sprite.aseprite", representation: "aseprite" },
      resources: { reference: "reference.png", layout: "layout.json", palettes: "palettes.json" },
      native: [{ format: "som.sprite.frames", options: {} }],
    }),
    [bindingResourceKey("binding.json", "reference")]: source,
    [bindingResourceKey("binding.json", "layout")]: json(layout),
    [bindingResourceKey("binding.json", "palettes")]: json(catalog),
    [bindingResourceKey("binding.json", "source")]: authored,
  };
  const options = {
    layout: "layout.json",
    palettes: "palettes.json",
    sourceBinding: "binding.json",
    segment: "tiles",
  };
  const normalized = normalizeSomSource(authored, options, resources, catalog);
  const direct = convertAssetPreview({
    source: authored,
    resources,
    format: "som.sprite.frames",
    options,
  });
  const expected = convertAssetPreview({
    source: normalized.source,
    resources: {
      "layout.json": json(normalized.layout),
      "palettes.json": json(normalized.catalog),
    },
    format: "som.sprite.frames",
    options: { layout: "layout.json", palettes: "palettes.json", segment: "tiles" },
  });
  t.is(direct.encodedBytes, expected.encodedBytes);
  t.is(direct.composedPngBase64, expected.composedPngBase64);
  const colors = convertAssetPreview({
    source: json(catalog),
    resources,
    format: "som.palette.bgr555",
    options: { palette: "C00100", paletteSources: ["binding.json"] },
  });
  const expectedColors = convertAssetPreview({
    source: json(normalized.catalog),
    resources: {},
    format: "som.palette.bgr555",
    options: { palette: "C00100" },
  });
  t.is(colors.composedPngBase64, expectedColors.composedPngBase64);
});

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
  for (let offset = 3; offset < pixels.length; offset += 4) {
    pixels[offset] = 255;
  }
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
  const source = somFixture("audio/brr/034784-waveform-01.wav");
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
  const source = somFixture("audio/brr/034784-waveform-01.wav");
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
  const source = somFixture("audio/brr/03fbcc-title-instrument-s13.wav");
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
  const layoutName = "../assets/images/enemy/rabite-frames.layout.json";
  const paletteName = "../assets/palettes/rom-palettes.json";
  const source = somFixture("images/enemy/rabite-frames.png");
  const input = {
    source: { bytes: source, mediaType: "image/png" },
    resources: {
      [layoutName]: {
        bytes: somFixture("images/enemy/rabite-frames.layout.json"),
        mediaType: "application/json",
      },
      [paletteName]: {
        bytes: somFixture("palettes/rom-palettes.json"),
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
  const palettes = {
    bytes: somFixture("palettes/rom-palettes.json"),
    mediaType: "application/json",
  };
  const preview = (name: string, segments?: string[]) => {
    const source = somFixture(`images/${name}-frames.png`);
    const result = convertAssetPreview({
      source: { bytes: source, mediaType: "image/png" },
      resources: {
        "layout.json": {
          bytes: somFixture(`images/${name}-frames.layout.json`),
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
  const womanSegments = woman.metadata?.segments;
  if (!Array.isArray(womanSegments)) {
    throw new Error("Missing preview segment inventory.");
  }
  t.is(womanSegments.length, 7);
  const cannon = preview("objects/cannon", [
    "cannon-bottom-right-tiles",
    "cannon-top-corner-tiles",
    "cannon-middle-left-tiles",
    "cannon-middle-right-tiles",
    "cannon-bottom-left-tiles",
  ]);
  t.is(cannon.encodedBytes, 1728);
  const cannonPalettes = cannon.metadata?.palettes;
  if (!Array.isArray(cannonPalettes)) {
    throw new Error("Missing preview palette inventory.");
  }
  t.deepEqual(
    cannonPalettes.map((palette: unknown) => {
      if (
        !palette ||
        typeof palette !== "object" ||
        !("paletteId" in palette) ||
        typeof palette.paletteId !== "string"
      ) {
        throw new Error("Invalid preview palette.");
      }
      return palette.paletteId;
    }),
    ["C8296E", "C8298C", "C829E6", "C829C8", "C82A04"],
  );
  t.throws(() => preview("objects/cannon"), { message: /gaps or overlaps/ });
});

test("SoM boss frame preview reports its fixed compressed ROM span", (t) => {
  const layoutName = "../assets/images/enemy/mantis-ant-frames.layout.json";
  const paletteName = "../assets/palettes/rom-palettes.json";
  const source = somFixture("images/enemy/mantis-ant-frames.png");
  const preview = convertAssetPreview({
    source: { bytes: source, mediaType: "image/png" },
    resources: {
      [layoutName]: {
        bytes: somFixture("images/enemy/mantis-ant-frames.layout.json"),
        mediaType: "application/json",
      },
      [paletteName]: {
        bytes: somFixture("palettes/rom-palettes.json"),
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
  const source = somFixture("palettes/rom-palettes.json");
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
  const source = somFixture("palettes/rom-palettes.json");
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

test("SoM Flammie overview preview samples tile IDs and reflects native swatch edits", (t) => {
  const tileIds = new Uint8Array(512 * 512).fill(192);
  tileIds[0] = 1;
  tileIds[1] = 1;
  tileIds[512] = 1;
  tileIds[513] = 2;
  const tiles = "world-tiles.png";
  const swatches = new Uint8Array(192 * 4);
  for (let slot = 0; slot < 192; slot++) {
    swatches[slot * 4 + 3] = 255;
  }
  swatches[4] = 231;
  swatches[9] = 231;
  const options = { tiles };
  const resources = {
    [tiles]: {
      mediaType: "image/png",
      bytes: createIndexedPng({
        width: 512,
        height: 512,
        indexes: tileIds,
        palette: Array.from({ length: 193 }, () => [0, 0, 0, 255]),
      }),
    },
  };
  const format = "som.world.overview-colors";
  const preview = () =>
    convertAssetPreview({
      format,
      resources,
      options,
      source: { mediaType: "image/png", bytes: rgbaNativePng(swatches, 16, 12) },
    });
  const pixels = (result: ReturnType<typeof preview>) =>
    readAssetPng(Buffer.from(result.composedPngBase64 ?? "", "base64")).toRGBA().rgba;
  t.true(supportsPortableAssetPreview(format));
  const original = preview();
  t.is(original.output, "colors");
  t.is(original.encodedBytes, 192);
  t.is(original.metadata?.width, 256);
  t.deepEqual([...pixels(original).subarray(0, 8)], [165, 33, 0, 255, 0, 0, 0, 255]);
  swatches[4] = 0;
  t.deepEqual([...pixels(preview()).subarray(0, 4)], [0, 33, 0, 255]);
  swatches[4] = 1;
  t.throws(preview, { message: /native direct-color gamut/ });
});

test("SoM room preview validates section output and responds to edited room placement", (t) => {
  const bytes = somFixture("rooms/room-001e.json");
  const previewPath = "room-001e.preview.json";
  const resources = {
    [previewPath]: {
      bytes: somFixture(`rooms/${previewPath}`),
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

test("independent game preview registration receives bytes without publication authority", (t) => {
  const input = {
    format: "second-game.pixels",
    source: { bytes: Uint8Array.of(1, 2) },
    resources: {},
    options: {},
  };
  const adapter = {
    formats: ["second-game.pixels"],
    convert: (value: typeof input) => ({
      kind: "binary" as const,
      sourceBytes: value.source.bytes.length,
      encodedBytes: 2,
      format: value.format,
      output: "native",
    }),
  };
  t.deepEqual(convertRegisteredPreview(input, [adapter]), {
    kind: "binary",
    sourceBytes: 2,
    encodedBytes: 2,
    format: "second-game.pixels",
    output: "native",
  });
  t.throws(() => convertRegisteredPreview(input, [adapter, adapter]), { message: /Ambiguous/ });
});
