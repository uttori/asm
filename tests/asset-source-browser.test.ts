import path from "node:path";
import vm from "node:vm";

import { encodeAsepriteDocument } from "@uttori/asm-assets/aseprite";
import { encodeFrameAtlas } from "@uttori/asm-assets/secret-of-mana/som-frame-atlas";
import { createSomSpriteInterchange } from "@uttori/asm-assets/secret-of-mana/som-sprite-interchange";
import { build } from "esbuild";

import { test } from "./ava-helper.js";
import { spriteFixture } from "./fixtures/sprite-source.js";

const json = (value: unknown) => Array.from(new TextEncoder().encode(JSON.stringify(value)));

test("browser bundle assembles saved Aseprite and portable bindings without Node globals or private project state", async (t) => {
  const { catalog, layout, png } = spriteFixture();
  const id = "a0000000-0000-0000-0000-000000000000";
  const presentation = createSomSpriteInterchange(
    { id, source: { bytes: png, mediaType: "image/png" }, layout },
    catalog,
    id,
  );
  const files = {
    "sprite.aseprite": Array.from(await encodeAsepriteDocument(presentation.baseline.document)),
    "reference.png": Array.from(png),
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
  };
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      sourcefile: "browser-asset-source.ts",
      contents: `
      import {Assembler, MemoryAssemblyFileProvider, PluginManager} from "@uttori/asm-core";
      import snes from "@uttori/asm-plugin-snes";
      import som from "@uttori/asm-assets/secret-of-mana/som-asset-plugin";
      globalThis.assetSourceResult = (async () => {
        const manager = new PluginManager();
        await manager.activatePlugins([{plugin:snes},{plugin:som}]);
        const files = Object.fromEntries(Object.entries(${JSON.stringify(files)}).map(([key,bytes]) => [key,Uint8Array.from(bytes)]));
        const assembler = new Assembler({environment:manager.freeze(),target:"snes.sfc",architecture:"snes.65816",fileProvider:new MemoryAssemblyFileProvider(files)});
        try {
          assembler.assembleSource('hirom\\norg $C00200\\nincludeAsset("sprite.aseprite", "som.sprite.frames", sourceBinding: "binding.json", layout: "layout.json", palettes: "palettes.json", segment: "tiles")', "main.asm");
          return Array.from(assembler.getBinaryOutput().slice(0x200, 0x280));
        } finally { assembler.dispose(); await manager.dispose(); }
      })();
    `,
    },
    bundle: true,
    platform: "browser",
    conditions: ["browser"],
    format: "esm",
    target: "es2022",
    write: false,
    logLevel: "silent",
  });
  const context = {
    TextEncoder,
    TextDecoder,
    structuredClone,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Int8Array,
    Int16Array,
    Int32Array,
    ArrayBuffer,
    DataView,
    assetSourceResult: undefined as Promise<number[]> | undefined,
  };
  await vm.runInNewContext(`(async () => { ${result.outputFiles[0].text} })()`, context, {
    filename: path.resolve("browser-asset-source.js"),
  });
  t.deepEqual(
    await context.assetSourceResult,
    Array.from(encodeFrameAtlas({ bytes: png, mediaType: "image/png" }, layout, "tiles", catalog)),
  );
});
