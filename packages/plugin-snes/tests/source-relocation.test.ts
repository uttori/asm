import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { decompressSomLz } from "@uttori/asm-assets/secret-of-mana/lz";
import somAssetPlugin from "@uttori/asm-assets/secret-of-mana/som-asset-plugin";
import { PluginManager } from "@uttori/asm-core";
import { sourceContentHash } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import snesPlugin, { createSnesAssemblerEnvironment } from "../src/assembler.js";
import {
  prepareSnesSourceRelocation,
  type SnesSourceObject,
  type SnesSourceReference,
} from "../src/disassembler/rom-layout/source-relocation.js";
import { inspectSnesSource } from "../src/disassembler/source-build.js";

test("asset growth across the old bank boundary measures safely and repairs both fields of one initializer", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-split-bank-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = Buffer.alloc(0x20000);
  original.set([0xc0, 0, 0xfe, 0xff]);
  original.set([0x11, 0x22], 0xfffe);
  fs.mkdirSync(path.join(root, "raw"));
  fs.writeFileSync(path.join(root, "raw/000000.bin"), original.subarray(0, 0x10000));
  fs.writeFileSync(path.join(root, "raw/010000.bin"), original.subarray(0x10000));
  fs.writeFileSync(path.join(root, "pixels.bin"), Uint8Array.of(0x11, 0x22, 0x33));
  fs.writeFileSync(
    path.join(root, "main.asm"),
    `hirom
struct Pointer $C00000
.bank: db
.reserved: db
.offset: dw
endstruct
org $C00000
dataStruct Pointer, {
  bank = $C0,
  reserved = $00,
  offset = $FFFE
}
incbin "raw/000000.bin":$4..$FFFE
Graphic:
includeAsset("pixels.bin", "raw")
GraphicEnd:
org $C10000
Pool:
incbin "raw/010000.bin":$0..$20
PoolEnd:
incbin "raw/010000.bin":$20..$10000
`,
  );
  const build = {
    root,
    entrySource: "main.asm",
    environment: await createSnesAssemblerEnvironment(),
    expectedSize: original.length,
    targetOptions: { checksumEnabled: false },
    rawBlocks: { original, directory: "raw", blockSize: 0x10000 },
  };
  t.throws(() => inspectSnesSource(build), { message: /bank_border_crossed/ });
  const result = prepareSnesSourceRelocation({
    build,
    objectId: "pixels",
    logicalAddress: (offset) => 0xc00000 + offset,
    objects: [
      {
        id: "pixels",
        kind: "asset",
        file: "main.asm",
        startSymbol: "Graphic",
        endSymbol: "GraphicEnd",
        originalStart: 0xfffe,
        originalEnd: 0x10000,
        start: 0xfffe,
        length: 2,
        alignment: 1,
        bankSize: 0x10000,
        movable: true,
        referencesComplete: true,
      },
    ],
    references: [
      {
        id: "bank",
        target: "pixels",
        offset: 0,
        expected: [0xc0],
        encoding: "bank8",
        expression: "$C0",
        pair: "source",
      },
      {
        id: "low",
        target: "pixels",
        offset: 2,
        expected: [0xfe, 0xff],
        encoding: "low16",
        expression: "$FFFE",
        pair: "source",
      },
    ],
    freeSpace: [
      {
        id: "free",
        start: 0x10000,
        end: 0x10020,
        file: "main.asm",
        startSymbol: "Pool",
        endSymbol: "PoolEnd",
        originalSha256: sourceContentHash(original.subarray(0x10000, 0x10020)),
      },
    ],
  });
  const expected = Buffer.from(original);
  expected.set([0xc1, 0, 0, 0]);
  expected.set([0x11, 0x22, 0x33], 0x10000);
  t.is(result.outputSha256, sourceContentHash(expected));
  t.regex(result.edits[0].after, /bank = \(\(Graphic >> 16\) & \$FF\)/);
  t.regex(result.edits[0].after, /offset = \(Graphic & \$FFFF\)/);
});

