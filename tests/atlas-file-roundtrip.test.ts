import fs from "node:fs";
import path from "node:path";

import { asepriteAtlasCodec } from "@uttori/asm-assets/aseprite";
import { indexedPngAtlasCodec } from "@uttori/asm-assets/atlas-png";
import {
  acceptedSourceGeneration,
  sourceGit,
  retainSourceGeneration,
  verifySourceGeneration,
  previewSourceGeneration,
  applySourceGeneration,
  finishSourceGeneration,
} from "@uttori/asm-disassembler/source-project";
import { somSpriteSourceAdapter } from "@uttori/asm-game-secret-of-mana/workflows";
import {
  AssetInterchangeService,
  asepriteRasterCodec,
  indexedPngStructureCodec,
  assetHash,
} from "@uttori/asm-workflows/asset-interchange";
import { inspectSourceProject } from "@uttori/asm-workflows/source";

import { test } from "./ava-helper.js";
import { spriteSourceFixture, buildSpriteSource } from "./fixtures/sprite-source.js";

for (const [codec, presentation] of [
  [asepriteAtlasCodec, asepriteRasterCodec],
  [indexedPngAtlasCodec(0), indexedPngStructureCodec],
] as const) {
  test(`${codec.id} files import pixels/palettes into assembling owners and survive two native generations`, async (t) => {
    const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup));
    const output = path.join(fixture.directory, ".uttori-local/export" + codec.extension);
    const service = new AssetInterchangeService(
      fixture.directory,
      somSpriteSourceAdapter,
      presentation,
    );
    const manifest = await service.export(fixture.selection, {
      document: output,
      manifest: output + ".json",
    });
    const sourceTimes = fixture.files.map(
      (file) => fs.statSync(path.join(fixture.directory, file.path)).mtimeMs,
    );
    const originalFile = fs.readFileSync(output);
    const noEdit = await service.review(manifest, output);
    await service.apply(manifest, output, noEdit.id);
    const reviewBytes = async (bytes: Uint8Array) => {
      fs.writeFileSync(output, bytes);
      return service.review(manifest, output);
    };
    t.deepEqual(noEdit.files, []);
    t.is(noEdit.outputSha256, assetHash(fixture.original));
    t.deepEqual(
      fixture.files.map((file) => fs.statSync(path.join(fixture.directory, file.path)).mtimeMs),
      sourceTimes,
    );
    const document = await codec.decode(originalFile);
    // The complete raster inventory starts with native owner zero, independently of the packed source PNG.
    const first = { x: 0, y: 0 };
    const indexes = document.indexes.slice();
    indexes[first.y * document.width + first.x] ^= 1;
    const palette = document.palette.map((color): [number, number, number, number] => [...color]);
    palette[1] = [16, 0, 0, 255];
    const pixelFile = await codec.encode({ ...document, indexes });
    const paletteFile = await codec.encode({ ...document, palette });
    const combinedFile = await codec.encode({ ...document, indexes, palette });
    const expected = Buffer.from(fixture.original);
    expected[0x200] ^= 0x80;
    expected[0x100] = 2;
    const pixels = await reviewBytes(pixelFile);
    const colors = await reviewBytes(paletteFile);
    t.is(
      pixels.outputSha256,
      assetHash(
        Uint8Array.from(fixture.original, (value, offset) =>
          offset === 0x200 ? value ^ 0x80 : value,
        ),
      ),
    );
    t.is(
      colors.outputSha256,
      assetHash(
        Uint8Array.from(fixture.original, (value, offset) => (offset === 0x100 ? 2 : value)),
      ),
    );
    t.false(colors.files.some((change) => change.path.endsWith("sprite.png")));
    const combined = await reviewBytes(combinedFile);
    t.is(combined.outputSha256, assetHash(expected));
    t.is(combined.files.length, 3);
    await service.apply(manifest, output, combined.id);
    t.deepEqual(Buffer.from((await inspectSourceProject(fixture.directory)).output), expected);
    t.is(fs.readFileSync(path.join(fixture.directory, "source/main.asm"), "utf8"), fixture.source);
    await t.throwsAsync(() => service.review(manifest, output), { message: /Stale asset input/g });
    const nextOutput = output + ".next";
    const nextManifest = await service.export(fixture.selection, {
      document: nextOutput,
      manifest: nextOutput + ".json",
    });
    const nextDocument = await codec.decode(fs.readFileSync(nextOutput));
    t.deepEqual(nextDocument.palette[1], [16, 0, 0, 255]);
    t.is(nextDocument.indexes[first.y * document.width + first.x], 1);
    t.deepEqual((await service.review(nextManifest, nextOutput)).files, []);
    await sourceGit(fixture.directory, ["add", "--all"]);
    await sourceGit(fixture.directory, ["commit", "-m", "Author atlas file import"]);
    for (let cycle = 1; cycle <= 2; cycle++) {
      const parent = await acceptedSourceGeneration(
        fixture.repository,
        (await sourceGit(fixture.directory, ["rev-parse", "HEAD"])).stdout.toString().trim(),
      );
      const files = fixture.files.map((file) => ({ ...file, bytes: Uint8Array.from(file.bytes) }));
      files.find((file) => file.path === "source/main.asm")!.bytes = Buffer.from(
        fixture.source + `\n; Atlas research ${cycle}\n`,
      );
      const candidate = await retainSourceGeneration(fixture.repository, {
        parent,
        files,
        inputs: { ...fixture.generationInputs, researchSha256: String(cycle).repeat(64) },
      });
      await verifySourceGeneration(fixture.repository, candidate.commit);
      const pure = await inspectSourceProject(
        fixture.directory,
        new Map(
          files
            .filter(
              (file) =>
                !file.path.endsWith("config.json") && !file.path.endsWith("source-raw.json"),
            )
            .map((file) => [file.path, file.bytes]),
        ),
      );
      t.deepEqual(Buffer.from(pure.output), fixture.original);
      const preview = await previewSourceGeneration(fixture.repository, candidate.commit);
      t.deepEqual(preview.conflicts, []);
      await applySourceGeneration(fixture.repository, candidate, preview);
      await finishSourceGeneration(fixture.repository, {
        message: `Accept atlas research ${cycle}`,
        validate: () => buildSpriteSource(fixture.directory),
      });
      t.deepEqual(Buffer.from((await inspectSourceProject(fixture.directory)).output), expected);
    }
  });
}

