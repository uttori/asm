/** Grow actual boss pixels into expanded storage, repair split pointers, and retain them through native merges. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pngImporter, rewriteIndexedPng } from "@uttori/asm-assets/image";
import { decompressSomLz } from "@uttori/asm-assets/secret-of-mana/lz";
import { sourceContentHash, sourceGit } from "@uttori/asm-disassembler/source-project";
import { convertBossImage } from "@uttori/asm-game-secret-of-mana";
import { executeSourceOperation } from "@uttori/asm-workflows/source";

const application = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const clone = path.join(application, "experiments/secret-of-mana-git-workflow-full");
assert.equal(JSON.parse(fs.readFileSync(path.join(clone, ".verification/seed.json"))).root, clone);
const expansion = JSON.parse(fs.readFileSync(path.join(clone, ".verification/expansion.json")));
assert.equal(expansion.success, true);
const parent = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-som-compressed-"));
const root = path.join(parent, "project");
const branch = `codex/verify-compressed-relocation-${Date.now()}`;
const report = { branch, started: new Date().toISOString(), operations: [], success: false };
const bank = "disassembly/banks/bank-01a.asm";
const imagePath = "disassembly/assets/images/enemy/tropicallo-frames.png";
const sidecar = imagePath.replace(".png", ".layout.json");
const palettePath = "disassembly/assets/palettes/rom-palettes.json";
const segment = "tropicallo-family-tiles";
const objectId = "asset:tropicallo-family";
let added = false;

/** Keep operation timing separate from potentially large source proposals. */
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

/** Apply only a proposal computed from these exact files. */
function applyEdits(edits) {
  for (const edit of edits) {
    const file = path.join(root, edit.path);
    assert.equal(sourceContentHash(fs.readFileSync(file)), edit.beforeSha256);
    fs.writeFileSync(file, edit.after);
  }
}

