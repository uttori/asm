/* eslint-disable @typescript-eslint/no-explicit-any */
import sinon from "sinon";
import { test } from "./ava-helper.js";

import { ArchSuperFX } from "../src/ArchSuperFX.js";
import { createEncoderTestHost } from "./architecture/test-stubs.js";

const createArchSuperFX = () => {
  const assembler = createEncoderTestHost();
  const arch = new ArchSuperFX(assembler.context);
  return { assembler, arch };
};

test("ArchSuperFX.estimateInstruction uses lowered operands", (t) => {
  const { arch } = createArchSuperFX();
  const size = arch.estimateInstruction({
    kind: "instruction",
    mnemonic: "IBT",
    operandText: "R1,#!imm",
    operands: ["R1", "#!imm"],
    loweredOperands: [
      {
        raw: "R1",
        expanded: "R1",
        length: 1,
        immediate: false,
        indirect: false,
        mode: "register",
        registerName: "r1",
      },
      {
        raw: "#!imm",
        expanded: "#$12",
        length: 1,
        immediate: true,
        indirect: false,
        mode: "immediate",
      },
    ],
    loweredOperand: {
      raw: "R1,#!imm",
      expanded: "R1,#$12",
      length: 2,
      immediate: false,
      indirect: false,
    },
    words: ["NOP"],
    sourceFile: "fixture.asm",
    sourceLine: 1,
    sourceRaw: "IBT R1,#!imm",
  });
  t.is(size, 2);
});

test("ArchSuperFX.estimateSize matches encoded SuperFX widths", (t) => {
  const { arch } = createArchSuperFX();

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

test("ArchSuperFX.encodeInstruction routes lowered operands directly", (t) => {
  const { assembler, arch } = createArchSuperFX();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  const encodeStub = sinon.stub(arch, "encode");
  const twoOperandStub = sinon.stub(arch, "handleTwoOperandOpcode").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
    encodeStub.restore();
    twoOperandStub.restore();
  });

  const handled = arch.encodeInstruction({
    kind: "instruction",
    mnemonic: "IBT",
    operandText: "R1,#!imm",
    operands: ["R1", "#!imm"],
    loweredOperands: [
      {
        raw: "R1",
        expanded: "R1",
        length: 1,
        immediate: false,
        indirect: false,
        mode: "register",
        registerName: "r1",
      },
      {
        raw: "#!imm",
        expanded: "#$12",
        length: 1,
        immediate: true,
        indirect: false,
        mode: "immediate",
      },
    ],
    loweredOperand: {
      raw: "R1,#!imm",
      expanded: "R1,#$12",
      length: 2,
      immediate: false,
      indirect: false,
    },
    words: ["BROKEN"],
    sourceFile: "fixture.asm",
    sourceLine: 2,
    sourceRaw: "IBT R1,#!imm",
  });

  t.true(handled);
  t.true(twoOperandStub.calledOnce);
  t.is(twoOperandStub.firstCall.args[0], "IBT");
  t.is(twoOperandStub.firstCall.args[1], "R1");
  t.is(twoOperandStub.firstCall.args[2], "#$12");
  t.true(expandOperandStub.notCalled);
  t.true(encodeStub.notCalled);
});

test("ArchSuperFX.handleTwoOperandOpcode consumes lowered register/immediate metadata", (t) => {
  const { assembler, arch } = createArchSuperFX();
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    write1Stub.restore();
  });

  const handled = arch.handleTwoOperandOpcode(
    "IBT",
    "LEFT_ALIAS",
    "RIGHT_ALIAS",
    {
      raw: "LEFT_ALIAS",
      expanded: "LEFT_ALIAS",
      length: 2,
      immediate: false,
      indirect: false,
      mode: "register",
      registerName: "r1",
    },
    {
      raw: "RIGHT_ALIAS",
      expanded: "RIGHT_ALIAS",
      length: 1,
      immediate: true,
      indirect: false,
      mode: "immediate",
      baseExpression: "$12",
    },
  );

  t.true(handled);
  t.deepEqual(
    write1Stub.getCalls().map((call) => call.args[0]),
    [0xa1, 0x12],
  );
});

test("ArchSuperFX emits extended and relative branch instructions through narrow contexts", (t) => {
  const { assembler, arch } = createArchSuperFX();

  t.true(arch.encode(["RPIX"]));
  assembler.currentTargetAddress = 0x1000;
  t.true(
    arch.encodeResolvedInstruction("BRA", ["target"], {
      raw: "target",
      expanded: "$1008",
      length: 2,
      immediate: false,
      indirect: false,
    }),
  );

  t.deepEqual(assembler.emitted, [0x3d, 0x4c, 0x05, 0x06]);
});

test("ArchSuperFX reports register ranges and unsupported instructions without a host", (t) => {
  const { arch } = createArchSuperFX();

  t.throws(() => arch.handleOneOperandOpcode("JMP", "R7", 1), {
    message: "Register out of valid range 8-13: 7",
  });
  t.throws(() => arch.encode(["MOVEB", "(R0), R12"]), {
    message: "Register out of valid range 0-11: 12",
  });
  t.throws(() => arch.encode(["MOVEW", "R0, (R12)"]), {
    message: "Register out of valid range 0-11: 12",
  });
  t.throws(() => arch.encode(["NOP", "R1"]), {
    message: "NOP does not take operands",
  });
  t.throws(() => arch.encode(["RPIX", "R0"]), {
    message: "RPIX does not take operands",
  });
  t.false(arch.encode(["UNKNOWN"]));
});

test("ArchSuperFX branches use source spelling for raw offsets and check signed range", (t) => {
  const { assembler, arch } = createArchSuperFX();

  t.true(arch.encode(["BRA", "$05"]));
  assembler.currentTargetAddress = 0x1000;
  t.true(
    arch.encodeResolvedInstruction("BRA", ["near"], {
      raw: "near",
      expanded: "$80",
      length: 1,
      immediate: false,
      indirect: false,
    }),
  );

  t.deepEqual(assembler.emitted, [0x05, 0x05, 0x05, 0x7e]);

  assembler.currentTargetAddress = 0x1000;
  assembler.enforceResolvedLabels = true;
  t.throws(
    () =>
      arch.encodeResolvedInstruction("BRA", ["far"], {
        raw: "far",
        expanded: "$2000",
        length: 2,
        immediate: false,
        indirect: false,
      }),
    { message: "Branch target out of range (4094)" },
  );
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

  t.deepEqual([...mnemonics].sort(), [...expected].sort());
});
