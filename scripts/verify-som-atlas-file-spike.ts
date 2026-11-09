import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { asepriteAtlasCodec } from "@uttori/asm-assets/aseprite";
import { createIndexedPng } from "@uttori/asm-assets/image";
import type { FrameLayout } from "@uttori/asm-assets/secret-of-mana/som-types";
import {
  acceptedSourceGeneration,
  applySourceGeneration,
  finishSourceGeneration,
  previewSourceGeneration,
  readSourceBlobs,
  retainSourceGeneration,
  sourceContentHash,
  sourceGit,
  sourceRepository,
  verifySourceGeneration,
} from "@uttori/asm-disassembler/source-project";
import { somSpriteSourceAdapter } from "@uttori/asm-game-secret-of-mana/workflows";
import {
  AssetInterchangeService,
  asepriteRasterCodec,
} from "@uttori/asm-workflows/asset-interchange";
import { inspectSourceProject } from "@uttori/asm-workflows/source";

import {
  buildSpriteSource,
  createSpriteSourceFixture,
  spriteSourceSelection as selected,
} from "../tests/fixtures/sprite-source.js";

const markerFile = ".uttori-local/atlas-file-spike.json";
const originalFile = ".uttori-local/original.sfc";
// Byte offsets in the synthetic ROM, independent of the conversion and debug maps.
const paletteOffset = 0x100;
const pixelOffset = 0x200;
const priorEditOffset = 0x7000;

/** Read trusted fixture declarations, never editor-supplied source authority. */
// Fixture callers declare known local schemas; editor-supplied inputs use separate runtime validators.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
function fixtureJson<T>(file: string): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

/** Store evidence separately from editable source; reports never contain ROM payloads. */
function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

/** Independent ROM oracle for an authored byte outside the sprite and palette owners. */
function authoredRom(original: Buffer): Buffer {
  const expected = Buffer.from(original);
  expected[priorEditOffset] ^= 1;
  return expected;
}

/** Compose exact expected native bytes without the asset converters under verification. */
function expectedRom(original: Buffer): Buffer {
  const expected = authoredRom(original);
  expected[paletteOffset] = 2;
  expected[pixelOffset] ^= 0x80;
  return expected;
}

/** Export inspectable editor files without changing the fixture's assembling sources. */
async function prepare(root: string, outputs: string, original: Buffer): Promise<void> {
  const before = await inspectSourceProject(root);
  assert.deepEqual(before.diagnostics, []);
  assert.deepEqual(Buffer.from(before.output), authoredRom(original));
  const times = [selected.image, selected.layout, selected.catalog].map(
    (name) => fs.statSync(path.join(root, name)).mtimeMs,
  );
  const service = new AssetInterchangeService(root, somSpriteSourceAdapter, asepriteRasterCodec);
  await service.export(selected, {
    document: path.join(outputs, "sprite.aseprite"),
    manifest: path.join(outputs, "sprite.interchange.json"),
  });
  writeJson(path.join(outputs, "selection.json"), selected);
  const document = await asepriteAtlasCodec.decode(
    fs.readFileSync(path.join(outputs, "sprite.aseprite")),
  );
  const layout = fixtureJson<FrameLayout>(path.join(root, selected.layout));
  assert.ok(Object.values(layout.segments)[0].tiles.length);
  const indexes = document.indexes.slice();
  // The complete raster inventory starts with the first native owner, regardless of packed source PNG coordinates.
  const offset = 0;
  assert.equal(indexes[offset], 0);
  indexes[offset] = 1;
  const palette = document.palette.map((color): [number, number, number, number] => [...color]);
  assert.deepEqual(palette[1], [8, 0, 0, 255]);
  palette[1] = [16, 0, 0, 255];
  for (const [name, value] of [
    ["pixel", { ...document, indexes }],
    ["palette", { ...document, palette }],
    ["edited", { ...document, indexes, palette }],
  ] as const) {
    fs.writeFileSync(
      path.join(outputs, `sprite-${name}.aseprite`),
      await asepriteAtlasCodec.encode(value),
      { flag: "wx" },
    );
  }
  fs.writeFileSync(path.join(outputs, "sprite-before.png"), createIndexedPng(document));
  fs.writeFileSync(
    path.join(outputs, "sprite-after.png"),
    createIndexedPng({ ...document, indexes, palette }),
  );
  assert.deepEqual(
    times,
    [selected.image, selected.layout, selected.catalog].map(
      (name) => fs.statSync(path.join(root, name)).mtimeMs,
    ),
  );
  writeJson(path.join(outputs, "oracle.json"), {
    originalSha256: sourceContentHash(original),
    beforeSha256: sourceContentHash(before.output),
    expectedSha256: sourceContentHash(expectedRom(original)),
    changedOffsets: [paletteOffset, pixelOffset],
    preservedAuthoredOffset: priorEditOffset,
  });
  console.log(
    "exported fixture files and before/after previews; source modification times retained",
  );
}

