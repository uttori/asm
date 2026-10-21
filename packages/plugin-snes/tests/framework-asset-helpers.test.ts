import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

import { test } from "../../../tests/ava-helper.js";
import { decodeFrameworkRelativePointerTable, decodeFrameworkSamplePointers, deriveFrameworkAssetExtractionRanges, deriveFrameworkSampleExtractionRanges } from "@uttori/asm-plugin-snes/disassembler";

const fixtureFile = fileURLToPath(
  new URL("./fixtures/framework-asset-helpers.json", import.meta.url),
);

test("independent Framework helper fixtures preserve relative, asset, and sample table behavior", async (t) => {
  const fixture = JSON.parse(await fs.readFile(fixtureFile, "utf8"));
  const relative = decodeFrameworkRelativePointerTable(
    Uint8Array.from(fixture.relativePointerTable.bytes),
    fixture.relativePointerTable.tableAddress,
  );
  t.deepEqual(
    relative.map((pointer) => pointer.targetAddress),
    fixture.relativePointerTable.targets,
  );

  const assets = deriveFrameworkAssetExtractionRanges(
    Uint8Array.from(fixture.assetTable.pointerBytes),
    fixture.assetTable.headerSize,
  );
  t.deepEqual(assets, fixture.assetTable.ranges);

  const pointers = decodeFrameworkSamplePointers(Uint8Array.from(fixture.sampleBank.pointerBytes));
  t.is(pointers[1].loopOffset, 3);
  t.is(pointers[0].kind, "zero");
  t.is(pointers[4].kind, "unused");
  const samples = deriveFrameworkSampleExtractionRanges(
    pointers,
    fixture.sampleBank.sourceDataStart,
    fixture.sampleBank.sourceDataEnd,
    fixture.sampleBank.aramDataBase,
  );
  t.deepEqual(samples, fixture.sampleBank.ranges);
});

test("Framework helper derivation rejects malformed and ambiguous tables", (t) => {
  t.throws(() => decodeFrameworkRelativePointerTable(new Uint8Array([1]), 0), {
    message: /whole number of words/,
  });
  t.throws(() => deriveFrameworkAssetExtractionRanges(Uint8Array.from([8, 0, 0, 10, 0, 0]), 4), {
    message: /ends before/,
  });
  t.throws(() => decodeFrameworkSamplePointers(Uint8Array.from([1, 0, 0, 0])), {
    message: /loops before/,
  });
  const unordered = decodeFrameworkSamplePointers(
    Uint8Array.from([0x20, 0x10, 0x20, 0x10, 0x10, 0x10, 0x10, 0x10]),
  );
  t.throws(() => deriveFrameworkSampleExtractionRanges(unordered, 0x8000, 0x8100, 0x1000), {
    message: /not ordered/,
  });
});
