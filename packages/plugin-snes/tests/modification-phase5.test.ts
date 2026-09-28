import fs from "node:fs";
import path from "node:path";

import { pngImporter, rewriteIndexedPng, type IndexedImage } from "@uttori/asm-assets/image";
import { PluginManager, definePlugin, PLUGIN_API_VERSION } from "@uttori/asm-core/plugin";
import {
  sourceExportSha256,
  RomImage,
  analysisProjectRevision,
  validateSourceExportFiles,
  findManagedSourceFile,
} from "@uttori/asm-disassembler";
import test from "ava";

import { ownershipFixture } from "../../../tests/helpers/ownership-fixture.js";
import snesPlugin, {
  createRomModificationProject,
  addRomReplacement,
  loadRomModificationProject,
  buildModifiedRom,
  extractRomAsset,
  importRomAsset,
  applyRomPlacement,
  reviewRomRebase,
  acceptRomRebase,
  refreshRomRebaseReview,
  detachRomSource,
  exportSnes65816Source,
  reviewSourceEdit,
  restoreReviewedSource,
  removeRomReplacement,
  retainRomModificationBaseline,
  encodeOwnedAsset,
  type RomRebaseReview,
  type SourceEditReview,
} from "../src/index.js";

const fixture = async () => {
  const f = ownershipFixture();
  const manifestFile = await createRomModificationProject({
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
    directory: path.join(f.directory, "modifications"),
  });
  return { ...f, manifestFile, root: path.dirname(manifestFile) };
};

test("indexed extract/edit/import preserves palette slots and survives regeneration", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  addRomReplacement({
    manifestFile: f.manifestFile,
    id: "tiles",
    offset: 0x100,
    size: 32,
    kind: "binary",
  });
  const input = await extractRomAsset({
    manifestFile: f.manifestFile,
    id: "tiles",
    format: "snes.tile.4bpp",
    paletteOffset: 0x200,
    paletteSize: 32,
  });
  const png = fs.readFileSync(input);
  const image = pngImporter.import({ bytes: png, mediaType: "image/png" }).value as IndexedImage;
  t.is(image.palette.length, 16);
  t.deepEqual(image.palette[1], image.palette[2]); // Duplicate colors remain separate addressable slots.
  const indexes = image.indexes.slice();
  indexes[0] = (indexes[0] + 1) % 16;
  const external = path.join(f.directory, "edited.png");
  fs.writeFileSync(external, rewriteIndexedPng(png, { indexes }));
  const owned = await importRomAsset({
    manifestFile: f.manifestFile,
    id: "tiles",
    sourceFile: external,
  });
  t.not(owned, input);
  const built = await buildModifiedRom({ manifestFile: f.manifestFile });
  t.true(built.changedBytes > 0);
  t.true(fs.existsSync(input));
  exportSnes65816Source(f.snapshot, f.rom, f.sourceDirectory, {
    sourceProjectSha256: analysisProjectRevision(f.snapshot.manifest).manifestSha256,
    commentLineWidth: 40,
  });
  validateSourceExportFiles(f.sourceDirectory);
  t.is((await buildModifiedRom({ manifestFile: f.manifestFile })).outputSha256, built.outputSha256);
  const palette = [...image.palette];
  palette[0] = [255, 0, 0, 0];
  fs.writeFileSync(external, rewriteIndexedPng(png, { palette }));
  await t.throwsAsync(
    importRomAsset({ manifestFile: f.manifestFile, id: "tiles", sourceFile: external }),
    { message: /palette slots changed/ },
  );
  t.is(
    loadRomModificationProject(f.manifestFile).replacements[0].input,
    path.relative(f.root, owned),
  );
});

