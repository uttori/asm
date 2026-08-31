/* eslint-disable @typescript-eslint/no-explicit-any */
import sinon from "sinon";
import { test } from "../../../tests/ava-helper.js";

import { ArchSPC700 } from "../src/architectures/spc700.js";
import { createEncoderTestHost } from "../../../tests/architecture/test-stubs.js";

const createArchSPC700 = () => {
  const assembler = createEncoderTestHost();
  const arch = new ArchSPC700(assembler.context);
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

test("ArchSPC700.estimateSize matches encoded widths for common forms", t => {
  const { arch } = createArchSPC700();
  t.is(arch.estimateSize([]), 0);
  t.is(arch.estimateSize(["CLRP"]), 1);
  t.is(arch.estimateSize(["MOV", "X,#$cf"]), 2);
  t.is(arch.estimateSize(["MOV", "SP,X"]), 1);
  t.is(arch.estimateSize(["MOV", "X,A"]), 1);
  t.is(arch.estimateSize(["BNE", "CODE_0407"]), 2);
  t.is(arch.estimateSize(["CALL", "CODE_0a96-MAPPING_OFFSET_2"]), 3);
  t.is(arch.estimateSize(["JMP", "CODE_0444-MAPPING_OFFSET_2"]), 3);
  t.is(arch.estimateSize(["MOV", "$0030+Y,A"]), 3);
  t.is(arch.estimateSize(["MOV", "$30+Y,A"]), 2);
  t.is(arch.estimateSize(["INC", "X"]), 1);
  t.is(arch.estimateSize(["SET5", "$48"]), 2);
  t.is(arch.estimateSize(["DBNZ", "Y,CODE_0446"]), 2);
  t.is(arch.estimateSize(["DBNZ", "$0c,CODE_070b"]), 3);
  t.is(arch.estimateSize(["CBNE", "$08+x,CODE_0502"]), 3);
  t.is(arch.estimateSize(["BBS7", "$4c,CODE_0462"]), 3);
  t.is(arch.estimateSize(["BBS", "$12.3,target"]), 3);
  t.is(arch.estimateSize(["NOT2", "C, $0027"]), 3);
  t.is(arch.estimateSize(["MOV2", "$0027, C"]), 3);
  t.is(arch.estimateSize(["MOV", "A,#$00"]), 2);
  t.is(arch.estimateSize(["CMP", "X,#$e0"]), 2);
});

test("ArchSPC700 encodes numbered mem.bit carry ops", t => {
  const { assembler, arch } = createArchSPC700();

  t.true(arch.encode(["NOT1", "$1234"]));
  t.true(arch.encode(["NOT2", "C, $0027"]));
  t.true(arch.encode(["NOT5", "C, $0028"]));
  t.true(arch.encode(["NOT3", "$12"]));
  t.true(arch.encode(["NOT1", "C,$12.3"]));
  t.true(arch.encode(["NOT1", "$12.3"]));
  t.true(arch.encode(["MOV1", "C, $0027"]));
  t.true(arch.encode(["MOV2", "$0027, C"]));
  t.true(arch.encode(["OR1", "C,$1234"]));
  t.true(arch.encode(["OR1", "C,!$1234"]));
  t.true(arch.encode(["AND1", "C,/$1234"]));
  t.true(arch.encode(["AND1", "C, $0027, 2"]));
  t.true(arch.encode(["EOR1", "C,$1234"]));

  t.deepEqual(assembler.emitted, [
    0xea, 0x34, 0x32,
    0xea, 0x27, 0x40,
    0xea, 0x28, 0xa0,
    0xea, 0x12, 0x60,
    0xea, 0x12, 0x60,
    0xea, 0x12, 0x60,
    0xaa, 0x27, 0x20,
    0xca, 0x27, 0x40,
    0x0a, 0x34, 0x32,
    0x2a, 0x34, 0x32,
    0x6a, 0x34, 0x32,
    0x4a, 0x27, 0x40,
    0x8a, 0x34, 0x32,
  ]);
});

test("ArchSPC700 encodes wiki BBS/BBC d.bit forms", t => {
  const { assembler, arch } = createArchSPC700();

  t.true(arch.encode(["BBS", "$12.3, target"]));
  t.true(arch.encode(["BBS3", "$12, target"]));
  t.true(arch.encode(["BBS1", "$12.3, target"]));
  t.true(arch.encode(["BBC", "$12.3, target"]));
  t.false(arch.encode(["BBS", "$12, target"]));

  t.deepEqual(assembler.emitted, [
    0x63, 0x12, 0xff,
    0x63, 0x12, 0xff,
    0x63, 0x12, 0xff,
    0x73, 0x12, 0xff,
  ]);
});

test("ArchSPC700.handleBitSetClear honors dp.bit operands", t => {
  const { assembler, arch } = createArchSPC700();
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    write1Stub.restore();
  });

  t.true(arch.handleBitSetClear("SET1", "$13.7"));
  t.true(arch.handleBitSetClear("SET1", "$13"));
  t.true(arch.handleBitSetClear("SET5", "$48"));
  t.true(arch.handleBitSetClear("CLR1", "$13.7"));

  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [
    0xe2, 0x13, 0x22, 0x13, 0xa2, 0x48, 0xf2, 0x13,
  ]);
});

test("ArchSPC700.encodeInstruction routes one-operand lowered nodes", t => {
  const { assembler, arch } = createArchSPC700();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  const oneOperandStub = sinon.stub(arch, "handleOneOperand").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
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
});

