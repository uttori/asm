import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";

/** Exercise cached CLI/include execution as well as the incremental public API. */
function assemble(source: string, incremental = false): Assembler {
  const assembler = new Assembler();
  if (incremental) {
    for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
      assembler.activateStage(stage);
      assembler.setCurrentFile("records.asm");
      source.split("\n").forEach((line, index) => {
        assembler.setCurrentLine(index);
        assembler.processCommand(line);
      });
      assembler.finishPass();
    }
  } else {
    const program = assembler.buildProgramModel(source, "records.asm");
    for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
      assembler.runStage(stage, program);
    }
  }
  return assembler;
}

const header = `lorom
org $808000
struct Record $808000
  .value: dw
endstruct`;

for (const incremental of [false, true]) {
  const mode = incremental ? "incremental" : "cached program";
  test(`typed fields are non-emitting and named records use layout order (${mode})`, (t) => {
    const assembler = assemble(
      `lorom
org $808000
struct Record $808000
  .byte: db
  .word: dw
  .pointer: dl
  .wide: dd
  .array: dw[2]
  .opaque: skip 2
endstruct
dataStruct Record, {
  opaque = [$AB, $CD],
  array = [$1234, $5678],
  wide = $FFFFFFFF,
  pointer = $FEDCBA,
  word = $8000,
  byte = $FF
}
After:
assert After == $808010`,
      incremental,
    );
    t.deepEqual(
      [...assembler.getBinaryOutput()],
      [255, 0, 128, 186, 220, 254, 255, 255, 255, 255, 52, 18, 120, 86, 171, 205],
    );
    t.is(assembler.structs.get("Record")?.size, 16);
    t.is(assembler.structEngine.resolveStructLabel("Record[2].pointer"), 0x808023);
  });

  test(`one-based tables retain indexes and little-endian bytes (${mode})`, (t) => {
    const assembler = assemble(
      `lorom
org $808006
struct Maps $808004
  .offset: dw
endstruct count 1023 firstindex 1
DaTaStRuCtS Maps
  [1] = { offset = $0804 }
  [2] = {
    offset = $080B,
  }
  [3] = { offset = $085C }
  [4] = { offset = $0864 }
EnDdAtAsTrUcTs`,
      incremental,
    );
    t.deepEqual([...assembler.getBinaryOutput().slice(6)], [4, 8, 11, 8, 92, 8, 100, 8]);
  });

  test(`forward expressions, functions and macros work (${mode})`, (t) => {
    const assembler = assemble(
      `${header}
macro entry(v)
  dataStruct Record, { value = <v> }
endmacro
%entry((Later & $FFFF))
Later:
db $AB`,
      incremental,
    );
    t.deepEqual([...assembler.getBinaryOutput()], [2, 128, 171]);
  });

  test(`tables inside macros and conditionals execute in their own pass (${mode})`, (t) => {
    const assembler = assemble(
      `${header}
macro entries()
dataStructs Record
  [0] = { value = $1234 }
  [1] = { value = $5678 }
endDataStructs
endmacro
if 0
  dataStruct Record, { value = Missing }
else
  %entries()
endif`,
      incremental,
    );
    t.deepEqual([...assembler.getBinaryOutput()], [52, 18, 120, 86]);
  });
}

test("alignment padding requires explicit original bytes", (t) => {
  const assembler = assemble(`lorom
org $808000
struct Record $808000
  .value: db
endstruct align 4
dataStruct Record, { value = 1, __padding = [$AB, $CD, $EF] }`);
  t.deepEqual([...assembler.getBinaryOutput()], [1, 171, 205, 239]);
});

test("a one-element byte array remains distinct from a scalar", (t) => {
  const source = header.replace("dw", "db[1]");
  t.deepEqual([...assemble(`${source}\ndataStruct Record, {value = [7]}`).getBinaryOutput()], [7]);
  t.throws(() => assemble(`${source}\ndataStruct Record, {value = 7}`), {
    message: /requires an array/,
  });
});

