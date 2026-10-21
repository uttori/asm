import { createEncoderTestHost } from "../../../tests/architecture/test-stubs.js";
import { test } from "../../../tests/ava-helper.js";
import { ArchSuperFX } from "../src/architectures/superfx.js";

const createArchSuperFX = () => {
  const assembler = createEncoderTestHost();
  const arch = new ArchSuperFX(assembler.context, () => assembler.asarSuperFxMoveShortAddress);
  return { assembler, arch };
};

test("ArchSuperFX.estimateSize matches encoded SuperFX widths", (t) => {
  const { arch } = createArchSuperFX();

  t.is(arch.estimateSize([]), 0);
  t.is(arch.estimateSize(["NOP"]), 1);
  t.is(arch.estimateSize(["RPIX"]), 2);
  t.is(arch.estimateSize(["ADC", "R0"]), 2);
  t.is(arch.estimateSize(["ADD", "R0"]), 1);
  t.is(arch.estimateSize(["LINK", "#2"]), 1);
  t.is(arch.estimateSize(["BRA", "target"]), 2);
  t.is(arch.estimateSize(["IBT", "R1, #$12"]), 2);
  t.is(arch.estimateSize(["IWT", "R1, #$1234"]), 3);
  t.is(arch.estimateSize(["MOVE", "R0, #$00"]), 2);
  t.is(arch.estimateSize(["MOVE", "R0, #$80"]), 3);
  t.is(arch.estimateSize(["LM", "R0, ($1234)"]), 4);
  t.is(arch.estimateSize(["LMS", "R0, ($00)"]), 3);
  t.is(arch.estimateSize(["MOVEB", "(R0), R1"]), 2);
  t.is(arch.estimateSize(["MOVEB", "(R2), R1"]), 3);
  t.is(arch.estimateSize(["MOVEW", "R0, (R1)"]), 1);
  t.is(arch.estimateSize(["MOVEW", "R3, (R1)"]), 2);
});

test("ArchSuperFX.estimateSize MOVE RAM: short=3, long=4, unresolved=4", (t) => {
  const { arch } = createArchSuperFX();

  // Short RAM (even, < $200): LMS-shaped, 3 bytes.
  t.is(arch.estimateSize(["MOVE", "R0, ($40)"]), 3);
  t.is(arch.estimateSize(["MOVE", "($40), R1"]), 3);
  // Non-short RAM: LM/SM-shaped, 4 bytes.
  t.is(arch.estimateSize(["MOVE", "R0, ($300)"]), 4);
  t.is(arch.estimateSize(["MOVE", "($300), R1"]), 4);
  // Unresolved label: pessimistic estimate of 4. May shrink to 3 after layout resolves.
  t.is(arch.estimateSize(["MOVE", "R0, (unknownLabel)"]), 4);
  t.is(arch.estimateSize(["MOVE", "(unknownLabel), R1"]), 4);
  // LEA is IWT-shaped (no ALT1): 3 bytes regardless.
  t.is(arch.estimateSize(["LEA", "R0, $1234"]), 3);
});

test("ArchSuperFX MOVEB/MOVEW drop FROM/TO when the implied register is R0", (t) => {
  const { assembler, arch } = createArchSuperFX();

  t.true(arch.encode(["MOVEB", "R0, (R5)"]));
  t.true(arch.encode(["MOVEB", "R3, (R5)"]));
  t.true(arch.encode(["MOVEB", "(R0), R5"]));
  t.true(arch.encode(["MOVEB", "(R3), R5"]));

  t.deepEqual(assembler.emitted, [0x3d, 0x45, 0x13, 0x3d, 0x45, 0x3d, 0x35, 0xb3, 0x3d, 0x35]);
});

test("ArchSuperFX auto-MOVE short RAM form is hardware word-index by default", (t) => {
  const { assembler, arch } = createArchSuperFX();

  t.true(arch.encode(["MOVE", "R0, ($40)"]));
  t.true(arch.encode(["MOVE", "($40), R1"]));
  t.true(arch.encode(["LMS", "R2, ($40)"]));

  t.deepEqual(assembler.emitted, [0x3d, 0xa0, 0x20, 0x3e, 0xa1, 0x20, 0x3d, 0xa2, 0x20]);
});

test("ArchSuperFX auto-MOVE short RAM form matches Asar when compatibility is enabled", (t) => {
  const { assembler, arch } = createArchSuperFX();
  assembler.asarSuperFxMoveShortAddress = true;

  t.true(arch.encode(["MOVE", "R0, ($40)"]));
  t.true(arch.encode(["MOVE", "($40), R1"]));
  t.true(arch.encode(["LMS", "R2, ($40)"]));

  t.deepEqual(assembler.emitted, [0x3d, 0xa0, 0x40, 0x3e, 0xa1, 0x40, 0x3d, 0xa2, 0x20]);
});

test("ArchSuperFX catalog covers every mnemonic the encoder accepts", (t) => {
  const { arch } = createArchSuperFX();
  const mnemonics = new Set(arch.getInstructionCatalog().map((entry) => entry.mnemonic));
  const expected = [
    "STOP",
    "NOP",
    "CACHE",
    "LSR",
    "ROL",
    "LOOP",
    "ALT1",
    "ALT2",
    "ALT3",
    "PLOT",
    "SWAP",
    "COLOR",
    "NOT",
    "MERGE",
    "SBK",
    "SEX",
    "ASR",
    "ROR",
    "LOB",
    "FMULT",
    "HIB",
    "GETC",
    "GETB",
    "RPIX",
    "CMODE",
    "DIV2",
    "LMULT",
    "GETBH",
    "RAMB",
    "GETBL",
    "ROMB",
    "GETBS",
    "BRA",
    "BGE",
    "BLT",
    "BNE",
    "BEQ",
    "BPL",
    "BMI",
    "BCC",
    "BCS",
    "BVC",
    "BVS",
    "TO",
    "WITH",
    "FROM",
    "ADD",
    "ADC",
    "SUB",
    "SBC",
    "CMP",
    "AND",
    "BIC",
    "OR",
    "XOR",
    "MULT",
    "UMULT",
    "JMP",
    "LJMP",
    "INC",
    "DEC",
    "LINK",
    "STW",
    "LDW",
    "STB",
    "LDB",
    "IBT",
    "IWT",
    "LM",
    "LMS",
    "SM",
    "SMS",
    "LEA",
    "MOVE",
    "MOVES",
    "MOVEB",
    "MOVEW",
  ];

  t.deepEqual([...mnemonics].toSorted(), [...expected].toSorted());
});
