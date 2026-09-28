import { readFileSync } from "node:fs";

import CRC32 from "@uttori/data-tools/data-hash-crc32";

import { test } from "../../../tests/ava-helper.js";
import {
  expandIndexedGrid,
  extractIndexedRegion,
  renderIndexedPlacements,
  rewriteIndexedPng,
  pngImporter,
} from "../src/image.js";
import type { IndexedImage } from "../src/image.js";

const fixture = (name: string): Uint8Array =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const decode = (bytes: Uint8Array): IndexedImage =>
  pngImporter.import({ bytes, mediaType: "image/png" }).value as IndexedImage;
/** Inspect chunks independently of the rewrite implementation. */
function chunks(bytes: Uint8Array): Map<string, Uint8Array> {
  const result = new Map<string, Uint8Array>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 8; i < bytes.length;) {
    const length = view.getUint32(i);
    result.set(
      String.fromCharCode(...bytes.subarray(i + 4, i + 8)),
      Uint8Array.from(bytes.subarray(i + 8, i + 8 + length)),
    );
    i += 12 + length;
  }
  return result;
}
/** Synthetic private ancillary data exercises both PNG safe-to-copy policies. */
function withChunk(bytes: Uint8Array, name: string): Uint8Array {
  const chunk = new Uint8Array(13);
  new DataView(chunk.buffer).setUint32(0, 1);
  chunk.set(
    [...name].map((c) => c.charCodeAt(0)),
    4,
  );
  chunk[8] = 17;
  new DataView(chunk.buffer).setUint32(9, Number.parseInt(CRC32.of(chunk.subarray(4, 9)), 16));
  return Uint8Array.from([...bytes.subarray(0, -12), ...chunk, ...bytes.subarray(-12)]);
}

test("rectangular indexed sources support negative origins, flips, mappings and custom transparency", (t) => {
  const source = { width: 3, height: 2, indexes: Uint8Array.of(0, 1, 2, 3, 4, 5) };
  const region = extractIndexedRegion(source, {
    x: 0,
    y: 0,
    width: 3,
    height: 2,
    flipX: true,
    flipY: true,
  });
  t.deepEqual([...region.indexes], [5, 4, 3, 2, 1, 0]);
  const placement = {
    id: "part",
    source: "tile",
    x: -2,
    y: -1,
    transparentIndex: 5,
    indexMap: [9, 8, 7, 6, 5],
  };
  const rendered = renderIndexedPlacements(new Map([["tile", source]]), [placement], {
    x: -2,
    y: -1,
    width: 3,
    height: 2,
  });
  t.deepEqual([...rendered.indexes], [9, 8, 7, 6, 5, 0]);
  t.deepEqual([...source.indexes], [0, 1, 2, 3, 4, 5]);
  t.throws(() => extractIndexedRegion(source, { x: 1, y: 0, width: 3, height: 2 }), {
    message: /exceeds/,
  });
  t.throws(
    () =>
      renderIndexedPlacements(new Map([["tile", source]]), [placement, placement], {
        x: -2,
        y: -1,
        width: 3,
        height: 2,
      }),
    { message: /Duplicate/ },
  );
  t.throws(
    () => extractIndexedRegion(source, { x: 0, y: 0, width: 3, height: 2, indexMap: [0, null] }),
    { message: /Unmapped/ },
  );
});

test("overlap order is explicit and index zero may be opaque", (t) => {
  const sources = new Map([
    ["a", { width: 2, height: 1, indexes: Uint8Array.of(1, 2) }],
    ["b", { width: 2, height: 1, indexes: Uint8Array.of(0, 3) }],
  ]);
  const placements = [
    { id: "a", source: "a", x: 0, y: 0 },
    { id: "b", source: "b", x: 0, y: 0, transparentIndex: null },
  ];
  t.deepEqual(
    [...renderIndexedPlacements(sources, placements, { x: 0, y: 0, width: 2, height: 1 }).indexes],
    [0, 3],
  );
});