test("explicit growth, allocation fill and bank-qualified pointers preserve exact ownership", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const input = addRomReplacement({
    manifestFile: f.manifestFile,
    id: "data",
    offset: 0x100,
    size: 4,
    kind: "binary",
  });
  fs.writeFileSync(input, Buffer.from([1, 2, 3, 4]));
  const plan = {
    manifestSha256: sourceExportSha256(fs.readFileSync(f.manifestFile)),
    replacement: "data",
    offset: 0x10000,
    size: 8,
    fill: 0xff,
    expansion: { size: 0x20000, fill: 0xee },
    pointers: [{ id: "pointer", offset: 0x80, width: 3 as const }],
  };
  applyRomPlacement({ manifestFile: f.manifestFile, plan });
  const built = await buildModifiedRom({ manifestFile: f.manifestFile });
  const bytes = fs.readFileSync(built.outputPath);
  t.is(bytes.length, 0x20000);
  t.deepEqual([...bytes.subarray(0x10000, 0x10008)], [1, 2, 3, 4, 255, 255, 255, 255]);
  t.deepEqual([...bytes.subarray(0x80, 0x83)], [0, 0, 0xc1]);
  t.is(bytes[0x10008], 0xee);
  t.is(bytes[0x100], 0x12);
  const before = fs.readFileSync(f.manifestFile);
  t.throws(() => applyRomPlacement({ manifestFile: f.manifestFile, plan }), { message: /stale/ });
  const currentPlan = {
    ...plan,
    manifestSha256: sourceExportSha256(before),
    pointers: [{ id: "short", offset: 0x90, width: 2 as const, bank: 0xc0 }],
  };
  t.throws(() => applyRomPlacement({ manifestFile: f.manifestFile, plan: currentPlan }), {
    message: /matching CPU bank/,
  });
  t.deepEqual(fs.readFileSync(f.manifestFile), before);
  t.throws(
    () =>
      applyRomPlacement({
        manifestFile: f.manifestFile,
        plan: { ...currentPlan, pointers: [], offset: 0xffff },
      }),
    { message: /bank/ },
  );
  removeRomReplacement({ manifestFile: f.manifestFile, id: "pointer" });
  t.true(fs.existsSync(input));
  t.true(fs.readdirSync(path.join(f.root, ".history")).length > 0);
});

test("three-way rebase retains all versions and requires decisions before selecting a verified fork", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const input = addRomReplacement({
    manifestFile: f.manifestFile,
    id: "price",
    offset: 0x40,
    size: 2,
    kind: "assembly",
    value: 20,
  });
  const original = fs.readFileSync(f.manifestFile);
  const nextSource = path.join(f.directory, "new-source");
  fs.mkdirSync(nextSource);
  fs.copyFileSync(
    path.join(f.sourceDirectory, "struct-map.json"),
    path.join(nextSource, "struct-map.json"),
  );
  const bytes = Buffer.from(f.rom.read(0, f.rom.length)!);
  bytes[0x40] = 11;
  const nextRom = new RomImage(bytes, { headerSize: 0 });
  const nextFile = path.join(f.directory, "new.sfc");
  fs.writeFileSync(nextFile, bytes);
  const snapshot = { ...f.snapshot, manifest: { ...f.snapshot.manifest, rom: nextRom.identity } };
  exportSnes65816Source(snapshot, nextRom, nextSource, {
    sourceProjectSha256: analysisProjectRevision(snapshot.manifest).manifestSha256,
  });
  const reviewFile = await reviewRomRebase({
    manifestFile: f.manifestFile,
    sourceDirectory: nextSource,
    romFile: nextFile,
    directory: path.join(f.directory, "rebased"),
  });
  const review = JSON.parse(fs.readFileSync(reviewFile, "utf8")) as RomRebaseReview;
  t.is(review.conflicts[0].id, "price");
  t.is(review.conflicts[0].offset, 0x40);
  for (const file of [review.baseRom, review.ownedRom, review.newRom]) {
    t.true(fs.existsSync(file));
  }
  await t.throwsAsync(acceptRomRebase({ reviewFile }), { message: /Resolve price/ });
  fs.writeFileSync(reviewFile, JSON.stringify({ ...review, resolutions: { price: "keep-owned" } }));
  const result = await acceptRomRebase({ reviewFile });
  t.is(fs.readFileSync(result.build.outputPath).readUInt16LE(0x40), 20);
  t.deepEqual(fs.readFileSync(f.manifestFile), original);
  t.true(fs.existsSync(input));
});