test("multiline typed pointer rows repair their exact encoded fields even when their values repeat", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-typed-pointer-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = Buffer.alloc(0x80);
  original.set([0x20, 0, 0xc0, 0x20, 0, 0xc0]);
  original.set([0x11, 0x22], 0x20);
  fs.mkdirSync(path.join(root, "raw"));
  fs.writeFileSync(path.join(root, "raw/000000.bin"), original);
  const source = `hirom
struct Pointers $C00000
.target: dl
endstruct count 2 firstindex 0
org $C00000
dataStructs Pointers
[0] = {
  target = $C00020
}
[1] = {
  target = $C00020
}
endDataStructs
incbin "raw/000000.bin":$6..$20
Asset:
db $11, $22, $33
AssetEnd:
incbin "raw/000000.bin":$22..$40
Pool:
incbin "raw/000000.bin":$40..$50
PoolEnd:
incbin "raw/000000.bin":$50..$80
`;
  fs.writeFileSync(path.join(root, "main.asm"), source);
  const build = {
    root,
    entrySource: "main.asm",
    environment: await createSnesAssemblerEnvironment(),
    expectedSize: original.length,
    targetOptions: { checksumEnabled: false },
    rawBlocks: { original, directory: "raw", blockSize: 0x1000 },
  };
  const inspection = inspectSnesSource(build);
  t.deepEqual(
    inspection.mapping.structFields.map(({ reference, expression, size, outputOffset, line }) => ({
      reference,
      expression,
      size,
      outputOffset,
      line,
    })),
    [
      { reference: "Pointers[0].target", expression: "$C00020", size: 3, outputOffset: 0, line: 7 },
      {
        reference: "Pointers[1].target",
        expression: "$C00020",
        size: 3,
        outputOffset: 3,
        line: 10,
      },
    ],
  );
  const result = prepareSnesSourceRelocation({
    build,
    objectId: "asset",
    logicalAddress: (offset) => 0xc00000 + offset,
    objects: [
      {
        id: "asset",
        kind: "asset",
        file: "main.asm",
        startSymbol: "Asset",
        endSymbol: "AssetEnd",
        originalStart: 0x20,
        originalEnd: 0x22,
        start: 0x20,
        length: 2,
        alignment: 1,
        bankSize: 0x10000,
        movable: true,
        referencesComplete: true,
      },
    ],
    references: [0, 3].map((offset) => ({
      id: `pointer-${offset}`,
      target: "asset",
      offset,
      expected: [0x20, 0, 0xc0],
      encoding: "long24",
      expression: "$C00020",
    })),
    freeSpace: [
      {
        id: "pool",
        file: "main.asm",
        startSymbol: "Pool",
        endSymbol: "PoolEnd",
        start: 0x40,
        end: 0x50,
        originalSha256: sourceContentHash(original.subarray(0x40, 0x50)),
      },
    ],
  });
  const expected = Buffer.from(original);
  expected.set([0x40, 0, 0xc0, 0x40, 0, 0xc0]);
  expected.set([0x11, 0x22, 0x33], 0x40);
  t.is(result.outputSha256, sourceContentHash(expected));
  t.is(result.edits[0].after.split("target = Asset").length, 3);
  t.is(fs.readFileSync(path.join(root, "main.asm"), "utf8"), source);
});

