import { deflateSync } from "node:zlib";

import { MemoryAssemblyFileProvider, PluginManager, Assembler } from "@uttori/asm-core";
import snesPlugin from "@uttori/asm-plugin-snes";

import { test } from "../../../tests/ava-helper.js";
import { spriteFixture } from "../../../tests/fixtures/sprite-source.js";
import { createSomAssetPlugin } from "../../game-secret-of-mana/src/assembly.js";
import { rasterZlib, rasterZlibSync } from "../src/aseprite-binary.js";
import {
  decodeAsepriteDocument,
  decodeAsepriteDocumentSync,
  encodeAsepriteDocument,
} from "../src/aseprite-document.js";
import type { IndexedDocument } from "../src/indexed-document.js";
import { extendIndexedPngPalette } from "../src/png-edit.js";
import type { AssetInput } from "../src/registry.js";
import { encodeFrameAtlas } from "../src/secret-of-mana/som-frame-atlas.js";
import {
  effectiveSomSourcePalette,
  normalizeSomSource,
  somPngPaletteViews,
} from "../src/secret-of-mana/som-source.js";
import { createSomSpriteInterchange } from "../src/secret-of-mana/som-sprite-interchange.js";
import { bindingResourceKey, type AssetSourceBinding } from "../src/source-binding.js";
import { indexedSourceCodecs } from "../src/source-codecs.js";
import type { AssetSourceCodec } from "../src/source-codecs.js";

const id = "a0000000-0000-0000-0000-000000000000";
const json = (value: unknown): AssetInput => ({
  bytes: new TextEncoder().encode(JSON.stringify(value)),
  mediaType: "application/json",
});

/** Synthetic editor container proves class-based codecs preserve their receiver and native mapping through registration. */
class TestEditorCodec implements AssetSourceCodec<IndexedDocument> {
  readonly id = "test.editor";
  readonly version = 1;
  readonly mediaType = "image/x-test-editor";
  readonly extensions = [".test-art"];
  readonly embeddedIdentity = true;
  readonly prefix = Uint8Array.of(0x55, 0x54);
  matches(bytes: Uint8Array): boolean {
    return this.prefix.every((byte, index) => byte === bytes[index]);
  }
  decode(bytes: Uint8Array): IndexedDocument {
    return decodeAsepriteDocumentSync(bytes.subarray(this.prefix.length));
  }
  async encode(document: IndexedDocument): Promise<Uint8Array> {
    return Uint8Array.from([...this.prefix, ...(await encodeAsepriteDocument(document))]);
  }
}

async function boundFixture(variant = false) {
  const { catalog, layout, png } = spriteFixture();
  if (variant) {
    catalog.palettes.C00120 = { ...structuredClone(catalog.palettes.C00100), romAddress: "C00120" };
    layout.paletteVariants = [{ group: 0, palette: "C00120" }];
  }
  const atlas = { id, source: { bytes: png, mediaType: "image/png" }, layout };
  const presentation = createSomSpriteInterchange(atlas, catalog, id);
  const binding: AssetSourceBinding = {
    format: "uttori-asset-source",
    version: 1,
    id,
    adapter: "som.sprite.native",
    source: { path: "sprite.aseprite", representation: "aseprite" },
    resources: { reference: "reference.png", layout: "layout.json", palettes: "palettes.json" },
    native: [{ format: "som.sprite.frames", options: {} }],
  };
  const resources = {
    "binding.json": json(binding),
    [bindingResourceKey("binding.json", "reference")]: atlas.source,
    [bindingResourceKey("binding.json", "layout")]: json(layout),
    [bindingResourceKey("binding.json", "palettes")]: json(catalog),
  };
  const source = {
    bytes: await encodeAsepriteDocument(presentation.baseline.document),
    mediaType: "image/x-aseprite",
  };
  return { catalog, layout, png, presentation, binding, resources, source };
}

