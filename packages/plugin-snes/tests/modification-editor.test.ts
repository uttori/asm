import fs from "node:fs";
import path from "node:path";

import test from "ava";

import { ownershipFixture } from "../../../tests/helpers/ownership-fixture.js";
import {
  createRomModificationProject,
  addRomReplacement,
  extractRomAsset,
  loadRomModificationProject,
  buildModifiedRom,
  readRomEditor,
  previewRomEditor,
  saveRomEditor,
} from "../src/index.js";

async function fixture() {
  const f = ownershipFixture();
  const manifestFile = await createRomModificationProject({
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
    directory: path.join(f.directory, "modifications"),
  });
  return { ...f, manifestFile };
}

test("visual numeric draft validates before saving, preserves original input and rejects stale previews", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const input = addRomReplacement({
    manifestFile: f.manifestFile,
    id: "table",
    offset: 0x100,
    size: 4,
    kind: "binary",
  });
  const saved = readRomEditor({ manifestFile: f.manifestFile, id: "table" });
  const review = await previewRomEditor({
    manifestFile: f.manifestFile,
    id: "table",
    ...saved,
    document: { kind: "bytes", values: [1, 2, 3, 4] },
  });
  t.deepEqual([...fs.readFileSync(input)], [0x12, 0x12, 0x12, 0x12]);
  const next = saveRomEditor({ manifestFile: f.manifestFile, reviewId: review.id });
  t.deepEqual([...fs.readFileSync(next)], [1, 2, 3, 4]);
  fs.unlinkSync(path.join(path.dirname(f.manifestFile), ".editor-drafts", review.id, "saved.json"));
  t.is(saveRomEditor({ manifestFile: f.manifestFile, reviewId: review.id }), next);
  t.true(
    fs.existsSync(
      path.join(path.dirname(f.manifestFile), ".editor-drafts", review.id, "saved.json"),
    ),
  );
  t.true(fs.existsSync(input));
  t.is((await buildModifiedRom({ manifestFile: f.manifestFile })).changedBytes, 4);
  await t.throwsAsync(
    previewRomEditor({
      manifestFile: f.manifestFile,
      id: "table",
      ...saved,
      document: { kind: "bytes", values: [0, 0, 0, 0] },
    }),
    { message: /stale/ },
  );
});

test("visual edits reject wrapped bytes, overflow and broken assembly without publishing", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  addRomReplacement({
    manifestFile: f.manifestFile,
    id: "data",
    offset: 0x100,
    size: 2,
    kind: "binary",
  });
  const saved = readRomEditor({ manifestFile: f.manifestFile, id: "data" });
  for (const values of [
    [256, 1],
    [-1, 0],
    [1, 2, 3],
    [1.5, 0],
  ]) {
    await t.throwsAsync(
      previewRomEditor({
        manifestFile: f.manifestFile,
        id: "data",
        ...saved,
        document: { kind: "bytes", values },
      }),
    );
  }
  t.is(loadRomModificationProject(f.manifestFile).replacements[0].input, saved.entry.input);
  addRomReplacement({
    manifestFile: f.manifestFile,
    id: "code",
    offset: 0x200,
    size: 2,
    kind: "assembly",
  });
  const code = readRomEditor({ manifestFile: f.manifestFile, id: "code" });
  await t.throwsAsync(
    previewRomEditor({
      manifestFile: f.manifestFile,
      id: "code",
      ...code,
      document: { kind: "assembly", text: "dw missing_symbol\n" },
    }),
  );
  t.is(loadRomModificationProject(f.manifestFile).replacements[1].input, code.entry.input);
});

test("pixel previews preserve duplicate palette identities; palette model range validation reaches codec", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  addRomReplacement({
    manifestFile: f.manifestFile,
    id: "tiles",
    offset: 0x100,
    size: 32,
    kind: "binary",
  });
  await extractRomAsset({
    manifestFile: f.manifestFile,
    id: "tiles",
    format: "snes.tile.4bpp",
    paletteOffset: 0x200,
    paletteSize: 32,
  });
  const saved = readRomEditor({ manifestFile: f.manifestFile, id: "tiles" });
  if (saved.document.kind !== "indexed") {
    t.fail();
    return;
  }
  const document = { ...saved.document, values: [...saved.document.values] };
  document.values[0] = 2;
  const review = await previewRomEditor({
    manifestFile: f.manifestFile,
    id: "tiles",
    ...saved,
    document,
  });
  saveRomEditor({ manifestFile: f.manifestFile, reviewId: review.id });
  const edited = readRomEditor({ manifestFile: f.manifestFile, id: "tiles" });
  t.deepEqual(
    edited.document.kind === "indexed" && edited.document.palette,
    saved.document.palette,
  );
  addRomReplacement({
    manifestFile: f.manifestFile,
    id: "palette",
    offset: 0x200,
    size: 32,
    kind: "binary",
  });
  await extractRomAsset({
    manifestFile: f.manifestFile,
    id: "palette",
    format: "snes.palette.bgr555",
  });
  const palette = readRomEditor({ manifestFile: f.manifestFile, id: "palette" });
  if (palette.document.kind !== "model") {
    t.fail();
    return;
  }
  (palette.document.value.colors as { red: number }[])[0].red = 32;
  await t.throwsAsync(
    previewRomEditor({ manifestFile: f.manifestFile, id: "palette", ...palette }),
  );
});

test("changing a dependency after review blocks save and leaves manifest untouched", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const input = addRomReplacement({
    manifestFile: f.manifestFile,
    id: "code",
    offset: 0x100,
    size: 2,
    kind: "assembly",
  });
  const saved = readRomEditor({ manifestFile: f.manifestFile, id: "code" });
  const review = await previewRomEditor({
    manifestFile: f.manifestFile,
    id: "code",
    ...saved,
    document: { kind: "assembly", text: "dw 42\n" },
  });
  fs.writeFileSync(input, "dw 43\n");
  t.throws(() => saveRomEditor({ manifestFile: f.manifestFile, reviewId: review.id }), {
    message: /changed/,
  });
  t.is(loadRomModificationProject(f.manifestFile).replacements[0].input, saved.entry.input);
});
