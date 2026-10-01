import fs from "node:fs/promises";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";

import {
  createIndexedPng,
  pngImporter,
  rewriteIndexedPng,
  type IndexedImage,
} from "@uttori/asm-assets/image";
import test from "ava";
import type { CustomDocumentEditEvent, Uri } from "vscode";

registerHooks({
  resolve(specifier, context, next) {
    return specifier === "vscode"
      ? { shortCircuit: true, url: "png-test:vscode" }
      : next(specifier, context);
  },
  load(url, context, next) {
    if (url !== "png-test:vscode") {
      return next(url, context);
    }
    return {
      shortCircuit: true,
      format: "module",
      source: `export class EventEmitter {
      listeners = new Set(); event = (listener) => { this.listeners.add(listener); return { dispose: () => this.listeners.delete(listener) }; };
      fire(value) { for (const listener of this.listeners) listener(value); } dispose() { this.listeners.clear(); }
    }`,
    };
  },
});
const { PngDocument } = await import("../../src/assets/png-document.js");
const { BinaryDrafts } = await import("../../src/assets/binary-drafts.js");
const { PngCodec } = await import("../../src/assets/png-codec.js");

/** Same portable codec in-process for deterministic filesystem/race tests; native tests use the actual worker. */
class Codec extends PngCodec {
  constructor() {
    super("unused-in-process");
  }
  override async decode(bytes: Uint8Array): Promise<IndexedImage> {
    const image = pngImporter.import({ bytes, mediaType: "image/png" });
    if (image.kind !== "indexed-image") {
      throw new Error("Expected indexed PNG");
    }
    return image.value as IndexedImage;
  }
  override async encode(bytes: Uint8Array, indexes: Uint8Array): Promise<Uint8Array> {
    return rewriteIndexedPng(bytes, { indexes });
  }
}

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "uttori-png-document-"));
  const file = path.join(directory, "pixels.png");
  const uri = { scheme: "file", fsPath: file, toString: () => `file://${file}` } as Uri;
  const bytes = createIndexedPng({
    width: 2,
    height: 2,
    indexes: new Uint8Array([0, 1, 1, 0]),
    palette: [
      [0, 0, 0, 0],
      [255, 255, 255, 255],
      [255, 255, 255, 255],
    ],
  });
  await fs.writeFile(file, bytes, { mode: 0o640 });
  const drafts = new BinaryDrafts();
  const codec = new Codec();
  const document = await PngDocument.open(uri, codec, drafts);
  const edits: CustomDocumentEditEvent<typeof document>[] = [];
  document.onDidEdit((edit) => edits.push(edit));
  return {
    directory,
    file,
    uri,
    bytes,
    drafts,
    codec,
    document,
    edits,
    cleanup: async () => {
      document.dispose();
      drafts.dispose();
      codec.dispose();
      await fs.rm(directory, { recursive: true });
    },
  };
}

test("PNG indexed edits save atomically and undo after Save restores exact original container", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  f.document.paint({ version: 1, pixels: [0, 0, 1], index: 2 });
  t.true(f.document.dirty);
  t.deepEqual([...f.document.image.indexes], [2, 2, 1, 0]);
  t.deepEqual(await fs.readFile(f.file), Buffer.from(f.bytes));
  const snapshot = await f.document.snapshot();
  await f.document.save();
  t.false(f.document.dirty);
  t.deepEqual(await fs.readFile(f.file), Buffer.from(snapshot));
  t.is((await fs.stat(f.file)).mode & 0o777, 0o640);
  await f.edits[0].undo();
  t.true(f.document.dirty);
  await f.document.save();
  t.deepEqual(await fs.readFile(f.file), Buffer.from(f.bytes));
  await f.edits[0].redo();
  t.true(f.document.dirty);
});

test("PNG backup restores the unsaved version and refuses to overwrite external edits", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  f.document.paint({ version: 1, pixels: [0], index: 1 });
  const expected = await f.document.snapshot();
  const backup = f.document.backup();
  f.document.dispose();
  const restored = await PngDocument.open(f.uri, f.codec, f.drafts, backup);
  t.teardown(() => restored.dispose());
  t.true(restored.dirty);
  t.deepEqual(await restored.snapshot(), expected);
  t.deepEqual(await fs.readFile(f.file), Buffer.from(f.bytes));
  const external = rewriteIndexedPng(f.bytes, { indexes: new Uint8Array([0, 0, 1, 0]) });
  await fs.writeFile(f.file, external);
  await t.throwsAsync(restored.save(), { message: /changed on disk/ });
  t.true(restored.dirty);
  t.deepEqual(await fs.readFile(f.file), Buffer.from(external));
  t.deepEqual(await fs.readdir(f.directory), ["pixels.png"]);
  const copy = {
    ...f.uri,
    fsPath: path.join(f.directory, "copy.png"),
    toString: () => "file://copy.png",
  } as Uri;
  await restored.save(copy);
  t.true(restored.dirty, "Save As must not silently mark the original saved");
  t.deepEqual(await fs.readFile(copy.fsPath), Buffer.from(expected));
  await restored.revert();
  t.false(restored.dirty);
  t.deepEqual([...restored.image.indexes], [0, 0, 1, 0]);
});