test("compressed asset growth uses actual lossless encoding and repairs its pointer and length", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-compression-relocation-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  // Independent mode-5 stream: one zero literal followed by a 31-byte overlapping copy.
  const pristine = Uint8Array.from([5, 0, 0, 32, 0, 0, 0x9c, 0]);
  t.deepEqual(decompressSomLz(pristine).data, new Uint8Array(32));
  const edited = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  // Distinct bytes require one literal run; this oracle does not invoke the production encoder.
  const encoded = Uint8Array.from([5, 0, 0, 32, 31, ...edited]);
  const original = Buffer.alloc(0x400);
  original.set([0, 1, 0xc0, 8, 0]);
  original.set(pristine, 0x100);
  fs.mkdirSync(path.join(root, "raw"));
  fs.writeFileSync(path.join(root, "raw/000000.bin"), original);
  fs.writeFileSync(path.join(root, "logical.bin"), edited);
  const source = `hirom
org $C00000
dl $C00100
dw 8
incbin "raw/000000.bin":$5..$100
Graphic:
includeAsset("logical.bin", "raw", compress: "som.lz", compressOptions: { mode: 5 })
GraphicEnd:
incbin "raw/000000.bin":$108..$200
Pool:
incbin "raw/000000.bin":$200..$280
PoolEnd:
incbin "raw/000000.bin":$280..$400
`;
  fs.writeFileSync(path.join(root, "main.asm"), source);
  const manager = new PluginManager();
  await manager.activatePlugins([{ plugin: snesPlugin }, { plugin: somAssetPlugin }]);
  const build = {
    root,
    entrySource: "main.asm",
    environment: manager.freeze(),
    expectedSize: original.length,
    targetOptions: { checksumEnabled: false },
    rawBlocks: { directory: "raw", original, blockSize: 0x1000 },
    extents: [{ id: "graphic", startSymbol: "Graphic", endSymbol: "GraphicEnd", size: 8 }],
  };
  const result = prepareSnesSourceRelocation({
    build,
    objectId: "graphic",
    logicalAddress: (offset) => 0xc00000 + offset,
    objects: [
      {
        id: "graphic",
        kind: "asset",
        originalStart: 0x100,
        originalEnd: 0x108,
        start: 0x100,
        length: 8,
        alignment: 1,
        bankSize: 0x10000,
        movable: true,
        referencesComplete: true,
        file: "main.asm",
        startSymbol: "Graphic",
        endSymbol: "GraphicEnd",
      },
    ],
    references: [
      {
        id: "pointer",
        target: "graphic",
        offset: 0,
        expected: [0, 1, 0xc0],
        encoding: "long24",
        expression: "$C00100",
      },
      {
        id: "length",
        target: "graphic",
        offset: 3,
        expected: [8, 0],
        encoding: "length16",
        expression: "8",
      },
    ],
    freeSpace: [
      {
        id: "pool",
        start: 0x200,
        end: 0x280,
        originalSha256: sourceContentHash(original.subarray(0x200, 0x280)),
        file: "main.asm",
        startSymbol: "Pool",
        endSymbol: "PoolEnd",
      },
    ],
  });
  t.is(result.object.length, encoded.length);
  t.is(fs.readFileSync(path.join(root, "main.asm"), "utf8"), source);
  const final = inspectSnesSource({
    ...build,
    extents: result.extents,
    overlays: new Map(result.edits.map((edit) => [edit.path, Buffer.from(edit.after)])),
    placements: {
      objects: [result.object],
      references: result.references,
      logicalAddress: (offset) => 0xc00000 + offset,
    },
  });
  const expected = Buffer.from(original);
  expected.set([0, 2, 0xc0, encoded.length, 0]);
  expected.set(encoded, 0x200);
  t.deepEqual(Buffer.from(final.output), expected);
  t.deepEqual(final.diagnostics, []);
  const decoded = decompressSomLz(final.output.subarray(0x200, 0x200 + encoded.length));
  t.deepEqual(decoded.data, edited);
  t.is(decoded.compressedBytes, encoded.length);
});

