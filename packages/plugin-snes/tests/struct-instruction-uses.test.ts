import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import {
  loadAnalysisProjectSnapshot,
  openAnalysisProjectStore,
  RomImage,
  validateSourceExportFiles,
} from "@uttori/asm-disassembler";

import { test } from "../../../tests/ava-helper.js";
import { Assembler } from "../../../tests/test-assembler.js";
import { Cpu65816Decoder } from "../src/architectures/65816-decoder.js";
import {
  initializeSnesDisassemblyWorkspace,
  verifySnesProjectRoundTrip,
} from "../src/disassembler/project-initializer.js";
import {
  exportSnes65816Source,
  formatSnes65816SourceInstruction,
} from "../src/disassembler/source-export.js";
import { SnesStructExpressionResolver } from "../src/disassembler/struct-expressions.js";
import {
  applySnesStructInstructionOperand,
  indexSnesStructInstructionUses,
  renderSnesStructUseComments,
} from "../src/disassembler/struct-instruction-uses.js";
import { renderSnesStructDefines, validateSnesStructMap } from "../src/disassembler/struct-map.js";

/** Native A16/X8 entry followed by an indirect read, a record stride and a terminating STP. */
const code = [0x18, 0xfb, 0xc2, 0x20, 0xe2, 0x10, 0xa0, 2, 0xb7, 0xd1, 0x69, 4, 0, 0xdb];
const fixtureRom = (): RomImage => {
  const bytes = new Uint8Array(0x8000).fill(0xea);
  bytes.set(code);
  bytes.fill(0x20, 0x7fc0, 0x7fd5);
  bytes[0x7fd5] = 0x20;
  bytes[0x7fd7] = 0x05;
  bytes.set([0xcb, 0xed, 0x34, 0x12], 0x7fdc);
  bytes.fill(0, 0x7fe0);
  bytes.set([0x00, 0x80], 0x7ffc);
  return new RomImage(bytes);
};

const observation = (romSha256 = fixtureRom().identity.contentSha256) => ({
  target: "Commands[1].target",
  width: 2,
  access: "read",
  provenance: "trace-derived",
  source: "captures/ceremony.act2",
  detail: "Sequence 42; pointer plus Y resolves this word.",
  romSha256,
});
const inputMap = () => ({
  format: "uttori-asm-snes-struct-map",
  schemaVersion: 1,
  structures: [
    {
      id: "Tint",
      size: 4,
      fields: [
        { name: "opcode", offset: 0, size: 1 },
        { name: "scope", offset: 1, size: 1 },
        { name: "target", offset: 2, size: 2 },
      ],
    },
  ],
  bindings: [
    {
      name: "Commands",
      structure: "Tint",
      address: 0x808100,
      count: 2,
      firstIndex: 0,
      fileOffset: 0x100,
    },
  ],
  instructionUses: [
    {
      address: 0x808006,
      expectedBytes: [0xa0, 2],
      reason: "Index the target word.",
      operand: "Tint.target",
    },
    {
      address: 0x808008,
      expectedBytes: [0xb7, 0xd1],
      reason: "Shared script consumer.",
      observations: [observation()],
    },
    {
      address: 0x80800a,
      expectedBytes: [0x69, 4, 0],
      reason: "Advance over the complete command.",
      operand: "sizeof(Tint)",
    },
  ],
});

test("struct uses resolve layout offsets, sizes, array indices and interior bytes", (t) => {
  const input = inputMap();
  input.bindings[0].firstIndex = 1;
  input.instructionUses[1].observations = [
    { ...observation(), target: "Commands[2].target + $1", width: 1 },
  ];
  const map = validateSnesStructMap(input);
  t.deepEqual(map.instructionUses?.[0].operand, { expression: "Tint.target", value: 2 });
  t.deepEqual(map.instructionUses?.[2].operand, { expression: "sizeof(Tint)", value: 4 });
  const access = map.instructionUses![1].observations[0];
  t.is(access.expression, "(Commands[2].target + $1)");
  t.is(access.address, 0x808107);
  t.is(access.width, 1);
  t.is(
    indexSnesStructInstructionUses(undefined, fixtureRom(), () => undefined),
    undefined,
  );
  t.is(
    indexSnesStructInstructionUses([], fixtureRom(), () => undefined),
    undefined,
  );
});

