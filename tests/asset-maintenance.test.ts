import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  acquireSourceOperationLease,
  applySourceFileTransaction,
  readSourceFileTransaction,
} from "@uttori/asm-disassembler/source-project";
import {
  executeAssetOperation,
  somSpriteSourceAdapter,
} from "@uttori/asm-game-secret-of-mana/workflows";
import {
  AssetInterchangeService,
  AssetRecordStore,
  assetHash,
  cleanupAssetInterchange,
  recoverAssetInterchange,
  readAssetRetentionPolicy,
} from "@uttori/asm-workflows/asset-interchange";

import { test } from "./ava-helper.js";
import { spriteSourceFixture } from "./fixtures/sprite-source.js";

test("explicit cleanup retains referenced exports and requires the exact reviewed inventory", async (t) => {
  const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup));
  const service = new AssetInterchangeService(fixture.directory, somSpriteSourceAdapter);
  const first = path.join(fixture.directory, ".uttori-local/first.aseprite");
  const manifest = await service.export(fixture.selection, {
    document: first,
    manifest: first + ".json",
  });
  const reviewed = await service.review(manifest, first);
  const bytes = fs.readFileSync(path.join(fixture.directory, "source/sprite.png"));
  const time = fs.statSync(path.join(fixture.directory, "source/sprite.png"), {
    bigint: true,
  }).mtimeNs;
  await t.throwsAsync(
    () => cleanupAssetInterchange(fixture.directory, { exports: [manifest.id], reviews: [] }),
    { message: /retained review/ },
  );
  const root = path.join(fixture.directory, ".uttori-local/asset-interchange"),
    stageId = `.staging-${randomUUID()}`,
    stage = path.join(root, "exports", stageId);
  fs.mkdirSync(stage);
  const policy = {
    exports: [manifest.id],
    reviews: [reviewed.id],
    staging: { exports: [stageId], reviews: [] },
  };
  const preview = await cleanupAssetInterchange(fixture.directory, policy);
  t.false(preview.applied);
  const next = first + ".next";
  const retained = await service.export(fixture.selection, {
    document: next,
    manifest: next + ".json",
  });
  await t.throwsAsync(() => cleanupAssetInterchange(fixture.directory, policy, preview.id), {
    message: /inventory changed/,
  });
  t.true(fs.existsSync(stage));
  const fresh = await cleanupAssetInterchange(fixture.directory, policy);
  t.true((await cleanupAssetInterchange(fixture.directory, policy, fresh.id)).applied);
  t.deepEqual(fs.readdirSync(path.join(root, "exports")), [retained.id]);
  t.deepEqual(fs.readdirSync(path.join(root, "reviews")), []);
  t.deepEqual(fs.readFileSync(path.join(fixture.directory, "source/sprite.png")), bytes);
  t.is(
    fs.statSync(path.join(fixture.directory, "source/sprite.png"), { bigint: true }).mtimeNs,
    time,
  );
  t.true(fs.existsSync(first));
  await t.throwsAsync(() => cleanupAssetInterchange(fixture.directory, policy), {
    message: /Unknown asset export/,
  });
});

test("explicit staging cleanup preserves complete records, documents and unselected crash leftovers", async (t) => {
  const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup));
  const service = new AssetInterchangeService(fixture.directory, somSpriteSourceAdapter),
    document = path.join(fixture.directory, ".uttori-local/retained.aseprite"),
    manifest = await service.export(fixture.selection, { document, manifest: document + ".json" }),
    review = await service.review(manifest, document),
    root = path.join(fixture.directory, ".uttori-local/asset-interchange"),
    exportStage = `.staging-${randomUUID()}`,
    reviewStage = `.staging-${randomUUID()}`,
    unselected = `.staging-${randomUUID()}`;
  fs.cpSync(path.join(root, "exports", manifest.id), path.join(root, "exports", exportStage), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, "reviews", reviewStage));
  const temporary = `${assetHash("partial")}.${randomUUID()}.tmp`;
  fs.writeFileSync(path.join(root, "reviews", reviewStage, temporary), "partial");
  fs.mkdirSync(path.join(root, "exports", unselected));
  fs.writeFileSync(path.join(root, "exports", unselected, "unknown.txt"), "keep");
  const policy = {
      exports: [],
      reviews: [],
      staging: { exports: [exportStage], reviews: [reviewStage] },
    },
    before = fs.readFileSync(path.join(fixture.directory, "source/sprite.png")),
    beforeTime = fs.statSync(path.join(fixture.directory, "source/sprite.png"), {
      bigint: true,
    }).mtimeNs,
    preview = await cleanupAssetInterchange(fixture.directory, policy);
  t.false(preview.applied);
  t.deepEqual(
    preview.stagingInventory.exports.map(({ id }) => id),
    [exportStage],
  );
  t.deepEqual(preview.stagingInventory.reviews[0].files, [
    { name: temporary, size: 7, sha256: assetHash("partial") },
  ]);
  const policyFile = path.join(fixture.directory, ".uttori-local/retire.json");
  fs.writeFileSync(policyFile, JSON.stringify(policy));
  t.deepEqual(
    await executeAssetOperation({
      action: "asset-cleanup",
      directory: fixture.directory,
      policy: policyFile,
      review: preview.id,
    }),
    { ...preview, applied: true },
  );
  t.deepEqual(
    fs.readdirSync(path.join(root, "exports")).toSorted(),
    [manifest.id, unselected].toSorted(),
  );
  t.deepEqual(fs.readdirSync(path.join(root, "reviews")), [review.id]);
  t.true(fs.existsSync(document));
  t.true(fs.existsSync(document + ".json"));
  t.deepEqual(fs.readFileSync(path.join(fixture.directory, "source/sprite.png")), before);
  t.is(
    fs.statSync(path.join(fixture.directory, "source/sprite.png"), { bigint: true }).mtimeNs,
    beforeTime,
  );
});