test("file export survives unrelated commits but rejects changed owners and manipulated manifest/identity", async (t) => {
  const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup));
  const output = path.join(fixture.directory, ".uttori-local/export.aseprite");
  const service = new AssetInterchangeService(
    fixture.directory,
    somSpriteSourceAdapter,
    asepriteRasterCodec,
  );
  const manifest = await service.export(fixture.selection, {
    document: output,
    manifest: output + ".json",
  });
  const bytes = fs.readFileSync(output);
  const reviewBytes = async (value: Uint8Array, selected: unknown = manifest) => {
    fs.writeFileSync(output, value);
    return service.review(selected, output);
  };
  fs.writeFileSync(path.join(fixture.directory, "unrelated.txt"), "independent research\n");
  await sourceGit(fixture.directory, ["add", "unrelated.txt"]);
  await sourceGit(fixture.directory, ["commit", "-m", "Unrelated source commit"]);
  // Change a consumed but independent byte too: import must validate against the current build.
  const raw = fs.readFileSync(path.join(fixture.directory, "source/original.bin"));
  raw[0x7000] ^= 1;
  fs.writeFileSync(path.join(fixture.directory, "source/original.bin"), raw);
  const noEdit = await reviewBytes(bytes);
  t.deepEqual(noEdit.files, []);
  t.is(noEdit.outputSha256, assetHash((await inspectSourceProject(fixture.directory)).output));
  await t.throwsAsync(() => reviewBytes(bytes, { ...manifest, asset: "foreign" }), {
    message: /baseline/,
  });
  const document = await asepriteAtlasCodec.decode(bytes);
  const missingIdentity = await asepriteAtlasCodec.encode({ ...document, exportId: undefined });
  await t.throwsAsync(() => reviewBytes(missingIdentity), { message: /export identity/ });
  const unrepresentable = document.palette.map((color): [number, number, number, number] => [
    ...color,
  ]);
  unrepresentable[1][0] = 7;
  const unrepresentableFile = await asepriteAtlasCodec.encode({
    ...document,
    palette: unrepresentable,
  });
  await t.throwsAsync(() => reviewBytes(unrepresentableFile), { message: /representable/ });
  const wrongIdentity = await asepriteAtlasCodec.encode({
    ...document,
    exportId: "b0000000-0000-0000-0000-000000000000",
  });
  await t.throwsAsync(() => reviewBytes(wrongIdentity), { message: /export identity/ });
  const changedLayout = path.join(fixture.directory, fixture.selection.layout);
  fs.appendFileSync(changedLayout, "\n");
  await t.throwsAsync(() => reviewBytes(bytes), { message: /Stale asset input/g });
  t.is(fs.readFileSync(path.join(fixture.directory, "source/main.asm"), "utf8"), fixture.source);
});
