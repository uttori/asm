import fs from "node:fs";
import path from "node:path";

import { decodeAsepriteDocument, encodeAsepriteDocument } from "@uttori/asm-assets/aseprite";
import {
  acceptedSourceGeneration,
  retainSourceGeneration,
  verifySourceGeneration,
  previewSourceGeneration,
  applySourceGeneration,
  finishSourceGeneration,
  sourceGit,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { spriteSourceFixture, buildSpriteSource } from "../../../tests/fixtures/sprite-source.js";
import { AssetSourceConversionService } from "../src/asset-source-conversion.js";
import { editAssetCall, locateAssetCall } from "../src/asset-source-edits.js";
import { somSourceConversionAdapter } from "../src/asset-source/som-adapter.js";
import { inspectSourceProject } from "../src/source.js";

const service = () => new AssetSourceConversionService([somSourceConversionAdapter]);

test("multiline syntax edits target the literal operand and preserve shared defines and comments", (t) => {
  const text =
    '!image = "sprite.png"\norg $C00200\n  includeAsset(\n    "!image", ; shared define\n    "som.sprite.frames",\n    layout: "layout.json"\n  ) ; keep this comment\n';
  const location = locateAssetCall(text, 3);
  const after = editAssetCall(text, location, {
    path: "sprite.aseprite",
    values: { sourceBinding: "sprite.source.json" },
  });
  t.true(after.startsWith('!image = "sprite.png"'));
  t.true(after.includes('"sprite.aseprite", ; shared define'));
  t.true(after.includes("; keep this comment"));
  t.true(after.includes('sourceBinding: "sprite.source.json"'));
  t.notThrows(() => locateAssetCall(after, 3));
});

test("conversion resolves a multiline define operand and preserves source-owned generation identities", async (t) => {
  const fixture = await spriteSourceFixture(t.teardown);
  const file = path.join(fixture.directory, "source/main.asm");
  const source =
    '!sprite = "sprite.png"\n' +
    fixture.source.replace(
      'includeAsset("sprite.png", "som.sprite.frames",',
      'includeAsset(\n  "!sprite", ; shared source define\n  "som.sprite.frames",',
    );
  fs.writeFileSync(file, source);
  const before = await inspectSourceProject(fixture.directory);
  const emission = before.mapping.assets.find((item) => item.format === "som.sprite.frames")!;
  const declaration = {
    start: emission.outputOffset,
    end: emission.outputOffset + emission.size,
    identity: "original-tiles",
    directive:
      'includeAsset("sprite.png", "som.sprite.frames", layout: "sprite.layout.json", palettes: "palettes.json", segment: "tiles")',
  };
  const declarationFile = path.join(fixture.directory, "asset-includes.json");
  fs.writeFileSync(declarationFile, JSON.stringify({ entries: [declaration] }));
  const converted = await service().convert({
    directory: fixture.directory,
    file,
    line: emission.line + 1,
    representation: "aseprite",
  });
  const saved = fs.readFileSync(file, "utf8");
  t.true(saved.startsWith('!sprite = "sprite.png"'));
  t.true(saved.includes('"sprite.aseprite", ; shared source define'));
  const updated = JSON.parse(fs.readFileSync(declarationFile, "utf8")).entries[0];
  t.is(updated.start, declaration.start);
  t.is(updated.end, declaration.end);
  t.is(updated.identity, declaration.identity);
  t.regex(updated.directive, /sprite\.aseprite/);
  t.regex(updated.directive, /sourceBinding:/);
  t.is(converted.affected.length, 2);
  t.deepEqual((await inspectSourceProject(fixture.directory)).output, before.output);
});

for (const compression of [undefined, "rle", "lz-rle"] as const) {
  test(`saved source conversions preserve the complete current ROM (${compression ?? "uncompressed"})`, async (t) => {
    const fixture = await spriteSourceFixture(t.teardown, compression);
    const before = await inspectSourceProject(fixture.directory);
    const emission = before.mapping.assets.find(
      (item) => item.format === (compression ? "som.boss.graphics" : "som.sprite.frames"),
    )!;
    const file = before.mapping.fileList[emission.fileIdx].name;
    const converted = await service().convert({
      directory: fixture.directory,
      file,
      line: emission.line,
      representation: "aseprite",
    });
    t.true(fs.existsSync(path.join(fixture.directory, converted.destination)));
    t.false(fs.existsSync(path.join(fixture.directory, converted.source)));
    t.deepEqual((await inspectSourceProject(fixture.directory)).output, before.output);
    const reverted = await service().convert({
      directory: fixture.directory,
      file,
      line: emission.line,
      representation: "indexed-png",
    });
    t.is(reverted.destination, converted.source);
    t.deepEqual((await inspectSourceProject(fixture.directory)).output, before.output);
  });
}

test("Aseprite pixel and palette saves build directly, then inverse conversion preserves the edited ROM", async (t) => {
  const fixture = await spriteSourceFixture(t.teardown);
  const before = await inspectSourceProject(fixture.directory);
  const emission = before.mapping.assets.find((item) => item.format === "som.sprite.frames")!;
  const file = before.mapping.fileList[emission.fileIdx].name;
  const converted = await service().convert({
    directory: fixture.directory,
    file,
    line: emission.line,
    representation: "aseprite",
  });
  const destination = path.join(fixture.directory, converted.destination);
  const document = await decodeAsepriteDocument(fs.readFileSync(destination));
  const indexes = document.tilesets[0].indexes.slice();
  indexes[64] ^= 1;
  const palette = document.palette.map((color): [number, number, number, number] => [...color]);
  palette[1] = [16, 0, 0, 255];
  fs.writeFileSync(
    destination,
    await encodeAsepriteDocument({
      ...document,
      palette,
      tilesets: [{ ...document.tilesets[0], indexes }],
    }),
  );
  const edited = await inspectSourceProject(fixture.directory);
  t.notDeepEqual(edited.output, before.output);
  t.is(edited.output[0x100], 2);
  await service().convert({
    directory: fixture.directory,
    file,
    line: emission.line,
    representation: "indexed-png",
  });
  t.deepEqual((await inspectSourceProject(fixture.directory)).output, edited.output);
});

test("conversion preserves unresolved declarations, rejects collisions and relevant drafts without publishing", async (t) => {
  const fixture = await spriteSourceFixture(t.teardown);
  const build = await inspectSourceProject(fixture.directory);
  const emission = build.mapping.assets.find((item) => item.format === "som.sprite.frames")!;
  const file = build.mapping.fileList[emission.fileIdx].name;
  fs.writeFileSync(
    path.join(fixture.directory, "source/other.asm"),
    'includeAsset("sprite.png", "som.sprite.frames")\n',
  );
  const request = {
    directory: fixture.directory,
    file,
    line: emission.line,
    representation: "aseprite",
  };
  const plan = await service().prepare(request);
  t.deepEqual(plan.retained, ["source/sprite.png"]);
  t.deepEqual(plan.unresolvedDeclarations, ["source/other.asm"]);
  t.false(plan.changes.some((change) => change.path === "source/sprite.png"));
  const sourceBefore = fs.readFileSync(file);
  fs.writeFileSync(path.join(fixture.directory, plan.destination), "unrelated file");
  await t.throwsAsync(service().convert(request), { message: /already exists/ });
  t.deepEqual(fs.readFileSync(file), sourceBefore);
  fs.unlinkSync(path.join(fixture.directory, plan.destination));
  const dirty = new AssetSourceConversionService([somSourceConversionAdapter], {
    ...service().host,
    drafts: () => [{ path: file, version: 2, opaque: false }],
  });
  await t.throwsAsync(dirty.convert(request), { message: /Save relevant conversion drafts/ });
  t.false(fs.existsSync(path.join(fixture.directory, plan.destination)));
});

test("two previewed Git generation merges retain Aseprite authoring and edits while pure payloads reproduce the original", async (t) => {
  const fixture = await spriteSourceFixture(t.teardown);
  const initial = await inspectSourceProject(fixture.directory);
  const emission = initial.mapping.assets.find((item) => item.format === "som.sprite.frames")!;
  const file = initial.mapping.fileList[emission.fileIdx].name;
  const conversion = await service().convert({
    directory: fixture.directory,
    file,
    line: emission.line,
    representation: "aseprite",
  });
  const source = path.join(fixture.directory, conversion.destination);
  const document = await decodeAsepriteDocument(fs.readFileSync(source));
  const indexes = document.tilesets[0].indexes.slice();
  indexes[64] ^= 1;
  fs.writeFileSync(
    source,
    await encodeAsepriteDocument({ ...document, tilesets: [{ ...document.tilesets[0], indexes }] }),
  );
  const authored = await inspectSourceProject(fixture.directory);
  await sourceGit(fixture.directory, ["add", "--all"]);
  await sourceGit(fixture.directory, ["commit", "-m", "Author sprite directly in Aseprite"]);
  let parent = await acceptedSourceGeneration(
    fixture.repository,
    (await sourceGit(fixture.directory, ["rev-parse", "HEAD"])).stdout.toString().trim(),
  );
  for (let cycle = 1; cycle <= 2; cycle++) {
    const files = fixture.files.map((entry) =>
      entry.path === "source/main.asm"
        ? { ...entry, bytes: Buffer.from(`; Pristine generation ${cycle}\n${fixture.source}`) }
        : entry,
    );
    const incoming = await retainSourceGeneration(fixture.repository, {
      files,
      parent,
      inputs: { ...fixture.generationInputs, evidenceSha256: String(cycle).repeat(64) },
    });
    await verifySourceGeneration(fixture.repository, incoming.commit);
    const pure = await inspectSourceProject(
      fixture.directory,
      new Map(
        files
          .filter((entry) => entry.path === "source/main.asm" || entry.path === "source/sprite.png")
          .map((entry) => [entry.path, entry.bytes]),
      ),
    );
    t.true(Buffer.from(pure.output).equals(Buffer.from(fixture.original)));
    const preview = await previewSourceGeneration(fixture.repository, incoming.commit);
    t.deepEqual(preview.conflicts, []);
    await applySourceGeneration(fixture.repository, incoming, preview);
    await finishSourceGeneration(fixture.repository, {
      message: `Merge verified generation ${cycle}`,
      validate: () => buildSpriteSource(fixture.directory),
    });
    t.deepEqual((await inspectSourceProject(fixture.directory)).output, authored.output);
    t.true(fs.existsSync(source));
    t.false(fs.existsSync(path.join(fixture.directory, conversion.source)));
    parent = incoming.commit;
  }
});
