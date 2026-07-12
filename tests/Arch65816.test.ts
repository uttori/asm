/* eslint-disable import/no-named-as-default-member */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import sinon from "sinon";
import { test } from "./ava-helper.js";

import { Arch65816 } from "../src/Arch65816.js";
import { Assembler } from "../src/assembler.js";

const createArch65816 = () => {
  const assembler = new Assembler();
  const arch = new Arch65816(assembler);
  return { assembler, arch };
};

test("Arch65816.getlenfromchar resolves supported suffixes", t => {
  const { arch } = createArch65816();
  // const warnStub = sinon.stub(console, "warn");
  // t.teardown(() => warnStub.restore());

  t.is(arch.getlenfromchar("b"), 1, "Should resolve byte suffixes");
  t.is(arch.getlenfromchar("W"), 2, "Should resolve word suffixes case-insensitively");
  t.is(arch.getlenfromchar("l"), 3, "Should resolve long suffixes");
  t.is(arch.getlenfromchar("d"), 4, "Should resolve deprecated double-word suffixes");
  // t.true(warnStub.calledOnceWithExactly("Warning: .d opcode suffix is deprecated."));
});

test("Arch65816.getlenfromchar throws for invalid suffixes", t => {
  const { arch } = createArch65816();

  t.throws(() => {
    arch.getlenfromchar("x");
  }, { message: "Error: Invalid opcode length." });
});

test("Arch65816.estimateSize uses architecture-aware sizing", t => {
  const { assembler, arch } = createArch65816();

  t.is(arch.estimateSize(["BRA", "$8005"]), 2, "Short branches reserve 2 bytes");
  t.is(arch.estimateSize(["BRL", "$8100"]), 3, "Long branches reserve 3 bytes");
  t.is(arch.estimateSize(["JSL", "$808000"]), 4, "Long jumps reserve 4 bytes");
  t.is(arch.estimateSize(["LDA", "#$1000"]), 3, "Immediate word operands reserve 3 bytes");
  t.is(arch.estimateSize(["ASL", "#3"]), 3, "Accumulator repeat pseudo-ops reserve one byte per repeat");
  t.is(arch.estimateSize(["INC"]), 1, "Bare accumulator INC should reserve one byte");
  t.is(arch.estimateSize(["DEC"]), 1, "Bare accumulator DEC should reserve one byte");
  assembler.currentTargetAddress = 0x048AFD;
  t.is(arch.estimateSize(["SBC", "_048AD3,X"]), 3, "Same-bank indexed labels should reserve absolute,X bytes");
});

test("Arch65816.estimateInstruction consumes lowered operand metadata", t => {
  const { arch } = createArch65816();
  const size = arch.estimateInstruction({
    kind: "instruction",
    mnemonic: "LDA",
    operandText: "#!IMM",
    operands: ["#!IMM"],
    loweredOperands: [{
      raw: "#!IMM",
      expanded: "#$12",
      length: 1,
      immediate: true,
      indirect: false,
    }],
    loweredOperand: {
      raw: "#!IMM",
      expanded: "#$12",
      length: 1,
      immediate: true,
      indirect: false,
    },
    words: ["LDA", "#!IMM"],
    sourceFile: "fixture.asm",
    sourceLine: 1,
    sourceRaw: "LDA #!IMM",
  });
  t.is(size, 2);
});

test("Arch65816.encodeInstruction routes lowered operands without re-expansion", t => {
  const { assembler, arch } = createArch65816();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  const memoryStub = sinon.stub(arch, "handleMemoryOperations").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
    memoryStub.restore();
  });

  const encoded = arch.encodeInstruction({
    kind: "instruction",
    mnemonic: "LDA",
    operandText: "#!IMM",
    operands: ["#!IMM"],
    loweredOperands: [{
      raw: "#!IMM",
      expanded: "#$12",
      length: 1,
      immediate: true,
      indirect: false,
    }],
    loweredOperand: {
      raw: "#!IMM",
      expanded: "#$12",
      length: 1,
      immediate: true,
      indirect: false,
    },
    words: ["LDA", "#!IMM"],
    sourceFile: "fixture.asm",
    sourceLine: 1,
    sourceRaw: "LDA #!IMM",
  });

  t.true(encoded);
  t.true(memoryStub.calledOnceWithExactly("LDA", "#$12", 1, false, "#!IMM"));
  t.true(expandOperandStub.notCalled);
});

test("Arch65816.handleMemoryBitInstructions encodes direct TSB", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleMemoryBitInstructions("TSB", "$12"));
  t.true(getnumStub.calledOnceWithExactly("$12"));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x04, 0x12]);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleMemoryBitInstructions encodes absolute TRB", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleMemoryBitInstructions("TRB", "$1234"));
  t.true(getnumStub.calledOnceWithExactly("$1234"));
  t.true(write1Stub.calledOnceWithExactly(0x1C));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleMemoryBitInstructions returns false for unsupported opcodes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.false(arch.handleMemoryBitInstructions("BIT", "$12"));
  t.true(getnumStub.notCalled);
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleArithmeticOperations accepts implied accumulator form", t => {
  const { assembler, arch } = createArch65816();
  const write1Stub = sinon.stub(assembler, "write1");
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  t.teardown(() => {
    write1Stub.restore();
    getnumStub.restore();
  });

  t.true(arch.handleArithmeticOperations("DEC", "", 0, false));
  t.true(write1Stub.calledOnceWithExactly(0x3A));
  t.true(getnumStub.notCalled);
});

test("Arch65816.handleBranchInstructions returns false for unsupported opcodes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.false(arch.handleBranchInstructions("NOP", "$8000"));
  t.true(getnumStub.notCalled);
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleBranchInstructions writes short-branch placeholders during pass 0", t => {
  const { assembler, arch } = createArch65816();
  assembler.activateStage("collectDefinitions");
  assembler.currentTargetAddress = 0x8000;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$8005").returns(0x8005);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleBranchInstructions("BRA", "$8005"));
  t.true(getnumStub.calledOnceWithExactly("$8005"));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x80, 0]);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleBranchInstructions writes BRL placeholders during pass 1", t => {
  const { assembler, arch } = createArch65816();
  assembler.activateStage("resolveLayout");
  assembler.currentTargetAddress = 0x8000;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$8100").returns(0x8100);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleBranchInstructions("BRL", "$8100"));
  t.true(getnumStub.calledOnceWithExactly("$8100"));
  t.true(write1Stub.calledOnceWithExactly(0x82));
  t.true(write2Stub.calledOnceWithExactly(0));
});

