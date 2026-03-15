/* eslint-disable @typescript-eslint/no-explicit-any */
import sinon from "sinon";
import { test } from "./ava-helper.js";

import { ArchSPC700 } from "../src/ArchSPC700.js";
import { Assembler } from "../src/assembler.js";

const createArchSPC700 = () => {
  const assembler = new Assembler();
  const arch = new ArchSPC700(assembler.createSPC700Context());
  return { assembler, arch };
};

test("ArchSPC700.estimateInstruction uses lowered operands", t => {
  const { arch } = createArchSPC700();
  const size = arch.estimateInstruction({
    kind: "instruction",
    mnemonic: "MOV",
    operandText: "$12,#!imm",
    operands: ["$12", "#!imm"],
    loweredOperands: [
      { raw: "$12", expanded: "$12", length: 1, immediate: false, indirect: false },
      { raw: "#!imm", expanded: "#$34", length: 1, immediate: true, indirect: false },
    ],
    loweredOperand: { raw: "$12,#!imm", expanded: "$12,#$34", length: 2, immediate: false, indirect: false },
    words: ["NOP"],
    sourceFile: "fixture.asm",
    sourceLine: 1,
    sourceRaw: "MOV $12,#!imm",
  });
  t.is(size, 3);
});

test("ArchSPC700.encodeInstruction routes one-operand lowered nodes", t => {
  const { assembler, arch } = createArchSPC700();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  const splitStub = sinon.stub(arch, "splitTopLevelComma");
  const oneOperandStub = sinon.stub(arch, "handleOneOperand").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
    splitStub.restore();
    oneOperandStub.restore();
  });

  const handled = arch.encodeInstruction({
    kind: "instruction",
    mnemonic: "BRA",
    operandText: "target",
    operands: ["target"],
    loweredOperands: [{ raw: "target", expanded: "$8000", length: 2, immediate: false, indirect: false }],
    loweredOperand: { raw: "target", expanded: "$8000", length: 2, immediate: false, indirect: false },
    words: ["BROKEN"],
    sourceFile: "fixture.asm",
    sourceLine: 2,
    sourceRaw: "BRA target",
  });

  t.true(handled);
  t.true(oneOperandStub.calledOnce);
  t.is(oneOperandStub.firstCall.args[0], "BRA");
  t.is(oneOperandStub.firstCall.args[1], "$8000");
  t.is(oneOperandStub.firstCall.args[2], null);
  t.is(oneOperandStub.firstCall.args[3], false);
  t.true(expandOperandStub.notCalled);
  t.true(splitStub.notCalled);
});

test("ArchSPC700.encodeInstruction routes two-operand lowered nodes", t => {
  const { assembler, arch } = createArchSPC700();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  const splitStub = sinon.stub(arch, "splitTopLevelComma");
  const twoOperandStub = sinon.stub(arch, "handleTwoOperands").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
    splitStub.restore();
    twoOperandStub.restore();
  });

  const handled = arch.encodeInstruction({
    kind: "instruction",
    mnemonic: "MOV",
    operandText: "$12,#!imm",
    operands: ["$12", "#!imm"],
    loweredOperands: [
      { raw: "$12", expanded: "$12", length: 1, immediate: false, indirect: false },
      { raw: "#!imm", expanded: "#$34", length: 1, immediate: true, indirect: false },
    ],
    loweredOperand: { raw: "$12,#!imm", expanded: "$12,#$34", length: 2, immediate: false, indirect: false },
    words: ["BROKEN"],
    sourceFile: "fixture.asm",
    sourceLine: 3,
    sourceRaw: "MOV $12,#!imm",
  });

  t.true(handled);
  t.true(twoOperandStub.calledOnce);
  t.is(twoOperandStub.firstCall.args[0], "MOV");
  t.is(twoOperandStub.firstCall.args[1], "$12");
  t.is(twoOperandStub.firstCall.args[2], "#$34");
  t.is(twoOperandStub.firstCall.args[3], null);
  t.is(twoOperandStub.firstCall.args[4], false);
  t.true(expandOperandStub.notCalled);
  t.true(splitStub.notCalled);
});

test("ArchSPC700.handleMemoryInstruction consumes lowered indirect register modes", t => {
  const { assembler, arch } = createArchSPC700();
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    write1Stub.restore();
  });

  const handled = arch.handleMemoryInstruction(
    "ADC",
    "LEFT_ALIAS",
    "RIGHT_ALIAS",
    null,
    false,
    { raw: "LEFT_ALIAS", expanded: "LEFT_ALIAS", length: 1, immediate: false, indirect: true, mode: "registerIndirect", registerName: "x" },
    { raw: "RIGHT_ALIAS", expanded: "RIGHT_ALIAS", length: 1, immediate: false, indirect: true, mode: "registerIndirect", registerName: "y" },
  );

  t.true(handled);
  t.true(write1Stub.calledOnceWithExactly(0x99));
});

test("ArchSPC700.handleCallJump consumes lowered indexed-indirect mode", t => {
  const { assembler, arch } = createArchSPC700();
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    write1Stub.restore();
    write2Stub.restore();
  });

  const handled = arch.handleCallJump(
    "JMP",
    "JUMP_ALIAS",
    {
      raw: "JUMP_ALIAS",
      expanded: "JUMP_ALIAS",
      length: 2,
      immediate: false,
      indirect: true,
      mode: "directPageIndexedXIndirect",
      baseExpression: "$1234",
    },
  );

  t.true(handled);
  t.true(write1Stub.calledOnceWithExactly(0x1F));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

