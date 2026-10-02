import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { build } from "esbuild";

import { test } from "../../../tests/ava-helper.js";

test("public conversion and native subpaths bundle for browser workers without Node dependencies", async (t) => {
  const result = await build({
    stdin: {
      contents: `import { AssetRegistry, convertAsset } from "@uttori/asm-assets";
import { snesNativeEncoders } from "@uttori/asm-assets/snes";
import { rawImporter, rawEncoder } from "@uttori/asm-assets/data";
import { transformBytes } from "@uttori/asm-assets/compression";
import { tileRgba } from "@uttori/asm-assets/preview";
import { pngImporter, withImageEncoders, expandIndexedGrid, extractIndexedRegion, renderIndexedPlacements, rewriteIndexedPng } from "@uttori/asm-assets/image";
import { waveImporter, withAudioEncoder, decodeBrrPcm } from "@uttori/asm-assets/audio";
const registry = new AssetRegistry().registerImporter(rawImporter).registerEncoder(rawEncoder);
export const result = convertAsset(registry, { source: { bytes: new Uint8Array([1]), mediaType: "application/octet-stream" }, format: "uttori.data.raw" });
export { snesNativeEncoders, pngImporter, waveImporter, withImageEncoders, withAudioEncoder, decodeBrrPcm, transformBytes, tileRgba, expandIndexedGrid, extractIndexedRegion, renderIndexedPlacements, rewriteIndexedPng };`,
      resolveDir: process.cwd(),
      sourcefile: "assets-browser-smoke.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "browser",
    format: "esm",
    conditions: ["uttori-source"],
    write: false,
    logLevel: "silent",
  });
  t.is(result.errors.length, 0);
  t.true(result.outputFiles[0].text.length > 100);
});

test("PNG and WAVE conversion execute in a browser-like worker without Node globals", async (t) => {
  const result = await build({
    stdin: {
      contents: `import { AssetRegistry, convertAsset } from "@uttori/asm-assets";
import { pngImporter, withImageEncoders, expandIndexedGrid, extractIndexedRegion, renderIndexedPlacements, rewriteIndexedPng } from "@uttori/asm-assets/image";
import { waveImporter, withAudioEncoder } from "@uttori/asm-assets/audio";
import { snesNativeEncoders } from "@uttori/asm-assets/snes";
export function run(png, wave) {
  const registry = new AssetRegistry().registerImporter(pngImporter).registerImporter(waveImporter);
  for (const encoder of withAudioEncoder(withImageEncoders(snesNativeEncoders))) registry.registerEncoder(encoder);
  const original = pngImporter.import({ bytes: png, mediaType: "image/png" }).value;
  if (expandIndexedGrid({id:"block",x:0,y:0,columns:1,cellWidth:3,cellHeight:2,cells:[{source:"tile"}]}).length !== 1) throw new Error("Grid expansion failed");
  const tile = extractIndexedRegion(original, { x: 0, y: 0, width: 3, height: 2, flipX: true });
  const composed = renderIndexedPlacements(new Map([["tile", tile]]), [{ id: "one", source: "tile", x: -1, y: -2, transparentIndex: null }], { x: -1, y: -2, width: 3, height: 2 });
  if (composed.indexes.some((v, i) => v !== tile.indexes[i])) throw new Error("Browser placement differs");
  const indexes = original.indexes.slice(); indexes[0] = (indexes[0] + 1) % original.palette.length;
  const rewritten = rewriteIndexedPng(png, { indexes });
  const image = convertAsset(registry, { source: { bytes: rewritten, mediaType: "image/png" }, format: "snes.tile.4bpp" });
  const audio = convertAsset(registry, { source: { bytes: wave, mediaType: "audio/wav" }, format: "snes.brr" });
  return [image.outputs.tiles.bytes.length, audio.outputs.brr.bytes.length];
}`,
      resolveDir: process.cwd(),
      sourcefile: "assets-browser-runtime.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "browser",
    format: "esm",
    conditions: ["uttori-source"],
    write: false,
    logLevel: "silent",
  });
  const temp = mkdtempSync(join(tmpdir(), "asm-assets-browser-"));
  try {
    const bundlePath = join(temp, "bundle.mjs");
    writeFileSync(bundlePath, result.outputFiles![0].text);
    const child = `import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const [bundlePath, pngPath, wavePath] = process.argv.slice(1);
const stdout = process.stdout;
const png = Uint8Array.from(readFileSync(pngPath));
const wave = Uint8Array.from(readFileSync(wavePath));
globalThis.Buffer = undefined;
globalThis.process = undefined;
const bundle = await import(pathToFileURL(bundlePath).href);
stdout.write(JSON.stringify(bundle.run(png, wave)));`;
    const pngPath = new URL("./fixtures/indexed-4bpp.png", import.meta.url).pathname;
    const wavePath = new URL("./fixtures/pcm8-silence.wav", import.meta.url).pathname;
    const output = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", child, bundlePath, pngPath, wavePath],
      { encoding: "utf8" },
    );
    t.deepEqual(JSON.parse(output), [128, 9]);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