test("Arch65816.handleBranchInstructions resolves forward + labels using the branch reference address", t => {
  const { assembler, arch } = createArch65816();
  assembler.activateStage("emitProgram");
  assembler.currentTargetAddress = 0x8000;
  const findNextLabelStub = sinon.stub(assembler.symbolScope, "findNextLabel");
  findNextLabelStub.withArgs("++", 0x8002).returns(0x8007);
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    findNextLabelStub.restore();
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleBranchInstructions("BRA", "++"));
  t.true(findNextLabelStub.calledOnceWithExactly("++", 0x8002));
  t.true(getnumStub.notCalled);
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x80, 0x05]);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleBranchInstructions resolves backward - labels for negative offsets", t => {
  const { assembler, arch } = createArch65816();
  assembler.activateStage("emitProgram");
  assembler.currentTargetAddress = 0x8000;
  const findPreviousLabelStub = sinon.stub(assembler.symbolScope, "findPreviousLabel");
  findPreviousLabelStub.withArgs("--", 0x8002).returns(0x7FFD);
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    findPreviousLabelStub.restore();
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleBranchInstructions("BNE", "--"));
  t.true(findPreviousLabelStub.calledOnceWithExactly("--", 0x8002));
  t.true(getnumStub.notCalled);
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xD0, 0x1FB]);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleBranchInstructions uses numeric operands for BRL", t => {
  const { assembler, arch } = createArch65816();
  assembler.activateStage("emitProgram");
  assembler.currentTargetAddress = 0x8000;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$8013").returns(0x8013);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleBranchInstructions("BRL", "$8013"));
  t.true(getnumStub.calledOnceWithExactly("$8013"));
  t.true(write1Stub.calledOnceWithExactly(0x82));
  t.true(write2Stub.calledOnceWithExactly(0x10));
});

test("Arch65816.handleBranchInstructions throws when the relative target is NaN", t => {
  const { assembler, arch } = createArch65816();
  assembler.activateStage("emitProgram");
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("bad_label").returns(Number.NaN);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.throws(() => {
    arch.handleBranchInstructions("BRA", "bad_label");
  }, { message: "Error: relativeAddress is NaN." });
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleBranchInstructions throws when short branches are out of range", t => {
  const { assembler, arch } = createArch65816();
  assembler.activateStage("emitProgram");
  assembler.currentTargetAddress = 0x8000;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$8082").returns(0x8082);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.throws(() => {
    arch.handleBranchInstructions("BCC", "$8082");
  }, { message: "Error: Branch target out of range (128)." });
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleBranchInstructions throws when BRL targets are out of range", t => {
  const { assembler, arch } = createArch65816();
  assembler.activateStage("emitProgram");
  assembler.currentTargetAddress = 0x8000;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$10003").returns(0x10003);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.throws(() => {
    arch.handleBranchInstructions("BRL", "$10003");
  }, { message: "Error: BRL target out of range (32768)." });
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handlePER encodes a resolved operand", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("target_label").returns(0x3456);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handlePER("target_label"));
  t.true(getnumStub.calledOnceWithExactly("target_label"));
  t.true(write1Stub.calledOnceWithExactly(0x62));
  t.true(write2Stub.calledOnceWithExactly(0x3456));
});

test("Arch65816.handlePER throws when no operand is provided", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.throws(() => {
    arch.handlePER("");
  }, { message: "Error: PER requires an operand." });
  t.true(getnumStub.notCalled);
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleBlockMove encodes MVP with trimmed banks", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$01").returns(0x01);
  getnumStub.withArgs("$02").returns(0x02);
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
  });

  t.true(arch.handleBlockMove("MVP", " $01 , $02 "));
  t.deepEqual(getnumStub.getCalls().map((call) => call.args[0]), ["$01", "$02"]);
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x44, 0x01, 0x02]);
});

test("Arch65816.handleBlockMove encodes MVN", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$7E").returns(0x7E);
  getnumStub.withArgs("$40").returns(0x40);
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
  });

  t.true(arch.handleBlockMove("MVN", "$7E,$40"));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x54, 0x7E, 0x40]);
});

test("Arch65816.handleBlockMove throws when operand count is invalid", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
  });

  t.throws(() => {
    arch.handleBlockMove("MVN", "$01");
  }, { message: "Error: MVN requires two parameters (source, destination)." });
  t.true(getnumStub.notCalled);
  t.true(write1Stub.notCalled);
});

test("Arch65816.handleGenericOpcode encodes PEA with a 16-bit operand", t => {
  const { assembler, arch } = createArch65816();
  // const warnStub = sinon.stub(console, "warn");
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    // warnStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleGenericOpcode("PEA", 0x1234, 2, false, false));
  // t.true(warnStub.calledOnceWithExactly("arch65816 handleGenericOpcode: PEA assuming 8-bit mode."));
  t.true(write1Stub.calledOnceWithExactly(0xF4));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleGenericOpcode encodes fixed-width single-byte operand opcodes", t => {
  const { assembler, arch } = createArch65816();
  const warnStub = sinon.stub(console, "warn");
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    warnStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleGenericOpcode("WDM", 0xAB, 1, true, true));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x42, 0xAB]);
  t.true(write2Stub.notCalled);
  t.true(warnStub.notCalled);
});

