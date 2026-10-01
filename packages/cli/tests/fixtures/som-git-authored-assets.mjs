/** Verify normal PNG, room JSON and externally saved WAVE edits against independent full-ROM bytes. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { waveImporter, writePcmWave } from "@uttori/asm-assets/audio";
import { pngImporter, rewriteIndexedPng } from "@uttori/asm-assets/image";
import { convertBrrWave } from "@uttori/asm-assets/secret-of-mana/som-asset-plugin";
import { executeSourceOperation } from "@uttori/asm-cli/source";
import { sourceContentHash, sourceGit } from "@uttori/asm-disassembler";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const clone = path.join(application, "experiments/secret-of-mana-git-workflow-full");
assert.equal(JSON.parse(fs.readFileSync(path.join(clone, ".verification/seed.json"))).root, clone);
const parent = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-som-assets-"));
const root = path.join(parent, "project");
const branch = `codex/verify-authored-assets-${Date.now()}`;
const report = {
  branch,
  started: new Date().toISOString(),
  operations: [],
  assets: [],
  success: false,
};
let added = false;

/** Run the shipped source operations and record compact phase timing. */
async function operation(action, values = {}) {
  const started = performance.now();
  const result = await executeSourceOperation({
    action,
    directory: root,
    ...values,
    onProgress: (message) => console.log(`${action}: ${message}`),
  });
  report.operations.push({ action, elapsedMs: performance.now() - started });
  return result;
}

