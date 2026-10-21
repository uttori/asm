import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { sourceContentHash } from "@uttori/asm-disassembler/source-project";

import { test } from "../../../tests/ava-helper.js";
import { createSnesAssemblerEnvironment } from "../src/assembler.js";
import { checkSnesRomExpansion } from "../src/disassembler/rom-layout/expansion.js";
import { prepareSnesSourceExpansion } from "../src/disassembler/rom-layout/source-expansion.js";
import {
  prepareSnesSourceRelocation,
  type SnesSourceObject,
} from "../src/disassembler/rom-layout/source-relocation.js";
import { inspectSnesSource } from "../src/disassembler/source-build.js";

/** Independent power-of-two checksum oracle, including the checksum/complement's fixed byte sum. */
function checksum(bytes: Buffer, header: number): void {
  bytes.writeUInt32LE(0xffff, header + 0x1c);
  let value = 0;
  for (const byte of bytes) {
    value = (value + byte) % 65536;
  }
  bytes.writeUInt16LE(value ^ 0xffff, header + 0x1c);
  bytes.writeUInt16LE(value, header + 0x1e);
}

for (const mapper of ["hirom", "lorom"] as const) {
  test(`${mapper} explicit expansion preserves existing bytes and supports repeated asset relocation`, async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-expansion-"));
    t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
    const original = Buffer.alloc(0x10000);
    const header = mapper === "hirom" ? 0xffc0 : 0x7fc0;
    original[header + 0x15] = mapper === "hirom" ? 0x31 : 0x30;
    original[header + 0x17] = 6;
    const logicalAddress = (offset: number) =>
      mapper === "hirom"
        ? 0xc00000 + offset
        : 0x808000 + Math.floor(offset / 0x8000) * 0x10000 + (offset % 0x8000);
    original.writeUIntLE(logicalAddress(0x100), 0, 3);
    original.set([0x11, 0x22], 0x100);
    checksum(original, header);
    fs.mkdirSync(path.join(root, "raw"));
    fs.writeFileSync(path.join(root, "raw/000000.bin"), original);
    const source = `${mapper}
org $${logicalAddress(0).toString(16)}
dl $${logicalAddress(0x100).toString(16)}
incbin "raw/000000.bin":$3..$100
Asset:
db $11, $22
AssetEnd:
incbin "raw/000000.bin":$102..$${(header + 0x17).toString(16)}
RomSize:
db $06 ; capacity
incbin "raw/000000.bin":$${(header + 0x18).toString(16)}..$${mapper === "hirom" ? "10000" : "8000"}
${mapper === "lorom" ? 'org $818000\nincbin "raw/000000.bin":$8000..$10000' : ""}
`;
    fs.writeFileSync(path.join(root, "main.asm"), source);
    const object: SnesSourceObject = {
      id: "asset",
      kind: "asset",
      file: "main.asm",
      startSymbol: "Asset",
      endSymbol: "AssetEnd",
      start: 0x100,
      length: 2,
      originalStart: 0x100,
      originalEnd: 0x102,
      alignment: 1,
      bankSize: mapper === "hirom" ? 0x10000 : 0x8000,
      movable: true,
      referencesComplete: true,
    };
    const build = {
      root,
      entrySource: "main.asm",
      environment: await createSnesAssemblerEnvironment(),
      expectedSize: original.length,
      targetOptions: { checksumEnabled: false },
      rawBlocks: { directory: "raw", original, blockSize: 0x10000 },
    };
    const expansion = {
      mapper,
      maximumSize: 0x400000,
      fillByte: 0xff,
      checksum: "recalculate" as const,
    };
    const result = prepareSnesSourceExpansion({
      build,
      expansion,
      size: 0x20000,
      freeSpace: [],
      logicalAddress,
    });
    t.is(fs.readFileSync(path.join(root, "main.asm"), "utf8"), source);
    const expected = Buffer.alloc(0x20000, 0xff);
    expected.set(original);
    expected[header + 0x17] = 7;
    checksum(expected, header);
    t.is(result.outputSha256, sourceContentHash(expected));
    t.deepEqual(checkSnesRomExpansion(expected, original, expected.length, expansion), []);
    t.throws(() => checkSnesRomExpansion(expected, original, expected.length, undefined), {
      message: /explicit expansion policy/,
    });
    t.throws(() => checkSnesRomExpansion(expected, original, 0x800000, expansion), {
      message: /4 MiB/,
    });
    const corrupt = Buffer.from(expected);
    corrupt[0x18000] = 1;
    checksum(corrupt, header);
    t.regex(
      checkSnesRomExpansion(corrupt, original, expected.length, expansion)[0].message,
      /outside declared objects/,
    );
    corrupt.set(expected);
    corrupt[header + 0x17] = 6;
    checksum(corrupt, header);
    t.regex(
      checkSnesRomExpansion(corrupt, original, expected.length, expansion)[0].message,
      /size header/,
    );
    corrupt.set(expected);
    corrupt[header + 0x15] ^= 0x10;
    checksum(corrupt, header);
    t.regex(
      checkSnesRomExpansion(corrupt, original, expected.length, expansion)[0].message,
      /mapper/,
    );
    corrupt.set(expected);
    corrupt[header + 0x1c] ^= 1;
    t.regex(
      checkSnesRomExpansion(corrupt, original, expected.length, expansion)[0].message,
      /checksum/,
    );

    for (const edit of result.edits) {
      fs.writeFileSync(
        path.join(root, edit.path),
        edit.after.replace("db $11, $22", "db $11, $22, $33"),
      );
    }
    const expandedBuild = {
      ...build,
      expansion,
      expectedSize: expected.length,
      targetOptions: { checksumEnabled: true },
    };
    const moved = prepareSnesSourceRelocation({
      build: expandedBuild,
      objects: [object],
      objectId: object.id,
      logicalAddress,
      freeSpace: result.freeSpace,
      references: [
        {
          id: "pointer",
          target: "asset",
          offset: 0,
          encoding: "long24",
          expected: [...original.subarray(0, 3)],
          expression: `$${logicalAddress(0x100).toString(16)}`,
        },
      ],
    });
    t.is(moved.object.start, 0x10000);
    expected.set([0x11, 0x22, 0x33], 0x10000);
    expected.writeUIntLE(logicalAddress(0x10000), 0, 3);
    checksum(expected, header);
    t.is(moved.outputSha256, sourceContentHash(expected));
    for (const edit of moved.edits) {
      fs.writeFileSync(
        path.join(root, edit.path),
        edit.after.replace("db $11, $22, $33", "db $11, $22, $33, $44"),
      );
    }
    const again = prepareSnesSourceRelocation({
      build: expandedBuild,
      objects: [moved.object],
      objectId: object.id,
      logicalAddress,
      freeSpace: result.freeSpace,
      references: moved.references,
    });
    t.is(again.object.start, 0x10003);
    expected.fill(0xff, 0x10000, 0x10003);
    expected.set([0x11, 0x22, 0x33, 0x44], 0x10003);
    expected.writeUIntLE(logicalAddress(0x10003), 0, 3);
    checksum(expected, header);
    t.is(again.outputSha256, sourceContentHash(expected));
    const inspection = inspectSnesSource({
      ...expandedBuild,
      overlays: new Map(again.edits.map((edit) => [edit.path, Buffer.from(edit.after)])),
      placements: { objects: [again.object], references: again.references, logicalAddress },
    });
    t.deepEqual(inspection.diagnostics, []);
    t.deepEqual(Buffer.from(inspection.output), expected);
  });
}
