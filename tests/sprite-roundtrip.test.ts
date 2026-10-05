import fs from "node:fs";
import path from "node:path";

import { createIndexedPng } from "@uttori/asm-assets/image";
import { inspectFrameAtlas } from "@uttori/asm-assets/secret-of-mana/som-frame-atlas";
import { spritePaletteColors } from "@uttori/asm-assets/secret-of-mana/som-sprite-palettes";
import { spriteEditorBaselineResult } from "@uttori/asm-assets/sprite-editing";
import { inspectSourceProject } from "@uttori/asm-cli/source";
import {
  sourceGit,
  acceptedSourceGeneration,
  retainSourceGeneration,
  verifySourceGeneration,
  previewSourceGeneration,
  applySourceGeneration,
  finishSourceGeneration,
  abortSourceGeneration,
} from "@uttori/asm-disassembler";

import { deriveFramePlacements } from "../packages/assets/src/secret-of-mana/som-frame-composition.js";
import {
  layoutStableFrameAtlas,
  renderStableFrameAtlas,
} from "../packages/assets/src/secret-of-mana/som-frame-edit.js";
import { test } from "./ava-helper.js";
import {
  exportSpriteSession,
  planSpriteImport,
  applySpriteImport,
} from "./fixtures/sprite-roundtrip-host.js";
import {
  mutableSpriteResult,
  spriteSourceFixture,
  buildSpriteSource,
} from "./fixtures/sprite-source.js";

test("host imports combined edits into ordinary sources and verifies every ROM byte", async (t) => {
  const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup));
  const bundle = await exportSpriteSession(
    fixture.selection,
    path.join(fixture.directory, ".uttori-local/bundle.json"),
  );
  const result = mutableSpriteResult(bundle);
  const noEdit = await planSpriteImport(fixture.directory, bundle.session, result);
  t.deepEqual(noEdit.changes, []);
  t.deepEqual(noEdit.output, Uint8Array.from(fixture.original));
  result.images[0].indexes[0] ^= 1;
  result.images[1].x++;
  result.palette[1] = [16, 0, 0, 255];
  const expected = Buffer.from(fixture.original);
  expected[0x200] ^= 0x80;
  expected[0x14] = 0x81;
  expected[0x100] = 2;
  const plan = await planSpriteImport(fixture.directory, bundle.session, result);
  t.deepEqual(Buffer.from(plan.output), expected);
  t.deepEqual(plan.changedOffsets, [0x14, 0x100, 0x200]);
  t.is(plan.changes.length, 4);
  t.is(fs.readFileSync(path.join(fixture.directory, "source/main.asm"), "utf8"), fixture.source);
  await applySpriteImport(fixture.directory, bundle.session, result);
  t.regex(
    fs.readFileSync(path.join(fixture.directory, "source/main.asm"), "utf8"),
    /coordinates = \[\$80, \$81] ; keep flag bits/,
  );
  t.deepEqual(Buffer.from((await inspectSourceProject(fixture.directory)).output), expected);
  await t.throwsAsync(() => planSpriteImport(fixture.directory, bundle.session, result), {
    message: /Stale sprite session/,
  });
  const second = await exportSpriteSession(
    fixture.selection,
    path.join(fixture.directory, ".uttori-local/second.json"),
  );
  t.is(second.images[1].x, bundle.images[1].x + 1);
  t.deepEqual(second.palette[1], [16, 0, 0, 255]);
  t.deepEqual(
    (await planSpriteImport(fixture.directory, second.session, spriteEditorBaselineResult(second)))
      .changes,
    [],
  );

  await sourceGit(fixture.directory, ["add", "--all"]);
  await sourceGit(fixture.directory, ["commit", "-m", "Author sprite round trip"]);
  // Two immutable original-ROM generations add independent research comments. Native merges retain
  // the authored PNG, catalogue and typed coordinate literal without reseeding current pixels.
  for (let cycle = 1; cycle <= 2; cycle++) {
    const parent = await acceptedSourceGeneration(
      fixture.repository,
      (await sourceGit(fixture.directory, ["rev-parse", "HEAD"])).stdout.toString().trim(),
    );
    const files = fixture.files.map((file) => ({ ...file, bytes: Buffer.from(file.bytes) }));
    files.find((v) => v.path === "source/main.asm")!.bytes = Buffer.from(
      fixture.source + `\n; Research generation ${cycle}\n`,
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
          .filter((v) => !v.path.endsWith("config.json") && !v.path.endsWith("source-raw.json"))
          .map((v) => [v.path, v.bytes]),
      ),
    );
    t.deepEqual(Buffer.from(pure.output), fixture.original);
    t.deepEqual(pure.diagnostics, []);
    const preview = await previewSourceGeneration(fixture.repository, candidate.commit);
    t.deepEqual(preview.conflicts, []);
    await applySourceGeneration(fixture.repository, candidate, preview);
    await finishSourceGeneration(fixture.repository, {
      message: `Accept research ${cycle}`,
      validate: async () => {
        const verification = await buildSpriteSource(fixture.directory);
        t.deepEqual(Buffer.from((await inspectSourceProject(fixture.directory)).output), expected);
        return verification;
      },
    });
    t.regex(
      fs.readFileSync(path.join(fixture.directory, "source/main.asm"), "utf8"),
      new RegExp(`Research generation ${cycle}`),
    );
  }
  // A pure source refactor of the same coordinate owner must conflict, even when its ROM stays original.
  const parent = await acceptedSourceGeneration(
    fixture.repository,
    (await sourceGit(fixture.directory, ["rev-parse", "HEAD"])).stdout.toString().trim(),
  );
  const files = fixture.files.map((file) => ({ ...file, bytes: Buffer.from(file.bytes) }));
  files.find((v) => v.path === "source/main.asm")!.bytes = Buffer.from(
    fixture.source.replace("coordinates = [$80, $80]", "coordinates = [$80, 128]") +
      "\n; Research generation 2\n",
  );
  const conflict = await retainSourceGeneration(fixture.repository, {
    parent,
    files,
    inputs: { ...fixture.generationInputs, researchSha256: "3".repeat(64) },
  });
  await verifySourceGeneration(fixture.repository, conflict.commit);
  t.deepEqual(
    Buffer.from(
      (
        await inspectSourceProject(
          fixture.directory,
          new Map(
            files
              .filter((v) => !v.path.endsWith("config.json") && !v.path.endsWith("source-raw.json"))
              .map((v) => [v.path, v.bytes]),
          ),
        )
      ).output,
    ),
    fixture.original,
  );
  const preview = await previewSourceGeneration(fixture.repository, conflict.commit);
  t.deepEqual(preview.conflicts, ["source/main.asm"]);
  await applySourceGeneration(fixture.repository, conflict, preview);
  await abortSourceGeneration(fixture.repository);
  t.deepEqual(Buffer.from((await inspectSourceProject(fixture.directory)).output), expected);
});

