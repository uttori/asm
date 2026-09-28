import fs from "node:fs";
import path from "node:path";

import { loadAnalysisProject, validateSourceExportFiles } from "@uttori/asm-disassembler";
import test from "ava";

import { ownershipFixture } from "../../../tests/helpers/ownership-fixture.js";
import {
  createRomModificationProject,
  reviewMetadataMigration,
  applyMetadataMigration,
  verifySnesProjectRoundTrip,
} from "../src/index.js";

async function fixture() {
  const f = ownershipFixture();
  const manifestFile = await createRomModificationProject({
    sourceDirectory: f.sourceDirectory,
    romFile: f.romFile,
    directory: path.join(f.directory, "modifications"),
  });
  const targetRomFile = path.join(f.directory, "target.sfc");
  fs.copyFileSync(f.romFile, targetRomFile);
  return { ...f, manifestFile, targetRomFile };
}

test("migration explicitly relocates research and struct bindings into an independently verified workspace", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const review = reviewMetadataMigration({
    manifestFile: f.manifestFile,
    targetRomFile: f.targetRomFile,
    relocations: [{ from: 0x20, to: 0x120, size: 0x40 }],
  });
  t.is(review.items.find((i) => i.id === "labels:imported.candy")?.status, "relocated");
  const result = await applyMetadataMigration({
    manifestFile: f.manifestFile,
    reviewId: review.id,
    selected: ["labels:imported.candy", "comments:note", "struct-library", "binding:Prices"],
    outputDirectory: path.join(f.directory, "migrated"),
  });
  fs.unlinkSync(
    path.join(path.dirname(f.manifestFile), ".metadata-migrations", review.id, "completed.json"),
  );
  const replay = await applyMetadataMigration({
    manifestFile: f.manifestFile,
    reviewId: review.id,
    selected: ["labels:imported.candy", "comments:note", "struct-library", "binding:Prices"],
    outputDirectory: result.outputDirectory,
  });
  t.is(replay.outputDirectory, result.outputDirectory);
  const migrated = loadAnalysisProject(path.join(result.outputDirectory, "analysis"));
  t.is(migrated.shards.labels[0].address, 0xc00120);
  t.false(migrated.shards.labels[0].analysisEntryPoint!);
  t.is(migrated.shards.comments[0].address, 0x130);
  t.is(migrated.shards.runtime.length, 0);
  t.false(migrated.shards.evidence.some((e) => e.source === "runtime" || Boolean(e.artifact)));
  const map = JSON.parse(
    fs.readFileSync(path.join(result.outputDirectory, "struct-map.json"), "utf8"),
  );
  t.is(map.bindings[0].fileOffset, 0x140);
  t.falsy(map.instructionUses);
  t.is(loadAnalysisProject(f.projectDirectory).shards.labels[0].address, 0x400020);
  validateSourceExportFiles(result.outputDirectory);
  await verifySnesProjectRoundTrip({
    sourceDirectory: result.outputDirectory,
    romFile: result.romFile,
  });
});

test("changed anchors need review, range splits block, and overlapping relocation maps reject", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const bytes = fs.readFileSync(f.targetRomFile);
  bytes[0x21] ^= 0xff;
  fs.writeFileSync(f.targetRomFile, bytes);
  const review = reviewMetadataMigration(f);
  t.is(review.items.find((i) => i.id === "labels:imported.candy")?.status, "review");
  t.throws(
    () =>
      reviewMetadataMigration({
        ...f,
        relocations: [
          { from: 0x20, to: 0x100, size: 32 },
          { from: 0x30, to: 0x200, size: 32 },
        ],
      }),
    { message: /overlap/ },
  );
  const split = reviewMetadataMigration({
    ...f,
    relocations: [{ from: 0x41, to: 0x100, size: 2 }],
  });
  t.is(split.items.find((i) => i.id === "binding:Prices")?.status, "blocked");
  await t.throwsAsync(
    applyMetadataMigration({
      manifestFile: f.manifestFile,
      reviewId: split.id,
      selected: ["struct-library", "binding:Prices"],
      outputDirectory: path.join(f.directory, "blocked"),
    }),
    { message: /non-blocked/ },
  );
  t.false(fs.existsSync(path.join(f.directory, "blocked")));
});

test("stale migration reviews and missing layout dependencies cannot publish", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  const review = reviewMetadataMigration(f);
  const options = {
    manifestFile: f.manifestFile,
    reviewId: review.id,
    outputDirectory: path.join(f.directory, "migrated"),
  };
  await t.throwsAsync(applyMetadataMigration({ ...options, selected: ["binding:Prices"] }), {
    message: /library/,
  });
  const bytes = fs.readFileSync(f.targetRomFile);
  bytes[0x300] ^= 1;
  fs.writeFileSync(f.targetRomFile, bytes);
  await t.throwsAsync(applyMetadataMigration({ ...options, selected: ["labels:imported.candy"] }), {
    message: /stale/,
  });
  t.false(fs.existsSync(options.outputDirectory));
});