test("source review preserves unsupported drafts and resolves label deletion by native owner", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  fs.writeFileSync(f.file, f.text.replace("L_Item_Price_Candy:\n", ""));
  const file = reviewSourceEdit({ manifestFile: f.manifestFile, sourceFile: f.file });
  const review = JSON.parse(fs.readFileSync(file, "utf8")) as SourceEditReview;
  t.deepEqual(review.metadata, { kind: "remove-label", id: "imported.candy" });
  t.deepEqual(fs.readFileSync(review.draftFile), fs.readFileSync(f.file));
  fs.writeFileSync(f.file, "org $c00000\ndb 42\n");
  const unsupported = JSON.parse(
    fs.readFileSync(reviewSourceEdit({ manifestFile: f.manifestFile, sourceFile: f.file }), "utf8"),
  ) as SourceEditReview;
  t.truthy(unsupported.unsupported);
  t.is(fs.readFileSync(unsupported.draftFile, "utf8"), "org $c00000\ndb 42\n");
});

test("detached source transitions ownership in a new directory and leaves its verified baseline intact", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const directory = path.join(f.directory, "detached");
  const entry = await detachRomSource({
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
    directory,
  });
  t.true(fs.existsSync(entry));
  t.false(fs.existsSync(path.join(directory, "generated-files.json")));
  t.is(findManagedSourceFile(path.join(directory, "banks/bank-000.asm")), undefined);
  t.true(fs.existsSync(path.join(directory, "detached-source.json")));
  validateSourceExportFiles(f.sourceDirectory);
});

test("asset version drift, overflow and implicit fill reject without replacing the last successful build", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  addRomReplacement({
    manifestFile: f.manifestFile,
    id: "bytes",
    offset: 0x100,
    size: 4,
    kind: "binary",
  });
  const sourceFile = path.join(f.directory, "asset.bin");
  fs.writeFileSync(sourceFile, Buffer.from([1, 2]));
  const recipe = {
    format: "uttori.data.raw",
    version: "1.0.0",
    mediaType: "application/octet-stream",
  };
  const before = fs.readFileSync(f.manifestFile);
  await t.throwsAsync(
    importRomAsset({ manifestFile: f.manifestFile, id: "bytes", sourceFile, recipe }),
    { message: /Declare fill/ },
  );
  await t.throwsAsync(
    importRomAsset({
      manifestFile: f.manifestFile,
      id: "bytes",
      sourceFile,
      recipe: { ...recipe, version: "missing" },
    }),
    { message: /unavailable or changed/ },
  );
  t.deepEqual(fs.readFileSync(f.manifestFile), before);
  const input = await importRomAsset({
    manifestFile: f.manifestFile,
    id: "bytes",
    sourceFile,
    recipe,
    fill: 0xee,
  });
  const valid = await buildModifiedRom({ manifestFile: f.manifestFile });
  t.deepEqual([...fs.readFileSync(valid.outputPath).subarray(0x100, 0x104)], [1, 2, 238, 238]);
  const pointer = fs.readFileSync(path.join(f.root, "build/current.json"));
  fs.writeFileSync(input, Buffer.alloc(5));
  await t.throwsAsync(buildModifiedRom({ manifestFile: f.manifestFile }), {
    message: /allocation/,
  });
  t.deepEqual(fs.readFileSync(path.join(f.root, "build/current.json")), pointer);
});