test("host sessions reject unrelated dependencies and editable-envelope baseline tampering", async (t) => {
  const { directory, selection } = await spriteSourceFixture((cleanup) => t.teardown(cleanup));
  const file = path.join(directory, ".uttori-local/bundle.json");
  const bundle = await exportSpriteSession(selection, file);
  const result = spriteEditorBaselineResult(bundle);
  const forged = mutableSpriteResult(bundle);
  forged.images[0].indexes[0] ^= 1;
  fs.writeFileSync(file, JSON.stringify(forged));
  t.deepEqual((await planSpriteImport(directory, bundle.session, result)).changes, []);
  const original = path.join(directory, "source/original.bin");
  const bytes = fs.readFileSync(original);
  bytes[0x300] ^= 1;
  fs.writeFileSync(original, bytes);
  await t.throwsAsync(() => planSpriteImport(directory, bundle.session, result), {
    message: /Stale sprite session/,
  });
});

test("export refreshes retained coordinate caches from authored assembly and rejects expression owners", async (t) => {
  const { directory, selection, source } = await spriteSourceFixture((cleanup) =>
    t.teardown(cleanup),
  );
  const file = path.join(directory, "source/main.asm");
  fs.writeFileSync(file, source.replace("coordinates = [$80, $80]", "coordinates = [$80, $81]"));
  const bundle = await exportSpriteSession(
    selection,
    path.join(directory, ".uttori-local/refresh.json"),
  );
  t.is(bundle.images[1].x, 129);
  t.deepEqual(
    (await planSpriteImport(directory, bundle.session, spriteEditorBaselineResult(bundle))).changes,
    [],
  );
  fs.writeFileSync(
    file,
    source.replace("coordinates = [$80, $80]", "coordinates = [$80, $7F + 1]"),
  );
  const output = path.join(directory, ".uttori-local/unsupported.json");
  await t.throwsAsync(() => exportSpriteSession(selection, output), { message: /literal scalar/ });
  t.false(fs.existsSync(output));
});

test("continuous multi-segment emissions retain separate editor pixel owners", async (t) => {
  const { directory, selection, source, original } = await spriteSourceFixture((cleanup) =>
    t.teardown(cleanup),
  );
  const catalog = JSON.parse(fs.readFileSync(path.join(directory, selection.catalog), "utf8"));
  const layout = JSON.parse(fs.readFileSync(path.join(directory, selection.layout), "utf8"));
  const image = {
    bytes: fs.readFileSync(path.join(directory, selection.image)),
    mediaType: "image/png",
  };
  const tiles = inspectFrameAtlas(image, layout, catalog, { whole: true }).tiles.get("tiles")!;
  const segment = layout.segments.tiles;
  layout.segments = {
    left: { ...segment, tiles: segment.tiles.slice(0, 2) },
    right: { ...segment, romAddress: "C00240", tiles: segment.tiles.slice(2) },
  };
  layout.frames[0].placements = deriveFramePlacements(layout, layout.frames[0]);
  const stable = layoutStableFrameAtlas(layout);
  const rendered = renderStableFrameAtlas(
    new Map([
      ["left", tiles.slice(0, 2)],
      ["right", tiles.slice(2)],
    ]),
    stable,
  );
  const png = createIndexedPng({
    ...rendered,
    palette: [...spritePaletteColors(catalog, "C00100"), [255, 0, 255, 255]],
  });
  catalog.palettes.C00100.users[0].segments = ["left", "right"];
  for (const [file, value] of [
    [selection.catalog, catalog],
    [selection.layout, stable],
  ] as const) {
    fs.writeFileSync(path.join(directory, file), JSON.stringify(value, null, 2) + "\n");
  }
  fs.writeFileSync(path.join(directory, selection.image), png);
  fs.writeFileSync(
    path.join(directory, "source/main.asm"),
    source.replace(', segment: "tiles"', ""),
  );
  const bundle = await exportSpriteSession(
    selection,
    path.join(directory, ".uttori-local/continuous.json"),
  );
  const result = mutableSpriteResult(bundle);
  result.images[1].indexes[0] ^= 1;
  const expected = Buffer.from(original);
  expected[0x240] ^= 0x80;
  t.deepEqual(
    Buffer.from((await planSpriteImport(directory, bundle.session, result)).output),
    expected,
  );
});