test("Arch65816.handleGenericOpcode validates REP and SEP operand range", t => {
  const { assembler, arch } = createArch65816();
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    write1Stub.restore();
    write2Stub.restore();
  });

  t.throws(() => {
    arch.handleGenericOpcode("REP", 0x100, 1, true, true);
  }, { message: "Error: invalid_number" });

  t.throws(() => {
    arch.handleGenericOpcode("SEP", 0x12, 2, true, true);
  }, { message: "Error: invalid_number" });

  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleGenericOpcode returns false for unmapped opcodes", t => {
  const { assembler, arch } = createArch65816();
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    write1Stub.restore();
    write2Stub.restore();
  });

  t.false(arch.handleGenericOpcode("LDA", 0x12, 1, false, false));
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleJump encodes numeric JMP operands as absolute addresses", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("255").returns(0x00FF);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JMP", "255"));
  t.true(getnumStub.calledOnceWithExactly("255"));
  t.true(write1Stub.calledOnceWithExactly(0x4C));
  t.true(write2Stub.calledOnceWithExactly(0x00FF));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleJump normalizes short hex JSR operands", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$FF").returns(0x00FF);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JSR", "$FF"));
  t.true(getnumStub.calledOnceWithExactly("$FF"));
  t.true(write1Stub.calledOnceWithExactly(0x20));
  t.true(write2Stub.calledOnceWithExactly(0x00FF));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleJump upgrades long JMP operands to JML", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$123456").returns(0x123456);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JMP", "$123456"));
  t.true(write1Stub.calledOnceWithExactly(0x5C));
  t.true(write3Stub.calledOnceWithExactly(0x123456));
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleJump upgrades long JSR operands and preserves JML mode", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$123456").returns(0x123456);
  getnumStub.withArgs("$654321").returns(0x654321);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JSR", "$123456"));
  t.true(arch.handleJump("JML", "$654321"));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x22, 0x5C]);
  t.deepEqual(write3Stub.getCalls().map((call) => call.args[0]), [0x123456, 0x654321]);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleJump keeps banked same-bank JSR operands short", t => {
  const { assembler, arch } = createArch65816();
  assembler.activateStage("resolveLayout");
  assembler.currentTargetAddress = 0x02FFFE;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("_02FDB3_FDB7").returns(0x02FDB6);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JSR", "_02FDB3_FDB7"));
  t.true(write1Stub.calledOnceWithExactly(0x20));
  t.true(write2Stub.calledOnceWithExactly(0xFDB6));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleJump keeps bank-hinted same-bank JSR operands short during early-pass drift", t => {
  const { assembler, arch } = createArch65816();
  assembler.activateStage("resolveLayout");
  assembler.currentTargetAddress = 0x0295E8;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("_02FF22").returns(0x030022);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JSR", "_02FF22"));
  t.true(write1Stub.calledOnceWithExactly(0x20));
  t.true(write2Stub.calledOnceWithExactly(0x0022));
  t.true(write3Stub.notCalled);
});

test("Arch65816.encodeResolvedInstruction keeps raw bank hints for same-bank JSR sizing", t => {
  const { assembler, arch } = createArch65816();
  assembler.activateStage("resolveLayout");
  assembler.currentTargetAddress = 0x0295E8;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("_02FF22").returns(0x030022);
  getnumStub.withArgs("$30022").returns(0x030022);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.encodeResolvedInstruction("JSR", "_02FF22", "$30022", 3));
  t.true(write1Stub.calledOnceWithExactly(0x20));
  t.true(write2Stub.calledOnceWithExactly(0x0022));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleJump resolves symbolic JSL operands", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.returns(0x018053);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JSL", "_018049_8053"));
  t.true(getnumStub.calledOnce);
  t.true(write1Stub.calledOnceWithExactly(0x22));
  t.true(write3Stub.calledOnceWithExactly(0x018053));
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleJump encodes indirect long and indexed indirect modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$5678").returns(0x5678);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JMP", "[$1234]"));
  t.true(arch.handleJump("JSR", "($5678,x)"));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xDC, 0xFC]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234, 0x5678]);
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleJump accepts indexed indirect expressions", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs(".8741-2").returns(0x8741);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JSR", "(.8741-2,X)"));
  t.true(write1Stub.calledOnceWithExactly(0xFC));
  t.true(write2Stub.calledOnceWithExactly(0x8741));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleJump masks banked labels for indexed indirect JSR", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs(".offsets").returns(0x01A64D);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JSR", "(.offsets,X)"));
  t.true(write1Stub.calledOnceWithExactly(0xFC));
  t.true(write2Stub.calledOnceWithExactly(0xA64D));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleJump encodes JMP indexed indirect", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JMP", "($1234,x)"));
  t.true(write1Stub.calledOnceWithExactly(0x7C));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleJump encodes absolute indirect JMP", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleJump("JMP", "($1234)"));
  t.true(write1Stub.calledOnceWithExactly(0x6C));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleJump throws on invalid operands", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.throws(new Error("Label not found"));
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.throws(() => {
    arch.handleJump("JMP", "label_name");
  }, { message: "Error: Invalid operand format for JMP: label_name" });
  t.true(getnumStub.calledOnce);
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleStoreOperations returns false for unsupported opcodes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.false(arch.handleStoreOperations("STA", "$12", 1, false));
  t.true(getnumStub.notCalled);
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleStoreOperations encodes explicit indexed STZ word operands", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleStoreOperations("STZ", "$1234,x", 2, true));
  t.true(write1Stub.calledOnceWithExactly(0x9E));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleStoreOperations encodes explicit indexed STX and STY fallback opcodes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$34").returns(0x34);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleStoreOperations("STX", "$12,y", 1, true));
  t.true(arch.handleStoreOperations("STY", "$34,x", 1, true));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x86, 0x12, 0x84, 0x34]);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleStoreOperations encodes forced non-indexed STY and STZ", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$12").returns(0x12);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleStoreOperations("STY", "$1234", 2, true));
  t.true(arch.handleStoreOperations("STZ", "$12", 1, true));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x8C, 0x64, 0x12]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234]);
});

test("Arch65816.handleStoreOperations encodes direct and indexed store modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$34").returns(0x34);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleStoreOperations("STX", "$12", 1, false));
  t.true(arch.handleStoreOperations("STY", "$34,x", 1, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x86, 0x12, 0x94, 0x34]);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleStoreOperations encodes absolute indexed STZ", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleStoreOperations("STZ", "$1234,x", 2, false));
  t.true(write1Stub.calledOnceWithExactly(0x9E));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleStoreOperations encodes absolute indexed STX and STY", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$5678").returns(0x5678);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleStoreOperations("STX", "$1234,y", 2, false));
  t.true(arch.handleStoreOperations("STY", "$5678,x", 2, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x8E, 0x8C]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234, 0x5678]);
});

test("Arch65816.handleStoreOperations encodes non-indexed absolute and directY STX", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$9ABC").returns(0x9ABC);
  getnumStub.withArgs("$12").returns(0x12);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleStoreOperations("STY", "$9ABC", 2, false));
  t.true(arch.handleStoreOperations("STX", "$12,y", 1, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x8C, 0x96, 0x12]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x9ABC]);
});