test("invalid struct use metadata cannot become source expressions or unbounded references", (t) => {
  const mutations: [string, (use: Record<string, any>) => void][] = [
    [
      "empty",
      (use) => {
        delete use.operand;
      },
    ],
    [
      "unknown layout",
      (use) => {
        use.operand = "Missing.target";
      },
    ],
    [
      "unknown field",
      (use) => {
        use.operand = "Tint.target\nSTP";
      },
    ],
    [
      "object operand",
      (use) => {
        use.operand = { kind: "size", structure: "Tint" };
      },
    ],
    [
      "reflection member",
      (use) => {
        use.operand = "sizeof(Tint.target)";
      },
    ],
    [
      "reason",
      (use) => {
        use.reason = " ";
      },
    ],
    [
      "bytes",
      (use) => {
        use.expectedBytes = [];
      },
    ],
    [
      "long encoding",
      (use) => {
        use.expectedBytes = [1, 2, 3, 4, 5];
      },
    ],
    [
      "non-byte",
      (use) => {
        use.expectedBytes = [256];
      },
    ],
    [
      "fractional address",
      (use) => {
        use.address = 0.5;
      },
    ],
  ];
  for (const [name, mutate] of mutations) {
    const input = inputMap();
    mutate(input.instructionUses[0]);
    t.throws(() => validateSnesStructMap(input), undefined, name);
  }
  for (const [key, value] of Object.entries({
    target: "Missing.target",
    width: 3,
    access: "execute",
    provenance: "certain",
    source: "",
    detail: "",
    romSha256: "bad",
  })) {
    const input = inputMap();
    Object.assign(input.instructionUses[1].observations![0], { [key]: value });
    t.throws(() => validateSnesStructMap(input), undefined, key);
  }
  const duplicate = inputMap();
  duplicate.instructionUses.push(duplicate.instructionUses[0]);
  t.throws(() => validateSnesStructMap(duplicate), { message: /Duplicate/ });
  t.throws(() => validateSnesStructMap({ ...inputMap(), instructionUses: {} }), {
    message: /array/,
  });
  t.throws(() => validateSnesStructMap({ ...inputMap(), instructionUses: [null] }), {
    message: /objects/,
  });
  t.throws(
    () =>
      validateSnesStructMap({
        ...inputMap(),
        instructionUses: [{ ...inputMap().instructionUses[0], observations: {} }],
      }),
    { message: /array/ },
  );
  t.throws(
    () =>
      validateSnesStructMap({
        ...inputMap(),
        instructionUses: [{ ...inputMap().instructionUses[0], observations: [observation()] }],
      }),
    { message: /cannot combine/ },
  );
  t.deepEqual(
    validateSnesStructMap({ ...inputMap(), instructionUses: [] }).instructionUses,
    undefined,
  );
});

test("instruction indexing rejects stale ROMs, bytes, unmapped sites and mapper aliases", (t) => {
  const rom = fixtureRom();
  const map = validateSnesStructMap(inputMap());
  const translate = (address: number) => address & 0x7fff;
  const index = indexSnesStructInstructionUses(map.instructionUses, rom, translate)!;
  t.deepEqual([...index.keys()], [6, 8, 10]);
  const headeredBytes = new Uint8Array(rom.length + 512);
  headeredBytes.set(rom.bytes(), 512);
  t.notThrows(
    () =>
      indexSnesStructInstructionUses(map.instructionUses, new RomImage(headeredBytes), translate),
    "Capture identity uses headerless content, not copier-header bytes.",
  );
  t.throws(() => indexSnesStructInstructionUses(map.instructionUses, rom, () => undefined), {
    message: /contiguous/,
  });
  t.throws(
    () =>
      indexSnesStructInstructionUses(map.instructionUses, rom, (address) => translate(address) * 2),
    { message: /contiguous/ },
  );
  t.throws(
    () =>
      indexSnesStructInstructionUses(
        [{ ...map.instructionUses![0], expectedBytes: [0xa0, 3] }],
        rom,
        translate,
      ),
    { message: /Stale/ },
  );
  t.throws(
    () =>
      indexSnesStructInstructionUses(
        [map.instructionUses![0], { ...map.instructionUses![0], address: 0x008006 }],
        rom,
        translate,
      ),
    { message: /Aliased/ },
  );
  const wrongRom = inputMap();
  wrongRom.instructionUses[1].observations![0].romSha256 = "0".repeat(64);
  t.throws(
    () =>
      indexSnesStructInstructionUses(
        validateSnesStructMap(wrongRom).instructionUses,
        rom,
        translate,
      ),
    { message: /different ROM/ },
  );
});