test("explicit transform extraction and reencoding pin versions and reject a lossy codec", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const manager = new PluginManager();
  const plugin = definePlugin({
    manifest: {
      id: "test.asset-edit",
      name: "Asset edit fixture",
      version: "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
      requires: [{ pluginId: "uttori.asm-plugin-snes", version: "1.0.0" }],
    },
    activate(context) {
      context.registerAssetTransform({
        id: "test.xor",
        version: "1.0.0",
        targets: ["snes.sfc"],
        encode: (bytes) => bytes.map((byte) => byte ^ 255),
        decode: (bytes) => bytes.map((byte) => byte ^ 255),
      });
      context.registerAssetTransform({
        id: "test.lossy",
        version: "1.0.0",
        targets: ["snes.sfc"],
        encode: (bytes) => bytes.map(() => 0),
        decode: (bytes) => bytes,
      });
    },
  });
  await manager.activatePlugins([{ plugin: snesPlugin }, { plugin }]);
  const environment = manager.freeze();
  t.teardown(() => manager.dispose());
  addRomReplacement({
    manifestFile: f.manifestFile,
    id: "compressed",
    offset: 0x100,
    size: 4,
    kind: "binary",
  });
  const loadEnvironment = async () => ({ environment });
  const input = await extractRomAsset({
    manifestFile: f.manifestFile,
    id: "compressed",
    format: "uttori.data.raw",
    transforms: [{ id: "test.xor", version: "1.0.0" }],
    loadEnvironment,
  });
  t.deepEqual([...fs.readFileSync(input)], [237, 237, 237, 237]);
  t.is((await buildModifiedRom({ manifestFile: f.manifestFile, loadEnvironment })).changedBytes, 0);
  fs.writeFileSync(input, Buffer.from([1, 2, 3, 4]));
  const built = await buildModifiedRom({ manifestFile: f.manifestFile, loadEnvironment });
  t.deepEqual([...fs.readFileSync(built.outputPath).subarray(0x100, 0x104)], [254, 253, 252, 251]);
  t.throws(
    () =>
      encodeOwnedAsset(
        Uint8Array.of(1),
        {
          format: "uttori.data.raw",
          version: "1.0.0",
          mediaType: "application/octet-stream",
          transforms: [{ id: "test.lossy", version: "1.0.0" }],
        },
        environment,
        () => {
          throw new Error("Unexpected resource");
        },
      ),
    { message: /exact decode/ },
  );
});

test("phase-4 upgrade can recover its intact publication while preserving edited live source", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const project = loadRomModificationProject(f.manifestFile);
  const retained = path.join(f.directory, "retained");
  fs.renameSync(path.join(f.root, project.baseline.snapshotDirectory!), retained);
  const { snapshotDirectory: _snapshot, ...baseline } = project.baseline;
  fs.writeFileSync(f.manifestFile, JSON.stringify({ ...project, baseline }));
  fs.writeFileSync(
    path.join(f.sourceDirectory, ".uttori-publication.json"),
    JSON.stringify({
      id: "upgrade",
      phase: "published",
      candidate: path.join(retained, "source"),
      previous: path.join(retained, "source"),
    }),
  );
  const edited = f.text.replace("L_Item_Price_Candy:\n", "");
  fs.writeFileSync(f.file, edited);
  const result = await retainRomModificationBaseline({ manifestFile: f.manifestFile });
  t.true(fs.existsSync(path.join(result, "source/generated-files.json")));
  t.is(fs.readFileSync(f.file, "utf8"), edited);
  t.is(
    loadRomModificationProject(f.manifestFile).baseline.manifestSha256,
    project.baseline.manifestSha256,
  );
});

test("unsupported source can become detached ownership or be restored without losing its draft", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const edited = f.text + "; standalone manual note\n";
  fs.writeFileSync(f.file, edited);
  const reviewFile = reviewSourceEdit({ manifestFile: f.manifestFile, sourceFile: f.file });
  const reviewSha256 = sourceExportSha256(fs.readFileSync(reviewFile));
  const directory = path.join(f.directory, "detached-edit");
  await detachRomSource({
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
    directory,
    draft: { reviewFile, sha256: reviewSha256 },
  });
  t.is(fs.readFileSync(path.join(directory, "banks/bank-000.asm"), "utf8"), edited);
  t.is(fs.readFileSync(f.file, "utf8"), edited);
  const restored = await restoreReviewedSource({ reviewFile, reviewSha256 });
  t.true(restored.verified);
  t.is(fs.readFileSync(f.file, "utf8"), f.text);
  const review = JSON.parse(fs.readFileSync(reviewFile, "utf8")) as SourceEditReview;
  t.is(fs.readFileSync(review.draftFile, "utf8"), edited);
});