try {
  // The cleanup commit retains the verified expansion and excludes the local dependency symlink.
  report.base = "6d0a4d9d3688a60182d3cdb31e2ff97b652a3066";
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
  assert.equal(sourceContentHash(expected), expansion.expectedSha256);
  const original = fs.readFileSync(path.join(clone, "Secret of Mana (USA).sfc"));
  // Ordinary PNG editors discard private chunks. Keep exact original compression
  // streams in small explicit resources, admitted from verified original ROM ranges.
  const includesPath = path.join(root, "disassembly/asset-includes.json");
  const includes = JSON.parse(fs.readFileSync(includesPath));
  const inputsPath = path.join(root, ".uttori/generation-inputs.json");
  const inputs = JSON.parse(fs.readFileSync(inputsPath));
  report.nativeResources = [];
  for (const entry of includes.entries.filter((item) =>
    item.directive.includes('"som.boss.graphics"'),
  )) {
    const relative = `assets/native/boss-${entry.start.toString(16).padStart(6, "0")}.bin`;
    const bytes = original.subarray(entry.start, entry.end);
    const file = path.join(root, "disassembly", relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    const replacement = entry.directive.replace(/\)$/, `, native: "../${relative}")`);
    const assembly = path.join(
      root,
      "disassembly/banks",
      `bank-${Math.floor(entry.start / 0x10000)
        .toString(16)
        .padStart(3, "0")}.asm`,
    );
    const text = fs.readFileSync(assembly, "utf8");
    assert.equal(text.split(entry.directive).length, 2);
    fs.writeFileSync(assembly, text.replace(entry.directive, replacement));
    entry.directive = replacement;
    const resource = {
      path: `disassembly/${relative}`,
      sha256: sourceContentHash(bytes),
      romRange: { start: entry.start, end: entry.end },
    };
    inputs.pristineAssets.push(resource);
    report.nativeResources.push(resource);
  }
  assert.equal(report.nativeResources.length, 3);
  inputs.pristineAssets.sort((a, b) => a.path.localeCompare(b.path));
  fs.writeFileSync(includesPath, JSON.stringify(includes, null, 2) + "\n");
  fs.writeFileSync(inputsPath, JSON.stringify(inputs, null, 2) + "\n");
  assert.deepEqual(fs.readFileSync((await operation("build")).outputFile), expected);
  await sourceGit(root, ["add", ".uttori/generation-inputs.json", "disassembly"]);
  await sourceGit(root, [
    "commit",
    "-m",
    "Adopt verified original compressed resources for ordinary PNG authoring",
  ]);
  const adopted = await operation("prepare");
  assert.equal(adopted.verification.outputSha256, sourceContentHash(original));
  assert.deepEqual(
    (await operation("preview", { candidate: adopted.generation.commit })).conflicts,
    [],
  );
  await operation("apply", { candidate: adopted.generation.commit });
  assert.equal((await operation("finish")).phase, "verified");
  assert.deepEqual(fs.readFileSync((await operation("build")).outputFile), expected);
  report.nativeAdoptionHead = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout
    .toString()
    .trim();
  const source = { bytes: fs.readFileSync(path.join(root, imagePath)), mediaType: "image/png" };
  const atlas = JSON.parse(fs.readFileSync(path.join(root, sidecar)));
  const resources = {
    "layout.json": {
      bytes: fs.readFileSync(path.join(root, sidecar)),
      mediaType: "application/json",
    },
    "palettes.json": {
      bytes: fs.readFileSync(path.join(root, palettePath)),
      mediaType: "application/json",
    },
    "native.bin": {
      bytes: original.subarray(0x1ae598, 0x1af3c7),
      mediaType: "application/octet-stream",
    },
  };
  const options = {
    layout: "layout.json",
    palettes: "palettes.json",
    segment,
    storage: "lz-rle",
    byteLength: 3631,
    sizePolicy: "encoded",
    native: "native.bin",
  };
  assert.deepEqual(
    Buffer.from(convertBossImage(source, options, resources).outputs.graphics.bytes),
    original.subarray(0x1ae598, 0x1af3c7),
  );
  const image = pngImporter.import(source).value;
  assert.equal(image.kind, "indexed-image");
  const indexes = image.indexes.slice();
  let random = 0x13579bdf;
  for (const tile of atlas.segments[segment].tiles) {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        random ^= random << 13;
        random ^= random >>> 17;
        random ^= random << 5;
        indexes[(tile.y + y) * image.width + tile.x + x] =
          (random >>> 28) + atlas.segments[segment].palette * 16;
      }
    }
  }
  const edited = {
    ...source,
    bytes: rewriteIndexedPng(source.bytes, { indexes }),
  };
  const encoded = convertBossImage(edited, options, resources).outputs.graphics.bytes;
  assert.ok(encoded.length > options.byteLength, "The actual encoded asset must grow");
  // Independent planar oracle, including the atlas's inverse source flips; it never calls the asset encoder.
  const pixels = Buffer.alloc(atlas.segments[segment].tiles.length * 32);
  atlas.segments[segment].tiles.forEach((tile, index) => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const sx = tile.flipX ? 7 - x : x,
          sy = tile.flipY ? 7 - y : y;
        const value = indexes[(tile.y + sy) * image.width + tile.x + sx] % 16;
        for (let plane = 0; plane < 4; plane++) {
          pixels[index * 32 + Math.floor(plane / 2) * 16 + y * 2 + (plane % 2)] |=
            ((value >> plane) & 1) << (7 - x);
        }
      }
    }
  });
  assert.equal(pixels.length, 0x1800);
  const intermediate = decompressSomLz(encoded).data;
  const expanded = Buffer.alloc(pixels.length);
  let cursor = 0;
  for (let output = 0; output < expanded.length;) {
    const mask = intermediate[cursor++];
    for (let bit = 7; bit >= 0; bit--, output++) {
      expanded[output] = mask & (1 << bit) ? intermediate[cursor++] : (expanded[output - 2] ?? 0);
    }
  }
  assert.equal(cursor, intermediate.length);
  assert.deepEqual(expanded, pixels);
  fs.writeFileSync(path.join(root, imagePath), edited.bytes);
  const sourceFile = path.join(root, bank);
  const sourceText = fs.readFileSync(sourceFile, "utf8");
  const line = sourceText
    .split("\n")
    .find((sourceLine) => sourceLine.includes(`segment: "${segment}"`));
  assert.ok(line);
  fs.writeFileSync(
    sourceFile,
    sourceText.replace(
      line,
      `Tropicallo_Graphics:\n${line.replace("byteLength: 3631", 'byteLength: 3631, sizePolicy: "encoded"')}\nTropicallo_Graphics_End:`,
    ),
  );
  // Inspect the whole original image for this game's split record and conventional long encoding.
  const splitUses = [],
    longUses = [];
  for (let offset = 0; offset < original.length - 3; offset++) {
    if (original[offset] === 0xda && original.readUInt16LE(offset + 2) === 0xe598) {
      splitUses.push(offset);
    }
    if (original.readUIntLE(offset, 3) === 0xdae598) {
      longUses.push(offset);
    }
  }
  assert.deepEqual(splitUses, [0x10bc52]);
  assert.deepEqual(longUses, []);
  report.references = {
    splitUses,
    longUses,
    consumer: "Boss_LoadCompressedGraphicsToVram at C22614",
    record: "BossGraphicsRecord00 at D0BC52",
  };
  const layoutFile = path.join(root, ".uttori/layout.json");
  const layout = JSON.parse(fs.readFileSync(layoutFile));
  layout.objects.push({
    id: objectId,
    kind: "asset",
    file: bank,
    startSymbol: "Tropicallo_Graphics",
    endSymbol: "Tropicallo_Graphics_End",
    originalStart: 0x1ae598,
    originalEnd: 0x1af3c7,
    start: 0x1ae598,
    length: 3631,
    alignment: 1,
    bankSize: 0x10000,
    movable: true,
    referencesComplete: true,
  });
  layout.references.push(
    {
      id: "tropicallo-source-bank",
      target: objectId,
      offset: 0x10bc52,
      expected: [0xda],
      encoding: "bank8",
      pair: "tropicallo-source",
      expression: "$DA",
    },
    {
      id: "tropicallo-source-offset",
      target: objectId,
      offset: 0x10bc54,
      expected: [0x98, 0xe5],
      encoding: "low16",
      pair: "tropicallo-source",
      expression: "$E598",
    },
  );
  fs.writeFileSync(layoutFile, JSON.stringify(layout, null, 2) + "\n");
  await assert.rejects(() => operation("build"), /layout|overlap|placement|bank.border/i);
  const relocation = await operation("relocate", { objectId });
  assert.equal(relocation.object.start, 0x200000);
  assert.equal(relocation.object.length, encoded.length);
  expected.set(encoded, 0x200000);
  expected[0x10bc52] = 0xe0;
  expected.writeUInt16LE(0, 0x10bc54);
  // The expanded ROM always derives its checksum from the complete authored image.
  expected.writeUInt32LE(0xffff, 0xffdc);
  const checksum = expected.reduce((sum, value) => (sum + value) & 0xffff, 0);
  expected.writeUInt16LE(checksum ^ 0xffff, 0xffdc);
  expected.writeUInt16LE(checksum, 0xffde);
  assert.equal(relocation.outputSha256, sourceContentHash(expected));
  applyEdits(relocation.edits);
  assert.deepEqual(fs.readFileSync((await operation("build")).outputFile), expected);
  await sourceGit(root, ["add", ".uttori", "disassembly"]);
  await sourceGit(root, [
    "commit",
    "-m",
    "Verify compressed boss pixel growth and split pointer relocation",
  ]);
  for (let cycle = 0; cycle < 3; cycle++) {
    const generation = await operation("prepare");
    assert.equal(generation.verification.outputSha256, sourceContentHash(original));
    const candidate = generation.generation.commit;
    assert.deepEqual((await operation("preview", { candidate })).conflicts, []);
    const applied = await operation("apply", { candidate });
    // A unchanged pure generation can reuse ancestry after a new authored commit;
    // finish verifies that terminal commit without manufacturing a duplicate merge.
    if (applied.phase === "merging" || applied.phase === "committed") {
      assert.equal((await operation("finish")).phase, "verified");
    } else {
      assert.equal(applied.phase, "verified");
    }
    assert.deepEqual(fs.readFileSync((await operation("build")).outputFile), expected);
  }
  report.afterRom = path.join(clone, ".verification/compressed-relocation-after.sfc");
  report.decodedPixels = path.join(clone, ".verification/compressed-relocation-pixels.bin");
  fs.writeFileSync(report.afterRom, expected);
  fs.writeFileSync(report.decodedPixels, pixels);
  report.expectedSha256 = sourceContentHash(expected);
  report.pixelsSha256 = sourceContentHash(pixels);
  report.encodedSha256 = sourceContentHash(encoded);
  report.encodedLength = encoded.length;
  report.destination = 0xe00000;
  report.head = (await sourceGit(root, ["rev-parse", "HEAD"])).stdout.toString().trim();
  report.success = true;
} catch (error) {
  report.error = String(error.stack ?? error);
  throw error;
} finally {
  report.finished = new Date().toISOString();
  fs.writeFileSync(
    path.join(clone, ".verification/compressed-relocation.json"),
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