test("staging cleanup rechecks names and bytes under the operation lease before any retirement", async (t) => {
  const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup));
  const root = path.join(fixture.directory, ".uttori-local/asset-interchange/exports"),
    stageId = `.staging-${randomUUID()}`,
    stage = path.join(root, stageId),
    file = path.join(stage, "record.json"),
    policy = { exports: [], reviews: [], staging: { exports: [stageId], reviews: [] } };
  fs.mkdirSync(stage, { recursive: true });
  fs.writeFileSync(file, "partial");
  const preview = await cleanupAssetInterchange(fixture.directory, policy);
  for (const change of [
    () => fs.writeFileSync(file, "changed"),
    () => fs.writeFileSync(path.join(stage, "record.sha256"), "partial"),
    () => fs.unlinkSync(file),
  ]) {
    change();
    await t.throwsAsync(() => cleanupAssetInterchange(fixture.directory, policy, preview.id), {
      message: /inventory changed/,
    });
    t.true(fs.existsSync(stage));
    fs.rmSync(path.join(stage, "record.sha256"), { force: true });
    fs.writeFileSync(file, "partial");
  }
  fs.writeFileSync(path.join(stage, "unknown.txt"), "preserved");
  await t.throwsAsync(() => cleanupAssetInterchange(fixture.directory, policy, preview.id), {
    message: /Unexpected file/,
  });
  t.is(fs.readFileSync(file, "utf8"), "partial");
  fs.unlinkSync(path.join(stage, "unknown.txt"));
  const lease = acquireSourceOperationLease(fixture.repository);
  try {
    await t.throwsAsync(() => cleanupAssetInterchange(fixture.directory, policy, preview.id), {
      message: /operation owns/,
    });
    t.true(fs.existsSync(stage));
  } finally {
    lease.release();
  }
  t.true((await cleanupAssetInterchange(fixture.directory, policy, preview.id)).applied);
  t.false(fs.existsSync(stage));
});

test("cleanup rejects references naming a staging directory before retiring any selected content", async (t) => {
  const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup));
  const root = path.join(fixture.directory, ".uttori-local/asset-interchange"),
    stageId = `.staging-${randomUUID()}`,
    stage = path.join(root, "exports", stageId),
    reviewId = "a".repeat(64);
  fs.mkdirSync(stage, { recursive: true });
  new AssetRecordStore(path.join(root, "reviews")).publish(reviewId, {
    format: "uttori-asset-reviewed-plan",
    version: 2,
    summary: {
      format: "uttori-asset-review",
      version: 2,
      id: reviewId,
      exportId: stageId,
      documentSha256: "b".repeat(64),
      outputSha256: "c".repeat(64),
      files: [],
      effects: [],
    },
  });
  await t.throwsAsync(
    () =>
      cleanupAssetInterchange(fixture.directory, {
        exports: [],
        reviews: [reviewId],
        staging: { exports: [stageId], reviews: [] },
      }),
    { message: /export locator/ },
  );
  t.true(fs.existsSync(stage));
  t.true(fs.existsSync(path.join(root, "reviews", reviewId)));
});

test("retention policies require explicit store-scoped staging identities", (t) => {
  t.deepEqual(readAssetRetentionPolicy({ exports: [], reviews: [] }), { exports: [], reviews: [] });
  const id = `.staging-${randomUUID()}`;
  for (const staging of [
    null,
    [],
    { exports: [id], reviews: undefined },
    { exports: [id, id], reviews: [] },
    { exports: [randomUUID()], reviews: [] },
    { exports: [], reviews: [`../${id}`] },
  ]) {
    t.throws(() => readAssetRetentionPolicy({ exports: [], reviews: [], staging }));
  }
  t.throws(() => readAssetRetentionPolicy({ exports: [id], reviews: [] }));
  t.throws(() => readAssetRetentionPolicy({ exports: [], reviews: [id] }));
});

test("recovery preserves dirty drafts and rechecks the journal under the operation lock", async (t) => {
  const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup));
  const file = "source/original.bin",
    before = fs.readFileSync(path.join(fixture.directory, file)),
    after = Buffer.from(before);
  after[0x7000] ^= 1;
  t.throws(() =>
    applySourceFileTransaction(fixture.repository, [{ path: file, before, after }], {
      onStage(stage) {
        if (stage === "staged") {
          throw new Error("Interrupted staged publication");
        }
      },
    }),
  );
  const journal = readSourceFileTransaction(fixture.repository)!;
  await t.throwsAsync(
    () =>
      executeAssetOperation({
        action: "asset-recover",
        directory: fixture.directory,
        direction: "after",
        drafts: [{ path: file, version: 3, opaque: true }],
      }),
    { message: /drafts/ },
  );
  t.deepEqual(fs.readFileSync(path.join(fixture.directory, file)), before);
  await t.throwsAsync(
    () =>
      recoverAssetInterchange(fixture.directory, "after", {
        beforePublish: async () => {
          fs.writeFileSync(
            path.join(fixture.repository.stateDirectory, "file-publication.json"),
            JSON.stringify({ ...journal, direction: "before" }),
          );
        },
      }),
    { message: /journal changed/ },
  );
  t.deepEqual(fs.readFileSync(path.join(fixture.directory, file)), before);
  let completions = 0;
  const result = await recoverAssetInterchange(fixture.directory, "after", {
    completed: async () => {
      completions++;
    },
  });
  t.is(result?.state, "completed");
  t.deepEqual(fs.readFileSync(path.join(fixture.directory, file)), after);
  t.is(completions, 1);
});
