import { readFileSync } from "node:fs";

import { AssetRegistry, convertAsset } from "@uttori/asm-assets";
import { waveImporter, withAudioEncoder } from "@uttori/asm-assets/audio";
import { pngImporter, withImageEncoders } from "@uttori/asm-assets/image";
import { snesNativeEncoders } from "@uttori/asm-assets/snes";
import {
  MemoryAssemblyFileProvider,
  PluginManager,
  definePlugin,
  PLUGIN_API_VERSION,
} from "@uttori/asm-core";
import { createDebugMap, validateDebugMap } from "@uttori/asm-core/debug-map";

import { test } from "../../../tests/ava-helper.js";
import { Assembler } from "../../../tests/test-assembler.js";
import snesPlugin from "../src/assembler.js";

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`../../assets/tests/fixtures/${name}`, import.meta.url)));

const registry = new AssetRegistry().registerImporter(pngImporter).registerImporter(waveImporter);
for (const encoder of withAudioEncoder(withImageEncoders(snesNativeEncoders))) {
  registry.registerEncoder(encoder);
}

test("includeAsset emits PNG parts equal to the direct helper and sizes following labels", (t) => {
  const png = fixture("colored-4bpp.png");
  const provider = new MemoryAssemblyFileProvider({ "art/title.png": png });
  const assembler = new Assembler(undefined, { fileProvider: provider });
  assembler.assembleSource(
    `org $808000
TitleTiles:
  includeAsset("art/title.png", "snes.tile.4bpp", palette: "embedded", layout: { tileOrder: "row-major" })
TitlePalette:
  includeAsset("art/title.png", "4bpp", palette: "embedded", layout: { tileOrder: "row-major" }, output: "palette")
TitleMap:
  includeAsset("art/title.png", "4bpp", palette: "embedded", layout: { tileOrder: "row-major" }, output: "tilemap")
AfterAsset:
  db $42`,
    "main.asm",
  );
  const direct = convertAsset(registry, {
    source: { bytes: png, mediaType: "image/png" },
    format: "snes.tile.4bpp",
    options: { palette: "embedded", layout: { tileOrder: "row-major" } },
  });
  const expected = Uint8Array.from([
    ...direct.outputs.tiles.bytes,
    ...direct.outputs.palette.bytes,
    ...direct.outputs.tilemap.bytes,
    0x42,
  ]);
  t.deepEqual(assembler.getBinaryOutput().subarray(0, expected.length), expected);
  t.is(assembler.symbolScope.getLabelValue("AfterAsset", false), 0x808000 + expected.length - 1);
  t.deepEqual([...assembler.assetAssembly.dependencies.values()], ["binary"]);
  t.deepEqual(
    assembler.addressToLineMapping.assets.map(({ format, part, size, line }) => ({
      format,
      part,
      size,
      line,
    })),
    [
      { format: "snes.tile.4bpp", part: "tiles", size: direct.outputs.tiles.bytes.length, line: 3 },
      {
        format: "snes.tile.4bpp",
        part: "palette",
        size: direct.outputs.palette.bytes.length,
        line: 5,
      },
      {
        format: "snes.tile.4bpp",
        part: "tilemap",
        size: direct.outputs.tilemap.bytes.length,
        line: 7,
      },
    ],
  );
  const map = createDebugMap({
    target: "snes.sfc",
    output: assembler.getBinaryOutput(),
    mapping: assembler.addressToLineMapping,
    dependencyKinds: assembler.assetAssembly.dependencies,
  });
  t.deepEqual(validateDebugMap(map, assembler.getBinaryOutput()), []);
  t.is(map.assets?.length, 3);
  for (const asset of map.assets ?? []) {
    t.is(map.sources[asset.sourceId]?.path, "main.asm");
    t.is(map.sources[asset.assetSourceId]?.path, "art/title.png");
    t.is(map.sources[asset.assetSourceId]?.kind, "binary");
    t.true(map.ranges.every((range) => range.sourceId !== asset.assetSourceId));
  }
});

test("includeAsset converts WAVE to the same BRR bytes and records a binary dependency", (t) => {
  const wav = fixture("pcm16-loop.wav");
  const assembler = new Assembler(undefined, {
    fileProvider: new MemoryAssemblyFileProvider({ "audio/bell.wav": wav }),
  });
  assembler.assembleSource(
    `org $808000
includeAsset("audio/bell.wav", "snes.brr", loop: false, padding: "reject")
BellEnd:`,
    "main.asm",
  );
  const direct = convertAsset(registry, {
    source: { bytes: wav, mediaType: "audio/wav" },
    format: "snes.brr",
    options: { loop: false, padding: "reject" },
  });
  t.deepEqual(
    assembler.getBinaryOutput().subarray(0, direct.outputs.brr.bytes.length),
    direct.outputs.brr.bytes,
  );
  t.is(
    assembler.symbolScope.getLabelValue("BellEnd", false),
    0x808000 + direct.outputs.brr.bytes.length,
  );
  t.deepEqual([...assembler.assetAssembly.dependencies.values()], ["binary"]);
});