test("growing table produces ordinary source edits, symbolic repairs, and an independently checked ROM", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-relocation-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = Buffer.alloc(0x400);
  original.set([0, 1, 0xc0, 4, 2]);
  original.set([0x11, 0x11, 0x22, 0x22], 0x100);
  fs.mkdirSync(path.join(root, "raw"));
  fs.writeFileSync(path.join(root, "raw/000000.bin"), original);
  const source = `hirom
org $C00000
dl $C00100
db 4
db 2
incbin "raw/000000.bin":$5..$100
Table:
dw $1111, $2222, $3333
TableEnd:
incbin "raw/000000.bin":$104..$200
Pool:
incbin "raw/000000.bin":$200..$220
PoolEnd:
incbin "raw/000000.bin":$220..$400
`;
  fs.writeFileSync(path.join(root, "main.asm"), source);
  const environment = await createSnesAssemblerEnvironment();
  const object: SnesSourceObject = {
    id: "table",
    originalStart: 0x100,
    originalEnd: 0x104,
    start: 0x100,
    length: 4,
    alignment: 2,
    bankSize: 0x10000,
    movable: true,
    referencesComplete: true,
    kind: "data",
    file: "main.asm",
    startSymbol: "Table",
    endSymbol: "TableEnd",
  };
  const references: SnesSourceReference[] = [
    {
      id: "pointer",
      target: "table",
      offset: 0,
      expected: [0, 1, 0xc0],
      encoding: "long24",
      expression: "$C00100",
    },
    {
      id: "length",
      target: "table",
      offset: 3,
      expected: [4],
      encoding: "length8",
      expression: "4",
    },
    {
      id: "count",
      target: "table",
      offset: 4,
      expected: [2],
      encoding: "count8",
      unitSize: 2,
      expression: "2",
    },
  ];
  const build = {
    root,
    entrySource: "main.asm",
    environment,
    targetOptions: { checksumEnabled: false },
    expectedSize: original.length,
    rawBlocks: { directory: "raw", original, blockSize: 0x1000 },
    extents: [{ id: "table", startSymbol: "Table", endSymbol: "TableEnd", size: 4 }],
  };
  const options = {
    build,
    objects: [object],
    references,
    objectId: "table",
    freeSpace: [
      {
        id: "pool",
        start: 0x200,
        end: 0x220,
        originalSha256: sourceContentHash(original.subarray(0x200, 0x220)),
        file: "main.asm",
        startSymbol: "Pool",
        endSymbol: "PoolEnd",
      },
    ],
    logicalAddress: (offset: number) => 0xc00000 + offset,
  };
  const result = prepareSnesSourceRelocation(options);
  t.is(result.plan.destination, 0x200);
  t.is(result.object.length, 6);
  t.is(fs.readFileSync(path.join(root, "main.asm"), "utf8"), source);
  t.is(result.edits.length, 1);
  t.true(result.edits[0]!.after.includes("dl Table"));
  const final = inspectSnesSource({
    ...build,
    overlays: new Map(result.edits.map((edit) => [edit.path, Buffer.from(edit.after)])),
    extents: [{ ...build.extents[0]!, size: 6 }],
  });
  const expected = Buffer.from(original);
  expected.set([0, 2, 0xc0, 6, 3]);
  expected.set([0x11, 0x11, 0x22, 0x22, 0x33, 0x33], 0x200);
  t.deepEqual(Buffer.from(final.output), expected);
  t.is(result.outputSha256, sourceContentHash(expected));
  fs.writeFileSync(path.join(root, "main.asm"), result.edits[0]!.after);
  const again = prepareSnesSourceRelocation({
    ...options,
    objects: [result.object],
    references: result.references,
    build: { ...build, extents: [{ ...build.extents[0]!, size: 6 }] },
  });
  t.deepEqual(again.edits, []);
  t.is(again.outputSha256, result.outputSha256);
  fs.writeFileSync(
    path.join(root, "main.asm"),
    result.edits[0]!.after.replace("dw $1111, $2222, $3333", "dw $1111, $2222, $3333, $4444"),
  );
  const grownAgain = prepareSnesSourceRelocation({
    ...options,
    objects: [result.object],
    references: result.references,
    build: { ...build, extents: result.extents },
  });
  t.is(grownAgain.object.start, 0x206);
  const expectedAgain = Buffer.from(original);
  expectedAgain.set([6, 2, 0xc0, 8, 4]);
  expectedAgain.set([0x11, 0x11, 0x22, 0x22, 0x33, 0x33, 0x44, 0x44], 0x206);
  t.is(grownAgain.outputSha256, sourceContentHash(expectedAgain));
  fs.writeFileSync(
    path.join(root, "main.asm"),
    grownAgain.edits[0]!.after.replace("dw $1111, $2222, $3333, $4444", "dw $1111, $2222"),
  );
  const returned = prepareSnesSourceRelocation({
    ...options,
    destination: 0x100,
    objects: [grownAgain.object],
    references: grownAgain.references,
    build: { ...build, extents: grownAgain.extents },
  });
  t.is(returned.object.start, 0x100);
  t.is(returned.outputSha256, sourceContentHash(original));
});