/** Check actual editor-saved files and independently specified native byte changes before application. */
async function verify(
  root: string,
  outputs: string,
  original: Buffer,
  apply: boolean,
): Promise<void> {
  const manifest: unknown = fixtureJson(path.join(outputs, "sprite.interchange.json"));
  const saved = fs.readFileSync(path.join(outputs, "sprite-editor-saved.aseprite"));
  assert.deepEqual(
    await asepriteAtlasCodec.decode(saved),
    await asepriteAtlasCodec.decode(fs.readFileSync(path.join(outputs, "sprite.aseprite"))),
  );
  const service = new AssetInterchangeService(root, somSpriteSourceAdapter, asepriteRasterCodec);
  const noEdit = await service.review(manifest, path.join(outputs, "sprite-editor-saved.aseprite"));
  assert.deepEqual(noEdit.files, []);
  const before = (await inspectSourceProject(root)).output;
  for (const [name, offset] of [
    ["pixel", pixelOffset],
    ["palette", paletteOffset],
  ] as const) {
    const result = await service.review(manifest, path.join(outputs, `sprite-${name}.aseprite`));
    const expected = before.slice();
    expected[offset] = expectedRom(original)[offset];
    assert.equal(result.outputSha256, sourceContentHash(expected));
  }
  const edited = path.join(outputs, "sprite-edited-editor-saved.aseprite");
  assert.deepEqual(
    await asepriteAtlasCodec.decode(fs.readFileSync(edited)),
    await asepriteAtlasCodec.decode(fs.readFileSync(path.join(outputs, "sprite-edited.aseprite"))),
  );
  const plan = await service.review(manifest, edited);
  assert.equal(plan.outputSha256, sourceContentHash(expectedRom(original)));
  assert.ok(plan.files.every((change) => !change.path.endsWith(".asm")));
  writeJson(path.join(outputs, "import-review.json"), plan);
  if (apply) {
    await service.apply(manifest, edited, plan.id);
    assert.deepEqual(Buffer.from((await inspectSourceProject(root)).output), expectedRom(original));
    await sourceGit(root, ["add", "--", ...plan.files.map((change) => change.path)]);
    await sourceGit(root, ["commit", "-m", "Import saved fixture pixel and palette edits"]);
    await service.export(selected, {
      document: path.join(outputs, "sprite-reexported.aseprite"),
      manifest: path.join(outputs, "sprite-reexported.interchange.json"),
    });
    await verifyReexport(root, outputs);
  }
  console.log("actual saved-file no-op, pixel, palette and combined full-ROM oracles verified");
}

/** Derived poses refresh on import; compare authoritative tiles rather than requiring stale preview pixels. */
async function verifyReexport(root: string, outputs: string): Promise<void> {
  const reexport = await asepriteAtlasCodec.decode(
    fs.readFileSync(path.join(outputs, "sprite-reexported.aseprite")),
  );
  const imported = await asepriteAtlasCodec.decode(
    fs.readFileSync(path.join(outputs, "sprite-edited-editor-saved.aseprite")),
  );
  assert.equal(reexport.width, imported.width);
  assert.equal(reexport.height, imported.height);
  assert.deepEqual(reexport.palette, imported.palette);
  assert.deepEqual(reexport.indexes, imported.indexes);
  // Preserve the original editor preview if this verification is resumed after application.
  if (!fs.existsSync(path.join(outputs, "sprite-edited-preview.png"))) {
    fs.copyFileSync(
      path.join(outputs, "sprite-after.png"),
      path.join(outputs, "sprite-edited-preview.png"),
    );
  }
  fs.writeFileSync(path.join(outputs, "sprite-after.png"), createIndexedPng(reexport));
  writeJson(path.join(outputs, "reexport.json"), {
    nativeOwners: Object.values(
      fixtureJson<FrameLayout>(path.join(root, selected.layout)).segments,
    ).reduce((count, segment) => count + segment.tiles.length, 0),
    authoritativePixelsAndPalette: "exact",
    refreshedDerivedPixels: reexport.indexes.reduce(
      (count, slot, index) => count + Number(slot !== imported.indexes[index]),
      0,
    ),
    outputSha256: sourceContentHash((await inspectSourceProject(root)).output),
  });
}