test("ArchSPC700.encodeInstruction routes two-operand lowered nodes", t => {
  const { assembler, arch } = createArchSPC700();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  const twoOperandStub = sinon.stub(arch, "handleTwoOperands").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
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

test("ArchSPC700.handleTwoOperands supports parenthesized direct-page mov pairs", t => {
  const { assembler, arch } = createArchSPC700();
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    write1Stub.restore();
  });

  const handled = arch.handleTwoOperands("MOV", "($D1)", "($D0)", null, false);

  t.true(handled);
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xFA, 0xD0, 0xD1]);
});

test("ArchSPC700.handleTwoOperands supports symbolic indexed mov sources", t => {
  const { assembler, arch } = createArchSPC700();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("spc_0E00_0E02+1").returns(0x0E01);
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
  });

  const handled = arch.handleTwoOperands("MOV", "A", "spc_0E00_0E02+1+x", null, false);

  t.true(handled);
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xF5, 0x01, 0x0E]);
});

test("ArchSPC700.handleMovInstruction keeps zero-padded abs+Y absolute", t => {
  const { assembler, arch } = createArchSPC700();
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    write1Stub.restore();
  });

  t.true(arch.handleMovInstruction("$0030+Y", "A", null, false));
  t.true(arch.handleMovInstruction("$30+Y", "A", null, false));

  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xd6, 0x30, 0x00, 0xd6, 0x30]);
});

test("ArchSPC700.handleMovInstruction keeps zero-padded SPC registers absolute", t => {
  const { assembler, arch } = createArchSPC700();
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleMovInstruction("$00F1", "A", null, false));
  t.true(arch.handleMovInstruction("$F1", "A", null, false));

  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xC5, 0xC4, 0xF1]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x00F1]);
});

test("ArchSPC700.handleMemoryInstruction keeps symbolic SPC operands absolute", t => {
  const { assembler, arch } = createArchSPC700();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("spc_0E00").returns(0x0E00);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  const handled = arch.handleMemoryInstruction(
    "CMP",
    "A",
    "spc_0E00",
    null,
    false,
    { raw: "A", expanded: "A", length: 0, immediate: false, indirect: false, mode: "register", registerName: "A" },
    { raw: "spc_0E00", expanded: "spc_0E00", length: 2, immediate: false, indirect: false, baseExpression: "spc_0E00" },
  );

  t.true(handled);
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x65]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x0E00]);
});

test("ArchSPC700.handleMemoryInstruction keeps symbolic indexed Y operands absolute", t => {
  const { assembler, arch } = createArchSPC700();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("spc_07C2").returns(0x07C2);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  const handled = arch.handleMemoryInstruction(
    "ADC",
    "A",
    "spc_07C2+Y",
    null,
    false,
    { raw: "A", expanded: "A", length: 0, immediate: false, indirect: false, mode: "register", registerName: "A" },
    { raw: "spc_07C2+Y", expanded: "spc_07C2+Y", length: 2, immediate: false, indirect: false, baseExpression: "spc_07C2", mode: "absoluteIndexedY", indexRegister: "y" },
  );

  t.true(handled);
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x96]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x07C2]);
});

test("ArchSPC700.handleBranch resolves multi-depth forward relative labels", t => {
  const { assembler, arch } = createArchSPC700();
  assembler.activateStage("emitProgram");
  assembler.currentTargetAddress = 0x1200;
  const findNextLabelStub = sinon.stub(assembler.symbolScope, "findNextLabel").returns(0x1208);
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  const write1Values: number[] = [];
  const write1Stub = sinon.stub(assembler, "write1").callsFake((value: number) => {
    write1Values.push(value);
    assembler.currentTargetAddress += 1;
  });
  t.teardown(() => {
    findNextLabelStub.restore();
    getnumStub.restore();
    write1Stub.restore();
  });

  const handled = arch.handleBranch("BRA", "++");

  t.true(handled);
  t.true(findNextLabelStub.calledOnce);
  t.deepEqual(findNextLabelStub.firstCall.args, ["++", 0x1202]);
  t.true(getnumStub.notCalled);
  t.deepEqual(write1Values, [0x2F, 0x06]);
});

test("ArchSPC700.handleTwoOperands supports parenthesized direct-page OR pairs", t => {
  const { assembler, arch } = createArchSPC700();
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    write1Stub.restore();
  });

  const handled = arch.handleTwoOperands("OR", "($CE)", "($CD)", null, false);

  t.true(handled);
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x09, 0xCD, 0xCE]);
});

test("ArchSPC700 emits unresolved branch placeholders through narrow contexts", t => {
  const { assembler, arch } = createArchSPC700();
  assembler.currentTargetAddress = 0x1200;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("target").returns(0x1208);
  t.teardown(() => getnumStub.restore());

  t.true(arch.handleBranch("BRA", "target"));
  t.true(arch.handleTwoOperandsBitBranch("BBS0", "$12", "target"));

  t.deepEqual(assembler.emitted, [0x2F, 0xFF, 0x03, 0x12, 0xFF]);
});

test("ArchSPC700 validates resolved DBNZ branch ranges without a host", t => {
  const { assembler, arch } = createArchSPC700();
  assembler.activateStage("emitProgram");
  assembler.currentTargetAddress = 0x1200;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("target").returns(0x1300);
  t.teardown(() => getnumStub.restore());

  t.throws(() => arch.handleDbnzCbne("DBNZ", "Y", "target"), {
    message: "Branch target out of range (254)",
  });
});

test("ArchSPC700 skips DBNZ range checks before emit", t => {
  const { assembler, arch } = createArchSPC700();
  assembler.currentTargetAddress = 0x1200;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("target").returns(0x1300);
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
  });

  t.true(arch.handleDbnzCbne("DBNZ", "Y", "target"));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xfe, 0xfe]);
});

