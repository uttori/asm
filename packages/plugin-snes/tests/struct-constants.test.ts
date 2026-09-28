import { Uint8ArrayDecoderSource } from "@uttori/asm-core";

import { test } from "../../../tests/ava-helper.js";
import { Cpu65816Decoder } from "../src/architectures/65816-decoder.js";
import { SnesStructExpressionResolver } from "../src/disassembler/struct-expressions.js";
import { applySnesStructInstructionOperand } from "../src/disassembler/struct-instruction-uses.js";
import { renderSnesStructDefines, validateSnesStructMap } from "../src/disassembler/struct-map.js";

/** A zero-valued constant must remain distinguishable from an unknown symbol. */
const fixture = () => ({
  format: "uttori-asm-snes-struct-map",
  schemaVersion: 1,
  structures: [{ id: "Frame", size: 50, fields: [] }],
  bindings: [],
  constants: [
    { name: "LZ_COPY_FLAG", value: 128, description: "Token bit selecting a backward copy." },
    { name: "LZ_CODE_BANK", value: 0, description: "Executable stack RAM bank." },
  ],
  instructionUses: [
    {
      address: 0xc14cc8,
      expectedBytes: [0x89, 0x80],
      operand: "LZ_COPY_FLAG",
      reason: "Dispatch by token kind.",
    },
  ],
});

test("reviewed constants resolve guarded operands and emit documented declarations", (t) => {
  const map = validateSnesStructMap(fixture());
  const resolver = new SnesStructExpressionResolver(map.structures, map.bindings, map.constants);
  t.is(map.instructionUses?.[0].operand?.value, 128);
  t.is(resolver.resolve("LZ_CODE_BANK").value, 0);
  t.is(resolver.resolve("sizeof(Frame) - 1").value, 49);
  t.is(resolver.resolve("LZ_COPY_FLAG - 1").value, 127);
  t.regex(
    renderSnesStructDefines({ ...map, sourceBytes: new Uint8Array() }),
    /LZ_COPY_FLAG = \$80/,
  );
  for (const expression of [
    "sizeof(LZ_COPY_FLAG)",
    "LZ_COPY_FLAG.field",
    "LZ_COPY_FLAG[0]",
    "unknown",
  ]) {
    t.throws(() => resolver.resolve(expression));
  }
});

test("constant definitions reject collisions, invalid values and missing contracts", (t) => {
  for (const constant of [
    { name: "frame", value: 1, description: "Collision." },
    { name: "INVALID", value: -1, description: "Negative." },
    { name: "INVALID", value: 0x1000000, description: "Out of range." },
    { name: "INVALID", value: 0.5, description: "Fraction." },
    { name: "INVALID", value: 1, description: "" },
  ])
    {t.throws(() => validateSnesStructMap({ ...fixture(), constants: [constant] }));}
  t.throws(() => validateSnesStructMap({ ...fixture(), constants: {} }));
});

test("status-mask constants preserve REP/SEP syntax and reject unrelated signatures", (t) => {
  for (const opcode of [0xc2, 0xe2, 0x02, 0x42]) {
    const bytes = [opcode, 0x80];
    const map = validateSnesStructMap({
      ...fixture(),
      instructionUses: [
        {
          address: 0xc10000,
          expectedBytes: bytes,
          operand: "LZ_COPY_FLAG",
          reason: "Guarded mask test.",
        },
      ],
    });
    const decoded = new Cpu65816Decoder().decode({
      source: new Uint8ArrayDecoderSource(Uint8Array.from(bytes)),
      offset: 0,
      logicalAddress: 0xc10000,
      state: { e: false, m: true, x: false },
    });
    t.is(decoded.kind, "instruction");
    if (decoded.kind !== "instruction") {continue;}
    const render = () =>
      applySnesStructInstructionOperand(decoded.instruction, "", map.instructionUses![0]);
    if (opcode === 0xc2 || opcode === 0xe2)
      {t.is(render(), `${decoded.instruction.mnemonic} #LZ_COPY_FLAG`);}
    else {t.throws(render);}
  }
});
