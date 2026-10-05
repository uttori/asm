import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { asepriteAtlasCodec } from "@uttori/asm-assets/aseprite";
import { createIndexedPng } from "@uttori/asm-assets/image";
import type { SpritePaletteCatalog } from "@uttori/asm-assets/secret-of-mana/som-sprite-palettes";
import type { FrameLayout } from "@uttori/asm-assets/secret-of-mana/som-types";
import {
  AssetInterchangeService,
  asepriteRasterCodec,
  somSpriteSourceAdapter,
  type SomSpriteSelection,
} from "@uttori/asm-cli/asset-interchange";
import { executeSourceOperation, inspectSourceProject } from "@uttori/asm-cli/source";
import { sourceContentHash, sourceGit } from "@uttori/asm-disassembler";

const originalSha256 = "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f";

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

/** Private fixture selection includes every declared palette consumer for ownership auditing. */
function selection(root: string): SomSpriteSelection {
  const catalog = "disassembly/assets/palettes/rom-palettes.json";
  const palettes = fixtureJson<SpritePaletteCatalog>(path.join(root, catalog));
  const users = new Set(
    Object.values(palettes.palettes).flatMap((bank) =>
      (bank.users ?? []).map((user) => user.atlas),
    ),
  );
  return {
    image: "disassembly/assets/images/enemy/rabite-frames.png",
    layout: "disassembly/assets/images/enemy/rabite-frames.layout.json",
    catalog,
    atlasId: "enemy/rabite-frames.png",
    atlases: [...users].toSorted().map((id) => ({
      id,
      image: "disassembly/assets/images/" + id,
      layout: "disassembly/assets/images/" + id.replace(/\.png$/, ".layout.json"),
    })),
  };
}

/** Independent full-ROM oracle: preserve the earlier body edit, replace only two known native bytes. */
function expectedRom(root: string): Uint8Array {
  const original = fs.readFileSync(path.join(root, "Secret of Mana (USA).sfc"));
  assert.equal(sourceContentHash(original), originalSha256);
  assert.equal(original[0x196540], 0);
  assert.equal(original[0x81000], 0);
  assert.equal(original[0x133d2a], 0x6c);
  const expected = Uint8Array.from(original);
  expected[0x81000] = 2;
  expected[0x133d2a] = 0x6d;
  return expected;
}

/** Prepare inspectable saved files without changing the clone's assembling sources. */
async function prepare(root: string, outputs: string): Promise<void> {
  const selected = selection(root);
  const before = await inspectSourceProject(root);
  assert.deepEqual(before.diagnostics, []);
  const previous = expectedRom(root);
  previous[0x196540] = 0x80;
  previous[0x81000] = 1;
  assert.deepEqual(before.output, previous);
  const times = [selected.image, selected.layout, selected.catalog].map(
    (name) => fs.statSync(path.join(root, name)).mtimeMs,
  );
  const service = new AssetInterchangeService(root, somSpriteSourceAdapter, asepriteRasterCodec);
  await service.export(selected, {
    document: path.join(outputs, "rabite.aseprite"),
    manifest: path.join(outputs, "rabite.interchange.json"),
  });
  writeJson(path.join(outputs, "selection.json"), selected);
  const document = await asepriteAtlasCodec.decode(
    fs.readFileSync(path.join(outputs, "rabite.aseprite")),
  );
  const layout = fixtureJson<FrameLayout>(path.join(root, selected.layout));
  assert.ok(Object.values(layout.segments)[0].tiles.length);
  const indexes = document.indexes.slice();
  // The complete raster inventory starts with the first native owner, regardless of packed source PNG coordinates.
  const offset = 0;
  assert.equal(indexes[offset], 1);
  indexes[offset] = 0;
  const palette = document.palette.map((color): [number, number, number, number] => [...color]);
  assert.deepEqual(palette[1], [8, 0, 0, 255]);
  palette[1] = [16, 0, 0, 255];
  for (const [name, value] of [
    ["pixel", { ...document, indexes }],
    ["palette", { ...document, palette }],
    ["edited", { ...document, indexes, palette }],
  ] as const) {
    fs.writeFileSync(
      path.join(outputs, `rabite-${name}.aseprite`),
      await asepriteAtlasCodec.encode(value),
      { flag: "wx" },
    );
  }
  fs.writeFileSync(path.join(outputs, "rabite-before.png"), createIndexedPng(document));
  fs.writeFileSync(
    path.join(outputs, "rabite-after.png"),
    createIndexedPng({ ...document, indexes, palette }),
  );
  assert.deepEqual(
    times,
    [selected.image, selected.layout, selected.catalog].map(
      (name) => fs.statSync(path.join(root, name)).mtimeMs,
    ),
  );
  writeJson(path.join(outputs, "oracle.json"), {
    originalSha256,
    beforeSha256: sourceContentHash(before.output),
    expectedSha256: sourceContentHash(expectedRom(root)),
    changedOffsets: [0x81000, 0x196540],
    preservedBodyOffset: 0x133d2a,
    editorVersion: "1.3.18.6-arm64",
  });
  console.log(
    "exported Rabite files and before/after previews; source modification times retained",
  );
}

