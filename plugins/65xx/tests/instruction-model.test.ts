import { test } from "../../../tests/ava-helper.js";

import {
  cmos65c02Forms,
  cmos65sc02Forms,
  commodore4510Forms,
  csg65ce02Forms,
  getOpcodeForm,
  getCpuDecodeTable,
  materializeOpcodeForm,
  nmos6502Cpu,
  nmos6502DecodeTable,
  nmos6502Forms,
  nmos6502xForms,
  nmos6502xCpu,
  mega65Gs02Forms,
  mos6502DtvForms,
  wdc65c02Forms,
} from "../src/index.js";

test("NMOS decode table covers every byte and identifies all 151 legal opcodes", (t) => {
  t.is(nmos6502DecodeTable.length, 256);
  t.is(new Set(nmos6502DecodeTable.map((form) => form.opcode)).size, 256);
  t.is(nmos6502DecodeTable.filter((form) => form.documented).length, 151);
  t.is(nmos6502DecodeTable.filter((form) => !form.documented).length, 105);
  t.is(nmos6502Forms.length, 154);
  t.is(getCpuDecodeTable(nmos6502Cpu).length, 151);
  t.is(getCpuDecodeTable(nmos6502xCpu).length, 256);

  for (let opcode = 0; opcode <= 0xff; opcode++) {
    const form = getOpcodeForm(opcode);
    t.is(getCpuDecodeTable(nmos6502Cpu).includes(form), form.documented);
    t.true(getCpuDecodeTable(nmos6502xCpu).includes(form));
    const operandBytes = form.operands.flatMap((operand) => Array(operand.width).fill(0x5a));
    const encoded = materializeOpcodeForm(form, operandBytes);
    t.is(encoded[0], opcode, `$${opcode.toString(16).padStart(2, "0")}`);
    t.is(encoded.length, form.encoding.length + operandBytes.length);
  }
});

test("canonical 6502X forms preserve duplicate and unstable opcode policy", (t) => {
  const canonical = new Map(
    nmos6502xForms.map((form) => [`${form.mnemonic}:${form.mode}`, form.opcode]),
  );
  t.is(canonical.size, nmos6502xForms.length);
  t.is(canonical.get("ANC:immediate"), 0x0b);
  t.is(canonical.get("JAM:implied"), 0x02);
  t.is(canonical.get("NOP:immediate"), 0x80);
  t.is(canonical.get("NOP:absoluteIndexedX"), 0x1c);
  t.is(canonical.get("SBC:immediate"), 0xe9);
  t.false(getOpcodeForm(0x2b).canonical);
  t.false(getOpcodeForm(0xeb).canonical);
  t.is(getOpcodeForm(0x8b).stability, "unstable-undocumented");
  t.regex(getOpcodeForm(0x8b).note ?? "", /canonical ca65-compatible byte/i);
  t.regex(getOpcodeForm(0x6c).note ?? "", /wraps the high-byte fetch/i);
});

test("opcode form materialization validates raw operand bytes", (t) => {
  const ldaImmediate = getOpcodeForm(0xa9);
  t.deepEqual([...materializeOpcodeForm(ldaImmediate, [0x42])], [0xa9, 0x42]);
  t.throws(() => materializeOpcodeForm(ldaImmediate), { message: /expects 1 encoded operand/i });
  t.throws(() => materializeOpcodeForm(ldaImmediate, [0x100]), {
    message: /outside the byte range/i,
  });
  t.throws(() => getOpcodeForm(0x100), { instanceOf: RangeError });
});

test("Phase 4 and 5 tables expose complete and distinct ca65 architecture sets", (t) => {
  t.is(mos6502DtvForms.length, 192);
  t.is(cmos65sc02Forms.length, 182);
  t.is(cmos65c02Forms.length, 214);
  t.is(wdc65c02Forms.length, 216);
  t.is(csg65ce02Forms.length, 263);
  t.is(commodore4510Forms.length, 263);
  t.is(mega65Gs02Forms.length, 350);

  const has = (forms: typeof cmos65sc02Forms, mnemonic: string, mode = "implied") =>
    forms.some((form) => form.mnemonic === mnemonic && form.mode === mode);
  t.false(has(cmos65sc02Forms, "RMB0", "zeroPage"));
  t.true(has(cmos65c02Forms, "RMB0", "zeroPage"));
  t.false(has(cmos65c02Forms, "WAI"));
  t.true(has(wdc65c02Forms, "WAI"));
  t.true(has(csg65ce02Forms, "AUG"));
  t.false(has(csg65ce02Forms, "MAP"));
  t.true(has(commodore4510Forms, "MAP"));
  t.true(has(mega65Gs02Forms, "LDQ", "basePageIndirectIndexedZ"));
});