/** Merge two independently checked fixture generations, preserving the imported files. */
async function regenerate(root: string, outputs: string, original: Buffer): Promise<void> {
  assert.deepEqual(Buffer.from((await inspectSourceProject(root)).output), expectedRom(original));
  const repository = await sourceRepository(root);
  const head = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  let parent = await acceptedSourceGeneration(repository, head);
  const baseline = await verifySourceGeneration(repository, parent);
  const blobs = await readSourceBlobs(
    repository,
    baseline.files.map(({ blob }) => blob),
  );
  const files = baseline.files.map((file) => ({
    path: file.path,
    bytes: blobs.get(file.blob)!,
    executable: file.mode === "100755",
  }));
  const report = [];
  for (let cycle = 1; cycle <= 2; cycle++) {
    const text = `Atlas file regeneration verification ${cycle}`;
    // Derive each generation from the immutable baseline so working atlas edits cannot enter it.
    const generated = files.map((file) =>
      file.path === "source/main.asm"
        ? {
            ...file,
            bytes: Buffer.concat([
              file.bytes,
              Buffer.from(`
; ${text}
`),
            ]),
          }
        : file,
    );
    const candidate = await retainSourceGeneration(repository, {
      parent,
      files: generated,
      inputs: {
        ...baseline.descriptor.inputs,
        researchSha256: sourceContentHash(Buffer.from(text)),
      },
    });
    await verifySourceGeneration(repository, candidate.commit);
    const pure = await inspectSourceProject(
      root,
      new Map(
        generated
          .filter(({ path }) => !path.endsWith("config.json") && !path.endsWith("source-raw.json"))
          .map(({ path, bytes }) => [path, bytes]),
      ),
    );
    assert.deepEqual(pure.diagnostics, []);
    assert.deepEqual(Buffer.from(pure.output), original);

    const preview = await previewSourceGeneration(repository, candidate.commit);
    assert.deepEqual(preview.conflicts, [], "Review native conflicts before continuing.");
    await applySourceGeneration(repository, candidate, preview);
    await finishSourceGeneration(repository, {
      message: `Verify atlas-file import through generation ${cycle}`,
      validate: () => buildSpriteSource(root),
    });
    const build = await inspectSourceProject(root);
    assert.deepEqual(build.diagnostics, []);
    assert.deepEqual(Buffer.from(build.output), expectedRom(original));
    assert.ok(fs.readFileSync(path.join(root, "source/main.asm"), "utf8").includes(text));
    report.push({
      cycle,
      candidate: candidate.commit,
      pureOutputSha256: sourceContentHash(pure.output),
      editedOutputSha256: sourceContentHash(build.output),
    });
    writeJson(path.join(outputs, "regeneration.json"), report);
    parent = candidate.commit;
    console.log(`cycle ${cycle}: pure fixture ROM and merged atlas edits verified`);
  }
}

/** Only prepare can initialize a fixture. Resumed phases require its marker and original hash. */
async function main(): Promise<void> {
  const [rootArgument, outputsArgument, phase] = process.argv.slice(2);
  assert.ok(
    rootArgument && outputsArgument,
    "Use <fixture-directory> <example-output-directory> <prepare|verify|apply|reexport|regenerate>.",
  );
  const outputs = path.resolve(outputsArgument);
  if (phase === "prepare") {
    // An exclusive directory creation prevents initialization over any existing checkout.
    const root = path.resolve(rootArgument);
    fs.mkdirSync(root);
    const { original } = await createSpriteSourceFixture(root);
    fs.writeFileSync(path.join(root, "source/original.bin"), authoredRom(original));
    await sourceGit(root, ["add", "--", "source/original.bin"]);
    await sourceGit(root, ["commit", "-m", "Author an independent fixture byte"]);
    writeJson(path.join(root, markerFile), {
      format: "uttori-atlas-file-spike-fixture",
      originalSha256: sourceContentHash(original),
    });
    fs.mkdirSync(outputs, { recursive: true });
    await prepare(root, outputs, original);
    return;
  }

  const root = fs.realpathSync(rootArgument);
  const marker = fixtureJson<{ format?: string; originalSha256?: string }>(
    path.join(root, markerFile),
  );
  assert.equal(
    marker?.format,
    "uttori-atlas-file-spike-fixture",
    "Run prepare to create the fixture.",
  );
  const original = fs.readFileSync(path.join(root, originalFile));
  assert.equal(sourceContentHash(original), marker.originalSha256, "Fixture ROM changed.");
  if (phase === "verify" || phase === "apply") {
    await verify(root, outputs, original, phase === "apply");
  } else if (phase === "regenerate") {
    await regenerate(root, outputs, original);
  } else if (phase === "reexport") {
    await verifyReexport(root, outputs);
  } else {
    throw new Error("Choose prepare, verify, apply, reexport or regenerate.");
  }
}

await main();
