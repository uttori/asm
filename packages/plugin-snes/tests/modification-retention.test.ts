import fs from "node:fs";
import path from "node:path";

import { sourceExportSha256, publishAnalysisProject } from "@uttori/asm-disassembler";
import test from "ava";

import { ownershipFixture } from "../../../tests/helpers/ownership-fixture.js";
import {
  createRomModificationProject,
  addRomReplacement,
  buildModifiedRom,
  loadRomModificationProject,
  reviewModificationRetention,
  reviewMetadataMigration,
  pinModificationRetention,
  pruneModificationRetention,
} from "../src/index.js";

async function fixture() {
  const f = ownershipFixture();
  const manifestFile = await createRomModificationProject({
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
    directory: path.join(f.directory, "modifications"),
  });
  const input = addRomReplacement({
    manifestFile,
    id: "data",
    offset: 0x100,
    size: 2,
    kind: "assembly",
    value: 1,
  });
  const first = await buildModifiedRom({ manifestFile });
  fs.writeFileSync(input, "dw 2\n");
  const second = await buildModifiedRom({ manifestFile });
  return { ...f, manifestFile, input, first, second, root: path.dirname(manifestFile) };
}

test("retention protects active baseline/current output, pins milestones, and only deletes exact reviewed history", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  let inventory = reviewModificationRetention(f);
  const old = inventory.items.find((item) => item.path === path.dirname(f.first.outputPath))!;
  t.is(old.protected.length, 0);
  t.true(
    inventory.items.find((item) => item.path === path.dirname(f.second.outputPath))!.protected
      .length > 0,
  );
  t.true(inventory.items.find((item) => item.category === ".baselines")!.protected.length > 0);
  pinModificationRetention({ ...f, itemId: old.id, label: "Working milestone" });
  t.throws(
    () =>
      pruneModificationRetention({ ...f, fingerprint: inventory.fingerprint, selected: [old.id] }),
    { message: /stale/ },
  );
  inventory = reviewModificationRetention(f);
  t.true(inventory.items.find((item) => item.id === old.id)!.pinned);
  t.throws(
    () =>
      pruneModificationRetention({ ...f, fingerprint: inventory.fingerprint, selected: [old.id] }),
    { message: /unprotected/ },
  );
  pinModificationRetention({ ...f, itemId: old.id });
  inventory = reviewModificationRetention(f);
  const result = pruneModificationRetention({
    ...f,
    fingerprint: inventory.fingerprint,
    selected: [old.id],
  });
  t.is(result.removed, 1);
  t.true(result.bytes > 0);
  t.true(fs.existsSync(result.receiptFile));
  t.false(fs.existsSync(f.first.outputPath));
  t.true(fs.existsSync(f.second.outputPath));
  t.true(fs.existsSync(f.input));
});

test("unfinished drafts, sibling dependencies and changed files block cleanup", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const draft = path.join(f.root, ".source-drafts", "unfinished");
  fs.mkdirSync(draft, { recursive: true });
  fs.writeFileSync(path.join(draft, "edited.asm"), "changed");
  const finished = path.join(f.root, ".editor-drafts", "finished");
  fs.mkdirSync(finished, { recursive: true });
  fs.writeFileSync(path.join(finished, "saved.json"), "{}");
  let inventory = reviewModificationRetention(f);
  t.true(
    inventory.items
      .find((item) => item.path === draft)!
      .protected.includes("Unresolved source draft"),
  );
  const old = inventory.items.find((item) => item.path === path.dirname(f.first.outputPath))!;
  reviewMetadataMigration({ manifestFile: f.manifestFile, targetRomFile: f.first.finalOutput });
  inventory = reviewModificationRetention(f);
  t.true(
    inventory.items
      .find((item) => item.id === old.id)!
      .protected.some((reason) => reason.includes("unresolved metadata migration")),
  );

  // A real sibling analysis manifest pins the content hash, independent of where its ROM path is stored.
  publishAnalysisProject(path.join(f.directory, "derived/analysis"), {
    ...f.snapshot,
    manifest: {
      ...f.snapshot.manifest,
      rom: { ...f.rom.identity, sha256: f.first.outputSha256, contentSha256: f.first.outputSha256 },
    },
  });
  inventory = reviewModificationRetention(f);
  t.true(
    inventory.items
      .find((item) => item.id === old.id)!
      .protected.some((reason) => reason.includes("analysis project")),
  );
  const history = inventory.items.find((item) => item.path === finished)!;
  fs.appendFileSync(path.join(history.path, "saved.json"), "\n");
  t.throws(
    () =>
      pruneModificationRetention({
        ...f,
        fingerprint: inventory.fingerprint,
        selected: [history.id],
      }),
    { message: /stale/ },
  );
  t.true(fs.existsSync(history.path));
});

test("retention never traverses a symbolic link and rejects forged item IDs", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const inventory = reviewModificationRetention(f);
  t.throws(
    () =>
      pruneModificationRetention({
        ...f,
        fingerprint: inventory.fingerprint,
        selected: [sourceExportSha256(f.input)],
      }),
    { message: /unprotected/ },
  );
  const link = path.join(path.dirname(f.first.outputPath), "external");
  fs.symlinkSync(f.input, link);
  t.throws(() => reviewModificationRetention(f), { message: /symbolic link/ });
  t.true(fs.existsSync(f.input));
  t.is(loadRomModificationProject(f.manifestFile).replacements.length, 1);
});
