import fs from "node:fs";
import path from "node:path";

import { decodeAsepriteDocument, encodeAsepriteDocument } from "@uttori/asm-assets/aseprite";
import { AssetInterchangeService, somRoomSourceAdapter } from "@uttori/asm-cli/asset-interchange";
import { inspectSourceProject } from "@uttori/asm-cli/source";

import { test } from "./ava-helper.js";
import { roomSourceFixture } from "./fixtures/room-source.js";

/** Native byte/mtime oracle is independent of the room presentation and source planner. */
test("room pixel/palette import attributes exact native bytes, preserves geometry and updates every declared alias", async (t) => {
  const fixture = await roomSourceFixture(t.teardown),
    service = new AssetInterchangeService(fixture.directory, somRoomSourceAdapter),
    file = path.join(fixture.directory, ".uttori-local/room.aseprite");
  const manifest = await service.export(fixture.selection, {
    document: file,
    manifest: file + ".json",
  });
  const times = fixture.files.map(
    (entry) => fs.statSync(path.join(fixture.directory, entry.path), { bigint: true }).mtimeNs,
  );
  const noEdit = await service.review(manifest, file);
  t.deepEqual(noEdit.files, []);
  await service.apply(manifest, file, noEdit.id);
  t.deepEqual(
    fixture.files.map(
      (entry) => fs.statSync(path.join(fixture.directory, entry.path), { bigint: true }).mtimeNs,
    ),
    times,
  );
  const document = await decodeAsepriteDocument(fs.readFileSync(file));
  const view = document.tilesets[0].tileData.findIndex((id) => id?.includes("65536,2"));
  t.true(view > 0);
  document.tilesets[0].indexes[view * 64] = 19;
  for (const [offset, display] of [
    [131072, 25],
    [196608, 19],
  ]) {
    const tile = document.tilesets[0].tileData.findIndex((id) => id?.includes(String(offset)));
    document.tilesets[0].indexes[tile * 64] = display;
  }
  const palette = document.palette.map((color): [number, number, number, number] => [...color]);
  palette[17] = [16, 0, 0, 255];
  fs.writeFileSync(file, await encodeAsepriteDocument({ ...document, palette }));
  const review = await service.review(manifest, file);
  t.deepEqual(
    review.files.map((entry) => entry.path),
    ["source/native.bin", "source/preview.json"],
  );
  t.true(review.effects.every((effect) => effect.consumers.includes("source/other.json")));
  await service.apply(manifest, file, review.id);
  const expected = fixture.original.slice();
  expected[0x10000] = 0x80;
  expected[0x10001] = 0x80;
  expected[0xc8000] = 2;
  expected[0x20000] = 0x80;
  expected[0x30000] = 0x80;
  expected[0x30001] = 0x80;
  t.deepEqual((await inspectSourceProject(fixture.directory)).output, expected);
  for (const entry of fixture.files.filter(
    (entry) => entry.path !== "source/native.bin" && entry.path !== "source/preview.json",
  )) {
    t.deepEqual(fs.readFileSync(path.join(fixture.directory, entry.path)), entry.bytes);
  }
  t.is(
    JSON.parse(fs.readFileSync(path.join(fixture.directory, "source/preview.json"), "utf8"))
      .retainedNote,
    "opaque authored note",
  );
  const next = file + ".next",
    nextManifest = await service.export(fixture.selection, {
      document: next,
      manifest: next + ".json",
    });
  t.deepEqual((await service.review(nextManifest, next)).files, []);
});

test("changed room cells and incomplete consumer closure reject without source writes", async (t) => {
  const fixture = await roomSourceFixture(t.teardown),
    service = new AssetInterchangeService(fixture.directory, somRoomSourceAdapter),
    file = path.join(fixture.directory, ".uttori-local/room.aseprite");
  await t.throwsAsync(
    service.export(
      { ...fixture.selection, rooms: [fixture.selection.room] },
      { document: file, manifest: file + ".json" },
    ),
    { message: /consumer/ },
  );
  const manifest = await service.export(fixture.selection, {
    document: file,
    manifest: file + ".json",
  });
  const document = await decodeAsepriteDocument(fs.readFileSync(file)),
    cel = document.frames
      .at(-1)!
      .cels.find((cel) => cel.kind === "tilemap" && cel.cells.some(Boolean))!;
  if (cel.kind !== "tilemap") {
    throw new Error("Expected map cells.");
  }
  cel.cells[0] = 0;
  fs.writeFileSync(file, await encodeAsepriteDocument(document));
  await t.throwsAsync(service.review(manifest, file), { message: /reference|occurrence|cell/ });
  for (const entry of fixture.files) {
    t.deepEqual(fs.readFileSync(path.join(fixture.directory, entry.path)), entry.bytes);
  }
});