test("typed table growth updates its addressed declaration and rejects an undeclared symbolic pointer", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-typed-relocation-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = Buffer.alloc(0x100);
  original.set([0xfc, 0x20, 0]);
  original.set([0x11, 0x11, 0x22, 0x22], 0x20);
  fs.mkdirSync(path.join(root, "raw"));
  fs.writeFileSync(path.join(root, "raw/000000.bin"), original);
  const definitions = "struct Table $C00020\n  .value: dw\nendstruct count 2 firstindex 0\n";
  fs.writeFileSync(path.join(root, "structs.asm"), definitions);
  const source = `hirom
incsrc "structs.asm"
org $C00000
JSR ($0020,x)
incbin "raw/000000.bin":$3..$20
dataStructs Table
  [0] = { value = $1111 }
  [1] = { value = $2222 }
  [2] = { value = $3333 }
endDataStructs
TableEnd:
incbin "raw/000000.bin":$24..$40
Pool:
incbin "raw/000000.bin":$40..$60
PoolEnd:
incbin "raw/000000.bin":$60..$100
`;
  fs.writeFileSync(path.join(root, "main.asm"), source);
  const environment = await createSnesAssemblerEnvironment();
  const object: SnesSourceObject = {
    id: "table",
    originalStart: 0x20,
    originalEnd: 0x24,
    start: 0x20,
    length: 4,
    alignment: 2,
    bankSize: 0x10000,
    movable: true,
    referencesComplete: true,
    kind: "data",
    file: "main.asm",
    startSymbol: "Table",
    endSymbol: "TableEnd",
    structure: { file: "structs.asm", recordSize: 2 },
  };
  const options = {
    build: {
      root,
      entrySource: "main.asm",
      environment,
      targetOptions: { checksumEnabled: false },
      expectedSize: original.length,
      rawBlocks: { directory: "raw", original, blockSize: 0x1000 },
    },
    objects: [object],
    objectId: object.id,
    references: [
      {
        id: "pointer",
        target: "table",
        offset: 1,
        expected: [0x20, 0],
        encoding: "bank16" as const,
        bank: 0xc0,
        expression: "$0020",
      },
    ],
    freeSpace: [
      {
        id: "pool",
        start: 0x40,
        end: 0x60,
        originalSha256: sourceContentHash(original.subarray(0x40, 0x60)),
        file: "main.asm",
        startSymbol: "Pool",
        endSymbol: "PoolEnd",
      },
    ],
    logicalAddress: (offset: number) => 0xc00000 + offset,
  };
  const relocated = prepareSnesSourceRelocation(options);
  t.is(relocated.object.start, 0x40);
  t.is(
    relocated.edits.find((edit) => edit.path === "structs.asm")!.after,
    "struct Table $C00040\n  .value: dw\nendstruct count 3 firstindex 0\n",
  );
  const expected = Buffer.from(original);
  expected.set([0xfc, 0x40, 0]);
  expected.set([0x11, 0x11, 0x22, 0x22, 0x33, 0x33], 0x40);
  t.is(relocated.outputSha256, sourceContentHash(expected));
  t.is(fs.readFileSync(path.join(root, "structs.asm"), "utf8"), definitions);
  const withMissingReference = source.replace(
    'incbin "raw/000000.bin":$3..$20',
    'dl Table\nincbin "raw/000000.bin":$6..$20',
  );
  fs.writeFileSync(path.join(root, "main.asm"), withMissingReference);
  t.throws(() => prepareSnesSourceRelocation(options), { message: /undeclared bytes at \$3/ });
  t.is(fs.readFileSync(path.join(root, "main.asm"), "utf8"), withMissingReference);
  t.throws(
    () =>
      prepareSnesSourceRelocation({
        ...options,
        objects: [{ ...object, referencesComplete: false }],
      }),
    { message: /complete reference/ },
  );
});

