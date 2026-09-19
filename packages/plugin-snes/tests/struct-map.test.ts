import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import {
  loadAnalysisProjectSnapshot,
  RomImage,
  validateSourceExportFiles,
  validateSourceExportInputs,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { Assembler } from "../../../tests/test-assembler.js";
import { Cpu65816Decoder } from "../src/architectures/65816-decoder.js";
import {
  exportSnes65816Source,
  formatSnes65816SourceInstruction,
} from "../src/disassembler/source-export.js";
import {
  initializeSnesDisassemblyWorkspace,
  verifySnesProjectRoundTrip,
} from "../src/disassembler/project-initializer.js";
import {
  indexSnesStructFields,
  planSnesStructRomFields,
  renderSnesStructData,
  renderSnesStructDefines,
  renderSnesStructInitializer,
  validateSnesStructMap,
} from "../src/disassembler/struct-map.js";

const fixtureMap = () => ({
  format: "uttori-asm-snes-struct-map",
  schemaVersion: 1,
  structures: [
    {
      id: "Record",
      size: 12,
      fields: [
        { name: "byte", offset: 0, size: 1 },
        { name: "word", offset: 1, size: 2 },
        { name: "pointer", offset: 3, size: 3 },
        { name: "dword", offset: 7, size: 4 },
      ],
    },
  ],
  bindings: [
    { name: "Players", structure: "Record", address: 0x7e0100, count: 2 },
    { name: "Table", structure: "Record", address: 0x808100, fileOffset: 0x100, count: 2 },
  ],
});
const loadedMap = () => ({ ...validateSnesStructMap(fixtureMap()), sourceBytes: new Uint8Array() });

const assemble = (lines: readonly string[]): Uint8Array => {
  const assembler = new Assembler(undefined, { collectSourceMetadata: false });
  assembler.setCurrentFile("struct-fixture.asm");
  for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
    assembler.activateStage(stage);
    for (const [lineNumber, line] of lines.entries()) {
      assembler.setCurrentLine(lineNumber);
      assembler.processCommand(line);
    }
    assembler.finishPass();
  }
  return assembler.getBinaryOutput();
};

test("struct operands preserve mirrored banks, array indexes, and interior bytes", (t) => {
  const map = loadedMap();
  const fields = indexSnesStructFields(map);
  t.is(fields.get(0x7e010d), "Players[1].word");
  t.is(fields.get(0x7e0106), undefined, "opaque gaps do not receive inferred field names");
  const decoder = new Cpu65816Decoder();
  const definitions = renderSnesStructDefines(map).split("\n");
  for (const address of [0x000101, 0x800102, 0xbf010d, 0x7e010d, 0x808101, 0x80810e]) {
    for (const opcode of [0xaf, 0xbf, 0x8f]) {
      const bytes = Uint8Array.of(opcode, address & 0xff, (address >>> 8) & 0xff, address >>> 16);
      const decoded = decoder.decode({
        source: new Uint8ArrayDecoderSource(bytes),
        offset: 0,
        logicalAddress: 0x808000,
        state: { e: 0, m: 0, x: 0 },
      });
      if (decoded.kind !== "instruction") {throw new Error("Expected decoded fixture instruction.");}
      const source = formatSnes65816SourceInstruction(
        decoded.instruction,
        undefined,
        0x808000,
        undefined,
        fields,
      );
      t.regex(source, /(?:Players|Table)(?:\[1])?\.word/);
      t.deepEqual(
        assemble(["lorom", "org $808000", ".a16", ".i16", ...definitions, source]),
        bytes,
        source,
      );
    }
  }
});

test("bound ROM fields assemble every width and preserve opaque bytes and split fields", (t) => {
  const map = loadedMap();
  const fields = planSnesStructRomFields(map, 0x8000, (offset) => 0x808000 + offset);
  const bytes = Uint8Array.from({ length: 24 }, (_, index) => (index * 37 + 0x92) & 0xff);
  const lines = ["lorom", "org $808100", ...renderSnesStructDefines(map).split("\n")];
  for (const field of fields) {
    // A user label/comment in the middle of a 16-bit field must survive as two db fragments.
    const cuts = field.start === 0x101 ? [0x101, 0x102, 0x103] : [field.start, field.end];
    for (let index = 0; index < cuts.length - 1; index++) {
      const start = cuts[index];
      lines.push(
        ...renderSnesStructData(
          field,
          start,
          bytes.subarray(start - 0x100, cuts[index + 1] - 0x100),
        ),
      );
    }
  }
  t.deepEqual(assemble(lines).slice(0x100), bytes);
  t.throws(() => assemble(lines.map((line) => (line === "org $808100" ? "org $808101" : line))), {
    message: /assert/i,
  });
});