test("symbolic immediate operands retain bytes and indirect consumers retain addressing mode", (t) => {
  const map = { ...validateSnesStructMap(inputMap()), sourceBytes: new Uint8Array() };
  const decoder = new Cpu65816Decoder();
  for (const use of map.instructionUses!) {
    const decoded = decoder.decode({
      source: new Uint8ArrayDecoderSource(Uint8Array.from(use.expectedBytes)),
      offset: 0,
      logicalAddress: use.address,
      state: { e: 0, m: 0, x: 1 },
    });
    if (decoded.kind !== "instruction") throw new Error("Expected fixture instruction.");
    const original = formatSnes65816SourceInstruction(decoded.instruction);
    const symbolic = applySnesStructInstructionOperand(decoded.instruction, original, use);
    const assembler = new Assembler();
    const source = `lorom\norg $808000\n${renderSnesStructDefines(map)}\n.a16\n.i8\n${symbolic}`;
    const program = assembler.buildProgramModel(source, "struct-use.asm");
    for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const)
      assembler.runStage(stage, program);
    t.deepEqual([...assembler.getBinaryOutput()], use.expectedBytes);
    if (!use.operand) t.is(symbolic, "LDA [$D1],y");
    t.throws(
      () =>
        applySnesStructInstructionOperand(decoded.instruction, original, {
          ...use,
          expectedBytes: [0xea],
        }),
      { message: /decoded instruction/ },
    );
    t.throws(
      () =>
        applySnesStructInstructionOperand(decoded.instruction, original, {
          ...use,
          operand: { expression: "Tint.target", value: 65536 },
        }),
      { message: /encoded immediate/ },
    );
  }
});

test("observations retain alternatives and provenance without injecting source lines", (t) => {
  const input = inputMap();
  input.instructionUses[1].reason = "Shared\nhandler";
  input.instructionUses[1].observations!.push({
    ...observation(),
    target: "Commands.target",
    provenance: "observed",
    source: "capture\nSTP",
    detail: "Bus read\norg $0",
  });
  const comments = renderSnesStructUseComments(validateSnesStructMap(input).instructionUses![1]);
  t.is(comments.length, 3);
  t.true(comments.every((comment) => !comment.includes("\n")));
  t.regex(comments[1], /trace-derived read.*Commands\[1]\.target/);
  t.regex(comments[2], /observed read.*Commands\.target.*capture STP/);
});

test("capture annotations require explicit memory operands and complete matching bytes", (t) => {
  const use = validateSnesStructMap(inputMap()).instructionUses![1];
  const decoder = new Cpu65816Decoder();
  const decode = (bytes: number[]) => {
    const result = decoder.decode({
      source: new Uint8ArrayDecoderSource(Uint8Array.from(bytes)),
      offset: 0,
      logicalAddress: use.address,
      state: { e: 0, m: 0, x: 1 },
    });
    if (result.kind !== "instruction") throw new Error("Expected fixture instruction.");
    return result.instruction;
  };
  t.throws(
    () =>
      applySnesStructInstructionOperand(decode([0xea]), "NOP", { ...use, expectedBytes: [0xea] }),
    { message: /memory operand/ },
  );
  t.throws(() => applySnesStructInstructionOperand(decode([0xb7, 0xd2]), "LDA [$D2],y", use), {
    message: /decoded instruction/,
  });
  const direct = decode([0xaf, 6, 0x81, 0x80]);
  t.is(
    applySnesStructInstructionOperand(direct, "LDA.l $808106", {
      ...use,
      expectedBytes: [...direct.bytes],
    }),
    "LDA.l $808106",
  );
  const invalidOpcode = {
    ...decode([0xb7, 0xd1]),
    mode: "immediate",
    operands: [{ kind: "immediate" as const, value: 2, width: 3 }],
  };
  t.throws(
    () =>
      applySnesStructInstructionOperand(invalidOpcode, "", {
        ...use,
        observations: [],
        operand: { expression: "Tint.target", value: 2 },
      }),
    { message: /encoded immediate/ },
  );
});

