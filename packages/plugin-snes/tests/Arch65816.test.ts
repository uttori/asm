import { createEncoderTestHost } from "../../../tests/architecture/test-stubs.js";
import { test } from "../../../tests/ava-helper.js";
import { Arch65816 } from "../src/architectures/65816.js";

const createArch65816 = () => {
  const assembler = createEncoderTestHost();
  const arch = new Arch65816(assembler.context, () => assembler.optimizeDirectPage);
  return { assembler, arch };
};

test("Arch65816.estimateSize rejects a trailing opcode dot", (t) => {
  const { arch } = createArch65816();
  t.throws(
    () => {
      arch.estimateSize(["LDA."]);
    },
    { message: "Error: Invalid opcode length in 'LDA.'." },
  );
});

test("Arch65816.estimateSize uses architecture-aware sizing", (t) => {
  const { assembler, arch } = createArch65816();

  t.is(arch.estimateSize([]), 0, "Empty input reserves no bytes");
  t.is(arch.estimateSize(["BRA", "$8005"]), 2, "Short branches reserve 2 bytes");
  t.is(arch.estimateSize(["BRL", "$8100"]), 3, "Long branches reserve 3 bytes");
  t.is(arch.estimateSize(["JSL", "$808000"]), 4, "Long jumps reserve 4 bytes");
  t.is(arch.estimateSize(["LDA", "#$1000"]), 3, "Immediate word operands reserve 3 bytes");
  t.is(
    arch.estimateSize(["ASL", "#3"]),
    3,
    "Accumulator repeat pseudo-ops reserve one byte per repeat",
  );
  t.is(arch.estimateSize(["INC"]), 1, "Bare accumulator INC should reserve one byte");
  t.is(arch.estimateSize(["DEC"]), 1, "Bare accumulator DEC should reserve one byte");
  t.is(arch.estimateSize(["ASL", "A"]), 1, "ASL A is implied accumulator");
  t.is(arch.estimateSize(["LDA", "[$00],y"]), 2, "Indirect long indexed is two bytes");
  t.is(arch.estimateSize(["JML", "[$0000]"]), 3, "JML [$abs] is three bytes");
  assembler.currentTargetAddress = 0x048afd;
  t.is(
    arch.estimateSize(["SBC", "_048AD3,X"]),
    3,
    "Same-bank indexed labels should reserve absolute,X bytes",
  );
  assembler.currentTargetAddress = 0x01b487;
  assembler.symbols.set("raphael_mode7_matrix_a_d", 0x00e954);
  t.is(
    arch.estimateSize(["LDA", "raphael_mode7_matrix_a_d,x"]),
    4,
    "Cross-bank bank-0 table labels should reserve long,X bytes",
  );
});

test("Arch65816.encode uses abs,x for same-bank CMP table labels", (t) => {
  const { assembler, arch } = createArch65816();
  assembler.currentTargetAddress = 0x04fa46;
  assembler.symbols.set("level_with_ski_ids", 0x04fa31);

  t.true(arch.encode(["CMP", "level_with_ski_ids,x"]));
  t.deepEqual(assembler.emitted, [0xdd, 0x31, 0xfa]);
});

test("Arch65816.estimateSize uses M/X flags for immediates after SEP/REP", (t) => {
  const { arch } = createArch65816();
  t.is(arch.estimateSize(["LDA", "#$00"]), 2);
  t.is(arch.estimateSize(["REP", "#$20"]), 2);
  t.is(arch.estimateSize(["LDA", "#$00"]), 2, "Hex immediates keep their spelling width");
  t.is(
    arch.estimateSize(["LDA", "#(NMI&$FFFF)"]),
    3,
    "Math immediates follow 16-bit A after REP #$20",
  );
});

test("Arch65816.encode keeps .b on DP-indirect instead of treating it as a label", (t) => {
  const { assembler, arch } = createArch65816();

  t.true(arch.encode(["LDA.b", "[$20],y"]));
  t.deepEqual(assembler.emitted, [0xb7, 0x20]);

  assembler.emitted.length = 0;
  t.true(arch.encode(["LDA.b", "[$20]"]));
  t.deepEqual(assembler.emitted, [0xa7, 0x20]);

  assembler.emitted.length = 0;
  t.true(arch.encode(["STA.b", "($E8),y"]));
  t.deepEqual(assembler.emitted, [0x91, 0xe8]);

  assembler.emitted.length = 0;
  t.true(arch.encode(["LDA.b", "($60)"]));
  t.deepEqual(assembler.emitted, [0xb2, 0x60]);

  assembler.emitted.length = 0;
  t.true(arch.encode(["CMP.b", "[$EA]"]));
  t.deepEqual(assembler.emitted, [0xc7, 0xea]);

  assembler.emitted.length = 0;
  t.true(arch.encode(["ADC.b", "$01,S"]));
  t.deepEqual(assembler.emitted, [0x63, 0x01]);

  assembler.emitted.length = 0;
  t.true(arch.encode(["STY.b", "$48,x"]));
  t.deepEqual(assembler.emitted, [0x94, 0x48]);
});

test("Arch65816.encode treats parenthesized bank math ,x as long indexed X", (t) => {
  const { assembler, arch } = createArch65816();

  t.true(arch.encode(["LDA.l", "($7F0000&$FF0000)+$03,x"]));
  t.deepEqual(assembler.emitted, [0xbf, 0x03, 0x00, 0x7f]);

  assembler.emitted.length = 0;
  t.true(arch.encode(["CMP.l", "($7F0000&$FF0000)+$03,x"]));
  t.deepEqual(assembler.emitted, [0xdf, 0x03, 0x00, 0x7f]);
});

test("Arch65816.encode returns false for empty input", (t) => {
  const { arch } = createArch65816();

  t.false(arch.encode([]));
});