test("includeAsset resolves external palette resources and refreshes changed input on the next build", (t) => {
  const original = fixture("rgb-transparency.png");
  const changed = fixture("rgba-transparent.png");
  const palette = fixture("palette-exact.json");
  const provider = new MemoryAssemblyFileProvider({
    "art/title.png": original,
    "art/palette.json": palette,
  });
  const source =
    'org $808000\nincludeAsset("art/title.png", "4bpp", palette: "art/palette.json")\nEnd:';
  const assembler = new Assembler(undefined, { fileProvider: provider });
  assembler.assembleSource(source, "main.asm");
  const direct = convertAsset(registry, {
    source: { bytes: original, mediaType: "image/png" },
    format: "snes.tile.4bpp",
    options: { palette: "art/palette.json" },
    resources: {
      "art/palette.json": { bytes: palette, mediaType: "application/json" },
    },
  });
  t.deepEqual(
    assembler.getBinaryOutput().subarray(0, direct.outputs.tiles.bytes.length),
    direct.outputs.tiles.bytes,
  );
  t.deepEqual([...assembler.assetAssembly.dependencies.values()], ["resource", "binary"]);

  provider.files.set("art/title.png", changed);
  const next = new Assembler(undefined, { fileProvider: provider });
  t.throws(() => next.assembleSource(source, "main.asm"), {
    message: /external palette|absent from/i,
  });
});

test("includeAsset holds input bytes stable between passes and refreshes the next build", (t) => {
  const firstImage = fixture("colored-4bpp.png");
  const secondImage = fixture("indexed-2bpp.png");
  const provider = new MemoryAssemblyFileProvider({ "art/title.png": firstImage });
  const assembler = new Assembler(undefined, { fileProvider: provider });
  const source = 'org $808000\nincludeAsset("art/title.png", "4bpp")\nEnd:';
  const program = assembler.buildProgramModel(source, "main.asm");
  assembler.runStage("collectDefinitions", program);
  provider.files.set("art/title.png", secondImage);
  assembler.runStage("resolveLayout", program);
  assembler.runStage("emitProgram", program);
  const first = assembler.getBinaryOutput().slice(0, 128);
  const expectedFirst = convertAsset(registry, {
    source: { bytes: firstImage, mediaType: "image/png" },
    format: "snes.tile.4bpp",
  }).outputs.tiles.bytes;
  t.deepEqual(first, expectedFirst);

  assembler.assembleSource(source, "main.asm");
  const next = assembler.getBinaryOutput().slice(0, 128);
  const expectedNext = convertAsset(registry, {
    source: { bytes: secondImage, mediaType: "image/png" },
    format: "snes.tile.4bpp",
  }).outputs.tiles.bytes;
  t.deepEqual(next, expectedNext);
  t.not(Buffer.from(first).toString("hex"), Buffer.from(next).toString("hex"));
});

test("includeAsset respects macros, inactive branches, same-line labels and command separators", (t) => {
  const assembler = new Assembler(undefined, {
    fileProvider: new MemoryAssemblyFileProvider({ "payload.bin": Uint8Array.from([0x11, 0x22]) }),
  });
  assembler.assembleSource(
    `org $808000
!LIMIT = 1 + 1
macro add()
  includeAsset("payload.bin", "raw", maxSize: !LIMIT)
endmacro
if 0
  includeAsset("missing.bin", "raw")
endif
Start: includeAsset("payload.bin", "raw", maxSize: !LIMIT) : db $42
%add()
End:`,
    "main.asm",
  );
  t.deepEqual(
    assembler.getBinaryOutput().subarray(0, 5),
    Uint8Array.from([0x11, 0x22, 0x42, 0x11, 0x22]),
  );
  t.is(assembler.symbolScope.getLabelValue("End", false), 0x808005);
});

test("includeAsset preflights target boundaries before any asset byte is written", (t) => {
  const assembler = new Assembler(undefined, {
    fileProvider: new MemoryAssemblyFileProvider({ "payload.bin": Uint8Array.from([1, 2, 3, 4]) }),
  });
  t.throws(
    () => assembler.assembleSource('org $80FFFE\nincludeAsset("payload.bin", "raw")', "main.asm"),
    {
      message: /bank border/i,
    },
  );
  t.is(assembler.outputBytes.length, 0);
});

test("includeAsset contributes its entire size to SNES freespace accounting", (t) => {
  const assembler = new Assembler(undefined, {
    fileProvider: new MemoryAssemblyFileProvider({ "payload.bin": Uint8Array.from([1, 2, 3, 4]) }),
  });
  assembler.assembleSource('freedata\nincludeAsset("payload.bin", "raw")\nEnd:', "main.asm");
  const bytes = assembler.getBinaryOutput();
  const start = assembler.targetState.activeFreespaceStartOffset;
  t.truthy(start);
  t.deepEqual(
    bytes.subarray(start!, start! + 12),
    Uint8Array.from([0x53, 0x54, 0x41, 0x52, 3, 0, 0xfc, 0xff, 1, 2, 3, 4]),
  );
});

