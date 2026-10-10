import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { loadAnalysisProjectSnapshot, RomImage } from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import {
  renderSourceFixture,
  verifyRenderedFixture,
  initializeAnalysisFixture,
} from "../../../tests/helpers/source-render-fixture.js";
import { Assembler } from "../../../tests/test-assembler.js";
import { Cpu65816Decoder } from "../src/architectures/65816-decoder.js";
import { formatSnes65816SourceInstruction } from "../src/disassembler/source-export.js";
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
  t.is(fields.get(0x7e0101), "Players[0].word");
  t.is(fields.get(0x7e0102), "(Players[0].word + $1)");
  t.is(indexSnesStructFields(map, true).get(0x7e0101), "Players[0].word");
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
      if (decoded.kind !== "instruction") {
        throw new Error("Expected decoded fixture instruction.");
      }
      const source = formatSnes65816SourceInstruction(
        decoded.instruction,
        undefined,
        0x808000,
        undefined,
        fields,
      );
      t.regex(source, /(?:Players|Table)\[[01]]\.word/);
      t.deepEqual(
        assemble(["lorom", "org $808000", ".a16", ".i16", ...definitions, source]),
        bytes,
        source,
      );
    }
  }
});

test("array stores use explicit zero indexes while scalar bindings retain their short form", (t) => {
  const map = {
    ...validateSnesStructMap({
      format: "uttori-asm-snes-struct-map",
      schemaVersion: 1,
      structures: [
        { id: "HudCache", size: 2, fields: [{ name: "prefix_tiles", offset: 0, size: 2 }] },
      ],
      bindings: [{ name: "SomPartyHudCaches", structure: "HudCache", address: 0x7e0100, count: 3 }],
    }),
    sourceBytes: new Uint8Array(),
  };
  const fields = indexSnesStructFields(map);
  const definitions = renderSnesStructDefines(map).split("\n");
  const decoder = new Cpu65816Decoder();
  for (let index = 0; index < 3; index++) {
    const bytes = Uint8Array.of(0x8d, index * 2, 0x01);
    const decoded = decoder.decode({
      source: new Uint8ArrayDecoderSource(bytes),
      offset: 0,
      logicalAddress: 0x808000,
      state: { e: 0, m: 0, x: 0, dataBank: 0x7e },
    });
    if (decoded.kind !== "instruction") {
      throw new Error("Expected fixture store instruction.");
    }
    const source = formatSnes65816SourceInstruction(
      decoded.instruction,
      undefined,
      0x808000,
      undefined,
      fields,
    );
    t.is(source, `STA.w SomPartyHudCaches[${index}].prefix_tiles & $FFFF`);
    t.deepEqual(assemble(["lorom", "org $808000", ".a16", ...definitions, source]), bytes);
    if (index === 0) {
      t.deepEqual(
        assemble(["lorom", "org $808000", ".a16", ...definitions, source.replace("[0]", "")]),
        bytes,
        "Existing unindexed references remain valid aliases for index zero.",
      );
    }
  }
  for (const firstIndex of [0, 1]) {
    const scalar = { ...map, bindings: [{ ...map.bindings[0], count: 1, firstIndex }] };
    const reference = firstIndex === 0 ? "SomPartyHudCaches" : "SomPartyHudCaches[1]";
    t.is(indexSnesStructFields(scalar).get(0x7e0100), `${reference}.prefix_tiles`);
  }
});

