import { readFileSync } from "node:fs";

import { Assembler, MemoryAssemblyFileProvider, type AssemblyModule } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import { cpu65816Specifications } from "../src/architectures/65816-spec.js";
import { spc700Specifications } from "../src/architectures/spc700-spec.js";
import { createSnesAssemblerEnvironment } from "../src/assembler.js";

const environment = await createSnesAssemblerEnvironment();

/** Exercise the production source/stage/encoder path, retaining only the detached result. */
function assemble(source: string, architecture = "snes.65816"): AssemblyModule {
  const assembler = new Assembler({
    environment,
    target: "snes.sfc",
    architecture,
    module: { id: "module" },
  });
  try {
    assembler.assembleSource(source, "module.asm");
    return assembler.getAssemblyModule();
  } finally {
    assembler.dispose();
  }
}

test("module stages preserve section identity, imports, exports, forward branches and BSS", (t) => {
  const module = assemble(
    'import External\nexport Start\nsection "Code"\nStart:\nlda.l External+1\njsl External\nbra Done\ndb bank(External)\nDone:\nrts\nsection "Data", data, 16\nTable:\ndl Start\nsection "Scratch", bss\nreserve 8\n',
  );
  t.deepEqual(
    module.sections.map(({ name, size, alignment }) => ({ name, size, alignment })),
    [
      { name: "Code", size: 12, alignment: 1 },
      { name: "Data", size: 3, alignment: 16 },
      { name: "Scratch", size: 8, alignment: 1 },
    ],
  );
  t.deepEqual([...module.sections[0].bytes], [0xaf, 0, 0, 0, 0x22, 0, 0, 0, 0x80, 0, 0, 0x60]);
  t.is(module.sections[2].bytes.length, 0);
  t.deepEqual(
    module.fixups.map((fixup) => [fixup.section, fixup.offset, fixup.encoding.width]),
    [
      ["Code", 1, 3],
      ["Code", 5, 3],
      ["Code", 9, 1],
      ["Code", 10, 1],
      ["Data", 0, 3],
    ],
  );
  t.deepEqual(module.fixups[2].encoding.pc, { section: "Code", offset: 10 });
  t.deepEqual(module.symbols.find((symbol) => symbol.name === "Table")?.value, {
    kind: "section",
    module: "module",
    section: "Data",
    offset: 0,
  });
  t.is(module.symbols.find((symbol) => symbol.name === "Start")?.visibility, "export");
  t.true(module.ranges.some((range) => range.kind === "instruction" && range.source.line === 5));
  t.regex(module.dependencies[0].sha256, /^[\da-f]{64}$/);
});

test("SPC700 retains bit packing checks and reversed compound field order", (t) => {
  const module = assemble(
    "import Address,Source,Destination,Target\nMOV1 C,Address.2\nMOV Destination,Source\nBRA Target\n",
    "snes.spc700",
  );
  t.deepEqual([...module.sections[0].bytes], [0xaa, 0, 0, 0xfa, 0, 0, 0x2f, 0]);
  t.deepEqual(
    module.fixups.slice(1, 3).map((fixup) => fixup.expression),
    [
      { kind: "symbol", name: "Source" },
      { kind: "symbol", name: "Destination" },
    ],
  );
  t.deepEqual(module.fixups[0].encoding.checks, [
    { expression: { kind: "symbol", name: "Address" }, minimum: 0, maximum: 0x1fff },
  ]);
  t.deepEqual(module.fixups.at(-1)?.encoding.pc, { section: ".text", offset: 8 });
});

test("SuperFX retains scaled short-address constraints and chooses stable automatic long forms", (t) => {
  const module = assemble(
    "import Address,Target\nMOVE R2,#Address\nLMS R4,(Address)\nBRA Target\n",
    "snes.superfx",
  );
  t.deepEqual([...module.sections[0].bytes], [0xf2, 0, 0, 0x3d, 0xa4, 0, 5, 0]);
  t.deepEqual(module.fixups[1].expression, {
    kind: "binary",
    operator: ">>",
    left: { kind: "symbol", name: "Address" },
    right: { kind: "constant", value: 1 },
  });
  t.is(module.fixups[1].encoding.checks?.[0].alignment, 2);
  t.throws(() => assemble("LMS R2,($101)", "snes.superfx"), { message: /range\/alignment/ });
});

