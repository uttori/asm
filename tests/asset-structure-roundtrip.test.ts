import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import {
  decodeAsepriteDocument,
  encodeAsepriteDocument,
  renderAsepriteFrame,
} from "@uttori/asm-assets/aseprite";
import { AssetInterchangeService, somSpriteSourceAdapter } from "@uttori/asm-cli/asset-interchange";
import { inspectSourceProject } from "@uttori/asm-cli/source";
import {
  acceptedSourceGeneration,
  applySourceGeneration,
  finishSourceGeneration,
  previewSourceGeneration,
  retainSourceGeneration,
  sourceGit,
  verifySourceGeneration,
} from "@uttori/asm-disassembler";

import { test } from "./ava-helper.js";
import { spriteSourceFixture, buildSpriteSource } from "./fixtures/sprite-source.js";

test("source-owned observation proofs create read-only previews and participate in export freshness", async (t) => {
  const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup)),
    project = JSON.parse(
      fs.readFileSync(path.join(fixture.directory, ".uttori/project.json"), "utf8"),
    ),
    matched = Array.from({ length: 3 }, (_, index) => ({
      frame: "body",
      frameAddress: 0xc00010,
      visibleStart: String(index * 357368),
      visibleEnd: String(index * 357368 + 100000),
      oamTransferId: String(index),
      followingOamTransferId: String(index + 1),
      obsel: 99,
      obselEvidence: "Recorded physical register write.",
      displayControl: 15,
      flipX: false,
      flipY: false,
      paletteBanks: [{ bank: 5, covered: true, bytes: "00".repeat(32) }],
    })),
    proof = gzipSync(
      JSON.stringify({
        format: "som-castle-boss-display-proof",
        version: 1,
        romSha256: project.romSha256,
        captures: [
          {
            slug: "capture",
            primarySha256: "a".repeat(64),
            graphicsSha256: "b".repeat(64),
            contextSha256: "c".repeat(64),
            clock: { id: "snes.master", numerator: "236250000", denominator: "11" },
            matched,
          },
        ],
      }),
    ),
    declaration = {
      format: "som.sprite.observations",
      version: 1,
      id: "observations",
      romSha256: project.romSha256,
      proofSha256: createHash("sha256").update(proof).digest("hex"),
      capture: "capture",
      pivot: { x: 0, y: 0 },
      paletteBanks: [{ bank: 5, bytes: "00".repeat(32) }],
      ranges: [{ id: "Intro", start: "0", end: "714736" }],
    },
    observations = { declaration: "source/observations.json", proof: "source/proof.json.gz" };
  fs.writeFileSync(
    path.join(fixture.directory, observations.declaration),
    JSON.stringify(declaration),
  );
  fs.writeFileSync(path.join(fixture.directory, observations.proof), proof);
  const service = new AssetInterchangeService(fixture.directory, somSpriteSourceAdapter),
    output = path.join(fixture.directory, ".uttori-local/observed.aseprite"),
    selection = { ...fixture.selection, observations },
    manifest = await service.export(selection, { document: output, manifest: output + ".json" }),
    document = await decodeAsepriteDocument(fs.readFileSync(output)),
    tag = document.tags.find((entry) => entry.name === "Intro (observation)")!;
  t.truthy(tag);
  t.is(document.frames[tag.from].durationMs, 33);
  t.deepEqual(
    renderAsepriteFrame(document, tag.from).indexes,
    renderAsepriteFrame(document, 1).indexes,
  );
  t.deepEqual((await service.review(manifest, output)).files, []);
  const changed = {
    ...document,
    frames: document.frames.map((entry, index) => ({
      ...entry,
      durationMs: index === tag.from ? 34 : entry.durationMs,
    })),
  };
  fs.writeFileSync(output, await encodeAsepriteDocument(changed));
  await t.throwsAsync(() => service.review(manifest, output), { message: /preview timing/ });
  fs.writeFileSync(output, await encodeAsepriteDocument(document));
  fs.writeFileSync(path.join(fixture.directory, observations.proof), gzipSync("{}"));
  await t.throwsAsync(() => service.review(manifest, output), { message: /Stale.*proof/ });
  await t.throwsAsync(
    () =>
      service.export(selection, { document: output + ".next", manifest: output + ".next.json" }),
    { message: /ROM\/source identity/ },
  );
  for (const file of fixture.files) {
    t.deepEqual(fs.readFileSync(path.join(fixture.directory, file.path)), file.bytes);
  }
});