const invalidRecords: readonly [string, RegExp][] = [
  ["dataStruct Record, {}", /Missing initializer field/],
  ["dataStruct Record, { value = 1, typo = 2 }", /Unknown initializer field/],
  ["dataStruct Record, { value = 1, value = 2 }", /Duplicate initializer field/],
  ["dataStruct Record, { value = $10000 }", /does not fit/],
  ["dataStruct Record, { value = -1 }", /does not fit/],
  ["dataStruct Record, { value = 1.5 }", /does not fit|Invalid|Unexpected/],
  ["dataStruct Record, { value = [1, 2] }", /requires a scalar/],
  ["dataStruct Record, { value = Missing }", /not found|not defined|Unknown|resolve/],
  ["dataStruct Record, { value = 1,, }", /Empty initializer/],
  ["dataStruct Record, { value = (1] }", /Mismatched initializer/],
  ["dataStruct Record, { value = 1", /Unclosed dataStruct/],
  ["dataStruct Missing, { value = 1 }", /Unknown dataStruct/],
  ["dataStruct Record[-1], { value = 1 }", /Invalid record index/],
  ["dataStruct Record[1], { value = 1 }", /requires pc/],
  ["endDataStructs", /without dataStructs/],
  ["dataStructs Record\nendDataStructs", /at least one record/],
  ["dataStructs Record\n[0] = {value = 1}", /Missing endDataStructs/],
  ["dataStructs Record\n[0] = {value = 1}\n[2] = {value = 2}\nendDataStructs", /Non-contiguous/],
  ["dataStructs Record\n[0] = {value = 1}\n[0] = {value = 2}\nendDataStructs", /Non-contiguous/],
  ["dataStructs Record\norg $808000\nendDataStructs", /accepts only indexed records/],
  ["dataStructs Record\nif 0\nendDataStructs", /accepts only indexed records/],
  ["dataStructs Record\ndataStructs Record\nendDataStructs", /accepts only indexed records/],
  ["dataStructs Missing", /previously defined struct/],
];
for (const [source, message] of invalidRecords) {
  test(`reject malformed record: ${source.replaceAll("\n", " / ")}`, (t) => {
    t.throws(() => assemble(`${header}\n${source}`), { message });
  });
}

test("explicit bounds reject both ends while legacy address arithmetic stays available", (t) => {
  const source = header.replace("endstruct", "endstruct count 2 firstindex 1");
  for (const index of [0, 3]) {
    t.throws(() => assemble(`${source}\ndataStruct Record[${index}], {value = 1}`), {
      message: /out of bounds/,
    });
  }
  const assembler = assemble(`${source}\ndw Record[3].value & $FFFF`);
  t.deepEqual([...assembler.getBinaryOutput()], [6, 128]);
});

test("typed declarations reject bad lengths, defaults and duplicate fields", (t) => {
  for (const declaration of ["dw[0]", "dw[-1]", "dd[65536]", "dw $1234", "dw[]"]) {
    t.throws(() => assemble(header.replace(".value: dw", `.value: ${declaration}`)), {
      message: /Invalid/,
    });
  }
  t.throws(() => assemble(header.replace("endstruct", ".value: db\nendstruct")), {
    message: /Duplicate typed field/,
  });
});

test("explicit raw bytes preserve legacy skip members without inferring a word", (t) => {
  const source = header.replace("dw", "skip 2");
  t.deepEqual(
    [...assemble(`${source}\ndataStruct Record, {value = [$34, $12]}`).getBinaryOutput()],
    [52, 18],
  );
  t.throws(() => assemble(`${source}\ndataStruct Record, {value = $1234}`), {
    message: /requires an array/,
  });
  t.throws(() => assemble(`${source}\ndataStruct Record, {value = [1]}`), {
    message: /requires 2 value/,
  });
});