test("exported uses survive regeneration and full roundtrip; stale or ambiguous uses preserve all output", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-struct-uses-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const romFile = path.join(root, "fixture.sfc");
  const outputDirectory = path.join(root, "source");
  const rom = fixtureRom();
  fs.writeFileSync(romFile, rom.bytes());
  await initializeSnesDisassemblyWorkspace({ romFile, outputDirectory, mapper: "lorom" });
  const project = loadAnalysisProjectSnapshot(path.join(outputDirectory, "analysis"));
  const filename = path.join(outputDirectory, "struct-map.json");
  const input = inputMap();
  fs.writeFileSync(filename, JSON.stringify(input));
  const options = { sourceProjectSha256: "0".repeat(64) };
  const exportSource = () => exportSnes65816Source(project, rom, outputDirectory, options);
  const first = exportSource();
  t.is(first.inputs?.find((entry) => entry.path === "struct-map.json")?.records, 5);
  const bankFile = path.join(outputDirectory, "banks/bank-000.asm");
  const bank = fs.readFileSync(bankFile, "utf8");
  t.regex(bank, /LDY\.b #Tint.target/);
  t.regex(bank, /ADC\.w #sizeof\(Tint\)/);
  t.regex(
    bank,
    /trace-derived read.*Commands\[1]\.target.*captures\/ceremony.act2.*\n  LDA \[\$D1],y/,
  );
  t.true(
    (await verifySnesProjectRoundTrip({ romFile, sourceDirectory: outputDirectory })).comparison
      .equal,
  );
  t.deepEqual(exportSource(), first);
  const store = openAnalysisProjectStore(path.join(outputDirectory, "analysis"));
  try {
    store.prepareAnnotationQueries();
    const streamed = store.transaction(
      () =>
        exportSnes65816Source(store.sourceExportView(), rom, outputDirectory, {
          ...options,
          instructionGroups: store.instructionExportGroups(),
        }),
      false,
    );
    t.deepEqual(streamed, first, "SQL-backed export preserves uses and byte ownership");
  } finally {
    store.close();
  }
  const groups = project.shards.analysis.filter((record) => record.kind === "cfg-node");
  const grouped = new Map<number, typeof groups>();
  for (const node of groups)
    if (node.fileOffset !== undefined)
      grouped.set(node.fileOffset, [...(grouped.get(node.fileOffset) ?? []), node]);
  t.deepEqual(
    exportSnes65816Source(project, rom, outputDirectory, {
      ...options,
      instructionGroups: [...grouped].sort(([a], [b]) => a - b).map(([, nodes]) => nodes),
    }),
    first,
  );
  for (const change of [
    { ...input.instructionUses[0], expectedBytes: [0xa0, 3] },
    { ...input.instructionUses[0], operand: "sizeof(Tint)" },
    { ...input.instructionUses[0], address: 0x808014, expectedBytes: [0xea] },
    { ...input.instructionUses[0], expectedBytes: [0xa0] },
  ]) {
    fs.writeFileSync(filename, JSON.stringify({ ...input, instructionUses: [change] }));
    t.throws(exportSource);
    t.is(fs.readFileSync(bankFile, "utf8"), bank);
    t.notThrows(() => validateSourceExportFiles(outputDirectory));
  }
  fs.writeFileSync(filename, JSON.stringify(input));
  const conflicting = {
    ...project,
    shards: {
      ...project.shards,
      annotations: [
        ...project.shards.annotations,
        {
          id: "reject-use",
          addressSpace: "rom.file",
          architecture: "snes.65816",
          start: 6,
          end: 8,
          classification: "data8" as const,
          evidence: [],
        },
      ],
    },
  };
  t.throws(() => exportSnes65816Source(conflicting, rom, outputDirectory, options), {
    message: /accepted instruction/,
  });
  t.is(fs.readFileSync(bankFile, "utf8"), bank);
  const site = groups.find((node) => node.fileOffset === 6)!;
  const incompatible = {
    ...project,
    shards: {
      ...project.shards,
      analysis: [...project.shards.analysis, { ...site, id: `${site.id}:wrong-width`, size: 3 }],
    },
  };
  t.throws(() => exportSnes65816Source(incompatible, rom, outputDirectory, options), {
    message: /accepted instruction/,
  });
  t.is(fs.readFileSync(bankFile, "utf8"), bank);
});

test("expressions agree with native assembly, including grouping and one-based bounds", (t) => {
  const input = inputMap();
  input.bindings[0].firstIndex = 1;
  const map = { ...validateSnesStructMap(input), sourceBytes: new Uint8Array() };
  const resolver = new SnesStructExpressionResolver(map.structures, map.bindings);
  const cases: readonly [string, number][] = [
    ["Tint.target", 2],
    ["sizeof(Tint) - 1", 3],
    ["sizeof(Commands)", 4],
    ["countof(Commands)", 2],
    ["bytesof(Commands)", 8],
    ["startof(Commands)", 0x808100],
    ["endof(Commands)", 0x808108],
    ["Commands", 0x8080fc],
    ["Commands[1].target", 0x808102],
    ["Commands[2]", 0x808104],
    ["Commands & $FFFF", 0x80fc],
    ["bank(Commands)", 0x80],
    ["^Commands", 0x80],
    [">Commands", 0x80],
    ["<Commands", 0xfc],
    ["<:Commands", 0x80],
    ["-sizeof(Tint) + 5", 1],
    ["+sizeof(Tint)", 4],
    ["(sizeof(Tint) + 2) * 3", 18],
    ["sizeof(Tint) - (3 - 1)", 2],
    ["(sizeof(Tint) << 3) | 1", 33],
    ["(sizeof(Tint) >> 1) ^ 3", 1],
    ["sizeof(Tint) / 2", 2],
    ["sizeof(Tint) % 3", 1],
    ["sizeof(Tint) + 0x10", 20],
    ["bytesof(Tint)", 4],
    ["countof(Tint)", 1],
    ["endof(Tint)", 4],
  ];
  for (const [expression, expected] of cases) {
    const resolved = resolver.resolve(expression);
    t.is(resolved.value, expected, expression);
    t.is(resolver.resolve(expression), resolved, "Repeated strings reuse the validated result.");
    const assembler = new Assembler();
    const source = `lorom\norg $808000\n${renderSnesStructDefines(map)}\ndl ${resolved.expression}`;
    assembler.assembleProgram(assembler.buildProgramModel(source, "struct-expression.asm"));
    t.deepEqual(
      [...assembler.getBinaryOutput()],
      [expected & 255, (expected >> 8) & 255, (expected >> 16) & 255],
      expression,
    );
  }
});

test("rejects unsafe, unknown, ambiguous and imprecise expressions", (t) => {
  const map = validateSnesStructMap(inputMap());
  const resolver = new SnesStructExpressionResolver(map.structures, map.bindings);
  for (const expression of [
    undefined,
    {},
    "",
    "4",
    "sizeof(Tint)\nSTP",
    "#Tint.target",
    "Tint.target; STP",
    "Missing",
    "Tint.missing",
    "Commands[-1]",
    "Commands[2]",
    "Tint[0]",
    "Commands.target.foo",
    "sizeof(Tint.target)",
    "sizeof()",
    "sizeof(Tint,Tint)",
    "readfile1(Tint)",
    "!Tint",
    '"Tint"',
    "Tint..Commands",
    "sizeof(Tint) / 3",
    "sizeof(Tint) / 0",
    "sizeof(Tint) % 0",
    "sizeof(Tint) * 9007199254740991",
    "sizeof(Tint) == 4",
    "sizeof(Tint) ** 2",
    "Tint +",
    "(".repeat(1025),
    `sizeof(Tint)${" + 1".repeat(129)}`,
  ])
    t.throws(() => resolver.resolve(expression), undefined, JSON.stringify(expression));
  for (const expression of [
    "-sizeof(Tint)",
    "Commands",
    "sizeof(Tint) + $10000",
    { kind: "size", structure: "Tint" },
  ]) {
    const input = inputMap();
    t.throws(() =>
      validateSnesStructMap({
        ...input,
        instructionUses: [{ ...input.instructionUses[0], operand: expression }],
      }),
    );
  }
});

test("observations cover adjacent fields, records and opaque gaps without inventing types", (t) => {
  const input = inputMap();
  const observed = input.instructionUses[1].observations![0];
  observed.target = "Commands.opcode";
  let use = validateSnesStructMap(input).instructionUses![1];
  t.deepEqual(
    use.observations[0].parts.map(({ field, width }) => ({ field, width })),
    [
      { field: "opcode", width: 1 },
      { field: "scope", width: 1 },
    ],
  );
  t.regex(renderSnesStructUseComments(use)[1], /covers: Commands.opcode.*Commands.scope/);
  observed.target = "Commands.target + 1";
  use = validateSnesStructMap(input).instructionUses![1];
  t.deepEqual(
    use.observations[0].parts.map(({ expression, address }) => ({ expression, address })),
    [
      { expression: "(Commands.target + $1)", address: 0x808103 },
      { expression: "Commands[1].opcode", address: 0x808104 },
    ],
  );
  input.structures[0].fields.splice(1, 1);
  observed.target = "startof(Commands) + 1";
  use = validateSnesStructMap(input).instructionUses![1];
  t.is(use.observations[0].parts[0].field, undefined);
  t.is(use.observations[0].parts[1].field, "target");
  t.regex(renderSnesStructUseComments(use)[1], /opaque/);
  for (const target of [
    "endof(Commands) - 1",
    "Commands - 1",
    "Tint.opcode",
    "Commands + $100",
    "Commands + Other - Other",
  ]) {
    const invalid = structuredClone(input);
    invalid.bindings.push({
      ...invalid.bindings[0],
      name: "Other",
      address: 0x808200,
      fileOffset: 0x200,
    });
    invalid.instructionUses[1].observations![0].target = target;
    t.throws(() => validateSnesStructMap(invalid));
  }
  input.bindings[0].firstIndex = 1;
  observed.target = "Commands";
  t.throws(() => validateSnesStructMap(input), { message: /leaves binding/ });
  observed.target = "startof(Commands)";
  t.is(validateSnesStructMap(input).instructionUses![1].observations[0].address, 0x808100);
});

test("exports expressions and full spans through SQL and snapshot paths with identical ROM bytes", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-struct-expression-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  const romFile = path.join(root, "fixture.sfc");
  const outputDirectory = path.join(root, "source");
  const rom = fixtureRom();
  fs.writeFileSync(romFile, rom.bytes());
  await initializeSnesDisassemblyWorkspace({ romFile, outputDirectory, mapper: "lorom" });
  const input = inputMap();
  input.instructionUses[0].operand = "sizeof(Tint) / countof(Commands)";
  input.instructionUses[2].operand = "bytesof(Commands) - sizeof(Tint)";
  input.instructionUses[1].observations![0].target = "Commands.opcode";
  const mapPath = path.join(outputDirectory, "struct-map.json");
  fs.writeFileSync(mapPath, JSON.stringify(input));
  const project = loadAnalysisProjectSnapshot(path.join(outputDirectory, "analysis"));
  const first = exportSnes65816Source(project, rom, outputDirectory, {
    sourceProjectSha256: "0".repeat(64),
  });
  t.true(
    (await verifySnesProjectRoundTrip({ romFile, sourceDirectory: outputDirectory })).comparison
      .equal,
  );
  const store = openAnalysisProjectStore(path.join(outputDirectory, "analysis"));
  try {
    store.prepareAnnotationQueries();
    const streamed = store.transaction(
      () =>
        exportSnes65816Source(store.sourceExportView(), rom, outputDirectory, {
          sourceProjectSha256: "0".repeat(64),
          instructionGroups: store.instructionExportGroups(),
        }),
      false,
    );
    t.deepEqual(streamed, first);
  } finally {
    store.close();
  }
  const generated = fs.readFileSync(path.join(outputDirectory, "banks/bank-000.asm"), "utf8");
  t.regex(generated, /covers: Commands.opcode.*Commands.scope/);
  t.regex(generated, /ADC.w #\(bytesof\(Commands\) - sizeof\(Tint\)\)/);
  input.instructionUses[2].operand = "sizeof(Tint) - 1";
  fs.writeFileSync(mapPath, JSON.stringify(input));
  t.throws(
    () =>
      exportSnes65816Source(project, rom, outputDirectory, { sourceProjectSha256: "0".repeat(64) }),
    { message: /encoded immediate/ },
  );
  t.is(fs.readFileSync(path.join(outputDirectory, "banks/bank-000.asm"), "utf8"), generated);
});

test("the complete struct format remains schema version one", (t) => {
  const input = inputMap();
  t.is(input.schemaVersion, 1);
  t.is(validateSnesStructMap(input).instructionUses?.length, 3);
  for (const schemaVersion of [undefined, 0, 2, 3])
    t.throws(() => validateSnesStructMap({ ...input, schemaVersion }), {
      message: /Unsupported SNES struct-map/,
    });
  const { target: _target, ...evidence } = observation();
  t.throws(
    () =>
      validateSnesStructMap({
        ...input,
        instructionUses: [
          {
            ...input.instructionUses[1],
            observations: [{ ...evidence, binding: "Commands", index: 1, field: "target" }],
          },
        ],
      }),
    { message: /single expression/ },
  );
});