/** Check actual editor-saved files and independently specified native byte changes before application. */
async function verify(root: string, outputs: string, apply: boolean): Promise<void> {
  const selected = selection(root);
  const manifest: unknown = fixtureJson(path.join(outputs, "rabite.interchange.json"));
  const saved = fs.readFileSync(path.join(outputs, "rabite-editor-saved.aseprite"));
  assert.deepEqual(
    await asepriteAtlasCodec.decode(saved),
    await asepriteAtlasCodec.decode(fs.readFileSync(path.join(outputs, "rabite.aseprite"))),
  );
  const service = new AssetInterchangeService(root, somSpriteSourceAdapter, asepriteRasterCodec);
  const noEdit = await service.review(manifest, path.join(outputs, "rabite-editor-saved.aseprite"));
  assert.deepEqual(noEdit.files, []);
  const before = (await inspectSourceProject(root)).output;
  for (const [name, offset] of [
    ["pixel", 0x196540],
    ["palette", 0x81000],
  ] as const) {
    const result = await service.review(manifest, path.join(outputs, `rabite-${name}.aseprite`));
    const expected = before.slice();
    expected[offset] = expectedRom(root)[offset];
    assert.equal(result.outputSha256, sourceContentHash(expected));
  }
  const edited = path.join(outputs, "rabite-edited-editor-saved.aseprite");
  assert.deepEqual(
    await asepriteAtlasCodec.decode(fs.readFileSync(edited)),
    await asepriteAtlasCodec.decode(fs.readFileSync(path.join(outputs, "rabite-edited.aseprite"))),
  );
  const plan = await service.review(manifest, edited);
  assert.equal(plan.outputSha256, sourceContentHash(expectedRom(root)));
  assert.ok(plan.files.every((change) => !change.path.endsWith(".asm")));
  writeJson(path.join(outputs, "import-review.json"), plan);
  if (apply) {
    await service.apply(manifest, edited, plan.id);
    assert.deepEqual((await inspectSourceProject(root)).output, expectedRom(root));
    await sourceGit(root, ["add", "--", ...plan.files.map((change) => change.path)]);
    await sourceGit(root, ["commit", "-m", "Import saved Rabite raster pixel and palette edits"]);
    await service.export(selected, {
      document: path.join(outputs, "rabite-reexported.aseprite"),
      manifest: path.join(outputs, "rabite-reexported.interchange.json"),
    });
    await verifyReexport(root, outputs);
  }
  console.log("actual saved-file no-op, pixel, palette and combined full-ROM oracles verified");
}