test("PNG rejects invalid/stale strokes before changing pixels and rejects stale encoded snapshots", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  for (const stroke of [
    { version: 0, pixels: [0], index: 1 },
    { version: 1, pixels: [0, 4], index: 1 },
    { version: 1, pixels: [0], index: 3 },
  ]) {
    t.throws(() => f.document.paint(stroke));
    t.false(f.document.dirty);
  }
  const snapshot = f.document.snapshot();
  f.document.paint({ version: 1, pixels: [0], index: 1 });
  await t.throwsAsync(snapshot, { message: /changed during encoding/ });
  const save = f.document.save();
  t.throws(() => f.document.paint({ version: f.document.version, pixels: [0], index: 2 }), {
    message: /saving/,
  });
  await save;
});

test("PNG cancellation preserves the saved file and old undo cannot cross an external reload", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  f.document.paint({ version: 1, pixels: [0], index: 1 });
  await t.throwsAsync(
    f.document.save(f.uri, () => true),
    { message: /cancelled/ },
  );
  t.true(f.document.dirty);
  t.deepEqual(await fs.readFile(f.file), Buffer.from(f.bytes));
  t.deepEqual(await fs.readdir(f.directory), ["pixels.png"]);
  await f.document.revert();
  t.false(f.document.dirty);
  t.throws(() => f.edits[0].undo(), { message: /reloaded from disk/ });
  t.deepEqual(await f.document.snapshot(), f.bytes);
});

test("atlas painting protects encoded regions and backup/save retain stale-layout drafts", async (t) => {
  const f = await fixture();
  t.teardown(f.cleanup);
  f.document.dispose();
  const bytes = createIndexedPng({
    width: 24,
    height: 8,
    indexes: new Uint8Array(24 * 8),
    palette: Array.from({ length: 33 }, (_, index) => [index, index, index, 255] as const),
  });
  await fs.writeFile(f.file, bytes);
  const layoutFile = f.file.replace(".png", ".layout.json");
  const layout = {
    version: 1,
    width: 24,
    height: 8,
    guideIndex: 32,
    paletteRefs: ["first", "second"],
    frames: [],
    segments: { tile: { palette: 1, tiles: [{ x: 8, y: 0 }] } },
  };
  const originalLayout = JSON.stringify(layout);
  await fs.writeFile(layoutFile, originalLayout);
  const document = await PngDocument.open(f.uri, f.codec, f.drafts);
  t.teardown(() => document.dispose());
  t.throws(() => document.paint({ version: document.version, pixels: [0], index: 17 }), {
    message: /padding or a preview/,
  });
  t.throws(() => document.paint({ version: document.version, pixels: [8], index: 1 }), {
    message: /different palette group/,
  });
  t.false(document.dirty);
  document.paint({ version: document.version, pixels: [8], index: 17 });
  const expected = await document.snapshot();
  const backup = document.backup();
  layout.segments.tile.tiles[0].x = 16;
  await fs.writeFile(layoutFile, JSON.stringify(layout));
  await t.throwsAsync(document.save(), { message: /layout changed/ });
  await document.externalGuidanceChange();
  t.throws(() => document.paint({ version: document.version, pixels: [8], index: 18 }), {
    message: /layout changed/,
  });
  const restored = await PngDocument.open(f.uri, f.codec, f.drafts, backup);
  t.teardown(() => restored.dispose());
  t.true(restored.dirty);
  await t.throwsAsync(restored.save(), { message: /layout changed since/ });
  const twiceRestored = await PngDocument.open(f.uri, f.codec, f.drafts, restored.backup());
  t.teardown(() => twiceRestored.dispose());
  await t.throwsAsync(twiceRestored.snapshot(), { message: /layout changed since/ });
  const copy = {
    ...f.uri,
    fsPath: path.join(f.directory, "retained.png"),
    toString: () => "file://retained.png",
  } as Uri;
  await restored.save(copy);
  t.deepEqual(await fs.readFile(copy.fsPath), Buffer.from(expected));
  t.deepEqual(await fs.readFile(f.file), Buffer.from(bytes));
  await fs.writeFile(layoutFile, originalLayout);
  await document.externalGuidanceChange();
  await document.save();
  t.deepEqual(await fs.readFile(f.file), Buffer.from(expected));
  await restored.revert();
  t.false(restored.dirty);
  t.is(restored.guidanceIssue, undefined);
});