test("synchronous and cancellable decoders agree for a complete tilemap inventory", async (t) => {
  const fixture = await boundFixture();
  t.deepEqual(
    decodeAsepriteDocumentSync(fixture.source.bytes),
    await decodeAsepriteDocument(fixture.source.bytes),
  );
  const normalized = normalizeSomSource(
    fixture.source,
    { sourceBinding: "binding.json" },
    fixture.resources,
    fixture.catalog,
  );
  t.deepEqual(
    encodeFrameAtlas(normalized.source, normalized.layout, "tiles", normalized.catalog),
    encodeFrameAtlas(
      { bytes: fixture.png, mediaType: "image/png" },
      fixture.layout,
      "tiles",
      fixture.catalog,
    ),
  );
  t.deepEqual(fixture.resources["binding.json"], json(fixture.binding));
});

test("direct tile pixels and palette colors produce pure native changes without reference writes", async (t) => {
  const fixture = await boundFixture();
  const document = decodeAsepriteDocumentSync(fixture.source.bytes);
  const indexes = document.tilesets[0].indexes.slice();
  indexes[64] ^= 1;
  const palette = document.palette.map((color): [number, number, number, number] => [...color]);
  palette[1] = [16, 0, 0, 255];
  const source = {
    ...fixture.source,
    bytes: await encodeAsepriteDocument({
      ...document,
      palette,
      tilesets: [{ ...document.tilesets[0], indexes }],
    }),
  };
  const resources = {
    ...fixture.resources,
    [bindingResourceKey("binding.json", "source")]: source,
  };
  const normalized = normalizeSomSource(
    source,
    { sourceBinding: "binding.json" },
    resources,
    fixture.catalog,
  );
  const paletteFirst = effectiveSomSourcePalette(
    fixture.catalog,
    { paletteSources: ["binding.json"] },
    resources,
  );
  t.deepEqual(paletteFirst, normalized.catalog);
  t.is(paletteFirst.palettes.C00100.words[0], "8002");
  t.notDeepEqual(
    encodeFrameAtlas(normalized.source, normalized.layout, "tiles", normalized.catalog),
    encodeFrameAtlas(
      { bytes: fixture.png, mediaType: "image/png" },
      fixture.layout,
      "tiles",
      fixture.catalog,
    ),
  );
  t.is(fixture.catalog.palettes.C00100.words[0], "8001");
});

test("palette consumers reconcile changed aliases and diagnose conflicting source votes", async (t) => {
  const fixture = await boundFixture();
  const document = decodeAsepriteDocumentSync(fixture.source.bytes);
  const sources = await Promise.all(
    [16, 24].map(async (red) => {
      const palette = document.palette.map((color): [number, number, number, number] => [...color]);
      palette[1] = [red, 0, 0, 255];
      return {
        bytes: await encodeAsepriteDocument({ ...document, palette }),
        mediaType: "image/x-aseprite",
      };
    }),
  );
  const resources: Record<string, AssetInput> = { ...fixture.resources };
  for (const [index, name] of ["a.json", "b.json"].entries()) {
    resources[name] = json(fixture.binding);
    for (const key of ["reference", "layout", "palettes"]) {
      resources[bindingResourceKey(name, key)] =
        fixture.resources[bindingResourceKey("binding.json", key)];
    }
    resources[bindingResourceKey(name, "source")] = sources[index];
  }
  t.throws(
    () =>
      effectiveSomSourcePalette(
        fixture.catalog,
        { paletteSources: ["a.json", "b.json"] },
        resources,
      ),
    { message: /Conflicting authored palette/ },
  );
  resources[bindingResourceKey("b.json", "source")] = fixture.source;
  t.is(
    effectiveSomSourcePalette(fixture.catalog, { paletteSources: ["a.json", "b.json"] }, resources)
      .palettes.C00100.words[0],
    "8002",
  );
});

test("bounded inflation rejects short, oversized and invalid zlib payloads in both APIs", async (t) => {
  const bytes = deflateSync(new Uint8Array(65536));
  t.is(rasterZlibSync(bytes, 65536).length, 65536);
  for (const expected of [65535, 65537]) {
    t.throws(() => rasterZlibSync(bytes, expected), { message: /bounded Aseprite/ });
    await t.throwsAsync(rasterZlib(bytes, expected), { message: /bounded Aseprite/ });
  }
  t.throws(() => rasterZlibSync(Uint8Array.of(0, 1, 2), 1));
  const trailing = Uint8Array.from([...deflateSync(Uint8Array.of(5)), 1, 2]);
  t.throws(() => rasterZlibSync(trailing, 1));
  await t.throwsAsync(rasterZlib(trailing, 1));
});