/** Independent small-fixture LZ/mask decoder. Native padding is outside the consumed logical stream. */
function bossOracle(
  stream: Uint8Array,
  storage: "rle" | "lz-rle",
): { planar: Uint8Array; consumed: number } {
  let plain = stream,
    consumed = 0;
  if (storage === "lz-rle") {
    assert.equal(stream[0], 0);
    plain = new Uint8Array((stream[2] << 8) | stream[3]);
    let input = 4,
      output = 0;
    while (output < plain.length) {
      const token = stream[input++];
      if (token < 128) {
        const length = token + 1;
        assert.ok(output + length <= plain.length && input + length <= stream.length);
        plain.set(stream.subarray(input, input + length), output);
        input += length;
        output += length;
      } else {
        const distance = ((token & 31) << 8) + stream[input++] + 1,
          length = ((token & 127) >> 5) + 3;
        assert.ok(distance <= output && output + length <= plain.length);
        for (let index = 0; index < length; index++) {
          plain[output] = plain[output - distance];
          output++;
        }
      }
    }
    consumed = input;
  }
  const planar = new Uint8Array(128);
  let input = 0;
  for (let group = 0; group < 16; group++) {
    const mask = plain[input++];
    for (let bit = 0; bit < 8; bit++) {
      const output = group * 8 + bit;
      if (mask & (128 >> bit)) {
        planar[output] = plain[input++];
      } else if (output >= 2) {
        planar[output] = planar[output - 2];
      }
    }
  }
  if (storage === "lz-rle") {
    assert.equal(input, plain.length);
  } else {
    consumed = input;
  }
  return { planar, consumed };
}

test("production tilemap host edits native owners and preserves the complete ROM through two Git generations", async (t) => {
  const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup));
  const service = new AssetInterchangeService(fixture.directory, somSpriteSourceAdapter);
  const output = path.join(fixture.directory, ".uttori-local/structure.aseprite");
  const manifest = await service.export(fixture.selection, {
    document: output,
    manifest: output + ".json",
  });
  const before = await decodeAsepriteDocument(fs.readFileSync(output));
  t.is(before.layers[0].kind, "tilemap");
  t.true(before.layers[0].name.startsWith("Tiles"));
  t.is(before.tilesets[0].tileCount, 5);
  t.is(before.frames.length, 2);
  const noEdit = await service.review(manifest, output);
  t.deepEqual(noEdit.files, []);
  t.is((await service.apply(manifest, output, noEdit.id)).transaction, undefined);
  const after = {
    ...before,
    palette: before.palette.map((color): [number, number, number, number] => [...color]),
  };
  after.tilesets[0].indexes[64] ^= 1;
  after.palette[1] = [16, 0, 0, 255];
  fs.writeFileSync(output, await encodeAsepriteDocument(after));
  const review = await service.review(manifest, output);
  t.deepEqual(review.files.map((file) => path.basename(file.path)).toSorted(), [
    "palettes.json",
    "sprite.layout.json",
    "sprite.png",
  ]);
  await service.apply(manifest, output, review.id);
  const expected = Buffer.from(fixture.original);
  expected[0x200] ^= 0x80;
  expected[0x100] = 2;
  t.deepEqual(Buffer.from((await inspectSourceProject(fixture.directory)).output), expected);
  t.is(fs.readFileSync(path.join(fixture.directory, "source/main.asm"), "utf8"), fixture.source);
  const nextOutput = output + ".next";
  const nextManifest = await service.export(fixture.selection, {
    document: nextOutput,
    manifest: nextOutput + ".json",
  });
  const next = await decodeAsepriteDocument(fs.readFileSync(nextOutput));
  t.deepEqual(next.palette[1], [16, 0, 0, 255]);
  t.is(next.tilesets[0].indexes[64], 1);
  t.deepEqual((await service.review(nextManifest, nextOutput)).files, []);
  // A flipped native block must display the edited owner at its reflected native coordinate.
  t.is(renderAsepriteFrame(next, 1).indexes[15], 1);
  await sourceGit(fixture.directory, ["add", "--all"]);
  await sourceGit(fixture.directory, ["commit", "-m", "Authored tilemap pixel and palette edit"]);
  for (let cycle = 0; cycle < 2; cycle++) {
    const accepted = await acceptedSourceGeneration(
      fixture.repository,
      (await sourceGit(fixture.directory, ["rev-parse", "HEAD"])).stdout.toString().trim(),
    );
    t.truthy(accepted);
    const candidate = await retainSourceGeneration(fixture.repository, {
      parent: accepted,
      files: fixture.files,
      inputs: { ...fixture.generationInputs, evidenceSha256: String(cycle + 1).repeat(64) },
    });
    await verifySourceGeneration(fixture.repository, candidate.commit);
    const preview = await previewSourceGeneration(fixture.repository, candidate.commit);
    t.deepEqual(preview.conflicts, []);
    await applySourceGeneration(fixture.repository, candidate, preview);
    await finishSourceGeneration(fixture.repository, {
      message: `Native generation ${cycle + 1}`,
      validate: () => buildSpriteSource(fixture.directory),
    });
    t.deepEqual(Buffer.from((await inspectSourceProject(fixture.directory)).output), expected);
  }
});

