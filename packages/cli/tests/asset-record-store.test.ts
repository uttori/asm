import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ASSET_LIMITS } from "@uttori/asm-assets/limits";

import { test } from "../../../tests/ava-helper.js";
import {
  AssetRecordStore,
  assetHash,
  readAssetStagingId,
} from "../src/asset-interchange/record-store.js";

const isObject = (input: unknown): input is Record<string, unknown> =>
  !!input && typeof input === "object" && !Array.isArray(input);

/** Only test assertions consume the unknown record; production callers supply their own schema validators. */
function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error("Invalid test record.");
  }
  return value;
}

test("compact records preserve full-area buffers, linked sharing and little-endian cells", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asset-record-"));
  try {
    const store = new AssetRecordStore(root),
      id = randomUUID(),
      indexes = new Uint8Array(4096 * 1024);
    indexes[4194303] = 7;
    const shared = { indexes, id: "owner-zero" };
    store.publish(id, {
      width: 4096,
      height: 1024,
      indexes,
      first: shared,
      second: shared,
      cells: Uint32Array.of(0x80000001, 0xffffffff),
    });
    const result = store.read(id, object).value;
    t.is(result.first, result.second);
    t.is(object(result.first).indexes, result.indexes);
    t.deepEqual(result.cells, Uint32Array.of(0x80000001, 0xffffffff));
    t.deepEqual(result.indexes, indexes);
    t.true(fs.statSync(path.join(root, id, "record.json")).size < 1024);
    t.is(fs.readdirSync(path.join(root, id)).length, 4);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("incomplete creation, unsupported objects and cancellation publish no usable record", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asset-record-"));
  try {
    const store = new AssetRecordStore(path.join(root, "records")),
      id = randomUUID();
    t.throws(() => store.read(id, object));
    t.false(fs.existsSync(store.directory));
    t.throws(() => store.publish(id, { indexes: new Uint8Array(64 * 1024 * 1024 + 1) }), {
      message: /limit/,
    });
    t.throws(() => store.publish(id, { date: new Date() }), { message: /plain objects/ });
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    t.throws(() => store.publish(id, cycle), { message: /Cyclic/ });
    const cancel = new AbortController();
    cancel.abort();
    t.throws(() => store.publish(id, { indexes: Uint8Array.of(1) }, cancel.signal));
    t.false(fs.existsSync(path.join(store.directory, id)));
    t.false(fs.existsSync(store.directory));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("private metadata, blob corruption and unknown versions fail before domain use", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asset-record-"));
  try {
    const store = new AssetRecordStore(root),
      id = randomUUID(),
      bytes = Uint8Array.of(1, 2, 3);
    store.publish(id, { indexes: bytes });
    const blob = path.join(root, id, assetHash(bytes));
    fs.writeFileSync(blob, Uint8Array.of(1, 2, 4));
    t.throws(() => store.read(id, object), { message: /blob hash mismatch/ });
    fs.writeFileSync(blob, bytes);
    const file = path.join(root, id, "record.json"),
      before = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, before.replace('"version":1', '"version":2'));
    t.throws(() => store.read(id, object), { message: /metadata hash mismatch/ });
    fs.writeFileSync(path.join(root, id, "record.sha256"), assetHash(fs.readFileSync(file)));
    t.throws(() => store.read(id, object), { message: /re-export/ });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("symlink parents cannot redirect records or blob reads", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asset-record-"));
  try {
    fs.mkdirSync(path.join(root, "real"));
    fs.symlinkSync(path.join(root, "real"), path.join(root, "alias"), "dir");
    const id = randomUUID();
    t.throws(() => new AssetRecordStore(path.join(root, "alias/records")).publish(id, {}), {
      message: /regular directory/,
    });
    const store = new AssetRecordStore(path.join(root, "real")),
      bytes = Uint8Array.of(4);
    store.publish(id, { bytes });
    const blob = path.join(store.directory, id, assetHash(bytes));
    fs.unlinkSync(blob);
    fs.writeFileSync(path.join(root, "outside"), bytes);
    fs.symlinkSync(path.join(root, "outside"), blob);
    t.throws(() => store.read(id, object), { message: /bounded regular file/ });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("one blob used as bytes and little-endian words has matching decoded budgets on publication and read", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asset-record-"));
  try {
    const store = new AssetRecordStore(root),
      id = randomUUID(),
      bytes = Uint8Array.of(1, 0, 0, 0, 2, 0, 0, 0);
    store.publish(id, { bytes, repeated: bytes, words: Uint32Array.of(1, 2) });
    const result = store.read(id, object).value;
    t.is(result.bytes, result.repeated);
    t.deepEqual(result.bytes, bytes);
    t.deepEqual(result.words, Uint32Array.of(1, 2));
    t.is(fs.readdirSync(path.join(root, id)).length, 3);
    const oversized = new Uint8Array(33 * 1024 * 1024),
      rejected = randomUUID();
    t.throws(
      () => store.publish(rejected, { bytes: oversized, words: new Uint32Array(oversized.buffer) }),
      { message: /baseline payload/ },
    );
    t.false(fs.existsSync(path.join(root, rejected)));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("staging retirement previews exact partial publication bytes without granting record authority", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asset-staging-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new AssetRecordStore(root),
    id = randomUUID(),
    stageId = `.staging-${randomUUID()}`,
    stage = path.join(root, stageId),
    payload = Uint8Array.of(7, 8);
  store.publish(id, { payload });
  fs.renameSync(path.join(root, id), stage);
  fs.unlinkSync(path.join(stage, "record.sha256"));
  const temporary = `record.sha256.${randomUUID()}.tmp`;
  fs.writeFileSync(path.join(stage, temporary), "partial");
  const preview = store.stagingInventory(stageId);
  t.deepEqual(preview.files, [
    { name: assetHash(payload), size: payload.length, sha256: assetHash(payload) },
    {
      name: "record.json",
      size: fs.statSync(path.join(stage, "record.json")).size,
      sha256: assetHash(fs.readFileSync(path.join(stage, "record.json"))),
    },
    { name: temporary, size: 7, sha256: assetHash("partial") },
  ]);
  t.deepEqual(store.inventory(object), []);
  t.throws(() => store.read(stageId, object), { message: /Invalid asset record identity/ });
  fs.writeFileSync(path.join(stage, temporary), "changed");
  t.throws(() => store.retireStaging(stageId, preview.hash), { message: /changed after cleanup/ });
  t.true(fs.existsSync(path.join(stage, assetHash(payload))));
  fs.writeFileSync(path.join(stage, temporary), "partial");
  store.retireStaging(stageId, preview.hash);
  t.deepEqual(fs.readdirSync(root), []);
  const emptyId = `.staging-${randomUUID()}`;
  fs.mkdirSync(path.join(root, emptyId));
  const empty = store.stagingInventory(emptyId);
  t.deepEqual(empty.files, []);
  store.retireStaging(emptyId, empty.hash);
  t.deepEqual(fs.readdirSync(root), []);
});

test("staging inventories reject redirection, unknown content and bounded-file violations", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "asset-staging-invalid-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new AssetRecordStore(path.join(root, "records")),
    outside = path.join(root, "outside");
  fs.mkdirSync(store.directory);
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "record.json"), "preserved");
  const invalidEntries = [
    (stage: string) => fs.writeFileSync(path.join(stage, "unknown.txt"), "preserved"),
    (stage: string) => fs.mkdirSync(path.join(stage, "record.json")),
    (stage: string) =>
      fs.symlinkSync(path.join(outside, "record.json"), path.join(stage, "record.json")),
    (stage: string) => {
      const file = path.join(stage, "record.json");
      fs.writeFileSync(file, "");
      fs.truncateSync(file, ASSET_LIMITS.baselineMetadataBytes + 1);
    },
  ];
  for (const create of invalidEntries) {
    const id = `.staging-${randomUUID()}`,
      stage = path.join(store.directory, id);
    fs.mkdirSync(stage);
    create(stage);
    t.throws(() => store.stagingInventory(id));
    t.throws(() => store.retireStaging(id, assetHash("[]")));
    t.true(fs.existsSync(stage));
  }
  const symlinkId = `.staging-${randomUUID()}`;
  fs.symlinkSync(outside, path.join(store.directory, symlinkId), "dir");
  t.throws(() => store.stagingInventory(symlinkId), { message: /record directory/ });
  const regularId = `.staging-${randomUUID()}`;
  fs.mkdirSync(path.join(store.directory, regularId));
  fs.symlinkSync(store.directory, path.join(root, "alias"), "dir");
  t.throws(() => new AssetRecordStore(path.join(root, "alias")).stagingInventory(regularId), {
    message: /record directory/,
  });
  t.is(fs.readFileSync(path.join(outside, "record.json"), "utf8"), "preserved");
  for (const id of [randomUUID(), `../.staging-${randomUUID()}`, `.staging-${"-".repeat(36)}`]) {
    t.throws(() => readAssetStagingId(id), { message: /staging directory identity/ });
  }
  const missing = path.join(root, "missing");
  t.throws(() => new AssetRecordStore(missing).stagingInventory(`.staging-${randomUUID()}`));
  t.false(fs.existsSync(missing));
});