test("Arch65816.handleStoreOperations encodes indexed direct-page STZ fallback", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleStoreOperations("STZ", "$12,x", 1, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x74, 0x12]);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleStoreOperations throws on unsupported forced lengths and invalid operands", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.throws(() => {
    arch.handleStoreOperations("STX", "$12", 3, true);
  }, { message: "Forced length 3 not supported for STX" });

  t.throws(() => {
    arch.handleStoreOperations("STZ", "not-an-address", 1, false);
  }, { message: "Error: Invalid operand format for STZ: not-an-address" });
});

test("Arch65816.handleBitTestOperations returns false for unsupported opcodes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.false(arch.handleBitTestOperations("LDA", "$12", 1, false));
  t.true(getnumStub.notCalled);
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleBitTestOperations encodes BIT immediate in default and forced modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$0000").returns(0x0000);
  getnumStub.withArgs("$12").returns(0x12);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleBitTestOperations("BIT", "#$0000", 2, false));
  t.true(arch.handleBitTestOperations("BIT", "#$12", 1, true));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x89, 0x89, 0x12]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x0000]);
});

test("Arch65816.handleBitTestOperations encodes indexed and absolute modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleBitTestOperations("BIT", "$12,x", 1, true));
  t.true(arch.handleBitTestOperations("BIT", "$1234,x", 2, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x34, 0x12, 0x3C]);
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleBitTestOperations encodes forced non-indexed and default non-forced branches", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$34").returns(0x34);
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleBitTestOperations("TRB", "$1234", 2, true));
  t.true(arch.handleBitTestOperations("BIT", "$12,x", 1, false));
  t.true(arch.handleBitTestOperations("TSB", "$34", 1, false));
  t.true(arch.handleBitTestOperations("TRB", "$1234", 2, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x1C, 0x34, 0x12, 0x04, 0x34, 0x1C]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234, 0x1234]);
});

test("Arch65816.handleBitTestOperations encodes TSB direct mode and rejects forced indexed mode", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleBitTestOperations("TSB", "$12", 1, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x04, 0x12]);
  t.true(write2Stub.notCalled);

  t.throws(() => {
    arch.handleBitTestOperations("TSB", "$12,x", 1, true);
  }, { message: "Opcode TSB does not support indexed addressing in forced mode." });
});

test("Arch65816.handleBitTestOperations throws on invalid operands", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.throws(() => {
    arch.handleBitTestOperations("BIT", "not-an-address", 1, false);
  }, { message: "Error: Invalid operand format for BIT: not-an-address" });
});

test("Arch65816.handleLoadRegister handles immediate and indexed modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLoadRegister("LDX", "#$12", 1, false));
  t.true(arch.handleLoadRegister("LDY", "$1234,x", 2, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xA2, 0x12, 0xBC]);
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleLoadRegister handles LDY immediate word operands", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLoadRegister("LDY", "#$1234", 2, false));
  t.true(write1Stub.calledOnceWithExactly(0xA0));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleLoadRegister handles LDY fallback direct and absolute forms", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$12").returns(0x12);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLoadRegister("LDY", "$1234", 2, false));
  t.true(arch.handleLoadRegister("LDY", "$12,x", 1, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xAC, 0xB4, 0x12]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234]);
});

test("Arch65816.handleLoadRegister supports forced addressing and errors", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLoadRegister("LDX", "$12,y", 1, true));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xB6, 0x12]);
  t.true(write2Stub.notCalled);

  t.throws(() => {
    arch.handleLoadRegister("LDX", "", 1, false);
  }, { message: "Error: LDX requires an operand." });

  t.throws(() => {
    arch.handleLoadRegister("LDY", "$12", 3, true);
  }, { message: "Forced length 3 not supported for LDY" });
});

test("Arch65816.handleLoadRegister covers forced LDX and forced indexed LDY word forms", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$5678").returns(0x5678);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLoadRegister("LDX", "$1234", 2, true));
  t.true(arch.handleLoadRegister("LDY", "$5678,x", 2, true));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xAE, 0xBC]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234, 0x5678]);
});

test("Arch65816.handleLoadRegister covers LDX fallback direct, absolute, and indexed-Y modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$5678").returns(0x5678);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLoadRegister("LDX", "$12", 1, false));
  t.true(arch.handleLoadRegister("LDX", "$1234", 2, false));
  t.true(arch.handleLoadRegister("LDX", "$5678,y", 2, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xA6, 0x12, 0xAE, 0xBE]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234, 0x5678]);
});

test("Arch65816.handleLoadRegister covers LDX indexed direct-page and LDY direct-page fallback", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$34").returns(0x34);
  getnumStub.withArgs("$56").returns(0x56);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLoadRegister("LDX", "$34,y", 1, false));
  t.true(arch.handleLoadRegister("LDY", "$56", 1, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xB6, 0x34, 0xA4, 0x56]);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleArithmeticOperations handles accumulator and addressing variants", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("3").returns(3);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleArithmeticOperations("ASL", "A", 1, false));
  t.true(arch.handleArithmeticOperations("ASL", "#3", 1, false));
  t.true(arch.handleArithmeticOperations("INC", "$12,x", 1, false));
  t.true(arch.handleArithmeticOperations("DEC", "$1234", 2, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x0A, 0x0A, 0x0A, 0x0A, 0xF6, 0x12, 0xCE]);
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleArithmeticOperations supports forced modes and rejects invalid inputs", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$12").returns(0x12);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleArithmeticOperations("ROL", "$1234,x", 2, true));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x3E]);
  t.true(write2Stub.calledOnceWithExactly(0x1234));

  t.true(arch.handleArithmeticOperations("ASL", "", 1, false));
  t.true(write1Stub.calledWithExactly(0x0A));

  t.throws(() => {
    arch.handleArithmeticOperations("INC", "$12", 3, true);
  }, { message: "Forced length for arithmetic operations must be 1 or 2 bytes." });
});

test("Arch65816.handleArithmeticOperations covers successful forced byte and word encodings", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$56").returns(0x56);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleArithmeticOperations("ASL", "$12,x", 1, true));
  t.true(arch.handleArithmeticOperations("DEC", "$1234", 2, true));
  t.true(arch.handleArithmeticOperations("INC", "$56", 1, true));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x16, 0x12, 0xCE, 0xE6, 0x56]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234]);
});

test("Arch65816.handleArithmeticOperations returns false for unsupported opcodes with operands", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.false(arch.handleArithmeticOperations("NOP", "$12", 1, false));
  t.true(getnumStub.notCalled);
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
});