test("section reopening resumes its cursor and scalar data retains distinct section bases", (t) => {
  const module = assemble(
    'section "One", data\nA:\ndb 1\nsection "Two", data\nB:\ndl A\nsection "One", data\ndl B\n',
  );
  t.deepEqual(
    module.sections.map((section) => [section.name, section.size]),
    [
      ["One", 4],
      ["Two", 3],
    ],
  );
  t.deepEqual(
    module.fixups.map((fixup) => fixup.expression),
    [
      { kind: "section", module: "module", section: "One", offset: 0 },
      { kind: "section", module: "module", section: "Two", offset: 0 },
    ],
  );
});

test("module failures cannot publish missing symbols, incomplete exports, BSS payloads or duplicate definitions", (t) => {
  for (const [source, message] of [
    ["lda.l Missing", /Undefined module symbol/],
    ["export Missing\nnop", /not defined/],
    ['section "Scratch", bss\ndb 1', /BSS/],
    ["A:\nnop\nA:\nnop", /Duplicate module symbol/],
    ["import External\nREP #External\nLDA #1", /assembly-time constant/],
  ] as const) {
    t.throws(() => assemble(source), { message });
  }
});

test("module snapshots own payload/metadata and binary output requires linking", (t) => {
  const assembler = new Assembler({
    environment,
    target: "snes.sfc",
    module: { id: "owned" },
    fileProvider: new MemoryAssemblyFileProvider(),
  });
  try {
    assembler.assembleSource("db 1,2,3", "owned.asm");
    const first = assembler.getAssemblyModule();
    first.sections[0].bytes[0] = 99;
    t.is(assembler.getAssemblyModule().sections[0].bytes[0], 1);
    t.throws(() => assembler.getBinaryOutput(), { message: /link it/ });
  } finally {
    assembler.dispose();
  }
});

test("structured fields retain symbolic values and referenced record bases across sections", (t) => {
  const module = assemble(
    'import External\nstruct Record $C01234\n.pointer: dl\n.flag: db\nendstruct\nsection "Records",data\ndataStruct Record,{pointer=External,flag=1}\nsection "Code"\nlda.l Record.pointer\n',
  );
  t.deepEqual(
    module.fields.map(({ section, offset, reference, size }) => ({
      section,
      offset,
      reference,
      size,
    })),
    [
      { section: "Records", offset: 0, reference: "Record.pointer", size: 3 },
      { section: "Records", offset: 3, reference: "Record.flag", size: 1 },
    ],
  );
  t.deepEqual([...module.sections[0].bytes], [0, 0, 0, 1]);
  t.deepEqual(module.fixups[1].expression, {
    kind: "binary",
    operator: "+",
    left: { kind: "section", module: "module", section: "Records", offset: 0 },
    right: { kind: "constant", value: 0 },
  });
});

test("symbol aliases preserve external dependencies and numeric sizing refuses section addresses", (t) => {
  const module = assemble("import External\nAlias = External+2\ndl Alias\n");
  t.deepEqual(module.fixups[0].expression, {
    kind: "binary",
    operator: "+",
    left: { kind: "symbol", name: "External" },
    right: { kind: "constant", value: 2 },
  });
  t.throws(() => assemble("Count:\nreserve Count"), { message: /assembly-time constant/ });
  t.throws(() => assemble("org $C00000\nnop"), { message: /absolute placement/ });
});

test("functions, macros and loop constants retain symbolic arguments without numeric coercion", (t) => {
  const module = assemble(`import External
function address(value,index) = value + index*2
macro Emit(value)
  dl address(<value>,3)
endmacro
%Emit(External)
for i = 0..2
  dl address(External,!i)
endfor
`);
  t.is(module.fixups.length, 3);
  t.deepEqual(
    module.fixups.map((fixup) => fixup.expression.kind),
    ["binary", "binary", "binary"],
  );
  t.deepEqual(
    module.fixups.map((fixup) =>
      fixup.expression.kind === "binary" ? fixup.expression.right : null,
    ),
    [
      { kind: "constant", value: 6 },
      { kind: "constant", value: 0 },
      { kind: "constant", value: 2 },
    ],
  );
});

test("relative and macro-local labels stay within their section despite identical offsets", (t) => {
  const module = assemble(`section "Other"
bra +
nop
+:
rts
section "Code"
macro Branch()
  bra ?+
  nop
?+:
endmacro
%Branch()
%Branch()
bra +
nop
nop
+:
rts
`);
  t.deepEqual(
    module.fixups.map(({ section, expression }) => [section, expression]),
    [
      ["Other", { kind: "section", module: "module", section: "Other", offset: 3 }],
      ["Code", { kind: "section", module: "module", section: "Code", offset: 3 }],
      ["Code", { kind: "section", module: "module", section: "Code", offset: 6 }],
      ["Code", { kind: "section", module: "module", section: "Code", offset: 10 }],
    ],
  );
});