test("source codec content and declared representation cannot disagree", async (t) => {
  const fixture = await boundFixture();
  const codecs = indexedSourceCodecs();
  t.is(codecs.identify(fixture.source.bytes, { path: "sprite.ase" }).id, "aseprite");
  t.throws(() => codecs.identify(fixture.source.bytes, { path: "sprite.png" }), {
    message: /extension\/content mismatch/,
  });
  t.throws(() => codecs.identify(fixture.png, { mediaType: "image/x-aseprite" }), {
    message: /extension\/content mismatch/,
  });
  t.throws(() => codecs.register(codecs.get("aseprite")), { message: /duplicate source codec/ });
});

test("PNG palette-only variant views preserve separate native palette ownership", async (t) => {
  const fixture = await boundFixture(true);
  const atlas = {
    id,
    source: { bytes: fixture.png, mediaType: "image/png" },
    layout: fixture.layout,
  };
  const views = somPngPaletteViews(atlas, fixture.catalog);
  const slot = views.slots.findIndex((item) => item?.palette === "C00120" && item.index === 1);
  t.true(slot > 16);
  const palette = [...views.document.palette];
  palette[slot] = [16, 0, 0, 255];
  const source = { bytes: extendIndexedPngPalette(fixture.png, palette), mediaType: "image/png" };
  const resources = {
    ...fixture.resources,
    "binding.json": json({
      ...fixture.binding,
      source: { path: "sprite.png", representation: "indexed-png" },
    }),
  };
  const effective = effectiveSomSourcePalette(
    fixture.catalog,
    { sourceBinding: "binding.json" },
    resources,
    source,
  );
  t.is(effective.palettes.C00120.words[0], "8002");
  t.is(effective.palettes.C00100.words[0], "8001");
});

test("standalone in-memory assembly accepts future codecs and shares a pure palette snapshot in either build order", async (t) => {
  const fixture = await boundFixture();
  const codecs = indexedSourceCodecs();
  codecs.register(new TestEditorCodec());
  const document = decodeAsepriteDocumentSync(fixture.source.bytes);
  const palette = document.palette.map((color): [number, number, number, number] => [...color]);
  palette[1] = [16, 0, 0, 255];
  const source = await codecs.get("test.editor").encode({ ...document, palette });
  const files = {
    "sprite.test-art": source,
    "binding.json": json({
      ...fixture.binding,
      source: { path: "sprite.test-art", representation: "test.editor" },
    }).bytes,
    "reference.png": fixture.png,
    "layout.json": json(fixture.layout).bytes,
    "palettes.json": json(fixture.catalog).bytes,
  };
  const manager = new PluginManager();
  t.teardown(() => manager.dispose());
  await manager.activatePlugins([{ plugin: snesPlugin }, { plugin: createSomAssetPlugin(codecs) }]);
  const environment = manager.freeze();
  const graphics =
    'org $C00200\nincludeAsset("sprite.test-art", "som.sprite.frames", sourceBinding: "binding.json", layout: "layout.json", palettes: "palettes.json", segment: "tiles")';
  const colors =
    'org $C00100\nincludeAsset("palettes.json", "som.palette.bgr555", palette: "C00100", paletteSources: ["binding.json"])';
  const outputs: Uint8Array[] = [];
  for (const statements of [
    [colors, graphics],
    [graphics, colors],
  ]) {
    const assembler = new Assembler({
      environment,
      target: "snes.sfc",
      architecture: "snes.65816",
      fileProvider: new MemoryAssemblyFileProvider(files),
    });
    assembler.assembleSource(`hirom\n${statements.join("\n")}`, "main.asm");
    outputs.push(assembler.getBinaryOutput().slice());
    t.is(outputs.at(-1)![0x100], 2);
    t.true(assembler.assetAssembly.dependencies.has("binding.json"));
    t.true(assembler.assetAssembly.dependencies.has("sprite.test-art"));
  }
  t.deepEqual(outputs[0], outputs[1]);
});