test("Arch65816.handleArithmeticOperations throws for unsupported forced opcode branches", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.throws(() => {
    arch.handleArithmeticOperations("NOP", "$12,x", 1, true);
  }, { message: "Opcode NOP not supported in forced indexed mode." });

  t.throws(() => {
    arch.handleArithmeticOperations("DEC", "$12,x", 3, true);
  }, { message: "Forced length for arithmetic operations must be 1 or 2 bytes." });

  t.throws(() => {
    arch.handleArithmeticOperations("NOP", "$12", 1, true);
  }, { message: "Opcode NOP not supported in forced non-indexed mode." });
});

test("Arch65816.handleArithmeticOperations covers absolute-X and direct-page fallback modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$78").returns(0x78);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleArithmeticOperations("ROR", "$1234,x", 2, false));
  t.true(arch.handleArithmeticOperations("LSR", "$78", 1, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x7E, 0x46, 0x78]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234]);
});

test("Arch65816.handleLogicAndCompareOperations handles immediate and routed modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$0000").returns(0x0000);
  getnumStub.withArgs("$34").returns(0x34);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleLogicAndCompareOperations("ORA", "#$12", 1, false));
  t.true(arch.handleLogicAndCompareOperations("CMP", "#$0000", 2, false));
  t.true(arch.handleLogicAndCompareOperations("AND", "[$34]", 1, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x09, 0x12, 0xC9, 0x27, 0x34]);
  t.true(write2Stub.calledOnceWithExactly(0x0000));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleLogicAndCompareOperations consumes lowered addressing metadata", t => {
  const { assembler, arch } = createArch65816();
  const lowerOperandStub = sinon.stub(assembler.operandResolver, "lowerOperand");
  lowerOperandStub.withArgs("TARGET,x").returns({
    raw: "TARGET,x",
    expanded: "TARGET,x",
    length: 2,
    indexRegister: "x",
    immediate: false,
    indirect: false,
    mode: "absoluteIndexedX",
    baseExpression: "TARGET",
    explicitDirectPage: false,
    explicitDirectPageIndexedX: false,
  });
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("TARGET").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    lowerOperandStub.restore();
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLogicAndCompareOperations("ORA", "TARGET,x", 2, false));
  t.true(lowerOperandStub.calledOnceWithExactly("TARGET,x"));
  t.true(write1Stub.calledOnceWithExactly(0x1D));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleLogicAndCompareOperations preserves forced indexed Y bases", t => {
  const { assembler, arch } = createArch65816();
  const lowerOperandStub = sinon.stub(assembler.operandResolver, "lowerOperand");
  lowerOperandStub.withArgs("TARGET,y").returns({
    raw: "TARGET,y",
    expanded: "$13EF,Y",
    length: 2,
    indexRegister: "y",
    immediate: false,
    indirect: false,
    mode: "absoluteIndexedY",
    baseExpression: "TARGET",
    explicitDirectPage: false,
    explicitDirectPageIndexedX: false,
  });
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("TARGET").returns(0x13EF);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    lowerOperandStub.restore();
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLogicAndCompareOperations("ORA", "TARGET,y", 2, true));
  t.true(lowerOperandStub.calledOnceWithExactly("TARGET,y"));
  t.true(getnumStub.calledOnceWithExactly("TARGET"));
  t.true(write1Stub.calledOnceWithExactly(0x19));
  t.true(write2Stub.calledOnceWithExactly(0x13EF));
});

test("Arch65816.handleArithmeticOperations consumes lowered addressing metadata", t => {
  const { assembler, arch } = createArch65816();
  const lowerOperandStub = sinon.stub(assembler.operandResolver, "lowerOperand");
  lowerOperandStub.withArgs("TARGET,x").returns({
    raw: "TARGET,x",
    expanded: "TARGET,x",
    length: 2,
    indexRegister: "x",
    immediate: false,
    indirect: false,
    mode: "absoluteIndexedX",
    baseExpression: "TARGET",
    explicitDirectPage: false,
    explicitDirectPageIndexedX: false,
  });
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("TARGET").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    lowerOperandStub.restore();
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleArithmeticOperations("ASL", "TARGET,x", 2, false));
  t.true(lowerOperandStub.calledOnceWithExactly("TARGET,x"));
  t.true(write1Stub.calledOnceWithExactly(0x1E));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleLoadRegister consumes lowered addressing metadata", t => {
  const { assembler, arch } = createArch65816();
  const lowerOperandStub = sinon.stub(assembler.operandResolver, "lowerOperand");
  lowerOperandStub.withArgs("$1234,y").returns({
    raw: "$1234,y",
    expanded: "$1234,y",
    length: 2,
    indexRegister: "y",
    immediate: false,
    indirect: false,
    mode: "absoluteIndexedY",
    baseExpression: "$1234",
    explicitDirectPage: false,
    explicitDirectPageIndexedX: false,
  });
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    lowerOperandStub.restore();
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLoadRegister("LDX", "$1234,y", 2, false));
  t.true(lowerOperandStub.calledOnceWithExactly("$1234,y"));
  t.true(write1Stub.calledOnceWithExactly(0xBE));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleLoadRegister keeps symbolic indexed operands absolute", t => {
  const { assembler, arch } = createArch65816();
  const lowerOperandStub = sinon.stub(assembler.operandResolver, "lowerOperand");
  lowerOperandStub.withArgs("TARGET,y").returns({
    raw: "TARGET,y",
    expanded: "TARGET,y",
    length: 2,
    indexRegister: "y",
    immediate: false,
    indirect: false,
    mode: "absoluteIndexedY",
    baseExpression: "TARGET",
    explicitDirectPage: false,
    explicitDirectPageIndexedX: false,
  });
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("TARGET").returns(0x8200);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    lowerOperandStub.restore();
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLoadRegister("LDX", "TARGET,y", 2, false));
  t.true(lowerOperandStub.calledOnceWithExactly("TARGET,y"));
  t.true(write1Stub.calledOnceWithExactly(0xBE));
  t.true(write2Stub.calledOnceWithExactly(0x8200));
});