test("one-based ROM arrays distinguish biased indexed operands from adjacent scalar data", (t) => {
  const map = {
    ...validateSnesStructMap({
      format: "uttori-asm-snes-struct-map",
      schemaVersion: 1,
      structures: [{ id: "Word", size: 2, fields: [{ name: "value", offset: 0, size: 2 }] }],
      bindings: [
        { name: "Thresholds", structure: "Word", address: 0x808100, fileOffset: 0x100, count: 3 },
        {
          name: "Offsets",
          structure: "Word",
          address: 0x808106,
          fileOffset: 0x106,
          count: 2,
          firstIndex: 1,
        },
      ],
    }),
    sourceBytes: new Uint8Array(),
  };
  const fields = indexSnesStructFields(map);
  const indexedFields = indexSnesStructFields(map, true);
  t.is(fields.get(0x808104), "Thresholds[2].value");
  t.is(indexedFields.get(0x808104), "Offsets.value");
  t.is(fields.get(0x808106), "Offsets[1].value");
  const decoder = new Cpu65816Decoder();
  for (const opcode of [0xaf, 0xbf]) {
    const bytes = Uint8Array.of(opcode, 0x04, 0x81, 0x80);
    const decoded = decoder.decode({
      source: new Uint8ArrayDecoderSource(bytes),
      offset: 0,
      logicalAddress: 0x808000,
      state: { e: 0, m: 0, x: 0 },
    });
    if (decoded.kind !== "instruction") {throw new Error("Expected fixture instruction.");}
    const source = formatSnes65816SourceInstruction(
      decoded.instruction,
      undefined,
      0x808000,
      undefined,
      fields,
      indexedFields,
    );
    t.true(source.includes(opcode === 0xaf ? "Thresholds[2].value" : "Offsets.value,x"));
    t.deepEqual(
      assemble([
        "lorom",
        "org $808000",
        ".a16",
        ".i16",
        ...renderSnesStructDefines(map).split("\n"),
        source,
      ]),
      bytes,
    );
  }
  t.is(
    planSnesStructRomFields(map, 0x8000, (offset) => 0x808000 + offset)[3].expression,
    "Offsets[1].value",
  );
});

test("struct maps reject overlapping layouts, bindings, invalid mapping, and injected identifiers", (t) => {
  const overlap = fixtureMap();
  overlap.structures[0].fields[1].offset = 0;
  t.throws(() => validateSnesStructMap(overlap), { message: /overlap/ });
  const bounds = fixtureMap();
  bounds.structures[0].fields[3].size = 6;
  t.throws(() => validateSnesStructMap(bounds), { message: /exceeds/ });
  const bindings = fixtureMap();
  bindings.bindings.push({ ...bindings.bindings[0], name: "Alias" });
  t.throws(() => validateSnesStructMap(bindings), { message: /overlap/ });
  const injected = fixtureMap();
  injected.structures[0].fields[0].name = "field\n db $FF";
  t.throws(() => validateSnesStructMap(injected), { message: /identifier/ });
  t.throws(() => planSnesStructRomFields(loadedMap(), 0x8000, (offset) => 0xc00000 + offset), {
    message: /mapping/,
  });
  t.throws(() => planSnesStructRomFields(loadedMap(), 0x110, (offset) => 0x808000 + offset), {
    message: /outside/,
  });
});