test("third-party lossless transforms install on the standard SNES target", async (t) => {
  const manager = new PluginManager();
  const custom = definePlugin({
    manifest: {
      id: "example.assets",
      name: "Example assets",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
      requires: [{ pluginId: "uttori.asm-plugin-snes", version: "1.0.0" }],
    },
    activate(context) {
      context.registerAssetTransform({
        id: "example.xor",
        version: "1.0.0",
        aliases: ["xor"],
        targets: ["snes.sfc"],
        encode: (bytes) => bytes.map((byte) => byte ^ 0xff),
        decode: (bytes) => bytes.map((byte) => byte ^ 0xff),
      });
    },
  });
  await manager.activatePlugins([{ plugin: snesPlugin }, { plugin: custom }]);
  const environment = manager.freeze();
  const provider = new MemoryAssemblyFileProvider({ "input.bin": Uint8Array.from([0, 1, 255]) });
  const assembler = new (await import("@uttori/asm-core")).Assembler({
    environment,
    target: "snes.sfc",
    fileProvider: provider,
  });
  assembler.assembleSource(
    'org $808000\nincludeAsset("input.bin", "raw", compress: "xor")\nEnd:',
    "main.asm",
  );
  t.deepEqual(assembler.getBinaryOutput().subarray(0, 3), Uint8Array.from([255, 254, 0]));
  t.is(assembler.symbolScope.getLabelValue("End", false), 0x808003);
  t.is(environment.getAssetTransform("xor", "snes.sfc")?.id, "example.xor");
  const chain = new (await import("@uttori/asm-core")).Assembler({
    environment,
    target: "snes.sfc",
    fileProvider: provider,
  });
  chain.assembleSource(
    'org $808000\nincludeAsset("input.bin", "raw", compress: [{ id: "xor", options: {} }, { id: "xor", options: {} }], maxSize: 1 + 2)',
    "main.asm",
  );
  t.deepEqual(chain.getBinaryOutput().subarray(0, 3), Uint8Array.from([0, 1, 255]));
  const oversized = new (await import("@uttori/asm-core")).Assembler({
    environment,
    target: "snes.sfc",
    fileProvider: provider,
  });
  t.throws(
    () =>
      oversized.assembleSource(
        'org $808000\nincludeAsset("input.bin", "raw", maxSize: 2)',
        "main.asm",
      ),
    {
      message: /3 bytes, above maxSize 2/,
    },
  );
  await manager.dispose();
});

test("asset aliases are scoped and ambiguous short names fail at environment construction", async (t) => {
  const manager = new PluginManager();
  const conflicting = definePlugin({
    manifest: {
      id: "example.duplicate-assets",
      name: "Duplicate asset alias",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
    },
    activate(context) {
      context.registerAssetFormat({
        id: "example.tiles",
        version: "1.0.0",
        aliases: ["4bpp"],
        targets: ["snes.sfc"],
        convert: () => ({ primaryOutput: "data", outputs: { data: { bytes: new Uint8Array() } } }),
      });
    },
  });
  await manager.activatePlugins([{ plugin: snesPlugin }, { plugin: conflicting }]);
  t.throws(() => manager.freeze(), { message: /Asset alias '4bpp' is ambiguous/ });
  await manager.dispose();
});

test("one conversion supplies multiple selected parts across passes and re-reads resources next build", async (t) => {
  let calls = 0;
  const custom = definePlugin({
    manifest: {
      id: "example.parts-plugin",
      name: "Parts",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
    },
    activate(context) {
      context.registerAssetFormat({
        id: "example.parts",
        version: "1.0.0",
        targets: ["snes.sfc"],
        resourcePaths: (options) => [options.dictionary as string],
        convert: (source, _options, resources) => {
          calls++;
          return {
            primaryOutput: "data",
            outputs: {
              data: { bytes: source.bytes },
              dictionary: { bytes: resources["dict.bin"].bytes },
            },
          };
        },
      });
    },
  });
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: snesPlugin }, { plugin: custom }]);
  const provider = new MemoryAssemblyFileProvider({
    "input.bin": Uint8Array.from([1, 2]),
    "dict.bin": Uint8Array.from([3]),
  });
  const assembler = new (await import("@uttori/asm-core")).Assembler({
    environment: manager.freeze(),
    target: "snes.sfc",
    fileProvider: provider,
  });
  const source =
    'org $808000\nincludeAsset("input.bin", "example.parts", dictionary: "dict.bin")\nincludeAsset("input.bin", "example.parts", dictionary: "dict.bin", output: "dictionary")';
  assembler.assembleSource(source, "main.asm");
  t.is(calls, 1);
  t.deepEqual(assembler.getBinaryOutput().subarray(0, 3), Uint8Array.from([1, 2, 3]));
  provider.files.set("dict.bin", Uint8Array.from([4]));
  assembler.assembleSource(source, "main.asm");
  t.is(calls, 2);
  t.deepEqual(assembler.getBinaryOutput().subarray(0, 3), Uint8Array.from([1, 2, 4]));
  await manager.dispose();
});
