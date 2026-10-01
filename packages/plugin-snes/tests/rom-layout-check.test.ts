import { Assembler } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import { checkSnesSourceLayout } from "../src/disassembler/rom-layout/check.js";
import { createSnesAssemblerEnvironment } from "../src/index.js";

/** Use the production encoder and final-pass metadata; a mocked range cannot prove overwrite detection. */
async function assemble(source: string): Promise<Assembler> {
  const assembler = new Assembler({
    environment: await createSnesAssemblerEnvironment(),
    target: "snes.sfc",
    architecture: "snes.65816",
    collectSourceMetadata: true,
    targetOptions: { checksumEnabled: false },
  });
  assembler.setCurrentFile("layout.asm");
  assembler.assembleProgram(
    assembler.buildProgramModel(`hirom\narch 65816\n.smart off\n${source}`, "layout.asm", 0),
  );
  return assembler;
}

test("layout rejects an overwritten table word even when the final ROM length is unchanged", async (t) => {
  const assembler = await assemble(
    "org $C00000\ndw $1111, $2222, $3333\norg $C00004\ndb $EA, $EA\n",
  );
  t.teardown(() => assembler.dispose());
  const output = assembler.getBinaryOutput();
  t.is(output.length, 6);
  const diagnostics = checkSnesSourceLayout({
    output: Uint8Array.from(output),
    mapping: assembler.addressToLineMapping,
    expectedSize: 6,
  });
  t.true(
    diagnostics.some((diagnostic) => diagnostic.code === "overlap" && diagnostic.offset === 4),
  );
});

test("layout checks emitted immediate width against declared CPU state", async (t) => {
  const assembler = await assemble("org $C00000\nAND.w #$001F\n");
  t.teardown(() => assembler.dispose());
  t.is(assembler.addressToLineMapping.instructions[0]!.size, 3);
  const options = {
    output: Uint8Array.from(assembler.getBinaryOutput()),
    mapping: assembler.addressToLineMapping,
    expectedSize: 3,
  };
  t.true(
    checkSnesSourceLayout({ ...options, states: [{ offset: 0, e: false, m: true }] }).some(
      (diagnostic) => diagnostic.code === "instruction-width",
    ),
  );
  t.deepEqual(
    checkSnesSourceLayout({ ...options, states: [{ offset: 0, e: false, m: false }] }),
    [],
  );
  t.throws(
    () => checkSnesSourceLayout({ ...options, states: [{ offset: 0, e: true, m: false }] }),
    { message: /Emulation-mode/ },
  );
  t.true(
    checkSnesSourceLayout({ ...options, requiredCpuStateRanges: [{ start: 0, end: 3 }] }).some(
      (diagnostic) => diagnostic.code === "unknown-cpu-state",
    ),
  );
});

test("fixed symbol extents and program bank boundaries are independently enforced", async (t) => {
  const assembler = await assemble("org $C0FFFF\nStart:\nLDA.b #$01\nEnd:\n");
  t.teardown(() => assembler.dispose());
  const diagnostics = checkSnesSourceLayout({
    output: Uint8Array.from(assembler.getBinaryOutput()),
    mapping: assembler.addressToLineMapping,
    expectedSize: assembler.getBinaryOutput().length,
    states: [{ offset: 0xffff, e: false, m: true }],
    extents: [{ id: "entry", startSymbol: "Start", endSymbol: "End", size: 1 }],
    symbols: new Map([...assembler.labelTable].map(([name, symbol]) => [name, symbol.value])),
  });
  t.true(diagnostics.some((diagnostic) => diagnostic.code === "bank-crossing"));
  t.true(diagnostics.some((diagnostic) => diagnostic.code === "fixed-extent"));
});
