import { readFileSync } from "node:fs";

import { Assembler } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import { createSnesAssemblerEnvironment } from "../src/assembler.js";

const environment = await createSnesAssemblerEnvironment();

/** Exercise collection, layout and emission together, including forward symbol resolution. */
function assemble(source: string): Uint8Array {
  const assembler = new Assembler({
    environment,
    target: "snes.sfc",
    targetOptions: { checksumEnabled: false },
  });
  try {
    assembler.assembleSource(source, "immediate-width.asm");
    return assembler.getBinaryOutput();
  } finally {
    assembler.dispose();
  }
}

test("Asar label immediate widths match the independent native-assembler golden after SEP", (t) => {
  const source = readFileSync(
    new URL("../../../fixtures/asar/tests/65816-immediate-label-width.asm", import.meta.url),
    "utf8",
  );
  const expected = readFileSync(
    new URL("../../../fixtures/asar/expected/65816-immediate-label-width.asm.sfc", import.meta.url),
  );
  t.deepEqual(Buffer.from(assemble(source)), expected);
});

test("resolved word immediates retain their high byte across every 65816 immediate family", (t) => {
  for (const [mnemonic, opcode] of [
    ["LDA", 0xa9],
    ["ADC", 0x69],
    ["SBC", 0xe9],
    ["CMP", 0xc9],
    ["AND", 0x29],
    ["ORA", 0x09],
    ["EOR", 0x49],
    ["BIT", 0x89],
    ["LDX", 0xa2],
    ["LDY", 0xa0],
    ["CPX", 0xe0],
    ["CPY", 0xc0],
  ] as const) {
    const result = assemble(`org $008000\nSEP #$30\n${mnemonic} #Routine\nRoutine = $098000\n`);
    t.deepEqual([...result], [0xe2, 0x30, opcode, 0x00, 0x80], mnemonic);
  }
});