test("closed code growth repairs a long call and carries declared CPU state to the new address", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "source-code-relocation-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const original = Buffer.alloc(0x400);
  original.set([0x22, 0, 1, 0xc0]);
  original.set([0xa9, 1, 0x6b], 0x100);
  fs.mkdirSync(path.join(root, "raw"));
  fs.writeFileSync(path.join(root, "raw/000000.bin"), original);
  fs.writeFileSync(
    path.join(root, "main.asm"),
    `hirom
org $C00000
JSL.l $C00100
incbin "raw/000000.bin":$4..$100
Routine:
LDA.b #$02
NOP
RTL
RoutineEnd:
incbin "raw/000000.bin":$103..$200
Pool:
incbin "raw/000000.bin":$200..$220
PoolEnd:
incbin "raw/000000.bin":$220..$400
`,
  );
  const environment = await createSnesAssemblerEnvironment();
  const object: SnesSourceObject = {
    id: "routine",
    kind: "code",
    originalStart: 0x100,
    originalEnd: 0x103,
    start: 0x100,
    length: 3,
    alignment: 1,
    bankSize: 0x10000,
    movable: true,
    referencesComplete: true,
    closedControlFlow: true,
    returnInstruction: "RTL",
    file: "main.asm",
    startSymbol: "Routine",
    endSymbol: "RoutineEnd",
  };
  const options = {
    build: {
      root,
      entrySource: "main.asm",
      environment,
      targetOptions: { checksumEnabled: false },
      expectedSize: original.length,
      rawBlocks: { directory: "raw", original, blockSize: 0x1000 },
      states: [{ offset: 0x100, e: false, m: true, x: true }],
    },
    objects: [object],
    objectId: object.id,
    freeSpace: [
      {
        id: "pool",
        start: 0x200,
        end: 0x220,
        originalSha256: sourceContentHash(original.subarray(0x200, 0x220)),
        file: "main.asm",
        startSymbol: "Pool",
        endSymbol: "PoolEnd",
      },
    ],
    references: [
      {
        id: "caller",
        target: object.id,
        offset: 1,
        expected: [0, 1, 0xc0],
        encoding: "long24" as const,
        expression: "$C00100",
      },
    ],
    logicalAddress: (offset: number) => 0xc00000 + offset,
  };
  const result = prepareSnesSourceRelocation(options);
  const expected = Buffer.from(original);
  expected.set([0x22, 0, 2, 0xc0]);
  expected.set([0xa9, 2, 0xea, 0x6b], 0x200);
  t.is(result.outputSha256, sourceContentHash(expected));
  t.deepEqual(result.states, [{ offset: 0x200, e: false, m: true, x: true }]);
  t.throws(
    () => prepareSnesSourceRelocation({ ...options, build: { ...options.build, states: [] } }),
    { message: /E\/M\/X entry/ },
  );
  t.throws(
    () =>
      prepareSnesSourceRelocation({
        ...options,
        objects: [{ ...object, closedControlFlow: false }],
      }),
    { message: /closed code boundaries/ },
  );
  const file = path.join(root, "main.asm");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("NOP\nRTL", "ADC.b #$01\nRTL"));
  const grown = prepareSnesSourceRelocation(options);
  const propagated = Buffer.from(original);
  propagated.set([0x22, 0, 2, 0xc0]);
  propagated.set([0xa9, 2, 0x69, 1, 0x6b], 0x200);
  t.is(
    grown.outputSha256,
    sourceContentHash(propagated),
    "New instructions inherit proven predecessor widths",
  );
  const valid = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, valid.replace("ADC.b #$01", "REP #$20\nADC.b #$01"));
  t.throws(() => prepareSnesSourceRelocation(options), {
    message: /propagated CPU state requires 3/,
  });
  fs.writeFileSync(file, valid.replace("RTL\nRoutineEnd", "NOP\nRoutineEnd"));
  t.throws(() => prepareSnesSourceRelocation(options), { message: /control flow leaves/ });
  fs.writeFileSync(file, valid.replace("ADC.b #$01", "JSR $C00020"));
  t.throws(() => prepareSnesSourceRelocation(options), { message: /unsupported callee/ });
});