/** Derived poses refresh on import; compare authoritative tiles rather than requiring stale preview pixels. */
async function verifyReexport(root: string, outputs: string): Promise<void> {
  const selected = selection(root);
  const reexport = await asepriteAtlasCodec.decode(
    fs.readFileSync(path.join(outputs, "rabite-reexported.aseprite")),
  );
  const imported = await asepriteAtlasCodec.decode(
    fs.readFileSync(path.join(outputs, "rabite-edited-editor-saved.aseprite")),
  );
  assert.equal(reexport.width, imported.width);
  assert.equal(reexport.height, imported.height);
  assert.deepEqual(reexport.palette, imported.palette);
  assert.deepEqual(reexport.indexes, imported.indexes);
  // Preserve the original editor preview if this verification is resumed after application.
  if (!fs.existsSync(path.join(outputs, "rabite-edited-preview.png"))) {
    fs.copyFileSync(
      path.join(outputs, "rabite-after.png"),
      path.join(outputs, "rabite-edited-preview.png"),
    );
  }
  fs.writeFileSync(path.join(outputs, "rabite-after.png"), createIndexedPng(reexport));
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

/** Runtime guards keep native operation reports from becoming unchecked assertions about generation. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Two immutable original-ROM generations merge through native previews, retaining accepted file edits. */
async function regenerate(root: string, outputs: string): Promise<void> {
  assert.deepEqual((await inspectSourceProject(root)).output, expectedRom(root));
  const report: unknown[] = [];
  for (let cycle = 1; cycle <= 2; cycle++) {
    const text = `Atlas file regeneration verification ${cycle}`;
    const research = ".uttori/research/atlas-file-spike.json";
    writeJson(path.join(root, research), {
      format: "uttori-research",
      version: 1,
      project: "secret-of-mana",
      romSha256: originalSha256,
      decisions: [
        {
          id: "manual.comment.atlas-file-spike",
          collection: "comments",
          value: {
            id: "manual.comment.atlas-file-spike",
            addressSpace: "rom.file",
            address: 0,
            placement: "before",
            text,
            evidence: [],
          },
        },
      ],
    });
    await sourceGit(root, ["add", "--", research]);
    await sourceGit(root, ["commit", "-m", `Declare atlas-file research ${cycle}`]);
    const prepared: unknown = await executeSourceOperation({
      directory: root,
      action: "prepare",
      onProgress: console.log,
    });
    if (
      !isRecord(prepared) ||
      !isRecord(prepared.generation) ||
      typeof prepared.generation.commit !== "string" ||
      !isRecord(prepared.verification)
    ) {
      throw new Error("Missing native generation verification.");
    }
    assert.equal(prepared.verification.outputSha256, originalSha256);
    const candidate = prepared.generation.commit;
    const preview: unknown = await executeSourceOperation({
      directory: root,
      action: "preview",
      candidate,
    });
    assert.ok(isRecord(preview));
    assert.deepEqual(
      preview.conflicts,
      [],
      "Review native conflicts before continuing; never accept a whole side automatically.",
    );
    const applied: unknown = await executeSourceOperation({
      directory: root,
      action: "apply",
      candidate,
    });
    if (isRecord(applied) && applied.phase === "merging") {
      await executeSourceOperation({
        directory: root,
        action: "finish",
        message: `Verify atlas-file import through generation ${cycle}`,
      });
    }
    const build = await inspectSourceProject(root);
    assert.deepEqual(build.diagnostics, []);
    assert.deepEqual(build.output, expectedRom(root));
    assert.ok(
      fs.readFileSync(path.join(root, "disassembly/banks/bank-000.asm"), "utf8").includes(text),
    );
    report.push({
      cycle,
      candidate,
      pureOutputSha256: prepared.verification.outputSha256,
      editedOutputSha256: sourceContentHash(build.output),
    });
    writeJson(path.join(outputs, "regeneration.json"), report);
    console.log(`cycle ${cycle}: pure ROM, merged atlas edits and independent research verified`);
  }
}

/** This fixture deliberately refuses the live source project; editor save verification is a separate shell step. */
async function main(): Promise<void> {
  const [rootArgument, outputsArgument, phase] = process.argv.slice(2);
  assert.ok(
    rootArgument && outputsArgument,
    "Use <isolated-clone> <example-output-directory> <prepare|verify|apply|reexport|regenerate>.",
  );
  const root = fs.realpathSync(rootArgument);
  assert.notEqual(root, fs.realpathSync(path.resolve("secret-of-mana")));
  const marker: unknown = fixtureJson(path.join(root, ".verification/aseprite-spike.json"));
  assert.ok(
    isRecord(marker) && marker.isolated === true,
    "Use only the prepared isolated spike clone.",
  );
  const outputs = path.resolve(outputsArgument);
  fs.mkdirSync(outputs, { recursive: true });
  if (phase === "prepare") {
    await prepare(root, outputs);
  } else if (phase === "verify" || phase === "apply") {
    await verify(root, outputs, phase === "apply");
  } else if (phase === "regenerate") {
    await regenerate(root, outputs);
  } else if (phase === "reexport") {
    await verifyReexport(root, outputs);
  } else {
    throw new Error("Choose prepare, verify, apply, reexport or regenerate.");
  }
}

await main();