test("indexed PNG edits preserve packed depths, duplicate palette slots and Adam7 pixels", (t) => {
  for (const name of [
    "indexed-1bpp.png",
    "indexed-2bpp.png",
    "indexed-4bpp.png",
    "indexed-8bpp.png",
    "indexed-4bpp-adam7.png",
  ]) {
    const bytes = fixture(name);
    const source = decode(bytes);
    t.deepEqual(rewriteIndexedPng(bytes, {}), Uint8Array.from(bytes));
    const palette = source.palette.map((c) => [...c] as [number, number, number, number]);
    palette[1] = [...palette[0]];
    const recolored = rewriteIndexedPng(bytes, { palette });
    t.deepEqual(decode(recolored).indexes, source.indexes);
    t.deepEqual(decode(recolored).palette, palette);
    t.deepEqual(chunks(recolored).get("IDAT"), chunks(bytes).get("IDAT"));
    const indexes = source.indexes.slice();
    indexes[0] = (indexes[0] + 1) % palette.length;
    const repainted = decode(rewriteIndexedPng(recolored, { indexes }));
    t.deepEqual(repainted.indexes, indexes);
    t.is(repainted.sourceBitDepth, source.sourceBitDepth);
    t.throws(() => rewriteIndexedPng(bytes, { palette: [] }), { message: /slot count/ });
    t.throws(() => rewriteIndexedPng(bytes, { indexes: new Uint8Array(1) }), {
      message: /dimensions/,
    });
  }
});

test("PNG editing drops unsafe private chunks unless the adapter explicitly preserves them", (t) => {
  const bytes = withChunk(withChunk(fixture("indexed-4bpp.png"), "teST"), "teSt");
  const indexes = decode(bytes).indexes.slice();
  indexes[0] = (indexes[0] + 1) % 16;
  const edited = chunks(rewriteIndexedPng(bytes, { indexes }));
  t.false(edited.has("teST"));
  t.true(edited.has("teSt"));
  t.true(chunks(rewriteIndexedPng(bytes, { indexes, preserveChunks: ["teST"] })).has("teST"));
});

test("owned edits never mutate Buffer inputs or share unchanged output storage", (t) => {
  const bytes = Buffer.from(fixture("indexed-4bpp-adam7.png"));
  const snapshot = Buffer.from(bytes);
  const indexes = decode(bytes).indexes.slice();
  indexes[0] = (indexes[0] + 1) % 16;
  rewriteIndexedPng(bytes, { indexes });
  t.deepEqual(bytes, snapshot, "Adam7 header must not be modified through Buffer.slice");
  const unchanged = rewriteIndexedPng(bytes, {});
  unchanged[0] = 0;
  t.deepEqual(bytes, snapshot);
  const background = Buffer.from([7, 8]);
  const rendered = renderIndexedPlacements(
    new Map(),
    [],
    { x: 0, y: 0, width: 2, height: 1 },
    background,
  );
  rendered.indexes[0] = 1;
  t.deepEqual([...background], [7, 8]);
});

test("explicit canvas replacement retains indexes and leaves the original PNG untouched", (t) => {
  const bytes = Buffer.from(fixture("indexed-4bpp-adam7.png"));
  const before = Buffer.from(bytes);
  const indexes = Uint8Array.of(0, 1, 2, 3, 4, 5);
  const changed = decode(
    rewriteIndexedPng(bytes, { dimensions: { width: 3, height: 2 }, indexes }),
  );
  t.deepEqual(changed.indexes, indexes);
  t.is(changed.width, 3);
  t.is(changed.height, 2);
  t.deepEqual(bytes, before);
  t.throws(() => rewriteIndexedPng(bytes, { dimensions: { width: 3, height: 2 } }), {
    message: /replacement/,
  });
});

test("native grids expand rectangular cells with whole-block flips and independent identities", (t) => {
  const placements = expandIndexedGrid({
    id: "block",
    x: -7,
    y: 9,
    columns: 3,
    cellWidth: 5,
    cellHeight: 2,
    flipX: true,
    flipY: true,
    cells: ["a", "b", "a", "d", "e", "f"].map((source) => ({ source })),
  });
  t.deepEqual(
    placements.map((p) => [p.source, p.x, p.y]),
    [
      ["a", 3, 11],
      ["b", -2, 11],
      ["a", -7, 11],
      ["d", 3, 9],
      ["e", -2, 9],
      ["f", -7, 9],
    ],
  );
  t.is(new Set(placements.map((p) => p.id)).size, 6);
  t.true(placements.every((p) => p.flipX && p.flipY));
  t.throws(
    () =>
      expandIndexedGrid({
        id: "x",
        x: 0,
        y: 0,
        columns: 2,
        cellWidth: 5,
        cellHeight: 3,
        cells: [{ source: "a" }],
      }),
    { message: /complete/ },
  );
});