test("included records retain source ranges, field/value references and trace ownership", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-data-struct-"));
  t.teardown(() => fs.rmSync(directory, { recursive: true, force: true }));
  const entry = path.join(directory, "main.asm");
  const records = path.join(directory, "records.asm");
  fs.writeFileSync(
    entry,
    `${header}\nfunction sum(a,b) = a+b\n!VALUE = 3\nincsrc "records.asm"\nLater:\ndb $CC`,
  );
  fs.writeFileSync(
    records,
    `dataStructs Record
  [0] = { value = sum(!VALUE, 4) }
  [1] = {
    value = Later & $FFFF
  }
endDataStructs`,
  );
  const assembler = new Assembler(undefined, { collectSourceMetadata: true });
  t.teardown(() => assembler.dispose());
  const writes: { line: number; raw: string; value: number }[] = [];
  assembler.setTraceListener((event) => {
    if (event.type === "write" && event.stage === "emitProgram" && event.file === records) {
      writes.push({ line: event.line, raw: event.raw, value: event.value });
    }
  });
  assembler.setCurrentFile(entry);
  assembler.setIncludePaths([directory]);
  assembler.assembleProgram(assembler.buildProgramModel(fs.readFileSync(entry, "utf8"), entry));
  t.deepEqual([...assembler.getBinaryOutput()], [7, 0, 4, 128, 204]);
  t.deepEqual(
    assembler.addressToLineMapping.ranges
      .filter((range) => assembler.addressToLineMapping.fileList[range.fileIdx]?.name === records)
      .map(({ line, start, end }) => ({ line, start, end })),
    [
      { line: 2, start: 0x808000, end: 0x808002 },
      { line: 3, start: 0x808002, end: 0x808004 },
    ],
  );
  t.deepEqual(
    writes.map(({ line }) => line),
    [1, 1, 2, 2],
  );
  t.true(writes[0].raw.startsWith("[0]"));
  t.true(
    assembler.symbolReferences.some(
      (ref) => ref.name === "value" && ref.containerName === "Record",
    ),
  );
  t.true(
    assembler.symbolReferences.some((ref) => ref.name === "Later" && ref.location.file === records),
  );
});

test("failed records do not partially write earlier fields", (t) => {
  const assembler = new Assembler();
  const source = `${header.replace(".value: dw", ".low: db\n.high: db")}\ndataStruct Record, {low = 1, high = 256}`;
  const program = assembler.buildProgramModel(source, "invalid.asm");
  assembler.runStage("collectDefinitions", program);
  assembler.runStage("resolveLayout", program);
  t.throws(() => assembler.runStage("emitProgram", program), { message: /does not fit/ });
  t.is(assembler.currentTargetBaseAddress, 0x808000);
  t.is(assembler.addressToLineMapping.ranges.length, 0);
});

test("incremental multiline records keep their opening source line", (t) => {
  const assembler = new Assembler(undefined, { collectSourceMetadata: true });
  const source = `${header}\ndataStructs Record\n[0] = {\nvalue = 1\n}\nendDataStructs`;
  for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
    assembler.activateStage(stage);
    assembler.setCurrentFile("records.asm");
    source.split("\n").forEach((line, index) => {
      assembler.setCurrentLine(index);
      assembler.processCommand(line);
    });
    assembler.finishPass();
  }
  t.deepEqual(
    assembler.addressToLineMapping.ranges.map(({ line }) => line),
    [7],
  );
});

test("typed members coexist with Asar extensions and aligned index arithmetic", (t) => {
  const assembler = assemble(`lorom
org $808000
struct Actor $1000
  .hp: dw
endstruct align 4
struct Extra extends Actor
  .flags: db
endstruct
dw Actor[2].hp, Actor[2].Extra.flags
db sizeof(Actor), sizeof(Extra)`);
  t.deepEqual([...assembler.getBinaryOutput()], [10, 16, 14, 16, 4, 1]);
  t.throws(
    () =>
      assemble(
        `${header}\nstruct Extra extends Record\n.flags: db\nendstruct\ndataStruct Record, {value = 1}`,
      ),
    { message: /extended layouts/ },
  );
});