test("Arch65816.handleLoadRegister keeps symbolic LDY indexed operands absolute", t => {
  const { assembler, arch } = createArch65816();
  const lowerOperandStub = sinon.stub(assembler.operandResolver, "lowerOperand");
  lowerOperandStub.withArgs("TARGET,x").returns({
    raw: "TARGET,x",
    expanded: "TARGET,x",
    length: 1,
    indexRegister: "x",
    immediate: false,
    indirect: false,
    mode: "directPageIndexedX",
    baseExpression: "TARGET",
    explicitDirectPage: false,
    explicitDirectPageIndexedX: false,
  });
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("TARGET").returns(0x8219);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    lowerOperandStub.restore();
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleLoadRegister("LDY", "TARGET,x", 1, false));
  t.true(lowerOperandStub.calledOnceWithExactly("TARGET,x"));
  t.true(write1Stub.calledOnceWithExactly(0xBC));
  t.true(write2Stub.calledOnceWithExactly(0x8219));
});

test("Arch65816.handleStoreOperations consumes lowered addressing metadata", t => {
  const { assembler, arch } = createArch65816();
  const lowerOperandStub = sinon.stub(assembler.operandResolver, "lowerOperand");
  lowerOperandStub.withArgs("$1234,x").returns({
    raw: "$1234,x",
    expanded: "$1234,x",
    length: 2,
    indexRegister: "x",
    immediate: false,
    indirect: false,
    mode: "absoluteIndexedX",
    baseExpression: "$1234",
    explicitDirectPage: false,
    explicitDirectPageIndexedX: false,
  });
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    lowerOperandStub.restore();
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleStoreOperations("STZ", "$1234,x", 2, false));
  t.true(lowerOperandStub.calledOnceWithExactly("$1234,x"));
  t.true(write1Stub.calledOnceWithExactly(0x9E));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleBitTestOperations consumes lowered addressing metadata", t => {
  const { assembler, arch } = createArch65816();
  const lowerOperandStub = sinon.stub(assembler.operandResolver, "lowerOperand");
  lowerOperandStub.withArgs("$1234,x").returns({
    raw: "$1234,x",
    expanded: "$1234,x",
    length: 2,
    indexRegister: "x",
    immediate: false,
    indirect: false,
    mode: "absoluteIndexedX",
    baseExpression: "$1234",
    explicitDirectPage: false,
    explicitDirectPageIndexedX: false,
  });
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    lowerOperandStub.restore();
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleBitTestOperations("BIT", "$1234,x", 2, false));
  t.true(lowerOperandStub.calledOnceWithExactly("$1234,x"));
  t.true(write1Stub.calledOnceWithExactly(0x3C));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleLogicAndCompareOperations supports forced sizes and invalid formats", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$123456").returns(0x123456);
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleLogicAndCompareOperations("CMP", "$123456,x", 3, true));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xDF]);
  t.true(write3Stub.calledOnceWithExactly(0x123456));
  t.true(write2Stub.notCalled);

  t.false(arch.handleLogicAndCompareOperations("ADC", "$12", 1, false));

  t.throws(() => {
    arch.handleLogicAndCompareOperations("ORA", "bad", 1, false);
  }, { message: "Error: Invalid operand format for ORA: bad" });
});

test("Arch65816.handleLogicAndCompareOperations covers successful explicit-size indexed and non-indexed modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$123456").returns(0x123456);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleLogicAndCompareOperations("ORA", "$12,x", 1, true));
  t.true(arch.handleLogicAndCompareOperations("CMP", "$1234,x", 2, true));
  t.true(arch.handleLogicAndCompareOperations("EOR", "$12", 1, true));
  t.true(arch.handleLogicAndCompareOperations("AND", "$1234", 2, true));
  t.true(arch.handleLogicAndCompareOperations("ORA", "$123456", 3, true));

  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x15, 0x12, 0xDD, 0x45, 0x12, 0x2D, 0x0F]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234, 0x1234]);
  t.deepEqual(write3Stub.getCalls().map((call) => call.args[0]), [0x123456]);
});

test("Arch65816.handleLogicAndCompareOperations rejects unsupported indirect-long modes for CPX/CPY", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$34").returns(0x34);
  getnumStub.withArgs("$56").returns(0x56);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.throws(() => {
    arch.handleLogicAndCompareOperations("CPX", "[$34]", 1, false);
  }, { message: "Error: Invalid operand format for CPX: [$34] => undefined" });
  t.throws(() => {
    arch.handleLogicAndCompareOperations("CPY", "[$56],y", 1, false);
  }, { message: "Error: Invalid operand format for CPY: [$56],y => undefined" });
  t.true(write1Stub.notCalled);
  t.true(write2Stub.notCalled);
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleLogicAndCompareOperations writes 16-bit immediate operands", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleLogicAndCompareOperations("CPY", "#$1234", 2, false));
  t.true(write1Stub.calledOnceWithExactly(0xC0));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleLogicAndCompareOperations writes 16-bit ORA immediates", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$5678").returns(0x5678);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleLogicAndCompareOperations("ORA", "#$5678", 2, false));
  t.true(write1Stub.calledOnceWithExactly(0x09));
  t.true(write2Stub.calledOnceWithExactly(0x5678));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleLogicAndCompareOperations writes direct-page operands through write1", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$34").returns(0x34);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleLogicAndCompareOperations("EOR", "$34", 1, false));
  t.true(getnumStub.calledOnceWithExactly("$34"));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x45, 0x34]);
  t.true(write2Stub.notCalled);
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleLogicAndCompareOperations covers remaining indexed and indirect modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$5678").returns(0x5678);
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$34").returns(0x34);
  getnumStub.withArgs("$56").returns(0x56);
  getnumStub.withArgs("$78").returns(0x78);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleLogicAndCompareOperations("ORA", "$1234,y", 2, false));
  t.true(arch.handleLogicAndCompareOperations("ORA", "$12,x", 1, false));
  t.true(arch.handleLogicAndCompareOperations("ORA", "($34,x)", 1, false));
  t.true(arch.handleLogicAndCompareOperations("ORA", "($56),y", 1, false));
  t.true(arch.handleLogicAndCompareOperations("ORA", "($78)", 1, false));
  t.true(arch.handleLogicAndCompareOperations("ORA", "[$12],y", 1, false));
  t.true(arch.handleLogicAndCompareOperations("ORA", "$5678", 2, false));

  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [
    0x19,
    0x15,
    0x12,
    0x01,
    0x34,
    0x11,
    0x56,
    0x12,
    0x78,
    0x17,
    0x12,
    0x0D,
  ]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234, 0x5678]);
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleLogicAndCompareOperations covers non-forced absolute-X mode", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleLogicAndCompareOperations("ORA", "$1234,x", 2, false));
  t.true(write1Stub.calledOnceWithExactly(0x1D));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleLogicAndCompareOperations covers long and stack-relative modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$123456").returns(0x123456);
  getnumStub.withArgs("$34").returns(0x34);
  getnumStub.withArgs("$56").returns(0x56);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleLogicAndCompareOperations("ORA", "$123456", 3, false));
  t.true(arch.handleLogicAndCompareOperations("ORA", "$123456,x", 3, false));
  t.true(arch.handleLogicAndCompareOperations("ORA", "$34,s", 1, false));
  t.true(arch.handleLogicAndCompareOperations("ORA", "($56,s),y", 1, false));

  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x0F, 0x1F, 0x03, 0x34, 0x13, 0x56]);
  t.true(write2Stub.notCalled);
  t.deepEqual(write3Stub.getCalls().map((call) => call.args[0]), [0, 0x123456]);
});