test("normal export includes structs, owns typed bytes, retains interior metadata, and detects drift", async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-struct-export-"));
  t.teardown(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  const bytes = new Uint8Array(0x8000).fill(0xea);
  bytes.set([0xbf, 0x01, 0x81, 0x80, 0xaf, 0x0d, 0x01, 0x7e, 0xdb]);
  bytes.fill(0x20, 0x7fc0, 0x7fd5);
  bytes[0x7fd5] = 0x20;
  bytes[0x7fd7] = 0x05;
  bytes.set([0xcb, 0xed, 0x34, 0x12], 0x7fdc);
  bytes.fill(0, 0x7fe0);
  bytes.set([0x00, 0x80], 0x7ffc);
  fs.writeFileSync(romFile, bytes);
  await initializeSnesDisassemblyWorkspace({ romFile, outputDirectory, mapper: "lorom" });
  const before = loadAnalysisProjectSnapshot(path.join(outputDirectory, "analysis"));
  const project = {
    ...before,
    shards: {
      ...before.shards,
      comments: [
        ...before.shards.comments,
        {
          id: "inside-word",
          addressSpace: "rom.file",
          address: 0x102,
          text: "High byte remains annotated.",
          evidence: [],
        },
      ],
    },
  };
  const filename = path.join(outputDirectory, "struct-map.json");
  fs.writeFileSync(filename, JSON.stringify(fixtureMap()));
  const exportSource = () =>
    exportSnes65816Source(project, RomImage.load(romFile), outputDirectory, {
      sourceProjectSha256: "0".repeat(64),
    });
  const first = exportSource();
  const bank = fs.readFileSync(path.join(outputDirectory, "banks/bank-000.asm"), "utf8");
  t.regex(fs.readFileSync(path.join(outputDirectory, "main.asm"), "utf8"), /incsrc "structs.asm"/);
  t.regex(bank, /LDA\.l Table\.word,x/);
  t.regex(bank, /LDA\.l Players\[1]\.word/);
  t.regex(bank, /High byte remains annotated\.\n  assert pc\(\) == Table\.word \+ \$1/);
  t.regex(
    bank,
    /dataStruct Table\[1], { byte = \$EA, word = \$EAEA, pointer = \$EAEAEA, __gap_6 = \[\$EA], dword = \$EAEAEAEA, __gap_b = \[\$EA] }/,
  );
  t.is(
    first.spans
      .filter((span) => span.source === "struct-map.json")
      .reduce((sum, span) => sum + span.end - span.start, 0),
    24,
  );
  t.true(
    (await verifySnesProjectRoundTrip({ romFile, sourceDirectory: outputDirectory })).comparison
      .equal,
  );
  t.deepEqual(exportSource(), first, "regeneration uses the same bindings and file ownership");
  fs.appendFileSync(filename, "\n");
  t.throws(() => validateSourceExportInputs(outputDirectory), { message: /changed/ });
  exportSource();
  t.notThrows(() => validateSourceExportInputs(outputDirectory));

  // Whole neighboring records form tables. A label/comment at a record start
  // stays outside the block; an interior comment still forces raw fragments.
  const expanded = fixtureMap();
  expanded.bindings[1].count = 5;
  fs.writeFileSync(filename, JSON.stringify(expanded));
  const boundaryProject = {
    ...project,
    shards: {
      ...project.shards,
      comments: [
        ...project.shards.comments,
        {
          id: "record-boundary",
          addressSpace: "rom.file",
          address: 0x124,
          text: "Fourth record.",
          evidence: [],
        },
      ],
    },
  };
  const grouped = exportSnes65816Source(boundaryProject, RomImage.load(romFile), outputDirectory, {
    sourceProjectSha256: "0".repeat(64),
  });
  const groupedBank = fs.readFileSync(path.join(outputDirectory, "banks/bank-000.asm"), "utf8");
  t.regex(
    groupedBank,
    /dataStructs Table\n    \[1] = .*\n    \[2] = .*\n  endDataStructs\n\n; Fourth record\.\n  dataStructs Table\n    \[3] = .*\n    \[4] = .*\n  endDataStructs/,
  );
  t.is(
    grouped.spans
      .filter((span) => span.source === "struct-map.json")
      .reduce((sum, span) => sum + span.end - span.start, 0),
    60,
  );
  t.true(
    (await verifySnesProjectRoundTrip({ romFile, sourceDirectory: outputDirectory })).comparison
      .equal,
  );
  t.deepEqual(
    exportSnes65816Source(boundaryProject, RomImage.load(romFile), outputDirectory, {
      sourceProjectSha256: "0".repeat(64),
    }),
    grouped,
  );

  const manifest = fs.readFileSync(path.join(outputDirectory, "generated-files.json"));
  const conflict = fixtureMap();
  conflict.bindings[1].address = 0x808000;
  conflict.bindings[1].fileOffset = 0;
  fs.writeFileSync(filename, JSON.stringify(conflict));
  t.throws(exportSource, { message: /overlaps decoded code/ });
  t.deepEqual(fs.readFileSync(path.join(outputDirectory, "generated-files.json")), manifest);
  t.notThrows(() => validateSourceExportFiles(outputDirectory));
});

test("explicit field types distinguish arrays from scalars and validate their byte size", (t) => {
  const input = fixtureMap();
  const typed = {
    ...input,
    structures: [
      {
        ...input.structures[0],
        fields: input.structures[0].fields.map((field) =>
          field.name === "word" ? { ...field, type: "db[2]" } : field,
        ),
      },
    ],
  };
  const map = { ...validateSnesStructMap(typed), sourceBytes: new Uint8Array() };
  const defines = renderSnesStructDefines(map);
  t.regex(defines, /\.word: db\[2]/);
  t.regex(defines, /endstruct count 2 firstindex 0/);
  const fields = planSnesStructRomFields(map, 0x8000, (offset) => 0x808000 + offset);
  const record = fields[0].record!;
  const bytes = Uint8Array.from({ length: 12 }, (_, index) => index * 19 + 1);
  const literal = renderSnesStructInitializer(record, bytes);
  t.regex(literal, /word = \[\$14, \$27]/);
  t.deepEqual(
    assemble([
      "lorom",
      "org $808100",
      ...defines.split("\n"),
      `dataStruct Table[0], ${literal}`,
    ]).slice(0x100),
    bytes,
  );
  t.throws(() => renderSnesStructInitializer(record, bytes.slice(1)), {
    message: /complete record/,
  });
  for (const type of ["dw[2]", "db[0]", "dw\ndb $FF", "float", "db[9007199254740993]"]) {
    t.throws(
      () =>
        validateSnesStructMap({
          ...typed,
          structures: [
            { ...typed.structures[0], fields: [{ name: "bad", offset: 0, size: 2, type }] },
          ],
        }),
      { message: /type/ },
    );
  }
});