for (const storage of ["rle", "lz-rle"] as const) {
  test(`${storage} source resources preserve original no-op tokens and independently decode bounded edits`, async (t) => {
    const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup), storage);
    const service = new AssetInterchangeService(fixture.directory, somSpriteSourceAdapter),
      output = path.join(fixture.directory, ".uttori-local/boss.aseprite");
    const original = fs.readFileSync(path.join(fixture.directory, "source/native.bin")),
      times = fixture.files.map(
        (file) => fs.statSync(path.join(fixture.directory, file.path), { bigint: true }).mtimeNs,
      );
    const manifest = await service.export(fixture.selection, {
      document: output,
      manifest: output + ".json",
    });
    const noEdit = await service.review(manifest, output);
    t.deepEqual(noEdit.files, []);
    await service.apply(manifest, output, noEdit.id);
    t.deepEqual(
      Buffer.from((await inspectSourceProject(fixture.directory)).output),
      fixture.original,
    );
    t.deepEqual(
      fixture.files.map(
        (file) => fs.statSync(path.join(fixture.directory, file.path), { bigint: true }).mtimeNs,
      ),
      times,
    );
    const document = await decodeAsepriteDocument(fs.readFileSync(output));
    document.tilesets[0].indexes[64] ^= 1;
    fs.writeFileSync(output, await encodeAsepriteDocument(document));
    const review = await service.review(manifest, output);
    await service.apply(manifest, output, review.id);
    const current = (await inspectSourceProject(fixture.directory)).output,
      native = current.subarray(0x200, 0x200 + original.length);
    const expected = bossOracle(original, storage).planar;
    expected[0] ^= 0x80;
    const decoded = bossOracle(native, storage);
    t.deepEqual(decoded.planar, expected);
    t.deepEqual(
      native.subarray(decoded.consumed),
      Uint8Array.from(original.subarray(decoded.consumed)),
    );
    t.deepEqual(current.subarray(0, 0x200), Uint8Array.from(fixture.original.subarray(0, 0x200)));
    t.deepEqual(
      current.subarray(0x200 + original.length),
      Uint8Array.from(fixture.original.subarray(0x200 + original.length)),
    );
    t.deepEqual(fs.readFileSync(path.join(fixture.directory, "source/native.bin")), original);
    if (storage === "lz-rle") {
      t.is(native[0], original[0]);
      t.is(native[1], 0x73);
    }
  });
}

test("an oversized boss edit rejects without replacing source or compression references", async (t) => {
  const fixture = await spriteSourceFixture((cleanup) => t.teardown(cleanup), "rle", true);
  const service = new AssetInterchangeService(fixture.directory, somSpriteSourceAdapter),
    output = path.join(fixture.directory, ".uttori-local/small-boss.aseprite");
  const manifest = await service.export(fixture.selection, {
    document: output,
    manifest: output + ".json",
  });
  const document = await decodeAsepriteDocument(fs.readFileSync(output));
  document.tilesets[0].indexes[64] = 1;
  fs.writeFileSync(output, await encodeAsepriteDocument(document));
  await t.throwsAsync(() => service.review(manifest, output), { message: /fixed ROM span/ });
  for (const file of fixture.files) {
    t.deepEqual(fs.readFileSync(path.join(fixture.directory, file.path)), file.bytes);
  }
});