test("Arch65816.handleMemoryOperations handles immediate and forced addressing", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("#$12").returns(0x12);
  getnumStub.withArgs("$123456").returns(0x123456);
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleMemoryOperations("LDA", "#$12", 1, false));
  t.true(arch.handleMemoryOperations("STA", "$123456,x", 3, true));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xA9, 0x12, 0x9F]);
  t.true(write3Stub.calledOnceWithExactly(0x123456));
  t.true(write2Stub.notCalled);

  t.throws(() => {
    arch.handleMemoryOperations("STA", "#$12", 1, false);
  }, { message: "Error: STA does not support immediate mode." });

  t.throws(() => {
    arch.handleMemoryOperations("LDA", "", 1, false);
  }, { message: "Error: LDA requires an operand." });
});

test("Arch65816.handleMemoryOperations throws for unsupported forced opcode maps", t => {
  const { arch } = createArch65816();

  t.throws(() => {
    arch.handleMemoryOperations("ORA", "$12,x", 1, true);
  }, { message: "Error: Opcode ORA not supported in forced indexed mode." });

  t.throws(() => {
    arch.handleMemoryOperations("ORA", "$12", 1, true);
  }, { message: "Error: Opcode ORA not supported in forced non-indexed mode." });
});

test("Arch65816.handleMemoryOperations handles direct-page optimization and indirect forms", t => {
  const { assembler, arch } = createArch65816();
  assembler.optimizeDirectPage = false;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$34").returns(0x34);
  getnumStub.withArgs("VALUE").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleMemoryOperations("ADC", "$12", 1, false));
  t.true(arch.handleMemoryOperations("LDA", "($34),y", 1, false));
  t.true(arch.handleMemoryOperations("SBC", "$12", 1, false, "$12"));
  t.true(arch.handleMemoryOperations("ADC", "VALUE", 2, false, "VALUE"));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x65, 0x12, 0xB1, 0x34, 0xE5, 0x12, 0x6D]);
  t.true(write2Stub.calledOnceWithExactly(0x1234));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleMemoryOperations covers absolute indexed X and unsupported fallthrough", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleMemoryOperations("ADC", "$1234,x", 2, false));
  t.false(arch.handleMemoryOperations("ORA", "$1234,x", 2, false));
  t.true(write1Stub.calledOnceWithExactly(0x7D));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleMemoryOperations covers symbolic absolute indexed X fallback", t => {
  const { assembler, arch } = createArch65816();
  assembler.optimizeDirectPage = false;
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("VALUE").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleMemoryOperations("LDA", "VALUE,x", 2, false, "VALUE,x"));
  t.true(write1Stub.calledOnceWithExactly(0xBD));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleMemoryOperations covers absolute-Y, absolute-long, and absolute modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  getnumStub.withArgs("$123456").returns(0x123456);
  getnumStub.withArgs("$5678").returns(0x5678);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleMemoryOperations("STA", "$1234,y", 2, false));
  t.true(arch.handleMemoryOperations("LDA", "$123456", 3, false));
  t.true(arch.handleMemoryOperations("SBC", "$5678", 2, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x99, 0xAF, 0xED]);
  t.deepEqual(write2Stub.getCalls().map((call) => call.args[0]), [0x1234, 0x5678]);
  t.deepEqual(write3Stub.getCalls().map((call) => call.args[0]), [0x123456]);
});

test("Arch65816.handleMemoryOperations encodes explicit indexed-Y symbolic operands", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("obj.active").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleMemoryOperations("STA", "obj.active,Y", 2, true, "obj.active,Y"));
  t.true(write1Stub.calledOnceWithExactly(0x99));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleMemoryOperations covers stack-relative and indirect-long modes", t => {
  const { assembler, arch } = createArch65816();
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  getnumStub.withArgs("$34").returns(0x34);
  getnumStub.withArgs("$56").returns(0x56);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  const write3Stub = sinon.stub(assembler, "write3");
  t.teardown(() => {
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
    write3Stub.restore();
  });

  t.true(arch.handleMemoryOperations("ADC", "($12,s),y", 1, false));
  t.true(arch.handleMemoryOperations("LDA", "[$34]", 1, false));
  t.true(arch.handleMemoryOperations("SBC", "[$56],y", 1, false));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0x73, 0x12, 0xA7, 0x34, 0xF7, 0x56]);
  t.true(write2Stub.notCalled);
  t.true(write3Stub.notCalled);
});

test("Arch65816.handleMemoryOperations consumes lowered addressing metadata", t => {
  const { assembler, arch } = createArch65816();
  const lowerOperandStub = sinon.stub(assembler.operandResolver, "lowerOperand");
  lowerOperandStub.withArgs("TARGET,x").returns({
    raw: "TARGET,x",
    expanded: "TARGET,x",
    length: 2,
    indexRegister: "x",
    immediate: false,
    indirect: false,
    mode: "absoluteIndexedX",
    baseExpression: "TARGET",
    explicitDirectPage: false,
    explicitDirectPageIndexedX: false,
  });
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("TARGET").returns(0x1234);
  const write1Stub = sinon.stub(assembler, "write1");
  const write2Stub = sinon.stub(assembler, "write2");
  t.teardown(() => {
    lowerOperandStub.restore();
    getnumStub.restore();
    write1Stub.restore();
    write2Stub.restore();
  });

  t.true(arch.handleMemoryOperations("LDA", "TARGET,x", 2, false, "TARGET,x"));
  t.true(lowerOperandStub.calledOnceWithExactly("TARGET,x"));
  t.true(write1Stub.calledOnceWithExactly(0xBD));
  t.true(write2Stub.calledOnceWithExactly(0x1234));
});

