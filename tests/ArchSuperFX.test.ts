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

test("ArchSuperFX.estimateInstruction uses lowered operands", t => {
  const { arch } = createArchSuperFX();
  const size = arch.estimateInstruction({
    kind: "instruction",
    mnemonic: "IBT",
    operandText: "R1,#!imm",
    operands: ["R1", "#!imm"],
    loweredOperands: [
      { raw: "R1", expanded: "R1", length: 1, immediate: false, indirect: false, mode: "register", registerName: "r1" },
      { raw: "#!imm", expanded: "#$12", length: 1, immediate: true, indirect: false, mode: "immediate" },
    ],
    loweredOperand: { raw: "R1,#!imm", expanded: "R1,#$12", length: 2, immediate: false, indirect: false },
    words: ["NOP"],
    sourceFile: "fixture.asm",
    sourceLine: 1,
    sourceRaw: "IBT R1,#!imm",
  });
  t.is(size, 3);
});

test("ArchSuperFX.encodeInstruction routes lowered operands directly", t => {
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
      { raw: "R1", expanded: "R1", length: 1, immediate: false, indirect: false, mode: "register", registerName: "r1" },
      { raw: "#!imm", expanded: "#$12", length: 1, immediate: true, indirect: false, mode: "immediate" },
    ],
    loweredOperand: { raw: "R1,#!imm", expanded: "R1,#$12", length: 2, immediate: false, indirect: false },
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

test("ArchSuperFX.handleTwoOperandOpcode consumes lowered register/immediate metadata", t => {
  const { assembler, arch } = createArchSuperFX();
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    write1Stub.restore();
  });

  const handled = arch.handleTwoOperandOpcode(
    "IBT",
    "LEFT_ALIAS",
    "RIGHT_ALIAS",
    { raw: "LEFT_ALIAS", expanded: "LEFT_ALIAS", length: 2, immediate: false, indirect: false, mode: "register", registerName: "r1" },
    { raw: "RIGHT_ALIAS", expanded: "RIGHT_ALIAS", length: 1, immediate: true, indirect: false, mode: "immediate", baseExpression: "$12" },
  );

  t.true(handled);
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xA1, 0x12]);
});

test("ArchSuperFX emits extended and relative branch instructions through narrow contexts", t => {
  const { assembler, arch } = createArchSuperFX();

  t.true(arch.encode(["RPIX"]));
  assembler.currentTargetAddress = 0x1000;
  t.true(arch.encodeResolvedInstruction(
    "BRA",
    ["target"],
    { raw: "target", expanded: "$1008", length: 2, immediate: false, indirect: false },
  ));

  t.deepEqual(assembler.emitted, [0x3D, 0x4C, 0x05, 0x06]);
});

test("ArchSuperFX reports register ranges and unsupported instructions without a host", t => {
  const { arch } = createArchSuperFX();

  t.throws(() => arch.handleOneOperandOpcode("JMP", "R7", 1), {
    message: "Register out of valid range 8-13: 7",
  });
  t.false(arch.encode(["UNKNOWN"]));
});