try {
  report.base = (await sourceGit(clone, ["rev-parse", "HEAD"])).stdout.toString().trim();
  await sourceGit(clone, ["worktree", "add", "-b", branch, root, report.base]);
  added = true;
  fs.mkdirSync(path.join(root, ".uttori-local"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules"));
  fs.symlinkSync(
    path.join(application, "node_modules/@uttori"),
    path.join(root, "node_modules/@uttori"),
    "dir",
  );
  fs.writeFileSync(
    path.join(root, ".uttori-local/project.json"),
    JSON.stringify({
      format: "uttori-source-local",
      version: 1,
      evidence: path.join(clone, "disassembly/analysis"),
      rom: path.join(clone, "Secret of Mana (USA).sfc"),
    }),
  );
  const baseline = await operation("build");
  const expected = fs.readFileSync(baseline.outputFile);
  assert.equal(
    sourceContentHash(expected),
    "6abc48cc519de82d50edc730ba9ad32bdadc1e26e62f7420c3b75ea7eb033622",
  );
  const original = fs.readFileSync(path.join(clone, "Secret of Mana (USA).sfc"));
  const includesFile = path.join(root, "disassembly/asset-includes.json");
  const includes = JSON.parse(fs.readFileSync(includesFile));
  const counts = {};
  for (const item of includes.entries) {
    const format = [...item.directive.matchAll(/"([^"]+)"/g)][1][1];
    counts[format] = (counts[format] ?? 0) + 1;
  }
  report.inventory = counts;
  // Silence is an independently specified native oracle: zero predictor/filter/range and only
  // the last END/LOOP flags. Exercise an ordinary sample and the violin's within-block bank split.
  for (const [name, id] of [
    ["034784-waveform-01.wav", 1],
    ["03fbcc-title-instrument-s13.wav", 0x13],
  ]) {
    const file = path.join(root, "disassembly/assets/audio/brr", name);
    const audio = waveImporter.import({
      bytes: fs.readFileSync(file),
      mediaType: "audio/wav",
    }).value;
    const entries = includes.entries.filter((item) => item.directive.includes(name));
    assert.ok(entries.length > 0);
    const fullBytes = entries.reduce((sum, item) => sum + item.end - item.start, 0);
    assert.equal((audio.samples.length / 16) * 9, fullBytes);
    const loopFlag = original[entries.at(-1).end - 9] & 2;
    const loopByteOffset = original.readUInt16LE(0x33e5c + (id - 1) * 2);
    assert.equal(loopByteOffset % 9, 0);
    const loop = loopFlag ? { start: (loopByteOffset / 9) * 16, end: audio.samples.length } : false;
    const bytes = writePcmWave(new Int16Array(audio.samples.length), audio.sampleRate);
    fs.writeFileSync(file, bytes); // A conventional editor drops sBRR; the recipe supplies loop ownership.
    const native = Buffer.alloc(fullBytes);
    native[fullBytes - 9] = 1 | loopFlag;
    const options = { loop, fullByteLength: fullBytes };
    const encoded = convertBrrWave({ bytes, mediaType: "audio/wav" }, options).outputs.brr;
    assert.deepEqual(Buffer.from(encoded.bytes), native);
    assert.equal(encoded.metadata.peakError, 0);
    assert.equal(encoded.metadata.rmsError, 0);
    const loopText = loop ? `{ start: ${loop.start}, end: ${loop.end} }` : "false";
    let cursor = 0;
    for (const item of entries) {
      expected.set(native.subarray(cursor, cursor + item.end - item.start), item.start);
      cursor += item.end - item.start;
      const before = item.directive;
      item.directive = before.slice(0, -1) + `, loop: ${loopText}, fullByteLength: ${fullBytes})`;
      const bank = path.join(
        root,
        `disassembly/banks/bank-${Math.floor(item.start / 65536)
          .toString(16)
          .padStart(3, "0")}.asm`,
      );
      const text = fs.readFileSync(bank, "utf8");
      assert.equal(text.split(before).length, 2);
      fs.writeFileSync(bank, text.replace(before, item.directive));
    }
    report.assets.push({
      kind: "audio",
      name,
      sampleFrames: audio.samples.length,
      encodedBytes: fullBytes,
      loop,
      spans: entries.map(({ start, end }) => ({ start, end })),
    });
  }
  fs.writeFileSync(includesFile, JSON.stringify(includes, null, 2) + "\n");
  const pngPath = path.join(root, "disassembly/assets/images/enemy/rabite-frames.png");
  const png = fs.readFileSync(pngPath);
  const image = pngImporter.import({ bytes: png, mediaType: "image/png" }).value;
  assert.equal(image.kind, "indexed-image");
  const atlas = JSON.parse(fs.readFileSync(pngPath.replace(".png", ".layout.json")));
  const first = atlas.segments["rabite-tiles-1"].tiles[0];
  const at = first.y * image.width + first.x;
  const indexes = image.indexes.slice();
  indexes[at] = (indexes[at] % 15) + 1;
  fs.writeFileSync(pngPath, rewriteIndexedPng(png, { indexes }));
  const affected = [];
  // Account for every inverse atlas use of this pixel, including flipped/shared source rectangles.
  for (const [name, segment] of Object.entries(atlas.segments)) {
    const start = Number.parseInt(segment.romAddress, 16) - 0xc00000;
    segment.tiles.forEach((tile, index) => {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const sx = tile.flipX ? 7 - x : x,
            sy = tile.flipY ? 7 - y : y;
          if ((tile.y + sy) * image.width + tile.x + sx !== at) {
            continue;
          }
          const difference = (image.indexes[at] % 16) ^ (indexes[at] % 16);
          for (let plane = 0; plane < 4; plane++) {
            const offset = start + index * 32 + Math.floor(plane / 2) * 16 + y * 2 + (plane % 2);
            expected[offset] ^= ((difference >> plane) & 1) << (7 - x);
          }
          affected.push({ name, index, x, y });
        }
      }
    });
  }
  assert.ok(affected.length);
  report.assets.push({ kind: "indexed-png", path: pngPath, changedPixel: at, affected });
  const roomPath = path.join(root, "disassembly/assets/rooms/room-0008.json");
  const room = JSON.parse(fs.readFileSync(roomPath));
  assert.equal(room.pieces[0].x, 0);
  assert.equal(room.pieces[0].marker, 0xfe);
  room.pieces[0].x = 1;
  expected[room.sections.assembly.address - 0xc00000 + 4] = 2;
  room.triggers[0] ^= 1;
  expected[room.sections.triggers.address - 0xc00000] ^= 1;
  fs.writeFileSync(roomPath, JSON.stringify(room, null, 2) + "\n");
  const entityPath = path.join(root, "disassembly/assets/rooms/room-0010.json");
  const entityRoom = JSON.parse(fs.readFileSync(entityPath));
  assert.equal(entityRoom.entities[0].x, 10);
  entityRoom.entities[0].x = 11;
  expected[entityRoom.sections.objects.address - 0xc00000 + 10] ^= 1;
  fs.writeFileSync(entityPath, JSON.stringify(entityRoom, null, 2) + "\n");
  report.assets.push({
    kind: "room-json",
    edits: [
      "room 0008 first map-piece x: 0 → 1",
      "room 0008 first trigger bit zero toggled",
      "room 0010 first entity x: 10 → 11",
    ],
  });
  assert.deepEqual(fs.readFileSync((await operation("build")).outputFile), expected);
  await sourceGit(root, ["add", "disassembly"]);
  await sourceGit(root, [
    "commit",
    "-m",
    "Verify ordinary image, room and WAVE edits with persistent audio recipes",
  ]);
  for (let cycle = 0; cycle < 3; cycle++) {
    const generation = await operation("prepare");
    assert.equal(generation.verification.outputSha256, sourceContentHash(original));
    const candidate = generation.generation.commit;
    assert.deepEqual((await operation("preview", { candidate })).conflicts, []);
    const applied = await operation("apply", { candidate });
    if (applied.phase === "merging") {
      assert.equal((await operation("finish")).phase, "verified");
    } else {
      assert.equal(applied.phase, "verified");
    }
    assert.deepEqual(fs.readFileSync((await operation("build")).outputFile), expected);
  }
  report.expectedSha256 = sourceContentHash(expected);
  report.head = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  report.success = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  throw error;
} finally {
  report.finished = new Date().toISOString();
  fs.writeFileSync(
    path.join(clone, ".verification/authored-assets.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  if (added && report.success) {
    assert.equal((await sourceGit(root, ["status", "--porcelain"])).stdout.toString(), "");
    await sourceGit(clone, ["worktree", "remove", "--force", root]);
    fs.rmSync(parent, { recursive: true });
  } else {
    console.log(`Retained verification workspace: ${root}`);
  }
  console.log(JSON.stringify(report, null, 2));
}