test("Arch65816.handleNoOperandOperations writes single and repeated opcodes", t => {
  const { assembler, arch } = createArch65816();
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    write1Stub.restore();
  });

  t.true(arch.handleNoOperandOperations("NOP", ""));
  t.true(arch.handleNoOperandOperations("PHA", "#3"));
  t.true(arch.handleNoOperandOperations("CLC", "#$2"));
  t.deepEqual(write1Stub.getCalls().map((call) => call.args[0]), [0xEA, 0x48, 0x48, 0x48, 0x18, 0x18]);
});

test("Arch65816.handleNoOperandOperations handles unsupported, zero-count, and invalid repeat inputs", t => {
  const { assembler, arch } = createArch65816();
  const write1Stub = sinon.stub(assembler, "write1");
  t.teardown(() => {
    write1Stub.restore();
  });

  t.false(arch.handleNoOperandOperations("LDA", ""));
  t.true(arch.handleNoOperandOperations("NOP", "#0"));
  t.true(write1Stub.notCalled);

  t.throws(() => {
    arch.handleNoOperandOperations("NOP", "#abc");
  }, { message: "Invalid repeat count in pseudo opcode: #abc" });
});

test("Arch65816.asblock_65816 returns false for empty input", t => {
  const { arch } = createArch65816();

  t.false(arch.asblock_65816([]));
});

test("Arch65816.asblock_65816 routes arithmetic opcodes with explicit length suffixes", t => {
  const { assembler, arch } = createArch65816();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  expandOperandStub.withArgs("$12").returns({ expanded: "$12", length: 1 });
  const getlenStub = sinon.stub(arch, "getlenfromchar");
  getlenStub.withArgs("B").returns(1);
  const arithmeticStub = sinon.stub(arch, "handleArithmeticOperations").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
    getlenStub.restore();
    arithmeticStub.restore();
  });

  t.true(arch.asblock_65816(["asl.b", "$12"]));
  t.true(expandOperandStub.calledOnceWithExactly("$12"));
  t.true(getlenStub.calledOnceWithExactly("B"));
  t.true(arithmeticStub.calledOnceWithExactly("ASL", "$12", 1, true));
});

test("Arch65816.asblock_65816 routes no-operand opcodes before other helpers", t => {
  const { assembler, arch } = createArch65816();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  expandOperandStub.withArgs("#3").returns({ expanded: "#3", length: 1 });
  const noOperandStub = sinon.stub(arch, "handleNoOperandOperations").returns(true);
  const loadRegisterStub = sinon.stub(arch, "handleLoadRegister").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
    noOperandStub.restore();
    loadRegisterStub.restore();
  });

  t.true(arch.asblock_65816(["nop", "#3"]));
  t.true(noOperandStub.calledOnceWithExactly("NOP", "#3"));
  t.true(loadRegisterStub.notCalled);
});

test("Arch65816.asblock_65816 routes branch helpers before generic fallback", t => {
  const { assembler, arch } = createArch65816();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  expandOperandStub.withArgs("$1234").returns({ expanded: "$1234", length: 2 });
  const noOperandStub = sinon.stub(arch, "handleNoOperandOperations").returns(false);
  const branchStub = sinon.stub(arch, "handleBranchInstructions").returns(false);
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$1234").returns(0x1234);
  const genericStub = sinon.stub(arch, "handleGenericOpcode").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
    noOperandStub.restore();
    branchStub.restore();
    getnumStub.restore();
    genericStub.restore();
  });

  t.true(arch.asblock_65816(["bra", "$1234"]));
  t.true(branchStub.calledOnceWithExactly("BRA", "$1234"));
  t.true(genericStub.calledOnceWithExactly("BRA", 0x1234, 2, false, true));
});

test("Arch65816.asblock_65816 falls back to generic opcode handling with resolved num and hexconstant", t => {
  const { assembler, arch } = createArch65816();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  expandOperandStub.withArgs("$12").returns({ expanded: "$12", length: 1 });
  const noOperandStub = sinon.stub(arch, "handleNoOperandOperations").returns(false);
  const branchStub = sinon.stub(arch, "handleBranchInstructions").returns(false);
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("$12").returns(0x12);
  const genericStub = sinon.stub(arch, "handleGenericOpcode").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
    noOperandStub.restore();
    branchStub.restore();
    getnumStub.restore();
    genericStub.restore();
  });

  t.true(arch.asblock_65816(["wdm", "$12"]));
  t.true(genericStub.calledOnceWithExactly("WDM", 0x12, 1, false, true));
});

test("Arch65816.asblock_65816 routes bit-test opcodes without falling through to memory-bit helper", t => {
  const { assembler, arch } = createArch65816();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  expandOperandStub.withArgs("$12").returns({ expanded: "$12", length: 1 });
  const bitTestStub = sinon.stub(arch, "handleBitTestOperations").returns(true);
  const memoryBitStub = sinon.stub(arch, "handleMemoryBitInstructions").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
    bitTestStub.restore();
    memoryBitStub.restore();
  });

  t.true(arch.asblock_65816(["trb", "$12"]));
  t.true(bitTestStub.calledOnceWithExactly("TRB", "$12", 1, false));
  t.true(memoryBitStub.notCalled);
});

test("Arch65816.asblock_65816 routes memory and load-register opcodes using expanded operands", t => {
  const { assembler, arch } = createArch65816();
  const expandOperandStub = sinon.stub(assembler.operandResolver, "expandOperand");
  expandOperandStub.withArgs("#!VALUE").returns({ expanded: "#$34", length: 1 });
  expandOperandStub.withArgs("$1234,y").returns({ expanded: "$1234,y", length: 2 });
  const memoryStub = sinon.stub(arch, "handleMemoryOperations").returns(true);
  const loadRegisterStub = sinon.stub(arch, "handleLoadRegister").returns(true);
  t.teardown(() => {
    expandOperandStub.restore();
    memoryStub.restore();
    loadRegisterStub.restore();
  });

  t.true(arch.asblock_65816(["lda", "#!VALUE"]));
  t.true(arch.asblock_65816(["ldx", "$1234,y"]));
  t.true(memoryStub.calledOnceWithExactly("LDA", "#$34", 1, false, "#!VALUE"));
  t.true(loadRegisterStub.calledOnceWithExactly("LDX", "$1234,y", 2, false));
});