test("bound ROM fields assemble every width and preserve opaque bytes and split fields", (t) => {
  const map = loadedMap();
  const fields = planSnesStructRomFields(map, 0x8000, (offset) => 0x808000 + offset);
  t.is(fields[0].expression, "Table[0].byte");
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
    if (decoded.kind !== "instruction") {
      throw new Error("Expected fixture instruction.");
    }
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

test("entry comments use logical indexes and normalize prose without accepting ambiguous keys", (t) => {
  const input = fixtureMap();
  const withComments = (comments: unknown, firstIndex = 1) => ({
    ...input,
    bindings: [{ ...input.bindings[1], firstIndex, entryComments: comments }],
  });
  const normalized = validateSnesStructMap(
    withComments({ 1: "Candy\n  item", 2: "Cup of Wishes" }),
  );
  t.deepEqual(normalized.bindings[0].entryComments, { 1: "Candy item", 2: "Cup of Wishes" });
  t.deepEqual(validateSnesStructMap(withComments({})).bindings[0].entryComments, {});
  for (const comments of [
    { 0: "Wrong base" },
    { 3: "Outside" },
    { "01": "Ambiguous" },
    { "1.5": "Fraction" },
    { "0x1": "Hex" },
    { "-1": "Negative" },
    { 1: 42 },
    { 1: " \n " },
    [],
    null,
  ]) {
    t.throws(() => validateSnesStructMap(withComments(comments)));
  }
  t.throws(
    () =>
      validateSnesStructMap({
        ...input,
        bindings: [{ ...input.bindings[0], entryComments: { 0: "No ROM rows" } }],
      }),
    { message: /ROM binding/ },
  );
});

test("named data stays outside code and guide labels with configurable comment wrapping", async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-struct-layout-"));
  t.teardown(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const romFile = path.join(temporary, "fixture.sfc");
  const outputDirectory = path.join(temporary, "workspace");
  const bytes = new Uint8Array(0x8000).fill(0xea);
  bytes[0] = 0x60; // RTS immediately before a table: its data must not fold into the routine.
  bytes.fill(0x20, 0x7fc0, 0x7fd5);
  bytes[0x7fd5] = 0x20;
  bytes[0x7fd7] = 0x05;
  bytes.set([0xcb, 0xed, 0x34, 0x12], 0x7fdc);
  bytes.fill(0, 0x7fe0);
  bytes.set([0x00, 0x80], 0x7ffc);
  fs.writeFileSync(romFile, bytes);
  await initializeAnalysisFixture({ romFile, outputDirectory, mapper: "lorom" });
  const before = loadAnalysisProjectSnapshot(path.join(outputDirectory, "analysis"));
  const project = {
    ...before,
    shards: {
      ...before.shards,
      labels: [
        ...before.shards.labels,
        { id: "guide", addressSpace: "rom.file", address: 5, name: "OldTableGuide", evidence: [] },
        {
          id: "scalar-guide",
          addressSpace: "rom.file",
          address: 9,
          name: "OldScalarGuide",
          evidence: [],
        },
      ],
      comments: [
        ...before.shards.comments,
        {
          id: "guide-note",
          addressSpace: "rom.file",
          address: 5,
          text: "Imported guide.",
          evidence: [],
        },
      ],
    },
  };
  const input = {
    format: "uttori-asm-snes-struct-map",
    schemaVersion: 1,
    structures: [
      {
        id: "Word",
        size: 2,
        fields: [{ name: "value", offset: 0, size: 2, description: "Stored word value." }],
      },
    ],
    bindings: [
      {
        name: "Handlers",
        structure: "Word",
        address: 0x808001,
        fileOffset: 1,
        count: 2,
        entryComments: { 0: "First handler" },
      },
      { name: "GuidedTable", structure: "Word", address: 0x808005, fileOffset: 5, count: 2 },
      {
        name: "Scalar",
        structure: "Word",
        address: 0x808009,
        fileOffset: 9,
        count: 1,
        entryComments: { 0: "Short description" },
      },
      {
        name: "LongNote",
        structure: "Word",
        address: 0x80800b,
        fileOffset: 11,
        count: 1,
        entryComments: { 0: "A long description. ".repeat(10).trim() },
      },
    ],
  };
  fs.writeFileSync(path.join(outputDirectory, "struct-map.json"), JSON.stringify(input));
  const exportSource = () =>
    renderSourceFixture(project, RomImage.load(romFile), outputDirectory, {
      sourceProjectSha256: "0".repeat(64),
    });
  const first = exportSource();
  const bank = fs.readFileSync(path.join(outputDirectory, "banks/bank-000.asm"), "utf8");
  const structs = fs.readFileSync(path.join(outputDirectory, "structs.asm"), "utf8");
  t.true(structs.includes("Stored word value."));
  t.false(bank.includes("Stored word value."));
  t.regex(
    bank,
    /  RTS\n\ndataStructs Handlers\n  ; First handler\n  \[0] = {\n    value = \$EAEA\n  }\n  \[1] = {\n    value = \$EAEA\n  }\nendDataStructs\n\n/,
  );
  t.regex(bank, /L_OldTableGuide:\n; Imported guide\.\ndataStructs GuidedTable\n  \[0] =/);
  t.regex(
    bank,
    /L_OldScalarGuide:\n; Short description\ndataStruct Scalar, {\n  value = \$EAEA\n}\n/,
  );
  t.regex(
    bank,
    // oxlint-disable-next-line security/detect-unsafe-regex
    /\n; A long description\.[^\n]+\n(?:; [^\n]+\n)+dataStruct LongNote, {\n  value = \$EAEA\n}\n/,
  );
  t.notRegex(bank, /^[\t ]+(?:dataStructs? |endDataStructs)/m);
  t.true(
    (await verifyRenderedFixture({ romFile, sourceDirectory: outputDirectory })).comparison.equal,
  );
  t.deepEqual(exportSource(), first, "Formatting remains deterministic across regeneration.");
  for (const commentLineWidth of [60, 100]) {
    renderSourceFixture(project, RomImage.load(romFile), outputDirectory, {
      sourceProjectSha256: "0".repeat(64),
      commentLineWidth,
    });
    const wrapped = fs.readFileSync(path.join(outputDirectory, "banks/bank-000.asm"), "utf8");
    t.true(
      wrapped
        .split("\n")
        .filter((line) => line.trimStart().startsWith(";"))
        .every((line) => line.length <= commentLineWidth),
    );
  }
  renderSourceFixture(project, RomImage.load(romFile), outputDirectory, {
    sourceProjectSha256: "0".repeat(64),
    wrapComments: false,
  });
  t.true(
    fs
      .readFileSync(path.join(outputDirectory, "banks/bank-000.asm"), "utf8")
      .includes(`; ${input.bindings[3].entryComments?.[0]}\n`),
  );
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
  await initializeAnalysisFixture({ romFile, outputDirectory, mapper: "lorom" });
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
  const named = fixtureMap();
  fs.writeFileSync(
    filename,
    JSON.stringify({
      ...named,
      bindings: named.bindings.map((binding) =>
        binding.name === "Table"
          ? Object.assign({}, binding, {
              entryComments: { 0: "Fragmented Candy", 1: "Cup of Wishes" },
            })
          : binding,
      ),
    }),
  );
  const exportSource = () =>
    renderSourceFixture(project, RomImage.load(romFile), outputDirectory, {
      sourceProjectSha256: "0".repeat(64),
    });
  const first = exportSource();
  const bank = fs.readFileSync(path.join(outputDirectory, "banks/bank-000.asm"), "utf8");
  t.regex(fs.readFileSync(path.join(outputDirectory, "main.asm"), "utf8"), /incsrc "structs.asm"/);
  t.regex(bank, /LDA\.l Table\[0]\.word,x/);
  t.regex(bank, /LDA\.l Players\[1]\.word/);
  t.regex(bank, /High byte remains annotated\.\n  assert pc\(\) == Table\[0]\.word \+ \$1/);
  t.regex(bank, /; Fragmented Candy\n  assert pc\(\) == Table\[0]\.byte/);
  t.is(
    bank.match(/Fragmented Candy/g)?.length,
    1,
    "fragmentation must not duplicate the entry comment",
  );
  t.regex(bank, /\n; Cup of Wishes\ndataStruct Table\[1], [^\n;]+\n/);
  t.regex(
    bank,
    /dataStruct Table\[1], {\n  byte = \$EA,\n  word = \$EAEA,\n  pointer = \$EAEAEA,\n  __gap_6 = \[\$EA],\n  dword = \$EAEAEAEA,\n  __gap_b = \[\$EA]\n}/,
  );
  t.is(
    first.spans
      .filter((span) => span.source === "struct-map.json")
      .reduce((sum, span) => sum + span.end - span.start, 0),
    24,
  );
  t.true(
    (await verifyRenderedFixture({ romFile, sourceDirectory: outputDirectory })).comparison.equal,
  );
  t.deepEqual(exportSource(), first, "regeneration uses the same bindings and file ownership");
  fs.appendFileSync(filename, "\n");
  exportSource();

  // Whole neighboring records form tables. A label/comment at a record start
  // stays outside the block. An interior comment still forces raw fragments.
  const expanded = fixtureMap();
  expanded.bindings[1].count = 5;
  fs.writeFileSync(
    filename,
    JSON.stringify({
      ...expanded,
      bindings: expanded.bindings.map((binding) =>
        binding.name === "Table"
          ? Object.assign({}, binding, {
              entryComments: { 1: "Candy", 2: "Cup of Wishes", 4: "Named after a gap" },
            })
          : binding,
      ),
    }),
  );
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
  const grouped = renderSourceFixture(boundaryProject, RomImage.load(romFile), outputDirectory, {
    sourceProjectSha256: "0".repeat(64),
  });
  const groupedBank = fs.readFileSync(path.join(outputDirectory, "banks/bank-000.asm"), "utf8");
  t.regex(
    groupedBank,
    /\ndataStructs Table\n  ; Candy\n  \[1] = {\n[^}]+\n  }\n  ; Cup of Wishes\n  \[2] = {\n[^}]+\n  }\nendDataStructs\n\n; Fourth record\.\ndataStructs Table\n  \[3] = {\n[^}]+\n  }\n  ; Named after a gap\n  \[4] = {\n[^}]+\n  }\nendDataStructs/,
  );
  t.notRegex(groupedBank, /\[\d+] = .* ; (?:Cup of Wishes|Named after a gap)/);
  t.is(
    grouped.spans
      .filter((span) => span.source === "struct-map.json")
      .reduce((sum, span) => sum + span.end - span.start, 0),
    60,
  );
  t.true(
    (await verifyRenderedFixture({ romFile, sourceDirectory: outputDirectory })).comparison.equal,
  );
  t.deepEqual(
    renderSourceFixture(boundaryProject, RomImage.load(romFile), outputDirectory, {
      sourceProjectSha256: "0".repeat(64),
    }),
    grouped,
  );

  const manifest = fs.readFileSync(path.join(outputDirectory, "banks/bank-000.asm"));
  const conflict = fixtureMap();
  conflict.bindings[1].address = 0x808000;
  conflict.bindings[1].fileOffset = 0;
  fs.writeFileSync(filename, JSON.stringify(conflict));
  t.throws(exportSource, { message: /overlaps decoded code/ });
  t.deepEqual(fs.readFileSync(path.join(outputDirectory, "banks/bank-000.asm")), manifest);
});

test("explicit field types distinguish arrays from scalars and validate their byte size", (t) => {
  const input = fixtureMap();
  const typed = {
    ...input,
    structures: [
      {
        ...input.structures[0],
        fields: input.structures[0].fields.map((field) =>
          field.name === "word" ? Object.assign({}, field, { type: "db[2]" }) : field,
        ),
      },
    ],
  };
  const map = { ...validateSnesStructMap(typed), sourceBytes: new Uint8Array() };
  const defines = renderSnesStructDefines(map);
  t.false(defines.includes("struct-map.json"));
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