test("rebase refresh accepts reviewed manual resolution of renamed baseline symbols", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const input = addRomReplacement({
    manifestFile: f.manifestFile,
    id: "reference",
    offset: 0x100,
    size: 3,
    kind: "assembly",
  });
  fs.writeFileSync(input, "dl L_Item_Price_Candy\n");
  const snapshot = {
    ...f.snapshot,
    shards: {
      ...f.snapshot.shards,
      labels: f.snapshot.shards.labels.map((entry) => ({ ...entry, sourceName: "RenamedCandy" })),
    },
  };
  exportSnes65816Source(snapshot, f.rom, f.sourceDirectory, {
    sourceProjectSha256: analysisProjectRevision(snapshot.manifest).manifestSha256,
  });
  const reviewFile = await reviewRomRebase({
    manifestFile: f.manifestFile,
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
    directory: path.join(f.directory, "renamed-rebase"),
  });
  const review = JSON.parse(fs.readFileSync(reviewFile, "utf8")) as RomRebaseReview;
  t.truthy(review.buildError);
  fs.writeFileSync(
    reviewFile,
    JSON.stringify({ ...review, resolutions: { reference: "keep-owned" } }),
  );
  const newInput = path.join(path.dirname(reviewFile), "inputs/reference.asm");
  fs.writeFileSync(newInput, "dl RenamedCandy\n");
  await t.throwsAsync(acceptRomRebase({ reviewFile }), { message: /changed after review/ });
  await refreshRomRebaseReview({
    reviewFile,
    reviewSha256: sourceExportSha256(fs.readFileSync(reviewFile)),
  });
  const refreshed = JSON.parse(fs.readFileSync(reviewFile, "utf8")) as RomRebaseReview;
  t.falsy(refreshed.buildError);
  t.deepEqual(refreshed.editedInputs, ["inputs/reference.asm"]);
  const result = await acceptRomRebase({ reviewFile });
  t.deepEqual(
    [...fs.readFileSync(result.build.outputPath).subarray(0x100, 0x103)],
    [0x20, 0, 0xc0],
  );
  t.is(fs.readFileSync(input, "utf8"), "dl L_Item_Price_Candy\n");
});

test("take-baseline rebase decisions remain replayable after acceptance receipt loss", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  addRomReplacement({
    manifestFile: f.manifestFile,
    id: "price",
    offset: 0x40,
    size: 2,
    kind: "assembly",
    value: 20,
  });
  const snapshot = {
    ...f.snapshot,
    shards: {
      ...f.snapshot.shards,
      labels: f.snapshot.shards.labels.map((entry) => ({ ...entry, sourceName: "RenamedCandy" })),
    },
  };
  exportSnes65816Source(snapshot, f.rom, f.sourceDirectory, {
    sourceProjectSha256: analysisProjectRevision(snapshot.manifest).manifestSha256,
  });
  const reviewFile = await reviewRomRebase({
    manifestFile: f.manifestFile,
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
    directory: path.join(f.directory, "take-baseline"),
  });
  const review = JSON.parse(fs.readFileSync(reviewFile, "utf8")) as RomRebaseReview;
  fs.writeFileSync(
    reviewFile,
    JSON.stringify({ ...review, resolutions: { price: "take-baseline" } }),
  );
  const accepted = await acceptRomRebase({ reviewFile });
  t.is(loadRomModificationProject(accepted.manifestFile).replacements.length, 0);
  fs.unlinkSync(path.join(path.dirname(reviewFile), "rebase-accepted.json"));
  const replay = await acceptRomRebase({ reviewFile });
  t.is(replay.build.changedBytes, 0);
  t.is(loadRomModificationProject(f.manifestFile).replacements.length, 1);
});