test("incomplete assembly cannot expose records and module sessions reject direct ROM mutations", (t) => {
  const assembler = new Assembler({ environment, target: "snes.sfc", module: { id: "failed" } });
  t.teardown(() => assembler.dispose());
  t.throws(() => assembler.getAssemblyModule(), { message: /not completed/ });
  t.throws(() => assembler.assembleSource("dl Missing", "failed.asm"));
  t.throws(() => assembler.getAssemblyModule(), { message: /not completed/ });
  t.throws(() => assembler.writeOutputBytes(0, 1), { message: /linked output/ });
  t.throws(() => assembler.expandOutput(16, 0), { message: /linked output/ });
  t.throws(() => assembler.finalizeOutput(), { message: /linked output/ });
});

test("module encoders preserve the opcode and extent of every 65816 and SPC700 matrix entry", (t) => {
  for (const [architecture, specifications] of [
    ["snes.65816", cpu65816Specifications],
    ["snes.spc700", spc700Specifications],
  ] as const) {
    t.is(specifications.length, 256);
    for (const specification of specifications) {
      let operand = specification.syntax
        .replaceAll("addr.bit", "$1234.0")
        .replaceAll("upage", "$FF10")
        .replaceAll("srcBank", "$01")
        .replaceAll("destBank", "$02")
        .replaceAll("const", "$10")
        .replaceAll("long", "$123456")
        .replaceAll("addr", "$1234")
        .replaceAll("dp", "$10")
        .replaceAll("sr", "$10")
        .replaceAll("label", "Target");
      if (specification.mode === "tableCall") {
        operand = String(specification.opcode[0] >> 4);
      }
      const source = `import Target\n${specification.mnemonic} ${operand}\n`;
      const module = assemble(source, architecture);
      const bytes = module.sections[0].bytes;
      t.is(bytes[0], specification.opcode[0], `${architecture}: ${source}`);
      t.is(bytes.length, specification.minimumSize, `${architecture}: ${source}`);
    }
  }
});

test("converted assets retain owned payloads, conversion receipts and input hashes in modules", (t) => {
  const bytes = Uint8Array.from(
    readFileSync(new URL("../../assets/tests/fixtures/colored-4bpp.png", import.meta.url)),
  );
  const assetSource = 'includeAsset("art.png","snes.tile.4bpp",palette:"embedded")\n';
  const files = new MemoryAssemblyFileProvider({ "art.png": bytes });
  const absolute = new Assembler({
    environment,
    target: "snes.sfc",
    fileProvider: files,
    targetOptions: { checksumEnabled: false },
  });
  const relocatable = new Assembler({
    environment,
    target: "snes.sfc",
    fileProvider: files,
    module: { id: "assets" },
  });
  t.teardown(() => {
    absolute.dispose();
    relocatable.dispose();
  });
  absolute.assembleSource("org $808000\n" + assetSource, "assets.asm");
  relocatable.assembleSource('section "Art",data\n' + assetSource, "assets.asm");
  const module = relocatable.getAssemblyModule();
  t.deepEqual(module.sections[0].bytes, absolute.getBinaryOutput());
  t.is(module.assets[0].section, "Art");
  t.is(module.assets[0].offset, 0);
  t.truthy(module.assets[0].conversion);
  t.true(module.ranges.every((range) => range.kind === "asset"));
  t.true(
    module.dependencies.some(
      (dependency) =>
        dependency.path.endsWith("art.png") && /^[\da-f]{64}$/.test(dependency.sha256),
    ),
  );
});

test("symbolic and constant equates use existing namespace and local-label qualification", (t) => {
  const module = assemble(`import External
namespace Scene
Start:
.local:
Alias = External+1
Constant = 2
dl Alias
 db Constant
namespace off
dl Scene_Alias
`);
  t.true(module.symbols.some(({ name }) => name === "Scene_Alias"));
  t.false(module.symbols.some(({ name }) => name === "Alias"));
  t.deepEqual(module.symbols.find(({ name }) => name === "Scene_Constant")?.value, {
    kind: "constant",
    value: 2,
  });
  t.deepEqual(module.fixups[0].expression, module.fixups[1].expression);
  t.is(module.sections[0].bytes[3], 2);
});
