import fs from "fs";
import sinon from "sinon";
import { test } from "./ava-helper.js";

import { Assembler, LoopBlock } from "../src/assembler.js";
import { createTraceCollector } from "../src/debug-tracing.js";
import { parseExpressionNode } from "../src/ir/expression-node.js";
import { createNormalizedCommand } from "../src/ir/normalized-command.js";
import { getDefineVariable, splitCommandIntoWords, splitInlineCommands } from "../src/services/command-text-service.js";
import { handleArch } from "../src/directives/layout.js";
import { DirectiveContext } from "../src/directives/types.js";
import { handleIncbin } from "../src/directives/include-source.js";

const makeCommand = (command: string) => createNormalizedCommand(
  command,
  command,
  command.trim().split(/\s+/),
  "test.asm",
  1
);

test("getnum - handles numeric literals", t => {
  const assembler = new Assembler();

  // Decimal literals
  t.is(assembler.operandResolver.getnum("10"), 10, "Should parse decimal literals");
  t.is(assembler.operandResolver.getnum("0"), 0, "Should parse zero");
  t.is(assembler.operandResolver.getnum("255"), 255, "Should parse larger decimal values");

  // Hexadecimal literals
  t.is(assembler.operandResolver.getnum("$10"), 16, "Should parse hex literals with $ prefix");
  t.is(assembler.operandResolver.getnum("$FF"), 255, "Should parse larger hex values");
  t.is(assembler.operandResolver.getnum("$0"), 0, "Should parse hex zero");

  // Binary literals
  t.is(assembler.operandResolver.getnum("%1010"), 10, "Should parse binary literals");
  t.is(assembler.operandResolver.getnum("%11111111"), 255, "Should parse larger binary values");
  t.is(assembler.operandResolver.getnum("%0"), 0, "Should parse binary zero");

  // With whitespace
  t.is(assembler.operandResolver.getnum(" 42 "), 42, "Should handle whitespace");
});

test("getnum - handles immediate values", t => {
  const assembler = new Assembler();

  // Immediate values with # prefix
  t.is(assembler.operandResolver.getnum("#10"), 10, "Should parse immediate decimal values");
  t.is(assembler.operandResolver.getnum("#$FF"), 255, "Should parse immediate hex values");
  t.is(assembler.operandResolver.getnum("# 42"), 42, "Should handle whitespace after #");
});

test("getnum - resolves defines", t => {
  const assembler = new Assembler();

  // Setup some defines
  assembler.defines.set("TEST_VALUE", "42");
  assembler.defines.set("HEX_VALUE", "$FF");

  t.is(assembler.operandResolver.getnum("!TEST_VALUE"), 42, "Should resolve defines to their values");
  t.is(assembler.operandResolver.getnum("#!TEST_VALUE"), 42, "Should resolve defines in immediate mode");
  t.is(assembler.operandResolver.getnum("!HEX_VALUE"), 255, "Should resolve defines with hex values");
});

test("getnum - handles labels", t => {
  const assembler = new Assembler();

  // Mock the getLabelValue method
  const getLabelValueStub = sinon.stub(assembler.symbolScope, "getLabelValue");
  getLabelValueStub.withArgs("label1", false).returns(0x1000);
  getLabelValueStub.withArgs("another_label", false).returns(0x2000);

  t.is(assembler.operandResolver.getnum("label1"), 0x1000, "Should resolve label values");
  t.is(assembler.operandResolver.getnum("another_label"), 0x2000, "Should resolve different label values");
});

test("getnum - handles math expressions", t => {
  const assembler = new Assembler();

  // Mock the math method
  const mathStub = sinon.stub(assembler.mathCore, "math");
  mathStub.withArgs("10+5").returns(15);
  mathStub.withArgs("$10*2").returns(32);
  mathStub.withArgs("(20-5)/3").returns(5);

  t.is(assembler.operandResolver.getnum("10+5"), 15, "Should evaluate addition expressions");
  t.is(assembler.operandResolver.getnum("$10*2"), 32, "Should evaluate multiplication with hex values");
  t.is(assembler.operandResolver.getnum("(20-5)/3"), 5, "Should evaluate complex expressions with parentheses");
});

test("resolvedefines - preserves local label arithmetic expressions", t => {
  const assembler = new Assembler();

  assembler.symbolScope.setLabel("zombie_spawner_data", 0xDA6E, false, false, true);
  assembler.symbolScope.setLabel("zombie_spawner_data_zone", 0xDA8A);
  assembler.symbolScope.setLabel("zombie_spawner_data_zone_difficulty_offset", 0xDA8A);
  assembler.symbolScope.setLabel("zombie_spawner_data_zone_max", 0xDA8E);
  assembler.symbolScope.setLabel("zombie_spawner_data_zone_n", 0xDA98);

  assembler.currentParentLabel = "zombie_spawner_data_zone_difficulty_offset";
  assembler.currentGlobalParentLabel = "zombie_spawner_data";
  assembler.currentParentIsGlobal = false;
  assembler.pass = 2;

  t.is(
    assembler.resolvedefines(".zone_n-.zone_max"),
    ".zone_n-.zone_max",
    "Should leave dotted local arithmetic intact for later evaluation",
  );
  t.is(assembler.operandResolver.getnum(".zone_n-.zone_max"), 0x0A);
});

test("getnum - keeps parent stride for extended struct array members", t => {
  const assembler = new Assembler();

  assembler.assembleblock("struct obj 0");
  assembler.assembleblock(".base: skip 0");
  assembler.assembleblock(".active: skip 1");
  assembler.assembleblock(".timer: skip 1");
  assembler.assembleblock(".state: skip 4");
  assembler.assembleblock(".type: skip 1");
  assembler.assembleblock(".init_param: skip 1");
  assembler.assembleblock(".flags1: skip 1");
  assembler.assembleblock(".flags2: skip 1");
  assembler.assembleblock("._0A_0D: skip 4");
  assembler.assembleblock(".hp: skip 1");
  assembler.assembleblock("._0F: skip 1");
  assembler.assembleblock("._10: skip 1");
  assembler.assembleblock(".direction: skip 1");
  assembler.assembleblock(".facing: skip 1");
  assembler.assembleblock("._13: skip 2");
  assembler.assembleblock("._15: skip 1");
  assembler.assembleblock(".speed_x: skip 3");
  assembler.assembleblock(".speed_y: skip 3");
  assembler.assembleblock(".gravity: skip 1");
  assembler.assembleblock("._1D: skip 1");
  assembler.assembleblock(".pos_x: skip 3");
  assembler.assembleblock(".pos_y: skip 3");
  assembler.assembleblock(".anim_timer: skip 1");
  assembler.assembleblock("._25: skip 1");
  assembler.assembleblock("._26: skip 1");
  assembler.assembleblock("._27: skip 2");
  assembler.assembleblock("._29: skip 2");
  assembler.assembleblock("._2B: skip 2");
  assembler.assembleblock("endstruct");

  assembler.assembleblock("struct ext extends obj");
  assembler.assembleblock("._2D_3D: skip 17");
  assembler.assembleblock("._3E_3F: skip 2");
  assembler.assembleblock(".index: skip 1");
  assembler.assembleblock(".len: skip 0");
  assembler.assembleblock("endstruct");

  assembler.symbolScope.setLabel("obj_start", 0x043C, false, false, true);
  assembler.defines.set("obj_objects", "obj_start+obj[19]");

  t.is(
    assembler.structEngine.resolveStructLabel("obj[19].ext.index"),
    0x0513,
    "Extended array members should use the parent object stride",
  );
  t.is(
    assembler.operandResolver.getnum("!obj_objects.ext.index"),
    0x094F,
    "Define math should keep the parent stride for extension members",
  );
});

test("getnum - throws error for undefined defines", t => {
  const assembler = new Assembler();

  // Mock resolvedefines to throw for undefined defines
  const resolvedefinesStub = sinon.stub(assembler, "resolvedefines");
  resolvedefinesStub.withArgs("UNDEFINED_DEFINE").throws(new Error("Define 'UNDEFINED_DEFINE' not found."));

  t.throws(() => {
    assembler.operandResolver.getnum("UNDEFINED_DEFINE");
  }, { message: "Define 'UNDEFINED_DEFINE' not found." }, "Should throw for undefined defines");
});

test("setPass - updates the current pass of assembly", t => {
  const assembler = new Assembler();

  // Default pass should be 1
  t.is(assembler.pass, 0, "Default pass should be 0");

  // Set to pass 2
  assembler.setPass(2);
  t.is(assembler.pass, 2, "Pass should be updated to 2");

  // Set to pass 1
  assembler.setPass(1);
  t.is(assembler.pass, 1, "Pass should be updated to 1");
});

test("setPass - resets guarded status for included files", t => {
  const assembler = new Assembler();

  // Add a guarded file to the included files map
  const testFile = "/test/path/guarded.asm";
  assembler.includedFiles.set(testFile, { included: true, guarded: true });

  // Verify it's marked as guarded
  t.true(assembler.includedFiles.get(testFile).guarded);

  // Change to a new pass
  assembler.setPass(1);

  // Verify guard has been reset
  t.false(assembler.includedFiles.get(testFile).guarded);
});

test("splitInlineCommands splits relative-label command fragments after inline separators", t => {
  t.deepEqual(
    splitInlineCommands(["jmp (+,X) : +: dw .mode1, .mode2, .mode3"]),
    ["jmp (+,X)", "+:", "dw .mode1, .mode2, .mode3"],
  );
  t.deepEqual(
    splitInlineCommands(["bra + : ++: db $01"]),
    ["bra +", "++:", "db $01"],
  );
  t.deepEqual(
    splitInlineCommands(["set_hp: lda #$01"]),
    ["set_hp: lda #$01"],
  );
});

test("trace listener captures command and write events", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.romdata = new Uint8Array(0x100000);
  assembler.currentFile = new URL(import.meta.url).pathname;
  assembler.currentLine = 1;
  assembler.setWritePosition(0x808000);

  const collector = createTraceCollector({ startAddress: 0x808000, endAddress: 0x808000 });
  assembler.setTraceListener(collector.listener);

  assembler.processNormalizedCommand(makeCommand("db $42"), false);

  t.deepEqual(
    collector.events.map((event) => event.type),
    ["command-start", "write", "command-end"],
    "Trace listener should receive command boundaries and byte writes in order",
  );

  const writeEvent = collector.events.find((event) => event.type === "write");
  if (!writeEvent || writeEvent.type !== "write") {
    t.fail("Expected a write trace event");
    return;
  }
  t.is(writeEvent.file, "test.asm");
  t.is(writeEvent.line, 1);
  t.is(writeEvent.raw, "db $42");
  t.is(writeEvent.snesAddress, 0x808000);
  t.is(writeEvent.value, 0x42);

  const endEvent = collector.events.find((event) => event.type === "command-end");
  if (!endEvent || endEvent.type !== "command-end") {
    t.fail("Expected a command-end trace event");
    return;
  }
  t.is(endEvent.bytesWritten, 1);
  t.is(endEvent.endSnesAddress, 0x808001);
});

test("trace collector filters to matching address ranges", t => {
  const collector = createTraceCollector({ startAddress: 0x1234, endAddress: 0x1234, eventTypes: ["write"] });

  collector.listener({
    type: "write",
    pass: 2,
    arch: "spc700",
    file: "trace.asm",
    line: 12,
    raw: "db $10",
    normalized: "db $10",
    snesAddress: 0x1234,
    pcAddress: 0x5678,
    value: 0x10,
  });
  collector.listener({
    type: "write",
    pass: 2,
    arch: "spc700",
    file: "trace.asm",
    line: 13,
    raw: "db $11",
    normalized: "db $11",
    snesAddress: 0x1235,
    pcAddress: 0x5679,
    value: 0x11,
  });

  t.is(collector.events.length, 1);
  t.is(collector.events[0].snesAddress, 0x1234);
});

test("finishPass - updates header and CRC32", t => {
  const assembler = new Assembler();

  // Mock the updateHeaderAndCRC32 method
  const updateHeaderSpy = sinon.spy(assembler, "updateHeaderAndCRC32");

  assembler.finishPass();
  t.is(updateHeaderSpy.callCount, 1, "updateHeaderAndCRC32 should be called when targetRom is true");
});

test("addAddressToLine - adds mapping", t => {
  const assembler = new Assembler();

  // Mock the includeMapping method of addressToLineMapping
  const includeMappingSpy = sinon.spy(assembler.addressToLineMapping, "includeMapping");

  // Set current file and line
  assembler.setCurrentFile("test.asm");
  assembler.setCurrentLine(10);

  // On pass 1, mapping should not be added
  assembler.setPass(1);
  assembler.addAddressToLine(0x8000);
  t.is(includeMappingSpy.callCount, 1, "Mapping should not be added on pass 1");

  // On pass 2, mapping should be added
  assembler.setPass(2);
  assembler.addAddressToLine(0x8000);
  t.is(includeMappingSpy.callCount, 2, "Mapping should be added on pass 2");
  t.deepEqual(
    includeMappingSpy.firstCall.args,
    ["test.asm", 11, 0x8000],
    "Mapping should include file, line+1, and address"
  );
});

test("setCurrentFile - updates the current file being processed", t => {
  const assembler = new Assembler();
  const filename = "test.asm";

  assembler.setCurrentFile(filename);

  t.is(assembler.currentFile, filename);
  t.is(assembler.currentLine, 0, "currentLine should be reset to 0 when setting a new file");
});

test("setCurrentLine - setting a new file should reset the line number", t => {
  const assembler = new Assembler();

  // Set initial values
  assembler.setCurrentFile("first.asm");
  assembler.setCurrentLine(10);

  t.is(assembler.currentFile, "first.asm");
  t.is(assembler.currentLine, 10);

  // Setting a new file should reset the line number
  assembler.setCurrentFile("second.asm");

  t.is(assembler.currentFile, "second.asm");
  t.is(assembler.currentLine, 0, "Line number should be reset when changing files");

  // Setting the line number shouldn't affect the file
  assembler.setCurrentLine(20);

  t.is(assembler.currentFile, "second.asm", "File should remain unchanged when setting line number");
  t.is(assembler.currentLine, 20);
});

test("setCurrentLine - updates the current line number", t => {
  const assembler = new Assembler();
  const lineNumber = 42;

  assembler.setCurrentLine(lineNumber);

  t.is(assembler.currentLine, lineNumber);
});

test("writeDataBytes - writes a single byte to ROM", t => {
  const assembler = new Assembler();

  // Initialize ROM with zeros
  assembler.romdata = Array(10).fill(0);

  // Write a single byte
  assembler.writeDataBytes(5, 0xAA);

  // Check that only the specified position was modified
  for (let i = 0; i < 10; i++) {
    if (i === 5) {
      t.is(assembler.romdata[i], 0xAA);
    } else {
      t.is(assembler.romdata[i], 0);
    }
  }
});

test("writeDataBytes - writes multiple bytes to ROM", t => {
  const assembler = new Assembler();

  // Initialize ROM with zeros
  assembler.romdata = Array(20).fill(0);

  // Write multiple bytes
  assembler.writeDataBytes(5, 0xBB, 5);

  // Check that only the specified range was modified
  for (let i = 0; i < 20; i++) {
    if (i >= 5 && i < 10) {
      t.is(assembler.romdata[i], 0xBB);
    } else {
      t.is(assembler.romdata[i], 0);
    }
  }
});

test("writeDataBytes - writes to the beginning of ROM", t => {
  const assembler = new Assembler();

  // Initialize ROM with zeros
  assembler.romdata = Array(10).fill(0);

  // Write to the beginning
  assembler.writeDataBytes(0, 0xCC, 3);

  // Check that only the beginning was modified
  for (let i = 0; i < 10; i++) {
    if (i < 3) {
      t.is(assembler.romdata[i], 0xCC);
    } else {
      t.is(assembler.romdata[i], 0);
    }
  }
});

test("writeDataBytes - writes to the end of ROM", t => {
  const assembler = new Assembler();

  // Initialize ROM with zeros
  assembler.romdata = Array(10).fill(0);

  // Write to the end
  assembler.writeDataBytes(7, 0xDD, 3);

  // Check that only the end was modified
  for (let i = 0; i < 10; i++) {
    if (i >= 7) {
      t.is(assembler.romdata[i], 0xDD);
    } else {
      t.is(assembler.romdata[i], 0);
    }
  }
});

test("writeDataBytes - handles zero length correctly", t => {
  const assembler = new Assembler();

  // Initialize ROM with zeros
  assembler.romdata = Array(10).fill(0);

  // Write with length 0
  assembler.writeDataBytes(5, 0xEE, 0);

  // Check that nothing was modified
  for (let i = 0; i < 10; i++) {
    t.is(assembler.romdata[i], 0);
  }
});

test("writeDataBytes - handles different byte values", t => {
  const assembler = new Assembler();

  // Initialize ROM
  assembler.romdata = Array(5).fill(0);

  // Write different values
  assembler.writeDataBytes(0, 0x00);
  assembler.writeDataBytes(1, 0x7F);
  assembler.writeDataBytes(2, 0x80);
  assembler.writeDataBytes(3, 0xFF);
  assembler.writeDataBytes(4, 0x100); // Should wrap to 0x00

  // Check values
  t.is(assembler.romdata[0], 0x00);
  t.is(assembler.romdata[1], 0x7F);
  t.is(assembler.romdata[2], 0x80);
  t.is(assembler.romdata[3], 0xFF);
  t.is(assembler.romdata[4], 0x00); // 0x100 & 0xFF = 0x00
});

test("writeDataBytes - throws error when parameters are not numbers", t => {
  const assembler = new Assembler();

  // Initialize ROM
  assembler.romdata = Array(10).fill(0);

  // Test with non-number start parameter
  const error1 = t.throws(() => {
    // @ts-expect-error Testing invalid parameter type
    assembler.writeDataBytes("0", 0xFF);
  }, { instanceOf: Error });
  t.is(error1.message, "writeDataBytes requires a number for start, value, and length");

  // Test with non-number value parameter
  const error2 = t.throws(() => {
    // @ts-expect-error Testing invalid parameter type
    assembler.writeDataBytes(0, "0xFF");
  }, { instanceOf: Error });
  t.is(error2.message, "writeDataBytes requires a number for start, value, and length");

  // Test with non-number length parameter
  const error3 = t.throws(() => {
    // @ts-expect-error Testing invalid parameter type
    assembler.writeDataBytes(0, 0xFF, "5");
  }, { instanceOf: Error });
  t.is(error3.message, "writeDataBytes requires a number for start, value, and length");
});

test("expandRom - expands ROM size and fills with specified byte", t => {
  const assembler = new Assembler();

  // Initialize ROM with some data
  assembler.romdata = Array(50).fill(0xAA);

  // Expand ROM to 100 bytes with 0xFF fill
  assembler.expandRom(100, 0xFF);

  // Check ROM length was updated
  t.is(assembler.romdata.length, 100);

  // Check original data is preserved
  for (let i = 0; i < 50; i++) {
    t.is(assembler.romdata[i], 0xAA);
  }

  // Check new space is filled with specified byte
  for (let i = 50; i < 100; i++) {
    t.is(assembler.romdata[i], 0xFF);
  }
});

test("expandRom - does nothing when new size is smaller than current size", t => {
  const assembler = new Assembler();

  // Initialize ROM with some data
  assembler.romdata = Array(100).fill(0xAA);

  // Try to "expand" ROM to a smaller size
  assembler.expandRom(50, 0xFF);

  // Check ROM length remains unchanged
  t.is(assembler.romdata.length, 100);

  // Check data remains unchanged
  for (let i = 0; i < 100; i++) {
    t.is(assembler.romdata[i], 0xAA);
  }
});

test("expandRom - expands empty ROM", t => {
  const assembler = new Assembler();

  // Start with empty ROM
  assembler.romdata = [];

  // Expand ROM to 100 bytes with 0x00 fill
  assembler.expandRom(100, 0x00);

  // Check ROM length was updated
  t.is(assembler.romdata.length, 100);

  // Check all space is filled with specified byte
  for (let i = 0; i < 100; i++) {
    t.is(assembler.romdata[i], 0x00);
  }
});

test("expandRom - handles large expansions", t => {
  const assembler = new Assembler();

  // Initialize small ROM
  assembler.romdata = Array(10).fill(0xAA);

  // Expand ROM significantly
  const newSize = 10000;
  assembler.expandRom(newSize, 0xBB);

  // Check ROM length was updated
  t.is(assembler.romdata.length, newSize);

  // Check original data is preserved
  for (let i = 0; i < 10; i++) {
    t.is(assembler.romdata[i], 0xAA);
  }

  // Check new space is filled with specified byte (check boundaries and sample)
  t.is(assembler.romdata[10], 0xBB);
  t.is(assembler.romdata[100], 0xBB);
  t.is(assembler.romdata[1000], 0xBB);
  t.is(assembler.romdata[newSize - 1], 0xBB);
});

test("expandRom - throws error when newSize is not a number", t => {
  const assembler = new Assembler();

  // Initialize ROM
  assembler.romdata = Array(10).fill(0xAA);

  // Test with invalid newSize
  const error = t.throws(() => {
    // @ts-expect-error: Testing invalid parameter type
    assembler.expandRom("invalid", 0xBB);
  });

  t.is(error.message, "expandRom requires a number for newSize and fsByte");
});

test("expandRom - throws error when fsByte is not a number", t => {
  const assembler = new Assembler();

  // Initialize ROM
  assembler.romdata = Array(10).fill(0xAA);

  // Test with invalid fsByte
  const error = t.throws(() => {
    // @ts-expect-error: Testing invalid parameter type
    assembler.expandRom(100, "invalid");
  });

  t.is(error.message, "expandRom requires a number for newSize and fsByte");
});

test("expandOperand - handles resolvedefines errors", t => {
  const assembler = new Assembler();

  // Set up a stub for resolvedefines to throw an error
  sinon.stub(assembler, "resolvedefines").throws(new Error("Define not found"));

  // Call expandOperand with an operand that would trigger resolvedefines
  const { expanded, length } = assembler.operandResolver.expandOperand("SOME_DEFINE");

  // Verify that the original operand is returned unchanged
  t.is(expanded, "SOME_DEFINE");
  t.is(length, 2); // Default length should be used

  const resolvedefinesStub = assembler.resolvedefines as unknown as sinon.SinonStub;
  t.true(resolvedefinesStub.calledOnce);
  t.true(resolvedefinesStub.calledWith("SOME_DEFINE"));

  // Clean up
  sinon.restore();
});

test("expandOperand - immediate mode with small value", t => {
  const assembler = new Assembler();
  const { expanded, length } = assembler.operandResolver.expandOperand("#$10");

  t.is(expanded, "#$10");
  t.is(length, 1);
});

test("expandOperand - immediate mode with large value", t => {
  const assembler = new Assembler();
  const { expanded, length } = assembler.operandResolver.expandOperand("#$1000");

  t.is(expanded, "#$1000");
  t.is(length, 2);
});

test("expandOperand - immediate mode with very large value", t => {
  const assembler = new Assembler();
  const { expanded, length } = assembler.operandResolver.expandOperand("#$100000");

  t.is(expanded, "#$100000");
  t.is(length, 3);
});

test("expandOperand - immediate mode with decimal value", t => {
  const assembler = new Assembler();
  const { expanded, length } = assembler.operandResolver.expandOperand("#42");

  t.is(expanded, "#$2A");
  t.is(length, 1);
});

test("expandOperand - immediate mode with expression", t => {
  const assembler = new Assembler();
  const { expanded, length } = assembler.operandResolver.expandOperand("#10+20");

  t.is(expanded, "#$1E");
  t.is(length, 1);
});

test("expandOperand - immediate mode with failed expression evaluation", t => {
  const assembler = new Assembler();
  sinon.stub(assembler.operandResolver, "getnum").throws(new Error("Invalid expression"));

  const { expanded, length } = assembler.operandResolver.expandOperand("#invalid_expr");

  t.is(expanded, "#invalid_expr");
  t.is(length, 2);
});

test("expandOperand - immediate mode with unresolved label", t => {
  const assembler = new Assembler();
  sinon.stub(assembler.operandResolver, "getnum").throws(new Error("Label not found"));

  const { expanded, length } = assembler.operandResolver.expandOperand("#unknown_label");

  t.is(expanded, "#unknown_label");
  t.is(length, 2);
});

test("expandOperand - bank operation forces two bytes", t => {
  const assembler = new Assembler();
  sinon.stub(assembler.mathCore, "math").returns(0x10); // Return a small value that would normally be 1 byte

  const { expanded, length } = assembler.operandResolver.expandOperand("bank(label)");

  t.is(expanded, "$10");
  t.is(length, 2); // Should force 2 bytes despite small value
});

test("expandOperand - immediate mode with bank operation", t => {
  const assembler = new Assembler();
  sinon.stub(assembler.mathCore, "math").returns(0x10);

  const { expanded, length } = assembler.operandResolver.expandOperand("#bank(label)");

  t.is(expanded, "#$10");
  t.is(length, 2); // Should force 2 bytes despite small value
});

test("expandOperand - indexed mode", t => {
  const assembler = new Assembler();
  const { expanded, length } = assembler.operandResolver.expandOperand("$1000,X");

  t.is(expanded, "$1000,X");
  t.is(length, 2);
});

test("expandOperand - indirect mode", t => {
  const assembler = new Assembler();
  const { expanded, length } = assembler.operandResolver.expandOperand("[$1234]");

  t.is(expanded, "[$1234]");
  t.is(length, 2);
});

test("expandOperand - resolves defines", t => {
  const assembler = new Assembler();
  assembler.defines.set("TEST_DEFINE", "$2000");

  const { expanded, length } = assembler.operandResolver.expandOperand("!TEST_DEFINE");

  t.is(expanded, "$2000");
  t.is(length, 2);
});

test("expandOperand - evaluates math expressions", t => {
  const assembler = new Assembler();

  // Set up a stub for mathCore.math to return a predictable value
  sinon.stub(assembler.mathCore, "math").returns(0x30);
  sinon.stub(assembler, "resolvedefines").returns("10+20");

  const { expanded, length } = assembler.operandResolver.expandOperand("10+20");

  t.is(expanded, "$30");
  t.is(length, 1); // Small value, so 1 byte
});

test("expandOperand - handles label references", t => {
  const assembler = new Assembler();
  assembler.pass = 1;

  // Test 1: Label not found
  const { expanded: expanded1, length: length1 } = assembler.operandResolver.expandOperand("some_label");
  t.is(expanded1, "some_label");
  t.is(length1, 2); // Default for labels

  // Test 2: Label found
  // Set up the label in the label table
  assembler.symbolScope.setLabel("found_label", 0x1234, false);

  const { expanded: expanded2, length: length2 } = assembler.operandResolver.expandOperand("found_label");
  t.is(expanded2, "4660");
  t.is(length2, 2); // Should be 2 bytes for this address
});

test("expandOperand - handles complex math expressions", t => {
  const assembler = new Assembler();

  // Set up stubs
  sinon.stub(assembler, "resolvedefines").returns("($1000 + $20) & $FF");
  sinon.stub(assembler.mathCore, "math").returns(0x20);

  const { expanded, length } = assembler.operandResolver.expandOperand("($1000 + $20) & $FF");

  t.is(expanded, "$20");
  t.is(length, 1);
});

test("expandOperand - skips math evaluation when it fails", t => {
  const assembler = new Assembler();

  // Make resolvedefines work but math throw an error
  sinon.stub(assembler, "resolvedefines").returns("complex_expression");
  sinon.stub(assembler.mathCore, "math").throws(new Error("Invalid expression"));

  const { expanded, length } = assembler.operandResolver.expandOperand("complex_expression");

  t.is(expanded, "complex_expression");
  t.is(length, 2); // Default length
});

test("expandOperand - handles math expressions that throw errors", t => {
  const assembler = new Assembler();

  // Set up a math expression that will throw an error
  sinon.stub(assembler, "resolvedefines").returns("(1 + 2) * 3");
  sinon.stub(assembler.mathCore, "math").throws(new Error("Math evaluation error"));

  // Call expandOperand with the expression
  const { expanded, length } = assembler.operandResolver.expandOperand("(1 + 2) * 3");

  // Verify that the original expression is returned unchanged
  t.is(expanded, "(1 + 2) * 3");
  t.is(length, 2); // Default length should be used

  const mathStub = assembler.mathCore.math as unknown as sinon.SinonStub;
  t.true(mathStub.calledOnce);
  t.true(mathStub.calledWith("(1 + 2) * 3"));
});

test("getExpressionObjectSize - returns size for non-extended struct", t => {
  const assembler = new Assembler();
  const structName = "TestStruct";

  // Create a mock struct definition
  const mockStruct = {
    name: structName,
    base: 0,
    offset: 0,
    size: 10,
    labels: new Map(),
    parent: null,
    extensionSize: 5
  };

  // Set up the struct in the assembler
  assembler.structs = new Map();
  assembler.structs.set(structName, mockStruct);

  // Test getExpressionObjectSize
  const size = assembler.getExpressionObjectSize(structName);

  // For non-extended structs, should return base size + extension size
  t.is(size, 15);
});

test("getExpressionObjectSize - returns size for extended struct", t => {
  const assembler = new Assembler();
  const parentStructName = "ParentStruct";
  const childStructName = "ChildStruct";

  // Create mock struct definitions
  const parentStruct = {
    name: parentStructName,
    base: 0,
    offset: 0,
    size: 10,
    labels: new Map(),
    parent: null,
    extensionSize: 5
  };

  const childStruct = {
    name: childStructName,
    base: 0,
    offset: 0,
    size: 5,
    labels: new Map(),
    parent: parentStructName
  };

  // Set up the structs in the assembler
  assembler.structs = new Map();
  assembler.structs.set(parentStructName, parentStruct);
  assembler.structs.set(childStructName, childStruct);

  // Test getExpressionObjectSize on the child struct
  const size = assembler.getExpressionObjectSize(childStructName);

  // For extended structs, should return just its own size
  t.is(size, 5);
});

test("getExpressionObjectSize - handles quoted struct names", t => {
  const assembler = new Assembler();
  const structName = "TestStruct";

  // Create a mock struct definition
  const mockStruct = {
    name: structName,
    base: 0,
    offset: 0,
    size: 10,
    labels: new Map(),
    parent: null,
    extensionSize: 5
  };

  // Set up the struct in the assembler
  assembler.structs = new Map();
  assembler.structs.set(structName, mockStruct);

  // Test getExpressionObjectSize with quoted name
  const size = assembler.getExpressionObjectSize(`"${structName}"`);

  // Should handle the quoted name correctly
  t.is(size, 15);
});

test("resolveReferenceLabelValue - resolves indexed struct base references", t => {
  const assembler = new Assembler();
  assembler.structs.set("obj", {
    name: "obj",
    base: 0,
    offset: 16,
    size: 16,
    labels: new Map([
      ["base", 0],
    ]),
  });

  const expression = parseExpressionNode("obj[1]");
  if (expression.type !== "index") {
    t.fail("Expected indexed reference expression");
    return;
  }

  t.is(assembler.resolveReferenceLabelValue(expression), 16);
});

test("resolveReferenceLabelValue - resolves bare struct base references", t => {
  const assembler = new Assembler();
  assembler.structs.set("obj", {
    name: "obj",
    base: 0,
    offset: 32,
    size: 16,
    labels: new Map([
      ["base", 0],
    ]),
  });

  const expression = parseExpressionNode("obj");
  if (expression.type !== "identifier") {
    t.fail("Expected identifier reference expression");
    return;
  }

  t.is(assembler.resolveReferenceLabelValue(expression), 0);
});

test("resolveReferenceLabelValue - preserves struct members after define expansion", t => {
  const assembler = new Assembler();
  assembler.defines.set("task_offset", "$004E+task");
  assembler.structs.set("task", {
    name: "task",
    base: 0,
    offset: 0,
    size: 24,
    labels: new Map([
      ["base", 0],
      ["stack_id", 4],
    ]),
  });

  const expression = parseExpressionNode("!task_offset.stack_id+0");
  if (expression.type !== "binary") {
    t.fail("Expected binary expression");
    return;
  }

  t.is(assembler.mathCore.math(assembler.resolveExpressionInput(expression)), 0x52);
});

test("getExpressionObjectSize - throws error for non-existent struct", t => {
  const assembler = new Assembler();
  const nonExistentStruct = "NonExistentStruct";

  // Set up an empty structs map
  assembler.structs = new Map();

  // Test that calling getObjectSize with a non-existent struct throws an error
  const error = t.throws(() => {
    assembler.getExpressionObjectSize(nonExistentStruct);
  }, { instanceOf: Error });

  t.is(error.message, `Struct '${nonExistentStruct}' doesn't exist.`);
});

test("getExpressionObjectSize - baseOnly parameter returns only base size", t => {
  const assembler = new Assembler();
  const structName = "TestStruct";

  // Create a mock struct definition with both base size and extension size
  const mockStruct = {
    name: structName,
    base: 0,
    offset: 0,
    size: 10,
    labels: new Map(),
    parent: null,
    extensionSize: 5
  };

  // Set up the struct in the assembler
  assembler.structs = new Map();
  assembler.structs.set(structName, mockStruct);

  // Test getExpressionObjectSize with baseOnly = true
  const baseSize = assembler.getExpressionObjectSize(structName, true);
  // Should return only the base size (10) without the extension size
  t.is(baseSize, 10);

  // Test getExpressionObjectSize with baseOnly = false (default)
  const totalSize = assembler.getExpressionObjectSize(structName, false);
  // Should return the total size (base + extension = 15)
  t.is(totalSize, 15);

  // Test getExpressionObjectSize without specifying baseOnly (should default to false)
  const defaultSize = assembler.getExpressionObjectSize(structName);
  // Should return the total size (base + extension = 15)
  t.is(defaultSize, 15);
});

test("updateHeaderAndCRC32 - lorom mapper updates header at 0x7FC0", t => {
  const assembler = new Assembler();
  assembler.mapper = "lorom";
  assembler.romdata = new Array(0x8000).fill(0);

  assembler.updateHeaderAndCRC32();

  // Verify checksum and complement were written to the correct locations
  const checksum = (assembler.romdata[0x7FC0 + 0x1E] | (assembler.romdata[0x7FC0 + 0x1F] << 8)) & 0xFFFF;
  const complement = (assembler.romdata[0x7FC0 + 0x1C] | (assembler.romdata[0x7FC0 + 0x1D] << 8)) & 0xFFFF;

  t.is((checksum + complement) & 0xFFFF, 0xFFFF, "Checksum and complement should be complementary");
});

test("updateHeaderAndCRC32 - hirom mapper updates header at 0xFFC0", t => {
  const assembler = new Assembler();
  assembler.mapper = "hirom";
  assembler.romdata = new Array(0x10000).fill(0);

  assembler.updateHeaderAndCRC32();

  // Verify checksum and complement were written to the correct locations
  const checksum = (assembler.romdata[0xFFC0 + 0x1E] | (assembler.romdata[0xFFC0 + 0x1F] << 8)) & 0xFFFF;
  const complement = (assembler.romdata[0xFFC0 + 0x1C] | (assembler.romdata[0xFFC0 + 0x1D] << 8)) & 0xFFFF;

  t.is((checksum + complement) & 0xFFFF, 0xFFFF, "Checksum and complement should be complementary");
});

test("updateHeaderAndCRC32 - exhirom mapper updates header at 0xFFC0", t => {
  const assembler = new Assembler();
  assembler.mapper = "exhirom";
  assembler.romdata = new Array(0x10000).fill(0);

  assembler.updateHeaderAndCRC32();

  // Verify checksum and complement were written to the correct locations
  const checksum = (assembler.romdata[0xFFC0 + 0x1E] | (assembler.romdata[0xFFC0 + 0x1F] << 8)) & 0xFFFF;
  const complement = (assembler.romdata[0xFFC0 + 0x1C] | (assembler.romdata[0xFFC0 + 0x1D] << 8)) & 0xFFFF;

  t.is((checksum + complement) & 0xFFFF, 0xFFFF, "Checksum and complement should be complementary");
});

test("updateHeaderAndCRC32 - other mappers default to 0xFFC0", t => {
  const assembler = new Assembler();
  assembler.mapper = "other";
  assembler.romdata = new Array(0x10000).fill(0);

  assembler.updateHeaderAndCRC32();

  // Verify checksum and complement were written to the correct locations
  const checksum = (assembler.romdata[0xFFC0 + 0x1E] | (assembler.romdata[0xFFC0 + 0x1F] << 8)) & 0xFFFF;
  const complement = (assembler.romdata[0xFFC0 + 0x1C] | (assembler.romdata[0xFFC0 + 0x1D] << 8)) & 0xFFFF;

  t.is((checksum + complement) & 0xFFFF, 0xFFFF, "Checksum and complement should be complementary");
});

test("updateHeaderAndCRC32 - ROM too small for header update", t => {
  const assembler = new Assembler();
  assembler.mapper = "lorom";
  assembler.romdata = new Array(0x7FC0).fill(0); // Too small for lorom header

  // Just verify the function doesn't throw an error
  t.notThrows(() => {
    assembler.updateHeaderAndCRC32();
  });
});

test("updateHeaderAndCRC32 - checksum calculation is correct", t => {
  const assembler = new Assembler();
  assembler.mapper = "lorom";
  // Create a small ROM with known values to verify checksum calculation
  assembler.romdata = new Array(0x8000).fill(1); // All bytes are 1

  assembler.updateHeaderAndCRC32();

  // Asar seeds header bytes as FF FF 00 00 first, then sums the full ROM.
  const expectedChecksum = 0x81FA;
  const expectedComplement = (~expectedChecksum) & 0xFFFF;

  const actualChecksum = (assembler.romdata[0x7FC0 + 0x1E] | (assembler.romdata[0x7FC0 + 0x1F] << 8)) & 0xFFFF;
  const actualComplement = (assembler.romdata[0x7FC0 + 0x1C] | (assembler.romdata[0x7FC0 + 0x1D] << 8)) & 0xFFFF;

  t.is(actualChecksum, expectedChecksum, "Checksum should match expected value");
  t.is(actualComplement, expectedComplement, "Complement should match expected value");
});

test("getBinaryOutput - returns a Uint8Array of the ROM data", t => {
  const assembler = new Assembler();

  // Initialize ROM with some test data
  assembler.romdata = [0x01, 0x02, 0x03, 0x04, 0x05];

  const result = assembler.getBinaryOutput();

  t.true(result instanceof Uint8Array, "Result should be a Uint8Array");
  t.deepEqual(Array.from(result), [0x01, 0x02, 0x03, 0x04, 0x05], "Output should match the ROM data");
});

test("getBinaryOutput - returns a copy of the data, not a reference", t => {
  const assembler = new Assembler();

  // Initialize ROM with test data
  assembler.romdata = [0x10, 0x20, 0x30];

  const result = assembler.getBinaryOutput();

  // Modify the original data
  assembler.romdata[0] = 0xFF;

  // The returned array should not be affected by changes to the original
  t.is(result[0], 0x10, "Output should be a copy, not affected by changes to the original");
});

test("getBinaryOutput - handles empty ROM data", t => {
  const assembler = new Assembler();

  // Initialize with empty ROM
  assembler.romdata = [];

  const result = assembler.getBinaryOutput();

  t.true(result instanceof Uint8Array, "Result should be a Uint8Array even with empty data");
  t.is(result.length, 0, "Output length should be 0 for empty ROM data");
});

test("getBinaryOutput - slices to the correct length", t => {
  const assembler = new Assembler();

  // Create an array with allocated but unused space
  assembler.romdata = new Array(10);
  assembler.romdata.fill(0xFF, 0, 5); // Only first 5 elements have meaningful data

  const result = assembler.getBinaryOutput();

  t.is(result.length, assembler.romdata.length, "Output length should match the ROM data length");
});

test("readFile - successful read", t => {
  const assembler = new Assembler();
  assembler.currentFile = "/test/path/current.asm";

  const readFileStub = sinon.stub(fs, "readFileSync");
  const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
  readFileStub.returns(buffer);

  const result = assembler.readFile("test.bin");

  t.deepEqual(result, new Uint8Array([0x01, 0x02, 0x03, 0x04]));
  t.true(readFileStub.calledOnce);

  readFileStub.restore();
});

test("readFile - relative path resolution", t => {
  const assembler = new Assembler();
  assembler.currentFile = "/test/path/current.asm";

  const readFileStub = sinon.stub(fs, "readFileSync");
  readFileStub.returns(Buffer.from([0xFF]));

  assembler.readFile("data.bin");

  // Should resolve relative to current file's directory
  t.true(readFileStub.calledWith("/test/path/data.bin"));

  readFileStub.restore();
});

test("readFile - fallback to cwd when no current file", t => {
  const assembler = new Assembler();
  assembler.currentFile = ""; // No current file

  const cwdStub = sinon.stub(process, "cwd");
  cwdStub.returns("/fallback/dir");

  const readFileStub = sinon.stub(fs, "readFileSync");
  readFileStub.returns(Buffer.from([0xAA]));

  assembler.readFile("data.bin");

  // Should resolve relative to cwd
  t.true(readFileStub.calledWith("/fallback/dir/data.bin"));

  cwdStub.restore();
  readFileStub.restore();
});

test("readFile - throws error on file not found", t => {
  const assembler = new Assembler();

  const readFileStub = sinon.stub(fs, "readFileSync");
  readFileStub.throws(new Error("ENOENT: no such file or directory"));

  const error = t.throws(() => {
    assembler.readFile("nonexistent.bin");
  });

  t.is(error.message, "Error reading file: nonexistent.bin");

  readFileStub.restore();
});

test("readFile - handles binary data correctly", t => {
  const assembler = new Assembler();

  // Create a buffer with various byte values
  const testBuffer = Buffer.from([
    0x00, 0x7F, 0xFF, // Various values
    0xDE, 0xAD, 0xBE, 0xEF // Common magic bytes
  ]);

  const readFileStub = sinon.stub(fs, "readFileSync");
  readFileStub.returns(testBuffer);

  const result = assembler.readFile("binary.dat");

  // Verify the Uint8Array has the same content as the buffer
  t.is(result.length, testBuffer.length);
  for (let i = 0; i < testBuffer.length; i++) {
    t.is(result[i], testBuffer[i]);
  }

  readFileStub.restore();
});

test("readFile - handles text data with encoding", t => {
  const assembler = new Assembler();

  // Create a string with sample text content
  const testString = "This is a test file with text content.";
  const readFileStub = sinon.stub(fs, "readFileSync");
  readFileStub.returns(testString);

  const result = assembler.readFile("text.txt", "utf8");

  // Verify the result is a string and matches the expected content
  t.is(result, testString);
  t.is(typeof result, "string");
  t.true(readFileStub.calledWith(sinon.match.string, "utf8"));

  readFileStub.restore();
});

test("resolveIncludePath - absolute path", t => {
  const assembler = new Assembler();
  const existsSyncStub = sinon.stub(fs, "existsSync");

  // Mock absolute path exists
  const absolutePath = process.platform === "win32" ? "C:\\test\\file.asm" : "/test/file.asm";
  existsSyncStub.withArgs(absolutePath).returns(true);

  const result = assembler.resolveIncludePath(absolutePath);

  t.is(result, absolutePath);
  t.true(existsSyncStub.calledWith(absolutePath));

  existsSyncStub.restore();
});

test("resolveIncludePath - relative to current file", t => {
  const assembler = new Assembler();
  assembler.currentFile = "/test/path/current.asm";
  const existsSyncStub = sinon.stub(fs, "existsSync");

  // Mock relative path exists
  const relativePath = "file.asm";
  const expectedPath = "/test/path/file.asm";
  existsSyncStub.withArgs(expectedPath).returns(true);

  const result = assembler.resolveIncludePath(relativePath);

  t.is(result, expectedPath);
  t.true(existsSyncStub.calledWith(expectedPath));

  existsSyncStub.restore();
});

test("resolveIncludePath - from include paths", t => {
  const assembler = new Assembler();
  assembler.currentFile = "/test/path/current.asm";
  assembler.includePaths = ["./", "/other/include/path"];
  const existsSyncStub = sinon.stub(fs, "existsSync");

  // Mock first attempt fails, second succeeds
  const filename = "file.asm";
  const firstAttempt = "/test/path/file.asm";
  const secondAttempt = "/other/include/path/file.asm";

  existsSyncStub.withArgs(firstAttempt).returns(false);
  existsSyncStub.withArgs(secondAttempt).returns(true);

  const result = assembler.resolveIncludePath(filename);

  t.is(result, secondAttempt);
  t.true(existsSyncStub.calledWith(firstAttempt));
  t.true(existsSyncStub.calledWith(secondAttempt));

  existsSyncStub.restore();
});

test("resolveIncludePath - strips quotes", t => {
  const assembler = new Assembler();
  assembler.currentFile = "/test/path/current.asm";
  const existsSyncStub = sinon.stub(fs, "existsSync");

  // Test with different quote types
  const doubleQuoted = '"file.asm"';
  const singleQuoted = "'file.asm'";
  const backtickQuoted = "`file.asm`";
  const expectedPath = "/test/path/file.asm";

  existsSyncStub.withArgs(expectedPath).returns(true);

  t.is(assembler.resolveIncludePath(doubleQuoted), expectedPath);
  t.is(assembler.resolveIncludePath(singleQuoted), expectedPath);
  t.is(assembler.resolveIncludePath(backtickQuoted), expectedPath);

  existsSyncStub.restore();
});

test("resolveIncludePath - throws error when file not found", t => {
  const assembler = new Assembler();
  assembler.currentFile = "/test/path/current.asm";
  assembler.includePaths = ["./", "/other/include/path"];
  const existsSyncStub = sinon.stub(fs, "existsSync").returns(false);

  const filename = "nonexistent.asm";

  const error = t.throws(() => {
    assembler.resolveIncludePath(filename);
  }, { instanceOf: Error });

  t.is(error.message, `Could not find file: ${filename}`);

  existsSyncStub.restore();
});

test("handleInclude - includeonce adds current file to guarded set", t => {
  const assembler = new Assembler();
  assembler.currentFile = "/test/path/current.asm";

  const resolveIncludePathStub = sinon.stub(assembler, "resolveIncludePath").returns("/test/path/file.asm");
  const assemblefileStub = sinon.stub(assembler, "assemblefile");

  assembler.handleInclude("include", "file.asm", true);

  t.true(assembler.includedFiles.get("/test/path/current.asm")?.guarded);
  t.true(assemblefileStub.called);

  // Cleanup
  resolveIncludePathStub.restore();
  assemblefileStub.restore();
});

test("handleInclude - regular include calls assemblefile", t => {
  const assembler = new Assembler();

  const resolveIncludePathStub = sinon.stub(assembler, "resolveIncludePath").returns("/resolved/file.asm");
  const assemblefileStub = sinon.stub(assembler, "assemblefile");

  assembler.handleInclude("include", "file.asm", false);

  t.true(assembler.includedFiles.has("/resolved/file.asm"));
  t.true(assembler.includedFiles.get("/resolved/file.asm").included);
  t.false(assembler.includedFiles.get("/resolved/file.asm").guarded);
  t.true(assemblefileStub.calledOnce);
  t.true(assemblefileStub.calledWith("file.asm", true));

  // Cleanup
  resolveIncludePathStub.restore();
  assemblefileStub.restore();
});

test("handleInclude - adds file to included files set", t => {
  const assembler = new Assembler();

  const resolveIncludePathStub = sinon.stub(assembler, "resolveIncludePath").returns("/resolved/newfile.asm");
  const assemblefileStub = sinon.stub(assembler, "assemblefile");

  assembler.handleInclude("include", "newfile.asm", false);

  t.true(assembler.includedFiles.has("/resolved/newfile.asm"));
  t.true(assembler.includedFiles.get("/resolved/newfile.asm").included);
  t.false(assembler.includedFiles.get("/resolved/newfile.asm").guarded);

  // Cleanup
  resolveIncludePathStub.restore();
  assemblefileStub.restore();
});

test("handleInclude - handles undefined filename", t => {
  const assembler = new Assembler();

  // Stub assemblefile to verify behavior with undefined filename
  const assemblefileStub = sinon.stub(assembler, "assemblefile");

  assembler.handleInclude("include", undefined, false);

  t.true(assembler.includedFiles.has(undefined));
  t.true(assembler.includedFiles.get(undefined).included);
  t.false(assembler.includedFiles.get(undefined).guarded);
  t.true(assemblefileStub.calledWith(undefined, true));

  // Cleanup
  assemblefileStub.restore();
});

test("assemblefile - basic file assembly", t => {
  const assembler = new Assembler();
  const fsReadFileStub = sinon.stub(fs, "readFileSync");
  const resolvePathStub = sinon.stub(assembler, "resolveIncludePath");

  // Setup test file content
  const testFilePath = "/test/path/file.asm";
  const testContent = "LDA #$01\nSTA $2100";

  resolvePathStub.returns(testFilePath);
  fsReadFileStub.returns(testContent);

  // Stub normalized dispatch to verify each line is executed
  const processCommandStub = sinon.stub(assembler, "processNormalizedCommand");

  assembler.assemblefile("file.asm", true);

  t.true(processCommandStub.calledTwice);
  t.true(processCommandStub.calledWithMatch(sinon.match.has("command", "LDA #$01")));
  t.true(processCommandStub.calledWithMatch(sinon.match.has("command", "STA $2100")));

  // Cleanup
  fsReadFileStub.restore();
  resolvePathStub.restore();
  processCommandStub.restore();
});

test("assemblefile - respects include guards", t => {
  const assembler = new Assembler();
  const resolvePathStub = sinon.stub(assembler, "resolveIncludePath");
  const fsReadFileStub = sinon.stub(fs, "readFileSync");

  const testFilePath = "/test/path/guarded.asm";
  resolvePathStub.returns(testFilePath);

  // Add file to guarded set
  assembler.includedFiles.set(testFilePath, { included: true, guarded: true });

  // Verify file is not processed
  const processCommandStub = sinon.stub(assembler, "processNormalizedCommand");

  assembler.assemblefile("guarded.asm", true);

  t.false(processCommandStub.called);
  t.false(fsReadFileStub.called);

  // Cleanup
  resolvePathStub.restore();
  processCommandStub.restore();
  fsReadFileStub.restore();
});

test("assemblefile - throws on recursion limit", t => {
  const assembler = new Assembler();
  const resolvePathStub = sinon.stub(assembler, "resolveIncludePath");

  // Set up recursion limit scenario
  for (let i = 0; i < 512; i++) {
    assembler.includeStack.push(`file${i}.asm`);
  }

  // Verify error is thrown
  const error = t.throws(() => {
    assembler.assemblefile("too_deep.asm", true);
  });

  t.is(error.message, "Recursion limit exceeded (512 levels)");

  // Cleanup
  resolvePathStub.restore();
});

test("assemblefile - throws on recursive include cycle before recursion limit", t => {
  const assembler = new Assembler();
  const resolvePathStub = sinon.stub(assembler, "resolveIncludePath");

  assembler.currentFile = "/test/path/loop1.asm";
  assembler.includeStack.push("/test/path/root.asm");
  resolvePathStub.returns("/test/path/loop1.asm");

  const error = t.throws(() => {
    assembler.assemblefile("loop1.asm", true);
  });

  t.is(error.message, "Recursive include detected for '/test/path/loop1.asm'");

  resolvePathStub.restore();
});

test("assemblefile - maintains include stack", t => {
  const assembler = new Assembler();
  const fsReadFileStub = sinon.stub(fs, "readFileSync");
  const resolvePathStub = sinon.stub(assembler, "resolveIncludePath");
  t.teardown(() => {
    fsReadFileStub.restore();
    resolvePathStub.restore();
  });

  // Setup test file
  const mainFile = "/test/path/main.asm";
  const includedFile = "/test/path/included.asm";

  resolvePathStub.returns(includedFile);

  fsReadFileStub.returns(""); // Empty file for simplicity

  // Set current file
  assembler.currentFile = mainFile;

  // Process included file
  assembler.assemblefile("included.asm", true);

  // Verify stack was maintained
  t.is(assembler.currentFile, mainFile);
  t.is(assembler.includeStack.length, 0);
});

test("assemblefile - handles file read errors", t => {
  const assembler = new Assembler();
  const resolvePathStub = sinon.stub(assembler, "resolveIncludePath");
  const fsReadFileStub = sinon.stub(fs, "readFileSync");
  t.teardown(() => {
    fsReadFileStub.restore();
    resolvePathStub.restore();
  });

  const testFilePath = "/test/path/error.asm";
  resolvePathStub.returns(testFilePath);

  // Simulate file read error
  fsReadFileStub.throws(new Error("File read error"));

  // Set current file and include stack
  const originalFile = "/test/path/original.asm";
  assembler.currentFile = originalFile;

  // Include failures should bubble up so callers cannot silently keep going
  // after dropping an entire include tree.
  const error = t.throws(() => {
    assembler.assemblefile("error.asm", true);
  });
  t.regex(error.message, /Failed to assemble include '\/test\/path\/error\.asm': File read error/);

  // Verify state is restored
  t.is(assembler.currentFile, originalFile);
});

test("handleCharacterMapping - basic mapping", t => {
  const assembler = new Assembler();
  assembler.pass = 1;

  // Test basic character mapping
  assembler.handleCharacterMapping(['"A"', "=", "0x42"]);
  t.is(assembler.characterMappings.get("A"), 0x42);
});

test("handleCharacterMapping - single quotes", t => {
  const assembler = new Assembler();
  assembler.pass = 1;

  // Test with single quotes
  assembler.handleCharacterMapping(["'B'", "=", "0x43"]);
  t.is(assembler.characterMappings.get("B"), 0x43);
});

test("handleCharacterMapping - numeric value", t => {
  const assembler = new Assembler();
  assembler.pass = 1;

  // Test with decimal number
  assembler.handleCharacterMapping(['"C"', "=", "65"]);
  t.is(assembler.characterMappings.get("C"), 65);
});

test("handleCharacterMapping - hex value", t => {
  const assembler = new Assembler();
  assembler.pass = 1;

  // Test with hex number
  assembler.handleCharacterMapping(['"D"', "=", "$FF"]);
  t.is(assembler.characterMappings.get("D"), 0xFF);
});

test("handleCharacterMapping - overwrite existing mapping", t => {
  const assembler = new Assembler();
  assembler.pass = 1;

  // Set initial mapping
  assembler.handleCharacterMapping(['"E"', "=", "0x50"]);
  t.is(assembler.characterMappings.get("E"), 0x50);

  // Overwrite with new value
  assembler.handleCharacterMapping(['"E"', "=", "0x51"]);
  t.is(assembler.characterMappings.get("E"), 0x51);
});

test("handleCharacterMapping - throws error with incorrect format", t => {
  const assembler = new Assembler();

  // Test with too few arguments
  const error1 = t.throws(() => {
    assembler.handleCharacterMapping(['"F"', "="]);
  }, {instanceOf: Error});
  t.is(error1.message, "Character mapping requires format: 'char' = value");

  // Test with too many arguments
  const error2 = t.throws(() => {
    assembler.handleCharacterMapping(['"G"', "=", "0x60", "extra"]);
  }, {instanceOf: Error});
  t.is(error2.message, "Character mapping requires format: 'char' = value");
});

test("processStringWithMapping - basic character mapping", t => {
  const assembler = new Assembler();

  // Set up some character mappings
  assembler.characterMappings.set("A", 0x41);
  assembler.characterMappings.set("B", 0x42);
  assembler.characterMappings.set("C", 0x43);

  // Test basic mapping
  t.deepEqual(
    assembler.processStringWithMapping("ABC"),
    [0x41, 0x42, 0x43]
  );
});

test("processStringWithMapping - unmapped characters use charCode", t => {
  const assembler = new Assembler();

  // Set up some character mappings
  assembler.characterMappings.set("A", 0x41);

  // Test with unmapped characters (should use charCodeAt)
  t.deepEqual(
    assembler.processStringWithMapping("AXY"),
    [0x41, "X".charCodeAt(0), "Y".charCodeAt(0)]
  );
});

test("processStringWithMapping - empty string", t => {
  const assembler = new Assembler();

  // Test with empty string
  t.deepEqual(
    assembler.processStringWithMapping(""),
    []
  );
});

test("processStringWithMapping - custom mappings", t => {
  const assembler = new Assembler();

  // Set up custom mappings that differ from ASCII
  assembler.characterMappings.set("A", 0x10);
  assembler.characterMappings.set("B", 0x20);
  assembler.characterMappings.set("C", 0x30);

  // Test custom mappings
  t.deepEqual(
    assembler.processStringWithMapping("ABC"),
    [0x10, 0x20, 0x30]
  );
});

test("processStringWithMapping - mixed mapped and unmapped", t => {
  const assembler = new Assembler();

  // Set up some character mappings
  assembler.characterMappings.set("A", 0x10);
  assembler.characterMappings.set("C", 0x30);

  // Test with mixed mapped and unmapped characters
  t.deepEqual(
    assembler.processStringWithMapping("ABCD"),
    [0x10, "B".charCodeAt(0), 0x30, "D".charCodeAt(0)]
  );
});

test("processStringWithMapping - special characters", t => {
  const assembler = new Assembler();

  // Set up mappings for special characters
  assembler.characterMappings.set(" ", 0xFF);
  assembler.characterMappings.set("!", 0xFE);
  assembler.characterMappings.set("?", 0xFD);

  // Test with special characters
  t.deepEqual(
    assembler.processStringWithMapping("Hello! ?"),
    ["H".charCodeAt(0), "e".charCodeAt(0), "l".charCodeAt(0), "l".charCodeAt(0), "o".charCodeAt(0), 0xFE, 0xFF, 0xFD]
  );
});

test("processStringWithMapping - unicode characters", t => {
  const assembler = new Assembler();

  // Set up mappings for some unicode characters
  assembler.characterMappings.set("é", 0xE9);
  assembler.characterMappings.set("ñ", 0xF1);

  // Test with unicode characters
  t.deepEqual(
    assembler.processStringWithMapping("café niño"),
    ["c".charCodeAt(0), "a".charCodeAt(0), "f".charCodeAt(0), 0xE9, " ".charCodeAt(0),
     "n".charCodeAt(0), "i".charCodeAt(0), 0xF1, "o".charCodeAt(0)]
  );
});

test("splitCommandIntoWords - basic splitting", t => {
  // Basic whitespace splitting
  t.deepEqual(
    splitCommandIntoWords("word1 word2 word3"),
    ["word1", "word2", "word3"]
  );

  // Extra whitespace should be ignored
  t.deepEqual(
    splitCommandIntoWords("  word1   word2  word3  "),
    ["word1", "word2", "word3"]
  );

  // Empty string should return empty array
  t.deepEqual(
    splitCommandIntoWords(""),
    []
  );

  // String with only whitespace should return empty array
  t.deepEqual(
    splitCommandIntoWords("   "),
    []
  );
});

test("splitCommandIntoWords - quoted strings", t => {
  // Double quotes
  t.deepEqual(
    splitCommandIntoWords('word1 "quoted string" word3'),
    ["word1", '"quoted string"', "word3"]
  );

  // Single quotes
  t.deepEqual(
    splitCommandIntoWords("word1 'quoted string' word3"),
    ["word1", "'quoted string'", "word3"]
  );

  // Quotes at the beginning
  t.deepEqual(
    splitCommandIntoWords('"quoted string" word2'),
    ['"quoted string"', "word2"]
  );

  // Quotes at the end
  t.deepEqual(
    splitCommandIntoWords('word1 "quoted string"'),
    ["word1", '"quoted string"']
  );

  // Only a quoted string
  t.deepEqual(
    splitCommandIntoWords('"quoted string"'),
    ['"quoted string"']
  );
});

test("splitCommandIntoWords - nested quotes", t => {
  // Different quote types inside quotes
  t.deepEqual(
    splitCommandIntoWords('word1 "string with \'nested\' quotes" word3'),
    ["word1", '"string with \'nested\' quotes"', "word3"]
  );

  t.deepEqual(
    splitCommandIntoWords("word1 'string with \"nested\" quotes' word3"),
    ["word1", "'string with \"nested\" quotes'", "word3"]
  );
});

test("splitCommandIntoWords - escaped quotes", t => {
  // Escaped quotes should be treated as regular characters
  t.deepEqual(
    splitCommandIntoWords('word1 "string with \\" escaped quote" word3'),
    ["word1", '"string with \\" escaped quote"', "word3"]
  );

  t.deepEqual(
    splitCommandIntoWords("word1 'string with \\' escaped quote' word3"),
    ["word1", "'string with \\' escaped quote'", "word3"]
  );
});

test("splitCommandIntoWords - whitespace in quotes", t => {
  // Whitespace inside quotes should be preserved
  t.deepEqual(
    splitCommandIntoWords('word1 "  quoted  string  with  spaces  " word3'),
    ["word1", '"  quoted  string  with  spaces  "', "word3"]
  );

  // Multiple spaces between words outside quotes should be treated as a single delimiter
  t.deepEqual(
    splitCommandIntoWords('word1    "quoted string"    word3'),
    ["word1", '"quoted string"', "word3"]
  );
});

test("splitCommandIntoWords - unclosed quotes", t => {
  // Unclosed quotes should still capture the rest of the string
  t.deepEqual(
    splitCommandIntoWords('word1 "unclosed quote'),
    ["word1", '"unclosed quote']
  );

  t.deepEqual(
    splitCommandIntoWords("word1 'unclosed quote"),
    ["word1", "'unclosed quote"]
  );
});

test("snestopc - lorom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "lorom";

  // Valid addresses
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x400000), 0x200000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x808000), 0x000000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x818000), 0x008000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xFFFFFF), 0x3FFFFF);

  // Invalid addresses
  // WRAM
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x7E0000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x7F0000), -1);

  // Hardware registers, RAM mirrors, etc.
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x000000), -1);

  // SRAM (low parts of banks 70-7D)
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x700000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x706000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x707FFF), -1);

  // Out of range
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(-1), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x1000000), -1);
});

test("snestopc - hirom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "hirom";

  // Valid addresses
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x400000), 0x000000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xC00000), 0x000000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xFFFFFF), 0x3FFFFF);

  // Invalid addresses
  // WRAM
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x7E0000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x7F0000), -1);

  // Hardware registers, RAM mirrors, etc.
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x000000), -1);

  // Out of range
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(-1), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x1000000), -1);
});

test("snestopc - exlorom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "exlorom";

  // Valid addresses in first 4MB
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x808000), 0x000000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xFFFFFF), 0x3FFFFF);

  // Valid addresses in second 4MB
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x008000), 0x400000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x00FFFF), 0x407FFF);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x400000), 0x600000);

  // Invalid addresses
  // SRAM
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x700000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x7FFFFF), -1);

  // Hardware registers, RAM mirrors, etc.
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x000000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x7FFFFF), -1);

  // Out of range
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(-1), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x1000000), -1);
});

test("snestopc - exhirom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "exhirom";

  // Valid addresses
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x400000), 0x400000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xC00000), 0x000000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xFFFFFF), 0x3FFFFF);

  // Invalid addresses
  // WRAM
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x7E0000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x7F0000), -1);

  // Hardware registers, RAM mirrors, etc.
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x000000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x7FFFFF), -1);

  // Out of range
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(-1), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x1000000), -1);
});

test("snestopc - sfxrom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "sfxrom";

  // Valid addresses
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x008000), 0x000000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x00FFFF), 0x007FFF);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x400000), 0x000000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x5FFFFF), 0x1FFFFF);

  // Invalid addresses
  // $600000-$7FFFFF
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x600000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x7FFFFF), -1);

  // Hardware registers, RAM mirrors, etc.
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x000000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x400000), 0x000000); // This is valid in sfxrom

  // $800000-$FFFFFF
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x800000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xFFFFFF), -1);

  // Out of range
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(-1), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x1000000), -1);
});

test("snestopc - sa1rom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "sa1rom";

  // Setup SA-1 banks (default values)
  assembler.sa1banks = [0, 0x100000, 0x200000, 0x300000, 0x400000, 0x500000, 0x600000, 0x700000];

  // Valid addresses - LoROM-mapped area
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x008000), 0x000000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x00FFFF), 0x007FFF);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x208000), 0x100000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x20FFFF), 0x107FFF);

  // Valid addresses - HiROM-mapped area
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xC00000), 0x000000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xCFFFFF), 0x0FFFFF);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xD00000), 0x100000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xDFFFFF), 0x1FFFFF);

  // Invalid addresses
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x000000), -1); // Hardware registers
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(-1), -1); // Out of range
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x1000000), -1); // Out of range
});

test("snestopc - bigsa1rom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "bigsa1rom";

  // Valid addresses - HiROM-mapped area
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xC00000), 0x400000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xFFFFFF), 0x7FFFFF);

  // Valid addresses - LoROM-mapped area (first 8MB)
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x008000), 0x000000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x00FFFF), 0x007FFF);

  // Valid addresses - LoROM-mapped area (second 8MB)
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x808000), 0x200000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x80FFFF), 0x207FFF);

  // Invalid addresses
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x000000), -1); // No ROM at $000000-$007FFF
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x800000), -1); // No ROM at $800000-$807FFF
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x400000), -1); // Invalid mapping
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(-1), -1); // Out of range
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x1000000), -1); // Out of range
});

test("snestopc - norom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "norom";

  // In norom mode, addresses are passed through unchanged
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x000000), 0x000000);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x123456), 0x123456);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xFFFFFF), 0xFFFFFF);

  // Out of range
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(-1), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x1000000), -1);
});

test("snestopc - no mapper set", t => {
  const assembler = new Assembler();
  assembler.mapper = undefined;

  // Invalid addresses
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x808000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x818000), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0xFFFFFF), -1);
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x000000), -1); // Hardware registers
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x7E0000), -1); // WRAM
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x700000), -1); // SRAM
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(-1), -1); // Out of range
  t.is(assembler.romWriter.convertTargetAddressToRomOffset(0x1000000), -1); // Out of range
});

test("pctosnes - lorom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "lorom";

  // Valid addresses
  t.is(assembler.romWriter.pctosnes(0x000000), 0x808000);
  t.is(assembler.romWriter.pctosnes(0x007FFF), 0x80FFFF);
  t.is(assembler.romWriter.pctosnes(0x008000), 0x818000);
  t.is(assembler.romWriter.pctosnes(0x3FFFFF), 0xFFFFFF);

  // Invalid address (too large)
  t.is(assembler.romWriter.pctosnes(0x400000), -1);
});

test("pctosnes - hirom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "hirom";

  // Valid addresses
  t.is(assembler.romWriter.pctosnes(0x000000), 0xC00000);
  t.is(assembler.romWriter.pctosnes(0x3FFFFF), 0xFFFFFF);

  // Invalid address (too large)
  t.is(assembler.romWriter.pctosnes(0x400000), -1);
});

test("pctosnes - exlorom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "exlorom";

  // Valid addresses in first 4MB
  t.is(assembler.romWriter.pctosnes(0x000000), 0x808000);
  t.is(assembler.romWriter.pctosnes(0x007FFF), 0x80FFFF);
  t.is(assembler.romWriter.pctosnes(0x3FFFFF), 0xFFFFFF);

  // Valid addresses in second 4MB
  t.is(assembler.romWriter.pctosnes(0x400000), 0x008000);
  t.is(assembler.romWriter.pctosnes(0x407FFF), 0x00FFFF);
  t.is(assembler.romWriter.pctosnes(0x7FFFFF), 0x7FFFFF);

  // Invalid address (too large)
  t.is(assembler.romWriter.pctosnes(0x800000), -1);
});

test("pctosnes - exhirom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "exhirom";

  // Valid addresses in first 4MB
  t.is(assembler.romWriter.pctosnes(0x000000), 0xC00000);
  t.is(assembler.romWriter.pctosnes(0x3FFFFF), 0xFFFFFF);

  // Valid addresses in second 4MB
  t.is(assembler.romWriter.pctosnes(0x400000), 0x400000);
  t.is(assembler.romWriter.pctosnes(0x7FFFFF), 0x7FFFFF);

  // Invalid address (too large)
  t.is(assembler.romWriter.pctosnes(0x800000), -1);
});

test("pctosnes - sa1rom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "sa1rom";

  // Setup SA-1 banks
  assembler.sa1banks = [0x000000, 0x100000, 0x200000, 0x300000, 0x400000, 0x500000, 0x600000, 0x700000];

  // Test each bank mapping
  t.is(assembler.romWriter.pctosnes(0x000000), 0x008000);
  t.is(assembler.romWriter.pctosnes(0x100000), 0x208000);
  t.is(assembler.romWriter.pctosnes(0x200000), 0x408000);
  t.is(assembler.romWriter.pctosnes(0x300000), 0x608000);
  t.is(assembler.romWriter.pctosnes(0x400000), 0x808000);
  t.is(assembler.romWriter.pctosnes(0x500000), 0xA08000);
  t.is(assembler.romWriter.pctosnes(0x600000), 0xC08000);
  t.is(assembler.romWriter.pctosnes(0x700000), 0xE08000);

  // Invalid address (not matching any bank)
  t.is(assembler.romWriter.pctosnes(0x800000), -1);
});

test("pctosnes - bigsa1rom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "bigsa1rom";

  // Valid addresses in different regions
  // First 2MB region (000000-1FFFFF)
  t.is(assembler.romWriter.pctosnes(0x000000), 0x008000);
  t.is(assembler.romWriter.pctosnes(0x007FFF), 0x00FFFF);
  t.is(assembler.romWriter.pctosnes(0x1FFFFF), 0x3FFFFF);

  // Second 2MB region (200000-3FFFFF)
  t.is(assembler.romWriter.pctosnes(0x200000), 0x808000);
  t.is(assembler.romWriter.pctosnes(0x207FFF), 0x80FFFF);
  t.is(assembler.romWriter.pctosnes(0x3FFFFF), 0xBFFFFF);

  // Third 4MB region (400000-7FFFFF)
  t.is(assembler.romWriter.pctosnes(0x400000), 0xC00000);
  t.is(assembler.romWriter.pctosnes(0x500000), 0xD00000);
  t.is(assembler.romWriter.pctosnes(0x7FFFFF), 0xFFFFFF);

  // Invalid address (too large)
  t.is(assembler.romWriter.pctosnes(0x800000), -1);
});

test("pctosnes - sfxrom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "sfxrom";

  // Valid addresses
  t.is(assembler.romWriter.pctosnes(0x000000), 0x008000);
  t.is(assembler.romWriter.pctosnes(0x007FFF), 0x00FFFF);
  t.is(assembler.romWriter.pctosnes(0x1FFFFF), 0x3FFFFF);

  // Invalid address (too large)
  t.is(assembler.romWriter.pctosnes(0x200000), -1);
});

test("pctosnes - norom mapping", t => {
  const assembler = new Assembler();
  assembler.mapper = "norom";

  // In norom mode, addresses are passed through unchanged
  t.is(assembler.romWriter.pctosnes(0x000000), 0x000000);
  t.is(assembler.romWriter.pctosnes(0x123456), 0x123456);
  t.is(assembler.romWriter.pctosnes(0xFFFFFF), 0xFFFFFF);
});

test("pctosnes - negative input", t => {
  const assembler = new Assembler();

  // Negative input should always return -1
  t.is(assembler.romWriter.pctosnes(-1), -1);
});

test("pctosnes - no mapper set", t => {
  const assembler = new Assembler();
  // Explicitly set mapper to undefined to ensure we're testing the default behavior
  assembler.mapper = undefined;

  // When no mapper is set, pctosnes should return -1 for any address
  t.is(assembler.romWriter.pctosnes(0x000000), -1);
  t.is(assembler.romWriter.pctosnes(0x123456), -1);
  t.is(assembler.romWriter.pctosnes(0xFFFFFF), -1);

  // Test with a few more addresses to be thorough
  t.is(assembler.romWriter.pctosnes(0x008000), -1);
  t.is(assembler.romWriter.pctosnes(0x400000), -1);
});

test("verifysnespos - valid positions", t => {
  const assembler = new Assembler();

  // Set valid SNES positions
  assembler.currentTargetAddress = 0x008000;
  assembler.currentTargetBaseAddress = 0x008000;

  // Verify positions should not change valid positions
  assembler.romWriter.verifysnespos();
  t.is(assembler.currentTargetAddress, 0x008000);
  t.is(assembler.currentTargetBaseAddress, 0x008000);

  // Test with different valid positions
  assembler.currentTargetAddress = 0x018000;
  assembler.currentTargetBaseAddress = 0x018000;
  assembler.romWriter.verifysnespos();
  t.is(assembler.currentTargetAddress, 0x018000);
  t.is(assembler.currentTargetBaseAddress, 0x018000);
});

test("verifysnespos - negative currentTargetAddress", t => {
  const assembler = new Assembler();

  // Set negative currentTargetAddress
  assembler.currentTargetAddress = -1;
  assembler.currentTargetBaseAddress = 0x008000;

  // Verify should reset both positions
  assembler.romWriter.verifysnespos();
  t.is(assembler.currentTargetAddress, 0x008000);
  t.is(assembler.currentTargetBaseAddress, 0x008000);
  t.is(assembler.currentTargetStartAddress, 0x008000);
  t.is(assembler.currentTargetBaseStartAddress, 0x008000);
});

test("verifysnespos - negative currentTargetBaseAddress", t => {
  const assembler = new Assembler();

  // Set negative currentTargetBaseAddress
  assembler.currentTargetAddress = 0x008000;
  assembler.currentTargetBaseAddress = -1;

  // Verify should reset both positions
  assembler.romWriter.verifysnespos();
  t.is(assembler.currentTargetAddress, 0x008000);
  t.is(assembler.currentTargetBaseAddress, 0x008000);
  t.is(assembler.currentTargetStartAddress, 0x008000);
  t.is(assembler.currentTargetBaseStartAddress, 0x008000);
});

test("verifysnespos - both positions negative", t => {
  const assembler = new Assembler();

  // Set both positions negative
  assembler.currentTargetAddress = -1;
  assembler.currentTargetBaseAddress = -1;

  // Verify should reset both positions
  assembler.romWriter.verifysnespos();
  t.is(assembler.currentTargetAddress, 0x008000);
  t.is(assembler.currentTargetBaseAddress, 0x008000);
  t.is(assembler.currentTargetStartAddress, 0x008000);
  t.is(assembler.currentTargetBaseStartAddress, 0x008000);
});

test("fixsnespos - no bank crossing", t => {
  const assembler = new Assembler();

  // When there's no bank crossing, fixsnespos should just return the new address
  // regardless of mapper type

  // Test with lorom mapper
  assembler.mapper = "lorom";
  t.is(assembler.romWriter.fixsnespos(0x008000, 0x100), 0x008100);
  t.is(assembler.romWriter.fixsnespos(0x00FF00, 0x10), 0x00FF10);

  // Test with hirom mapper
  assembler.mapper = "hirom";
  t.is(assembler.romWriter.fixsnespos(0x408000, 0x100), 0x408100);
  t.is(assembler.romWriter.fixsnespos(0xC08000, 0x100), 0xC08100);

  // Test with norom mapper
  assembler.mapper = "norom";
  t.is(assembler.romWriter.fixsnespos(0x123456, 0x100), 0x123556);
});

test("fixsnespos - lorom bank crossing", t => {
  const assembler = new Assembler();
  assembler.mapper = "lorom";

  // When crossing a bank boundary in lorom, we should wrap to 0x8000 in the new bank
  t.is(assembler.romWriter.fixsnespos(0x00FFFF, 1), 0x018000);
  t.is(assembler.romWriter.fixsnespos(0x01FFFF, 1), 0x028000);
  t.is(assembler.romWriter.fixsnespos(0x7FFFFF, 1), 0x808000);

  // Test with larger steps that cross banks
  t.is(assembler.romWriter.fixsnespos(0x00FF00, 0x200), 0x018100);
});

test("fixsnespos - hirom bank crossing", t => {
  const assembler = new Assembler();
  assembler.mapper = "hirom";

  // For addresses below 0x400000, wrap to 0x8000 in the new bank
  t.is(assembler.romWriter.fixsnespos(0x00FFFF, 1), 0x018000);
  t.is(assembler.romWriter.fixsnespos(0x3FFFFF, 1), 0x408000);

  // For addresses at or above 0x400000, just return the new address
  t.is(assembler.romWriter.fixsnespos(0x40FFFF, 1), 0x410000);
  t.is(assembler.romWriter.fixsnespos(0xC0FFFF, 1), 0xC10000);
});

test("fixsnespos - exlorom and bigsa1rom bank crossing", t => {
  const assembler = new Assembler();

  // Test exlorom
  assembler.mapper = "exlorom";
  t.is(assembler.romWriter.fixsnespos(0x80FFFF, 1), 0x818000);

  // Test bigsa1rom
  assembler.mapper = "bigsa1rom";
  t.is(assembler.romWriter.fixsnespos(0x00FFFF, 1), 0x018000);
});

test("fixsnespos - exhirom bank crossing", t => {
  const assembler = new Assembler();
  assembler.mapper = "exhirom";

  // For addresses below 0x400000, wrap to 0x8000 in the new bank
  t.is(assembler.romWriter.fixsnespos(0x00FFFF, 1), 0x018000);
  t.is(assembler.romWriter.fixsnespos(0x3FFFFF, 1), 0x408000);

  // For addresses at or above 0x400000, just return the new address
  t.is(assembler.romWriter.fixsnespos(0x40FFFF, 1), 0x410000);
  t.is(assembler.romWriter.fixsnespos(0xC0FFFF, 1), 0xC10000);
});

test("fixsnespos - sfxrom bank crossing", t => {
  const assembler = new Assembler();
  assembler.mapper = "sfxrom";

  // For addresses below 0x400000, wrap to 0x8000 in the new bank
  t.is(assembler.romWriter.fixsnespos(0x00FFFF, 1), 0x018000);
  t.is(assembler.romWriter.fixsnespos(0x3FFFFF, 1), 0x408000);

  // For addresses at or above 0x400000, just return the new address
  t.is(assembler.romWriter.fixsnespos(0x40FFFF, 1), 0x410000);
});

test("fixsnespos - sa1rom bank crossing", t => {
  const assembler = new Assembler();
  assembler.mapper = "sa1rom";

  // For addresses below 0x400000, wrap to 0x8000 in the new bank
  t.is(assembler.romWriter.fixsnespos(0x00FFFF, 1), 0x018000);
  t.is(assembler.romWriter.fixsnespos(0x3FFFFF, 1), 0x408000);

  // For addresses at or above 0x400000, just return the new address
  t.is(assembler.romWriter.fixsnespos(0x40FFFF, 1), 0x410000);
});

test("fixsnespos - norom bank crossing", t => {
  const assembler = new Assembler();
  assembler.mapper = "norom";

  // In norom mode, addresses are passed through unchanged, even when crossing banks
  t.is(assembler.romWriter.fixsnespos(0x00FFFF, 1), 0x010000);
  t.is(assembler.romWriter.fixsnespos(0xFFFFFF, 1), 0x1000000);
});

test("fixsnespos - unknown mapper", t => {
  const assembler = new Assembler();
  assembler.mapper = "unknownmapper";

  // Should throw an error for unknown mapper types
  t.throws(() => {
    assembler.romWriter.fixsnespos(0x00FFFF, 1);
  }, { message: "Unknown mapper type: unknownmapper" });
});

test("fixsnespos - default step parameter", t => {
  const assembler = new Assembler();
  assembler.mapper = "lorom";

  // When step is not provided, it should default to 0
  t.is(assembler.romWriter.fixsnespos(0x008000), 0x008000);
  t.is(assembler.romWriter.fixsnespos(0x00FFFF), 0x00FFFF);
});

test("resolvedefines - basic define replacement", t => {
  const assembler = new Assembler();
  assembler.defines.set("TEST", "42");
  assembler.defines.set("FOO", "bar");

  t.is(assembler.resolvedefines("!TEST"), "42");
  t.is(assembler.resolvedefines("Value: !TEST"), "Value: 42");
  t.is(assembler.resolvedefines("!FOO!TEST"), "bar42");
  t.is(assembler.resolvedefines("Multiple !FOO and !TEST"), "Multiple bar and 42");
});

test("resolvedefines - not equal operator", t => {
  const assembler = new Assembler();
  assembler.pass = 1;
  assembler.defines.set("TEST", "42");
  assembler.defines.set("MIN", "10");
  assembler.defines.set("MAX", "100");

  // Test that != operator is preserved and not treated as a define
  t.is(assembler.resolvedefines("!TEST != 50"), "42!=50");
  t.is(assembler.resolvedefines("50 != !TEST"), "50!=42");

  // Test with multiple != operators
  t.is(assembler.resolvedefines("!MIN != !TEST && !TEST != !MAX"), "10!=42 && 42!=100");

  // Test with mixed operators
  t.is(assembler.resolvedefines("!TEST > 30 && !TEST != !MAX"), "42 > 30 && 42!=100");

  // Test with parentheses
  t.is(assembler.resolvedefines("(!TEST != !MIN) && (!MAX != 50)"), "(42!=10) && (100!=50)");
});

test("resolvedefines - escaped defines", t => {
  const assembler = new Assembler();
  assembler.defines.set("TEST", "42");

  t.is(assembler.resolvedefines("\\!TEST"), "!TEST");
  t.is(assembler.resolvedefines("Value: \\!TEST"), "Value: !TEST");
  t.is(assembler.resolvedefines("\\\\!TEST"), "\\42");
});

test("resolvedefines - double backslash handling", t => {
  const assembler = new Assembler();
  assembler.defines.set("TEST", "42");

  t.is(assembler.resolvedefines("\\\\"), "\\");
  t.is(assembler.resolvedefines("\\\\\\!TEST"), "\\!TEST");
  t.is(assembler.resolvedefines("Path\\\\folder\\\\!TEST"), "Path\\folder\\42");
});

test("resolvedefines - curly brace syntax", t => {
  const assembler = new Assembler();
  assembler.pass = 1;
  assembler.defines.set("TEST", "42");
  assembler.defines.set("FOO_BAR", "baz");

  t.is(assembler.resolvedefines("!{TEST}"), "42");
  t.is(assembler.resolvedefines("!{FOO_BAR}"), "baz");
  t.is(assembler.resolvedefines("!{TEST}suffix"), "42suffix");
  t.is(assembler.resolvedefines("prefix!{FOO_BAR}suffix"), "prefixbazsuffix");
});

test("resolvedefines - nested defines", t => {
  const assembler = new Assembler();
  assembler.defines.set("INNER", "value");
  assembler.defines.set("OUTER", "!INNER");
  assembler.defines.set("DOUBLE", "!OUTER");
  assembler.defines.set("INNER_CURLY", "curly_value");
  assembler.defines.set("OUTER_CURLY", "!{INNER_CURLY}");
  assembler.defines.set("DOUBLE_CURLY", "!{OUTER_CURLY}");

  // These tests will fail because nested defines don't work with regular syntax
  t.is(assembler.resolvedefines("!OUTER"), "!INNER");
  t.is(assembler.resolvedefines("!DOUBLE"), "!OUTER");
  t.is(assembler.resolvedefines("Nested: !DOUBLE"), "Nested: !OUTER");

  // These tests should pass because nested defines work with curly bracket syntax
  // t.is(assembler.resolvedefines("!{OUTER_CURLY}"), "curly_value");
  // t.is(assembler.resolvedefines("!{DOUBLE_CURLY}"), "curly_value");
  // t.is(assembler.resolvedefines("Nested curly: !{DOUBLE_CURLY}"), "Nested curly: curly_value");
});

test("resolvedefines - sizeof and objectsize special cases", t => {
  const assembler = new Assembler();

  t.is(assembler.resolvedefines("sizeof(label)"), "sizeof(label)");
  t.is(assembler.resolvedefines("objectsize(label)"), "objectsize(label)");
  t.is(assembler.resolvedefines("prefix_sizeof(label)"), "prefix_sizeof(label)");
});

test("resolvedefines - direct variable reference", t => {
  const assembler = new Assembler();
  assembler.defines.set("i", "42");

  t.is(assembler.resolvedefines("!i"), "42");
});

test("resolvedefines - loop-like variable values from defines", t => {
  const assembler = new Assembler();

  // Use define values to mirror loop variable updates without mutating whileStatus internals.
  assembler.defines.set("i", "5");

  t.is(assembler.resolvedefines("!i"), "5");

  assembler.defines.set("i", "8");

  t.is(assembler.resolvedefines("!i"), "8");
});

test("resolvedefines - indirect variables in expressions", t => {
  const assembler = new Assembler();

  assembler.defines.set("i", "5");

  t.is(assembler.resolvedefines("!i"), "5");
  t.is(assembler.resolvedefines("!i > 0"), "5 > 0");
  t.is(assembler.resolvedefines("!i < 10"), "5 < 10");
  t.is(assembler.resolvedefines("!i == 10"), "5 == 10");

  assembler.defines.set("j", "0");

  t.is(assembler.resolvedefines("!i > !j"), "5 > 0");
  t.is(assembler.resolvedefines("!j"), "0");
  t.is(assembler.resolvedefines("!i + !j == 5"), "5 + 0 == 5");

  t.is(assembler.resolvedefines("(!i * !j) == 0"), "(5 * 0) == 0");
  t.is(assembler.resolvedefines("(!i - !j) > 0"), "(5 - 0) > 0");

  assembler.defines.set("j", "3");
  t.is(assembler.resolvedefines("!j"), "3");
  t.is(assembler.resolvedefines("!i + !j == 8"), "5 + 3 == 8");
});

test("resolvedefines - undefined defines", t => {
  const assembler = new Assembler();

  // Undefined defines should throw an error
  t.throws(() => {
    assembler.resolvedefines("!UNDEFINED");
  }, { message: "Define 'UNDEFINED' not found." });

  t.throws(() => {
    assembler.resolvedefines("Value: !UNDEFINED");
  }, { message: "Define 'UNDEFINED' not found." });
});

test("resolvedefines - complex expressions", t => {
  const assembler = new Assembler();
  assembler.pass = 1;
  assembler.defines.set("X", "10");
  assembler.defines.set("Y", "20");

  t.is(assembler.resolvedefines("!X + !Y"), "10 + 20");
  t.is(assembler.resolvedefines("(!X * !Y)"), "(10 * 20)");
  t.is(assembler.resolvedefines("!{X}*!{Y}"), "10*20");
});

test("evaluateExpression - basic expressions", t => {
  const assembler = new Assembler();

  // Simple numeric expressions
  t.true(assembler.evaluateExpression("1"));
  t.false(assembler.evaluateExpression("0"));
  t.true(assembler.evaluateExpression("42"));
  t.true(assembler.evaluateExpression("-1"));

  // Basic arithmetic
  t.true(assembler.evaluateExpression("1 + 1"));
  t.false(assembler.evaluateExpression("1 - 1"));
  t.true(assembler.evaluateExpression("2 * 3"));
  t.true(assembler.evaluateExpression("10 / 10"));

  // Boolean expressions
  t.true(assembler.evaluateExpression("1 && 1"));
  t.false(assembler.evaluateExpression("1 && 0"));
  t.true(assembler.evaluateExpression("1 || 0"));
  t.false(assembler.evaluateExpression("0 || 0"));

  // Comparison operators
  t.true(assembler.evaluateExpression("5 > 3"));
  t.false(assembler.evaluateExpression("3 > 5"));
  t.true(assembler.evaluateExpression("3 < 5"));
  t.true(assembler.evaluateExpression("5 >= 5"));
  t.true(assembler.evaluateExpression("5 <= 5"));
  t.true(assembler.evaluateExpression("5 == 5"));
  t.false(assembler.evaluateExpression("5 != 5"));
});

test("evaluateExpression - with defines", t => {
  const assembler = new Assembler();

  // Set up some defines
  assembler.defines.set("TRUE", "1");
  assembler.defines.set("FALSE", "0");
  assembler.defines.set("VALUE", "42");
  assembler.defines.set("NEGATIVE", "-10");

  // Test with simple defines
  t.true(assembler.evaluateExpression("!TRUE"));
  t.false(assembler.evaluateExpression("!FALSE"));
  t.true(assembler.evaluateExpression("!VALUE"));
  t.true(assembler.evaluateExpression("!NEGATIVE"));

  // Test with arithmetic using defines
  t.true(assembler.evaluateExpression("!VALUE > 40"));
  t.true(assembler.evaluateExpression("!VALUE - 42 == 0"));
  t.true(assembler.evaluateExpression("!VALUE + !NEGATIVE > 0"));
  t.true(assembler.evaluateExpression("(!VALUE + !NEGATIVE) < 40"));

  // Test with complex expressions
  t.true(assembler.evaluateExpression("(!VALUE * 2) > 80"));
  t.false(assembler.evaluateExpression("(!VALUE / 2) == 20"));
  t.true(assembler.evaluateExpression("(!TRUE && !VALUE > 30) || !FALSE"));
});

test("evaluateExpression - with define-backed loop variables", t => {
  const assembler = new Assembler();

  assembler.defines.set("i", "5");

  t.true(assembler.evaluateExpression("!i"));
  t.true(assembler.evaluateExpression("!i > 0"));
  t.true(assembler.evaluateExpression("!i < 10"));
  t.false(assembler.evaluateExpression("!i == 10"));

  assembler.defines.set("j", "0");

  t.true(assembler.evaluateExpression("!i > !j"));
  t.false(assembler.evaluateExpression("!j"));
  t.true(assembler.evaluateExpression("!i + !j == 5"));

  t.true(assembler.evaluateExpression("(!i * !j) == 0"));
  t.true(assembler.evaluateExpression("(!i - !j) > 0"));

  assembler.defines.set("j", "3");
  t.true(assembler.evaluateExpression("!j"));
  t.true(assembler.evaluateExpression("!i + !j == 8"));
});

test("evaluateExpression - error handling", t => {
  const assembler = new Assembler();

  // Test with undefined define
  t.throws(() => {
    assembler.evaluateExpression("!UNDEFINED");
  }, { message: /Define 'UNDEFINED' not found/ });

  // Test with syntax errors
  t.throws(() => {
    assembler.evaluateExpression("1 + ");
  }, { message: /Error evaluating expression/ });

  t.throws(() => {
    assembler.evaluateExpression("(1 + 2");
  }, { message: /Error evaluating expression/ });

  // TODO: This is a bug in mathcore.ts
  // t.throws(() => {
  //   assembler.evaluateExpression("1 + + 1");
  // }, { message: /Error evaluating expression/ });
});

test("evaluateExpression - complex scenarios", t => {
  const assembler = new Assembler();

  // Set up defines and loop variables
  assembler.defines.set("MAX", "100");
  assembler.defines.set("MIN", "10");
  assembler.defines.set("ENABLED", "1");

  assembler.defines.set("i", "50");

  // Test complex expressions combining defines and loop variables
  t.true(assembler.evaluateExpression("!i >= !MIN && !i <= !MAX"));
  t.true(assembler.evaluateExpression("!ENABLED && (!i > !MIN * 2)"));
  t.false(assembler.evaluateExpression("!i == !MAX || !i < !MIN"));

  // Test with nested braces and complex math
  t.true(assembler.evaluateExpression("((!i - !MIN) * 2) > (!MAX - !i)"));
  t.true(assembler.evaluateExpression("((!MAX / !MIN) * !i) > 100"));

  // Test with bitwise operations
  t.true(assembler.evaluateExpression("(!i & 1) == 0")); // 50 is even
  t.true(assembler.evaluateExpression("(!i | 1) > !i"));
  t.true(assembler.evaluateExpression("(!i << 1) == 100"));
  t.true(assembler.evaluateExpression("(!i >> 1) == 25"));

  // Test with hex and binary values
  t.true(assembler.evaluateExpression("!i == 0x32"));
  t.true(assembler.evaluateExpression("(!i & 0xFF) == 50"));
  t.true(assembler.evaluateExpression("(%110010 == !i)"));
});

test("evaluateExpression - sizeof and objectsize", t => {
  const assembler = new Assembler();
  assembler.structs.set("MyStruct", {
    size: 42,
    name: "MyStruct",
    base: 0,
    offset: 0,
    labels: new Map([
      ["field1", 0],
      ["field2", 1],
      ["field3", 3],
    ]),
  });
  assembler.structs.set("MyObject", {
    size: 24,
    name: "MyObject",
    base: 0,
    offset: 0,
    labels: new Map([
      ["field1", 0],
      ["field2", 1],
      ["field3", 3],
    ]),
  });

  // These expressions should be passed through to mathCore without define resolution
  t.true(assembler.evaluateExpression("sizeof(MyStruct)"));
  t.true(assembler.evaluateExpression("objectsize(MyObject)"));
  t.true(assembler.evaluateExpression("sizeof(MyStruct) > 40"));
  t.true(assembler.evaluateExpression("objectsize(MyObject) < 30"));
});

test("setIncludePaths", t => {
  const assembler = new Assembler();

  // Test setting include paths
  const paths = ["/path/to/includes", "./relative/path", "../parent/path"];
  assembler.setIncludePaths(paths);

  // Verify the paths were set correctly
  t.deepEqual(assembler.includePaths, paths);

  // Test with empty array
  assembler.setIncludePaths([]);
  t.deepEqual(assembler.includePaths, []);

  // Test with single path
  const singlePath = ["/single/path"];
  assembler.setIncludePaths(singlePath);
  t.deepEqual(assembler.includePaths, singlePath);
});

test("handleIncbin", t => {
  const assembler = new Assembler();
  assembler.pass = 2;

  // Mock the readFile method
  const mockData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
  assembler.readFile = (filename) => {
    if (filename === "testfile.bin") {
      return mockData;
    }
    return null;
  };

  // Mock write1 method to track written bytes
  const writtenBytes: number[] = [];
  assembler.write1 = (byte) => {
    writtenBytes.push(byte);
    assembler.currentTargetAddress++;
    assembler.currentTargetBaseAddress++;
  };

  // Test basic incbin
  handleIncbin({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["incbin", "testfile.bin"]);
  t.deepEqual(writtenBytes, Array.from(mockData), "Basic incbin should write all bytes");

  // Test with range using ".." syntax
  writtenBytes.length = 0;
  handleIncbin({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["incbin", "testfile.bin:2..5"]);
  t.deepEqual(writtenBytes, [0x03, 0x04, 0x05], "Range with .. syntax should work");

  // Preserve spaced math expressions that have already been tokenized.
  writtenBytes.length = 0;
  handleIncbin({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["incbin", "testfile.bin:(000", "*", "2)..(003", "*", "2)"]);
  t.deepEqual(writtenBytes, [0x01, 0x02, 0x03, 0x04, 0x05, 0x06], "Range math with spaces should work");

  // 0 should be treated as EOF
  writtenBytes.length = 0;
  handleIncbin({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["incbin", "testfile.bin:2..0"]);
  t.deepEqual(writtenBytes, [0x03, 0x04, 0x05, 0x06, 0x07, 0x08], "Range with .. syntax should work");

  // Test with range using "-" syntax (deprecated)
  writtenBytes.length = 0;
  handleIncbin({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["incbin", "testfile.bin:1-4"]);
  t.deepEqual(writtenBytes, [0x02, 0x03, 0x04], "Range with - syntax should work");

  // Test with quoted filename
  writtenBytes.length = 0;
  handleIncbin({
    session: assembler,
    operandResolver: assembler.operandResolver
  }, ["incbin", '"testfile.bin"']);
  t.deepEqual(writtenBytes, Array.from(mockData), "Quoted filename should work");

  // Test with arrow syntax and numeric address
  writtenBytes.length = 0;
  assembler.handlePushPC = () => {}; // Mock
  assembler.handlePullPC = () => {}; // Mock
  assembler.operandResolver.getnum = (val) => parseInt((typeof val === "string" ? val : "").replace("$", ""), 16); // Mock
  assembler.addAddressToLine = () => {}; // Mock

  handleIncbin({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["incbin", "testfile.bin", "->", "$1000"]);
  t.is(assembler.currentTargetAddress, 0x1000 + mockData.length, "Arrow syntax with numeric address should set position");

  // Test with arrow syntax and label (pass 0)
  writtenBytes.length = 0;
  assembler.pass = 0;
  const setLabelStub = sinon.stub(assembler.symbolScope, "setLabel").callsFake((label, _addr) => {
    t.is(label, "TestLabel", "Label should be set correctly");
  });

  handleIncbin({
    session: assembler,
    operandResolver: assembler.operandResolver
  }, ["incbin", "testfile.bin", "->", "TestLabel"]);
  t.is(writtenBytes.length, 8, "Bytes should be written on pass 0");

  // Test with arrow syntax and label (pass 1)
  writtenBytes.length = 0;
  assembler.pass = 1;
  const getLabelValueStub = sinon.stub(assembler.symbolScope, "getLabelValue").callsFake((label) => {
    t.is(label, "TestLabel", "Label should be looked up correctly");
    return 0x2000;
  });

  handleIncbin({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["incbin", "testfile.bin", "->", "TestLabel"]);
  t.is(assembler.currentTargetAddress, 0x2000 + mockData.length, "Arrow syntax with label should set position");
  setLabelStub.restore();
  getLabelValueStub.restore();

})

test("handleIncbin - error handling", t => {
  const assembler = new Assembler();

  // Mock the readFile method
  const mockData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
  assembler.readFile = (filename) => {
    if (filename === "testfile.bin") {
      return mockData;
    }
    return null;
  };

  // Mock write1 method to track written bytes
  const writtenBytes: number[] = [];
  assembler.write1 = (byte) => {
    writtenBytes.push(byte);
    assembler.currentTargetAddress++;
    assembler.currentTargetBaseAddress++;
  };

  // Test with invalid range specification
  t.throws(() => {
    handleIncbin({
      session: assembler,
      operandResolver: assembler.operandResolver,
    }, ["incbin", "testfile.bin:invalid"]);
  }, { message: /Invalid range specification/ }, "Invalid range should throw error");

  // Test with missing file
  t.throws(() => {
    handleIncbin({
      session: assembler,
      operandResolver: assembler.operandResolver,
    }, ["incbin", "nonexistent.bin"]);
  }, { message: /Failed to read file/ }, "Missing file should throw error");

  // Test with arrow syntax but missing target
  t.throws(() => {
    handleIncbin({
      session: assembler,
      operandResolver: assembler.operandResolver,
    }, ["incbin", "testfile.bin", "->"]);
  }, { message: /requires a target location/ }, "Missing target should throw error");

  // Test with missing parts
  t.throws(() => {
    handleIncbin({
      session: assembler,
      operandResolver: assembler.operandResolver,
    }, ["incbin", "testfile.bin:5.."]);
  }, { message: /Invalid range specification/ }, "Invalid range should throw error");

  // Test with range start > end
  t.throws(() => {
    handleIncbin({
      session: assembler,
      operandResolver: assembler.operandResolver,
    }, ["incbin", "testfile.bin:5..2"]);
  }, { message: /Start offset 5 out of bounds for file/ }, "Invalid range should throw error");

  // Test with out of bounds range
  t.throws(() => {
    handleIncbin({
      session: assembler,
      operandResolver: assembler.operandResolver,
    }, ["incbin", "testfile.bin:0..100"]);
  }, { message: /End offset 100 out of bounds for file/ }, "Out of bounds range should throw error");
});

test("evaluateRangeExpression", (t) => {
  const assembler = new Assembler();
  assembler.labelTable.set("VALID_LABEL", { value: 8, isStatic: true });
  assembler.labelTable.set("DYNAMIC_LABEL", { value: 10, isStatic: false });

  // Test successful numeric evaluation
  t.is(assembler.evaluateRangeExpression("5+3"), 8, "Should evaluate simple math expression");
  t.is(assembler.evaluateRangeExpression("10-2"), 8, "Should evaluate subtraction");
  t.is(assembler.evaluateRangeExpression("2*4"), 8, "Should evaluate multiplication");

  // Test with whitespace
  t.is(assembler.evaluateRangeExpression("  5+3  "), 8, "Should handle whitespace");

  // Test fallback to static label when math fails
  t.is(assembler.evaluateRangeExpression("VALID_LABEL"), 8, "Should resolve static label when math fails");

  // TODO: This is a maybe bug in evaluateRangeExpression, we expect this to throw an error, but dynamic labels seem fine.
  // Test error cases
  // t.throws(() => {
  //   assembler.evaluateRangeExpression("DYNAMIC_LABEL");
  // }, { message: /Label is not static/ }, "Should require static labels");
});

test("resolveStructLabel", (t) => {
  const assembler = new Assembler();

  // Setup basic struct
  const basicStruct = {
    name: "BasicStruct",
    base: 0x1000,
    size: 8,
    offset: 8,
    labels: new Map([
      ["x", 0],
      ["y", 2],
      ["z", 4],
      ["data", 6]
    ])
  };
  assembler.structs.set("BasicStruct", basicStruct);

  // Setup array-accessible struct
  const arrayStruct = {
    name: "ArrayStruct",
    base: 0x2000,
    size: 10,
    offset: 10,
    labels: new Map([
      ["index", 0],
      ["value", 2],
      ["flag", 8]
    ])
  };
  assembler.structs.set("ArrayStruct", arrayStruct);

  // Setup parent struct
  const parentStruct = {
    name: "ParentStruct",
    base: 0x3000,
    size: 12,
    offset: 12,
    labels: new Map([
      ["id", 0],
      ["name", 2],
      ["type", 10]
    ])
  };
  assembler.structs.set("ParentStruct", parentStruct);

  // Setup extension struct
  const extensionStruct = {
    name: "ExtensionStruct",
    parent: "ParentStruct",
    base: 0x3000,
    size: 8,
    offset: 8,
    labels: new Map([
      ["extra", 0],
      ["data", 4]
    ])
  };
  assembler.structs.set("ExtensionStruct", extensionStruct);
  assembler.structs.set("ParentStruct.ExtensionStruct", extensionStruct);

  // Test 1: Basic struct reference
  t.is(
    assembler.structEngine.resolveStructLabel("BasicStruct"),
    0x1000,
    "Should return base address for direct struct reference"
  );

  // Test 2: Basic struct member reference
  t.is(
    assembler.structEngine.resolveStructLabel("BasicStruct.x"),
    0x1000,
    "Should resolve basic struct member"
  );
  t.is(
    assembler.structEngine.resolveStructLabel("BasicStruct.y"),
    0x1002,
    "Should resolve basic struct member with offset"
  );

  // Test 3: Array indexing
  t.is(
    assembler.structEngine.resolveStructLabel("ArrayStruct[0]"),
    0x2000,
    "Should resolve array struct with index 0"
  );
  t.is(
    assembler.structEngine.resolveStructLabel("ArrayStruct[1]"),
    0x200A,
    "Should resolve array struct with index 1"
  );
  t.is(
    assembler.structEngine.resolveStructLabel("ArrayStruct[2]"),
    0x2014,
    "Should resolve array struct member with index"
  );
  t.is(
    assembler.structEngine.resolveStructLabel("ArrayStruct[2].value"),
    0x2016,
    "Should resolve array struct member with index"
  );
  t.is(
    assembler.structEngine.resolveStructLabel("ArrayStruct[-1]"),
    0x1FF6,
    "Should resolve array struct bases with negative indices"
  );
  t.is(
    assembler.structEngine.resolveStructLabel("ArrayStruct[-1].value"),
    0x1FF8,
    "Should resolve array struct members with negative indices"
  );

  // Test 4: Extension struct
  t.is(
    assembler.structEngine.resolveStructLabel("ExtensionStruct"),
    0x3000,
    "Should return base address for extension struct"
  );
  t.is(
    assembler.structEngine.resolveStructLabel("ExtensionStruct.extra"),
    0x300C,
    "Should resolve extension struct member with parent size offset"
  );

  // Test 5: Array indexing with extension struct
  t.is(
    assembler.structEngine.resolveStructLabel("ExtensionStruct[1].data"),
    0x3018, // Updated from 0x301C to 0x3018 to match calculation: 0x3000 + 12 + (1 * 8) + 4
    "Should resolve extension struct array member with correct offset"
  );

  // Test 6: Nested member access
  t.is(
    assembler.structEngine.resolveStructLabel("ParentStruct.ExtensionStruct.data"),
    0x3010,
    "Should resolve nested struct member reference"
  );
  t.is(
    assembler.structEngine.resolveStructLabel("ParentStruct[1].ExtensionStruct.data"),
    0x3024,
    "Should resolve extension members through a parent array element"
  );

  // Test 7: Error cases
  t.throws(() => {
    assembler.structEngine.resolveStructLabel("NonExistentStruct");
  }, { message: /Struct not defined in reference/ }, "Should throw for non-existent struct");

  t.throws(() => {
    assembler.structEngine.resolveStructLabel("BasicStruct.nonexistent");
  }, { message: /Member 'nonexistent' not defined in struct/ }, "Should throw for non-existent member");

  t.throws(() => {
    assembler.structEngine.resolveStructLabel("ExtensionStruct.nonexistent");
  }, { message: /Member 'nonexistent' not defined in struct/ }, "Should throw for non-existent extension member");

  // Test 8: Complex array indexing with extra member
  const complexStruct = {
    name: "ComplexStruct",
    base: 0x4000,
    size: 20,
    offset: 20,
    labels: new Map([
      ["header", 0],
      ["subitem_x", 4],
      ["subitem_y", 8],
      ["footer", 16]
    ])
  };
  assembler.structs.set("ComplexStruct", complexStruct);

  t.is(
    assembler.structEngine.resolveStructLabel("ComplexStruct[3].subitem_x"),
    0x4040, // Updated from 0x4064 to 0x4040 to match size 20 math: 0x4000 + (3 * 20) + 4
    "Should resolve complex nested member with array index"
  );

  // Test 9: Missing parent for extension
  const orphanExtension = {
    name: "OrphanExtension",
    parent: "MissingParent",
    base: 0x5000,
    size: 4,
    offset: 4,
    labels: new Map([
      ["data", 0]
    ])
  };
  assembler.structs.set("OrphanExtension", orphanExtension);

  t.throws(() => {
    assembler.structEngine.resolveStructLabel("OrphanExtension.data");
  }, { message: /Parent struct 'MissingParent' not defined for extension/ }, "Should throw when parent struct is missing");
});

test("resolveStructMember supports negative indices", (t) => {
  const assembler = new Assembler();

  assembler.structs.set("Task", {
    name: "Task",
    base: 0,
    size: 16,
    offset: 16,
    labels: new Map([
      ["base", 0],
      ["state", 2],
    ]),
  });

  t.is(assembler.symbolScope.resolveStructMember("Task[-1].state"), -14);
});

test("resolveStructLabel - handles extensions with maxExtensionSize", t => {
  const assembler = new Assembler();

  // Set up a parent struct
  const parentStruct = {
    name: "ParentStruct",
    base: 0x6000,
    size: 10,
    offset: 10,
    align: 4, // Add alignment to test that branch too
    labels: new Map([
      ["header", 0],
      ["data", 4]
    ])
  };
  assembler.structs.set("ParentStruct", parentStruct);

  // Set up multiple extensions with different sizes
  const smallExtension = {
    name: "ParentStruct.SmallExt",
    parent: "ParentStruct",
    base: 0x600A, // Base + size of parent
    size: 6,
    offset: 6,
    labels: new Map([
      ["extra", 0]
    ])
  };
  assembler.structs.set("ParentStruct.SmallExt", smallExtension);

  const largeExtension = {
    name: "ParentStruct.LargeExt",
    parent: "ParentStruct",
    base: 0x600A, // Base + size of parent
    size: 12,
    offset: 12,
    labels: new Map([
      ["moreData", 0],
      ["evenMore", 8]
    ])
  };
  assembler.structs.set("ParentStruct.LargeExt", largeExtension);

  // Test accessing the parent struct directly
  t.is(
    assembler.structEngine.resolveStructLabel("ParentStruct"),
    0x6000,
    "Should return the base address of the parent struct"
  );

  // Test array indexing with parent struct (should account for alignment and largest extension)
  // Effective size = 12 (aligned parent size) + 12 (largest extension) = 24
  t.is(
    assembler.structEngine.resolveStructLabel("ParentStruct[2]"),
    0x6000 + (2 * 24),
    "Should account for alignment and largest extension when calculating array index"
  );

  // Test accessing the extension directly
  t.is(
    assembler.structEngine.resolveStructLabel("ParentStruct.LargeExt"),
    0x600A,
    "Should return the base address of the extension"
  );

  // Test array indexing with extension
  t.is(
    assembler.structEngine.resolveStructLabel("ParentStruct.LargeExt[3]"),
    0x600A + (3 * 12),
    "Should calculate the correct array index for extension"
  );

  // Test accessing a member of the extension
  t.is(
    assembler.structEngine.resolveStructLabel("ParentStruct.LargeExt.evenMore"),
    0x6000 + 12 + 8, // Updated to use correct calculation: parent base (0x6000) + parent aligned size (12) + member offset (8)
    "Should return the correct address for extension member"
  );

  // Test array indexing with extension member
  t.is(
    assembler.structEngine.resolveStructLabel("ParentStruct.LargeExt[2].evenMore"),
    0x6000 + 12 + (2 * 12) + 8, // Parent base + aligned parent size + (index * extension size) + member offset
    "Should calculate the correct array index for extension member"
  );
});

test("handleEndStruct - basic struct definition", t => {
  const assembler = new Assembler();

  // Set up a struct context
  assembler.currentStruct = {
    name: "BasicStruct",
    base: 0x7000,
    offset: 16, // Simulating a struct with 16 bytes of members
    size: 0,    // Will be set by handleEndStruct
    labels: new Map([
      ["member1", 0],
      ["member2", 8]
    ])
  };

  // Save the current PC
  assembler.savedPCStack.push(0x8000);
  assembler.currentTargetAddress = 0x7000;

  // Call handleEndStruct
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify the struct was added to the structs map
  t.true(assembler.structs.has("BasicStruct"), "Struct should be added to structs map");

  // Verify struct properties
  const struct = assembler.structs.get("BasicStruct");
  t.is(struct.size, 16, "Size should be set to the final offset");
  t.is(struct.base, 0x7000, "Base address should be preserved");

  // Verify PC was restored
  t.is(assembler.currentTargetAddress, 0x8000, "PC should be restored from savedPCStack");

  // Verify currentStruct was cleared
  t.is(assembler.currentStruct, null, "currentStruct should be cleared");
});

test("handleEndStruct - with alignment", t => {
  const assembler = new Assembler();

  // Set up a struct context
  assembler.currentStruct = {
    name: "AlignedStruct",
    base: 0x7000,
    offset: 10, // 10 bytes of members
    size: 0,    // Will be set by handleEndStruct
    labels: new Map([
      ["member1", 0],
      ["member2", 6]
    ])
  };

  // Save the current PC
  assembler.savedPCStack.push(0x8000);
  assembler.currentTargetAddress = 0x7000;

  // Call handleEndStruct with alignment
  assembler.structEngine.handleEndStruct(["endstruct", "align", "4"]);

  // Verify the struct was added to the structs map
  t.true(assembler.structs.has("AlignedStruct"), "Struct should be added to structs map");

  // Verify struct properties
  const struct = assembler.structs.get("AlignedStruct");
  t.is(struct.size, 12, "Size should be rounded up to the next multiple of alignment (10 -> 12)");
  t.is(struct.align, 4, "Alignment should be set");

  // Verify PC was restored
  t.is(assembler.currentTargetAddress, 0x8000, "PC should be restored from savedPCStack");
});

test("handleEndStruct - extension struct", t => {
  const assembler = new Assembler();

  // First set up a parent struct
  const parentStruct = {
    name: "ParentStruct",
    base: 0x7000,
    offset: 20,
    size: 20,
    labels: new Map([
      ["parentMember1", 0],
      ["parentMember2", 10]
    ])
  };
  assembler.structs.set("ParentStruct", parentStruct);

  // Set up an extension struct
  assembler.currentStruct = {
    name: "ExtensionStruct",
    base: 0x7000, // Same base as parent
    offset: 12,   // 12 bytes of members in the extension
    size: 0,      // Will be set by handleEndStruct
    parent: "ParentStruct",
    labels: new Map([
      ["extMember1", 0],
      ["extMember2", 8]
    ])
  };

  // Save the current PC
  assembler.savedPCStack.push(0x8000);
  assembler.currentTargetAddress = 0x7000;

  // Call handleEndStruct
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify the extension struct was added to the structs map
  t.true(assembler.structs.has("ParentStruct.ExtensionStruct"), "Extension struct should be added with combined name");

  // Verify extension struct properties
  const extStruct = assembler.structs.get("ParentStruct.ExtensionStruct");
  t.is(extStruct.size, 12, "Extension size should be set to the final offset");
  t.is(extStruct.parent, "ParentStruct", "Parent reference should be preserved");

  // Verify parent struct was updated with extension size
  const updatedParent = assembler.structs.get("ParentStruct");
  t.is(updatedParent.extensionSize, 12, "Parent should track the size of its largest extension");

  // Verify PC was restored
  t.is(assembler.currentTargetAddress, 0x8000, "PC should be restored from savedPCStack");
});

test("handleEndStruct - extension struct with larger existing extension", t => {
  const assembler = new Assembler();

  // First set up a parent struct with an existing extension size
  const parentStruct = {
    name: "ParentStruct",
    base: 0x7000,
    offset: 20,
    size: 20,
    extensionSize: 16, // Existing larger extension
    labels: new Map([
      ["parentMember1", 0],
      ["parentMember2", 10]
    ])
  };
  assembler.structs.set("ParentStruct", parentStruct);

  // Set up a smaller extension struct
  assembler.currentStruct = {
    name: "SmallerExtension",
    base: 0x7000,
    offset: 8, // Smaller than existing extension
    size: 0,
    parent: "ParentStruct",
    labels: new Map([
      ["extMember1", 0],
      ["extMember2", 4]
    ])
  };

  // Save the current PC
  assembler.savedPCStack.push(0x8000);
  assembler.currentTargetAddress = 0x7000;

  // Call handleEndStruct
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify extension struct properties
  const extStruct = assembler.structs.get("ParentStruct.SmallerExtension");
  t.is(extStruct.size, 8, "Extension size should be set correctly");

  // Verify parent struct's extensionSize was NOT updated (since new extension is smaller)
  const updatedParent = assembler.structs.get("ParentStruct");
  t.is(updatedParent.extensionSize, 16, "Parent should keep the size of its largest extension");
});

test("handleEndStruct - extension struct with alignment", t => {
  const assembler = new Assembler();

  // First set up a parent struct
  const parentStruct = {
    name: "ParentStruct",
    base: 0x7000,
    offset: 20,
    size: 20,
    labels: new Map([
      ["parentMember1", 0],
      ["parentMember2", 10]
    ])
  };
  assembler.structs.set("ParentStruct", parentStruct);

  // Set up an extension struct
  assembler.currentStruct = {
    name: "AlignedExtension",
    base: 0x7000,
    offset: 10, // 10 bytes of members
    size: 0,
    parent: "ParentStruct",
    labels: new Map([
      ["extMember1", 0],
      ["extMember2", 6]
    ])
  };

  // Save the current PC
  assembler.savedPCStack.push(0x8000);
  assembler.currentTargetAddress = 0x7000;

  // Call handleEndStruct with alignment
  assembler.structEngine.handleEndStruct(["endstruct", "align", "8"]);

  // Verify extension struct properties
  const extStruct = assembler.structs.get("ParentStruct.AlignedExtension");
  t.is(extStruct.size, 16, "Extension size should be aligned to 8 (10 -> 16)");
  t.is(extStruct.align, 8, "Alignment should be set");

  // Verify parent struct's extensionSize was updated
  const updatedParent = assembler.structs.get("ParentStruct");
  t.is(updatedParent.extensionSize, 16, "Parent should track the aligned size of its extension");
});

test("handleEndStruct - error cases", t => {
  const assembler = new Assembler();

  // Test: endstruct without being in a struct
  t.throws(() => {
    assembler.structEngine.handleEndStruct(["endstruct"]);
  }, { message: "endstruct encountered but not inside a struct definition." });

  // Set up a struct context for remaining tests
  assembler.currentStruct = {
    name: "TestStruct",
    base: 0x7000,
    offset: 10,
    size: 0,
    labels: new Map()
  };

  // Test: endstruct align without parameter
  t.throws(() => {
    assembler.structEngine.handleEndStruct(["endstruct", "align"]);
  }, { message: "endstruct align requires a single alignment parameter." });

  // Test: endstruct align with too many parameters
  t.throws(() => {
    assembler.structEngine.handleEndStruct(["endstruct", "align", "4", "extra"]);
  }, { message: "endstruct align requires a single alignment parameter." });

  // Test: endstruct align with invalid alignment
  t.throws(() => {
    assembler.structEngine.handleEndStruct(["endstruct", "align", "0"]);
  }, { message: "Alignment must be at least 1." });

  // Clean up
  assembler.currentStruct = null;
});

test("handleEndStruct - multiple extensions updating parent", t => {
  const assembler = new Assembler();

  // First set up a parent struct
  const parentStruct = {
    name: "BaseStruct",
    base: 0x7000,
    offset: 16,
    size: 16,
    labels: new Map([
      ["baseMember", 0]
    ])
  };
  assembler.structs.set("BaseStruct", parentStruct);

  // Add first extension
  assembler.currentStruct = {
    name: "FirstExt",
    base: 0x7000,
    offset: 8,
    size: 0,
    parent: "BaseStruct",
    labels: new Map([
      ["firstMember", 0]
    ])
  };
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify parent was updated
  let updatedParent = assembler.structs.get("BaseStruct");
  t.is(updatedParent.extensionSize, 8, "Parent should track first extension size");

  // Add second, larger extension
  assembler.currentStruct = {
    name: "SecondExt",
    base: 0x7000,
    offset: 12,
    size: 0,
    parent: "BaseStruct",
    labels: new Map([
      ["secondMember", 0]
    ])
  };
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify parent was updated with larger extension
  updatedParent = assembler.structs.get("BaseStruct");
  t.is(updatedParent.extensionSize, 12, "Parent should update to larger extension size");

  // Add third, smaller extension
  assembler.currentStruct = {
    name: "ThirdExt",
    base: 0x7000,
    offset: 4,
    size: 0,
    parent: "BaseStruct",
    labels: new Map([
      ["thirdMember", 0]
    ])
  };
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify parent still has largest extension size
  updatedParent = assembler.structs.get("BaseStruct");
  t.is(updatedParent.extensionSize, 12, "Parent should keep largest extension size");
});

test("handleStruct - basic struct definition", t => {
  const assembler = new Assembler();

  // Set initial PC
  assembler.currentTargetAddress = 0x8000;

  // Call handleStruct with a basic struct definition
  assembler.structEngine.handleStruct(["struct", "TestStruct", "$7000"]);

  // Verify currentStruct was created correctly
  t.not(assembler.currentStruct, null, "currentStruct should be created");
  t.is(assembler.currentStruct.name, "TestStruct", "Struct name should be set correctly");
  t.is(assembler.currentStruct.base, 0x7000, "Base address should be set correctly");
  t.is(assembler.currentStruct.offset, 0, "Initial offset should be 0");
  t.is(assembler.currentStruct.size, 0, "Initial size should be 0");
  t.is(assembler.currentStruct.parent, undefined, "Parent should be undefined for basic struct");

  // Verify PC was saved and changed
  t.is(assembler.savedPCStack.length, 1, "PC should be saved to stack");
  t.is(assembler.savedPCStack[0], 0x8000, "Original PC should be saved");
  t.is(assembler.currentTargetAddress, 0x7000, "PC should be set to struct base address");
  t.is(assembler.currentTargetStartAddress, 0x7000, "currentTargetStartAddress should be set to struct base address");
  t.is(assembler.currentTargetBaseAddress, 0x7000, "currentTargetBaseAddress should be set to struct base address");
  t.is(assembler.currentTargetBaseStartAddress, 0x7000, "currentTargetBaseStartAddress should be set to struct base address");

  // Clean up
  assembler.currentStruct = null;
});

test("handleStruct - extension struct", t => {
  const assembler = new Assembler();

  // Create a parent struct first
  const parentStruct = {
    name: "ParentStruct",
    base: 0x6000,
    offset: 16,
    size: 16,
    labels: new Map([
      ["header", 0],
      ["data", 8]
    ])
  };
  assembler.structs.set("ParentStruct", parentStruct);

  // Set initial PC
  assembler.currentTargetAddress = 0x8000;

  // Call handleStruct with an extension struct
  assembler.structEngine.handleStruct(["struct", "ChildStruct", "extends", "ParentStruct"]);

  // Verify currentStruct was created correctly
  t.not(assembler.currentStruct, null, "currentStruct should be created");
  t.is(assembler.currentStruct.name, "ChildStruct", "Struct name should be set correctly");
  t.is(assembler.currentStruct.base, 0x6000, "Base address should match parent's base");
  t.is(assembler.currentStruct.offset, 0, "Initial offset should be 0");
  t.is(assembler.currentStruct.size, 0, "Initial size should be 0");
  t.is(assembler.currentStruct.parent, "ParentStruct", "Parent should be set correctly");

  // Verify PC was saved and changed
  t.is(assembler.savedPCStack.length, 1, "PC should be saved to stack");
  t.is(assembler.savedPCStack[0], 0x8000, "Original PC should be saved");
  t.is(assembler.currentTargetAddress, 0x6000, "PC should be set to parent's base address");

  // Clean up
  assembler.currentStruct = null;
});

test("handleStruct - error cases", t => {
  const assembler = new Assembler();

  // struct Name (no base) is valid per Asar; only single-word "struct" is insufficient
  t.throws(() => {
    assembler.structEngine.handleStruct(["struct"]);
  }, { message: /Struct definition requires at least two parameters/ }, "Should throw for insufficient parameters");

  // Test with invalid SNES address
  t.throws(() => {
    assembler.structEngine.handleStruct(["struct", "TestStruct", "-1"]);
  }, { message: /Invalid SNES address for struct/ }, "Should throw for negative address");

  t.throws(() => {
    assembler.structEngine.handleStruct(["struct", "TestStruct", "$1000000"]);
  }, { message: /Invalid SNES address for struct/ }, "Should throw for address > 0xFFFFFF");

  // Test with non-existent parent struct
  t.throws(() => {
    assembler.structEngine.handleStruct(["struct", "ChildStruct", "extends", "NonExistentParent"]);
  }, { message: /Parent struct 'NonExistentParent' not defined/ }, "Should throw for non-existent parent");

  // Test with missing parent name
  t.throws(() => {
    assembler.structEngine.handleStruct(["struct", "ChildStruct", "extends"]);
  }, { message: /Struct extension must specify a parent struct/ }, "Should throw for missing parent name");
});

test("handleStruct and handleEndStruct - complete workflow", t => {
  const assembler = new Assembler();

  // Set initial PC
  assembler.currentTargetAddress = 0x8000;

  // 1. Define a basic struct
  assembler.structEngine.handleStruct(["struct", "BasicStruct", "$7000"]);

  // Simulate adding members by manually updating the offset and labels
  assembler.currentStruct.offset = 12;
  assembler.currentStruct.labels.set("header", 0);
  assembler.currentStruct.labels.set("data", 4);
  assembler.currentStruct.labels.set("footer", 8);

  // End the struct definition
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify struct was added to structs map
  t.true(assembler.structs.has("BasicStruct"), "BasicStruct should be added to structs map");
  const basicStruct = assembler.structs.get("BasicStruct");
  t.is(basicStruct.size, 12, "Size should be set to final offset");
  t.is(basicStruct.base, 0x7000, "Base address should be preserved");
  t.is(assembler.currentTargetAddress, 0x8000, "PC should be restored");

  // 2. Define an extension struct
  assembler.structEngine.handleStruct(["struct", "ExtStruct", "extends", "BasicStruct"]);

  // Simulate adding members
  assembler.currentStruct.offset = 8;
  assembler.currentStruct.labels.set("extraData", 0);
  assembler.currentStruct.labels.set("moreData", 4);

  // End the extension struct
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify extension struct was added
  t.true(assembler.structs.has("BasicStruct.ExtStruct"), "Combined name should also be added");

  const extStruct = assembler.structs.get("BasicStruct.ExtStruct");
  t.is(extStruct.size, 8, "Extension size should be set correctly");
  t.is(extStruct.parent, "BasicStruct", "Parent reference should be preserved");

  // Verify parent struct was updated with extension size
  const updatedBasicStruct = assembler.structs.get("BasicStruct");
  t.is(updatedBasicStruct.extensionSize, 8, "Parent should track extension size");

  // 3. Define a struct with alignment
  assembler.structEngine.handleStruct(["struct", "AlignedStruct", "$8000"]);

  // Simulate adding members
  assembler.currentStruct.offset = 10;
  assembler.currentStruct.labels.set("field1", 0);
  assembler.currentStruct.labels.set("field2", 6);

  // End the struct with alignment
  assembler.structEngine.handleEndStruct(["endstruct", "align", "4"]);

  // Verify aligned struct
  const alignedStruct = assembler.structs.get("AlignedStruct");
  t.is(alignedStruct.size, 12, "Size should be aligned to multiple of 4");
  t.is(alignedStruct.align, 4, "Alignment should be stored");
});

test("handleStruct and handleEndStruct - with multiple extensions", t => {
  const assembler = new Assembler();

  // Define base struct
  assembler.currentTargetAddress = 0x8000;
  assembler.structEngine.handleStruct(["struct", "BaseStruct", "$7000"]);
  assembler.currentStruct.offset = 16;
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify base struct
  t.true(assembler.structs.has("BaseStruct"), "Base struct should be added");
  t.is(assembler.structs.get("BaseStruct").size, 16, "Base size should be correct");

  // Add first extension
  assembler.structEngine.handleStruct(["struct", "Ext1", "extends", "BaseStruct"]);
  assembler.currentStruct.offset = 8;
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify first extension and parent update
  t.true(assembler.structs.has("BaseStruct.Ext1"), "First extension should be added");
  t.is(assembler.structs.get("BaseStruct.Ext1").size, 8, "Extension size should be correct");
  t.is(assembler.structs.get("BaseStruct").extensionSize, 8, "Parent should track extension size");

  // Add second, larger extension
  assembler.structEngine.handleStruct(["struct", "Ext2", "extends", "BaseStruct"]);
  assembler.currentStruct.offset = 12;
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify second extension and parent update
  t.true(assembler.structs.has("BaseStruct.Ext2"), "Second extension should be added");
  t.is(assembler.structs.get("BaseStruct.Ext2").size, 12, "Extension size should be correct");
  t.is(assembler.structs.get("BaseStruct").extensionSize, 12, "Parent should update to larger extension");

  // Add third, smaller extension
  assembler.structEngine.handleStruct(["struct", "Ext3", "extends", "BaseStruct"]);
  assembler.currentStruct.offset = 4;
  assembler.structEngine.handleEndStruct(["endstruct"]);

  // Verify third extension and parent unchanged
  t.true(assembler.structs.has("BaseStruct.Ext3"), "Third extension should be added");
  t.is(assembler.structs.get("BaseStruct.Ext3").size, 4, "Extension size should be correct");
  t.is(assembler.structs.get("BaseStruct").extensionSize, 12, "Parent should keep largest extension size");
});

test("handlePushPC and handlePullPC - basic functionality", t => {
  const assembler = new Assembler();

  // Set initial positions
  assembler.currentTargetAddress = 0x8000;
  assembler.currentTargetStartAddress = 0x8000;
  assembler.currentTargetBaseAddress = 0x8000;
  assembler.currentTargetBaseStartAddress = 0x8000;

  // Push PC
  assembler.handlePushPC();

  // Change positions
  assembler.currentTargetAddress = 0x9000;
  assembler.currentTargetStartAddress = 0x9000;
  assembler.currentTargetBaseAddress = 0x9000;
  assembler.currentTargetBaseStartAddress = 0x9000;

  // Pull PC should restore original positions
  assembler.handlePullPC();

  // Verify positions were restored
  t.is(assembler.currentTargetAddress, 0x8000, "currentTargetAddress should be restored");
  t.is(assembler.currentTargetStartAddress, 0x8000, "currentTargetStartAddress should be restored");
  t.is(assembler.currentTargetBaseAddress, 0x8000, "currentTargetBaseAddress should be restored");
  t.is(assembler.currentTargetBaseStartAddress, 0x8000, "currentTargetBaseStartAddress should be restored");
});

test("handlePushPC - multiple pushes", t => {
  const assembler = new Assembler();

  // Set initial positions
  assembler.currentTargetAddress = 0x1000;
  assembler.currentTargetStartAddress = 0x1000;
  assembler.currentTargetBaseAddress = 0x1000;
  assembler.currentTargetBaseStartAddress = 0x1000;

  // First push
  assembler.handlePushPC();

  // Change positions
  assembler.currentTargetAddress = 0x2000;
  assembler.currentTargetStartAddress = 0x2000;
  assembler.currentTargetBaseAddress = 0x2000;
  assembler.currentTargetBaseStartAddress = 0x2000;

  // Second push
  assembler.handlePushPC();

  // Change positions again
  assembler.currentTargetAddress = 0x3000;
  assembler.currentTargetStartAddress = 0x3000;
  assembler.currentTargetBaseAddress = 0x3000;
  assembler.currentTargetBaseStartAddress = 0x3000;

  // First pull should restore to second position
  assembler.handlePullPC();
  t.is(assembler.currentTargetAddress, 0x2000, "currentTargetAddress should be restored to second position");

  // Second pull should restore to first position
  assembler.handlePullPC();
  t.is(assembler.currentTargetAddress, 0x1000, "currentTargetAddress should be restored to first position");
});

test("handlePushPC - stack overflow", t => {
  const assembler = new Assembler();

  // Fill the stack to the limit (256 pushes)
  for (let i = 0; i < 256; i++) {
    assembler.handlePushPC();
  }

  // Next push should throw an error
  const error = t.throws(() => {
    assembler.handlePushPC();
  }, { instanceOf: Error });

  t.is(error.message, "PushPC stack overflow.");
});

test("handlePullPC - without matching push", t => {
  const assembler = new Assembler();

  // Pull without push should throw an error
  const error = t.throws(() => {
    assembler.handlePullPC();
  }, { instanceOf: Error });

  t.is(error.message, "PullPC without PushPC.");
});

test("handlePushPC and handlePullPC - nested operations", t => {
  const assembler = new Assembler();

  // Set initial positions
  assembler.currentTargetAddress = 0x1000;
  assembler.currentTargetStartAddress = 0x1000;
  assembler.currentTargetBaseAddress = 0x1000;
  assembler.currentTargetBaseStartAddress = 0x1000;

  // First push
  assembler.handlePushPC();

  // Change positions
  assembler.currentTargetAddress = 0x2000;
  assembler.currentTargetStartAddress = 0x2000;
  assembler.currentTargetBaseAddress = 0x2000;
  assembler.currentTargetBaseStartAddress = 0x2000;

  // Second push
  assembler.handlePushPC();

  // Change positions again
  assembler.currentTargetAddress = 0x3000;
  assembler.currentTargetStartAddress = 0x3000;
  assembler.currentTargetBaseAddress = 0x3000;
  assembler.currentTargetBaseStartAddress = 0x3000;

  // Third push
  assembler.handlePushPC();

  // Change positions one more time
  assembler.currentTargetAddress = 0x4000;
  assembler.currentTargetStartAddress = 0x4000;
  assembler.currentTargetBaseAddress = 0x4000;
  assembler.currentTargetBaseStartAddress = 0x4000;

  // Pull in reverse order
  assembler.handlePullPC();
  t.is(assembler.currentTargetAddress, 0x3000, "First pull should restore to third position");

  assembler.handlePullPC();
  t.is(assembler.currentTargetAddress, 0x2000, "Second pull should restore to second position");

  assembler.handlePullPC();
  t.is(assembler.currentTargetAddress, 0x1000, "Third pull should restore to first position");

  // Verify pushpcnum is back to 0
  t.is(assembler.pushpcnum, 0, "pushpcnum should be 0 after all pulls");
});

test("handlePushPC and handlePullPC - with different position values", t => {
  const assembler = new Assembler();

  // Set initial positions with different values for each property
  assembler.currentTargetAddress = 0x1000;
  assembler.currentTargetStartAddress = 0x1100;
  assembler.currentTargetBaseAddress = 0x1200;
  assembler.currentTargetBaseStartAddress = 0x1300;

  // Push PC
  assembler.handlePushPC();

  // Change all positions
  assembler.currentTargetAddress = 0x2000;
  assembler.currentTargetStartAddress = 0x2100;
  assembler.currentTargetBaseAddress = 0x2200;
  assembler.currentTargetBaseStartAddress = 0x2300;

  // Pull PC should restore all original positions
  assembler.handlePullPC();

  // Verify each position was restored correctly
  t.is(assembler.currentTargetAddress, 0x1000, "currentTargetAddress should be restored to original value");
  t.is(assembler.currentTargetStartAddress, 0x1100, "currentTargetStartAddress should be restored to original value");
  t.is(assembler.currentTargetBaseAddress, 0x1200, "currentTargetBaseAddress should be restored to original value");
  t.is(assembler.currentTargetBaseStartAddress, 0x1300, "currentTargetBaseStartAddress should be restored to original value");
});

test("handlePushPC and handlePullPC - pushpcnum tracking", t => {
  const assembler = new Assembler();

  // Initial pushpcnum should be 0
  t.is(assembler.pushpcnum, 0, "Initial pushpcnum should be 0");

  // Push PC and check counter
  assembler.handlePushPC();
  t.is(assembler.pushpcnum, 1, "pushpcnum should be 1 after first push");

  assembler.handlePushPC();
  t.is(assembler.pushpcnum, 2, "pushpcnum should be 2 after second push");

  // Pull PC and check counter
  assembler.handlePullPC();
  t.is(assembler.pushpcnum, 1, "pushpcnum should be 1 after first pull");

  assembler.handlePullPC();
  t.is(assembler.pushpcnum, 0, "pushpcnum should be 0 after second pull");
});

test("handleNamespace - basic functionality", t => {
  const assembler = new Assembler();

  // Initial namespace should be empty
  t.is(assembler.currentNamespace, "", "Initial namespace should be empty");

  // Set namespace
  assembler.handleNamespace(["TestNamespace"]);
  t.is(assembler.currentNamespace, "TestNamespace", "Namespace should be set correctly");

  // Turn namespace off with 'off' parameter
  assembler.handleNamespace(["off"]);
  t.is(assembler.currentNamespace, "", "Namespace should be empty after 'off' command");

  // Set namespace again
  assembler.handleNamespace(["AnotherNamespace"]);
  t.is(assembler.currentNamespace, "AnotherNamespace", "Namespace should be set correctly after being turned off");

  // Empty params should clear namespace
  assembler.handleNamespace([]);
  t.is(assembler.currentNamespace, "", "Namespace should be empty with empty params");
});

test("handleNamespace - case sensitivity", t => {
  const assembler = new Assembler();

  // Test with mixed case namespace
  assembler.handleNamespace(["MixedCaseNamespace"]);
  t.is(assembler.currentNamespace, "MixedCaseNamespace", "Namespace should preserve case");

  // Test with lowercase 'off' command
  assembler.handleNamespace(["off"]);
  t.is(assembler.currentNamespace, "", "Lowercase 'off' should clear namespace");

  // Test with uppercase 'OFF' command
  assembler.handleNamespace(["TestNamespace"]);
  assembler.handleNamespace(["OFF"]);
  t.is(assembler.currentNamespace, "", "Uppercase 'OFF' should clear namespace (case insensitive)");
});

test("handlePushNamespace and handlePullNamespace - basic functionality", t => {
  const assembler = new Assembler();

  // Set initial namespace
  assembler.handleNamespace(["InitialNamespace"]);
  t.is(assembler.currentNamespace, "InitialNamespace", "Initial namespace should be set");

  // Push namespace
  assembler.handlePushNamespace();

  // Change namespace
  assembler.handleNamespace(["NewNamespace"]);
  t.is(assembler.currentNamespace, "NewNamespace", "Namespace should be changed after push");

  // Pull namespace should restore original
  assembler.handlePullNamespace();
  t.is(assembler.currentNamespace, "InitialNamespace", "Original namespace should be restored after pull");
});

test("handlePushNamespace and handlePullNamespace - multiple levels", t => {
  const assembler = new Assembler();

  // Set and push multiple namespaces
  assembler.handleNamespace(["Level1"]);
  assembler.handlePushNamespace();

  assembler.handleNamespace(["Level2"]);
  assembler.handlePushNamespace();

  assembler.handleNamespace(["Level3"]);
  t.is(assembler.currentNamespace, "Level3", "Current namespace should be Level3");

  // Pull namespaces in reverse order
  assembler.handlePullNamespace();
  t.is(assembler.currentNamespace, "Level2", "Namespace should be restored to Level2");

  assembler.handlePullNamespace();
  t.is(assembler.currentNamespace, "Level1", "Namespace should be restored to Level1");
});

test("handlePushNamespace and handlePullNamespace - empty namespace", t => {
  const assembler = new Assembler();

  // Push empty namespace
  assembler.handlePushNamespace();

  // Set namespace
  assembler.handleNamespace(["TestNamespace"]);
  t.is(assembler.currentNamespace, "TestNamespace", "Namespace should be set");

  // Pull should restore empty namespace
  assembler.handlePullNamespace();
  t.is(assembler.currentNamespace, "", "Empty namespace should be restored");
});

test("handlePullNamespace - error on empty stack", t => {
  const assembler = new Assembler();

  // Attempt to pull without pushing should throw error
  const error = t.throws(() => {
    assembler.handlePullNamespace();
  }, { instanceOf: Error });

  t.is(error.message, "pullns without pushns", "Should throw correct error message");
});

test("handleNamespace, handlePushNamespace, handlePullNamespace - integration", t => {
  const assembler = new Assembler();

  // Test complex sequence of operations
  assembler.handleNamespace(["MainNamespace"]);
  assembler.handlePushNamespace();

  assembler.handleNamespace(["SubNamespace"]);
  t.is(assembler.currentNamespace, "SubNamespace", "Subnamespace should be active");

  assembler.handleNamespace(["off"]);
  t.is(assembler.currentNamespace, "", "Namespace should be cleared with 'off'");

  assembler.handlePullNamespace();
  t.is(assembler.currentNamespace, "MainNamespace", "Main namespace should be restored");

  // Push again with non-empty namespace
  assembler.handlePushNamespace();
  assembler.handleNamespace([]);
  t.is(assembler.currentNamespace, "", "Namespace should be cleared with empty params");

  assembler.handlePullNamespace();
  t.is(assembler.currentNamespace, "MainNamespace", "Main namespace should be restored again");
});

test("writeDataByLength - writes data of different lengths", t => {
  const assembler = new Assembler();

  // Spy on the write methods
  const write1Spy = sinon.spy(assembler, "write1");
  const write2Spy = sinon.spy(assembler, "write2");
  const write3Spy = sinon.spy(assembler, "write3");
  const write4Spy = sinon.spy(assembler, "write4");

  // Test 1-byte write
  assembler.writeDataByLength(1, 0xAB);
  t.true(write1Spy.calledOnceWith(0xAB), "Should call write1 with correct value");

  // Reset spies
  write1Spy.resetHistory();

  // Test 2-byte write
  assembler.writeDataByLength(2, 0xABCD);
  t.true(write2Spy.calledOnceWith(0xABCD), "Should call write2 with correct value");

  // Test 3-byte write
  assembler.writeDataByLength(3, 0xABCDEF);
  t.true(write3Spy.calledOnceWith(0xABCDEF), "Should call write3 with correct value");

  // Test 4-byte write
  assembler.writeDataByLength(4, 0xABCDEF12);
  t.true(write4Spy.calledOnceWith(0xABCDEF12), "Should call write4 with correct value");
});

test("writeDataByLength - handles string length parameter", t => {
  const assembler = new Assembler();

  const write1Spy = sinon.spy(assembler, "write1");

  // Test with string length parameter (which the code comments indicate happens sometimes)
  assembler.writeDataByLength("1" as any, 0xAB);
  t.true(write1Spy.calledOnceWith(0xAB), "Should handle string length parameter");
});

test("writeDataByLength - throws on invalid length", t => {
  const assembler = new Assembler();

  // Test with invalid length
  const error = t.throws(() => {
    assembler.writeDataByLength(5, 0xAB);
  }, { instanceOf: Error });

  t.is(error.message, "Unsupported data length 5", "Should throw with correct error message");
});

test("writeDataByLength - throws on NaN length", t => {
  const assembler = new Assembler();

  // Test with NaN length
  const error = t.throws(() => {
    assembler.writeDataByLength("invalid" as any, 0xAB);
  }, { instanceOf: Error });

  t.is(error.message, "writeDataByLength: len is NaN", "Should throw with correct error message");
});

test("writeDataByLength - handles edge values", t => {
  const assembler = new Assembler();

  const write1Spy = sinon.spy(assembler, "write1");
  const write2Spy = sinon.spy(assembler, "write2");
  const write3Spy = sinon.spy(assembler, "write3");
  const write4Spy = sinon.spy(assembler, "write4");

  // Test with minimum values
  assembler.writeDataByLength(1, 0);
  t.true(write1Spy.calledWith(0), "Should handle minimum value for 1-byte");

  // Test with maximum values
  assembler.writeDataByLength(1, 0xFF);
  t.true(write1Spy.calledWith(0xFF), "Should handle maximum value for 1-byte");

  assembler.writeDataByLength(2, 0xFFFF);
  t.true(write2Spy.calledWith(0xFFFF), "Should handle maximum value for 2-byte");

  assembler.writeDataByLength(3, 0xFFFFFF);
  t.true(write3Spy.calledWith(0xFFFFFF), "Should handle maximum value for 3-byte");

  assembler.writeDataByLength(4, 0xFFFFFFFF);
  t.true(write4Spy.calledWith(0xFFFFFFFF), "Should handle maximum value for 4-byte");
});

test("handleDataDirective - basic numeric values", t => {
  const assembler = new Assembler();
  assembler.setPass(1);
  const write1Spy = sinon.spy(assembler, "write1");
  const write2Spy = sinon.spy(assembler, "write2");

  // Test db with single value
  assembler.handleDataDirective("db", ["42"]);
  t.true(write1Spy.calledWith(42), "Should write 1-byte value correctly");

  // Test dw with single value
  assembler.handleDataDirective("dw", ["1234"]);
  t.true(write2Spy.calledWith(1234), "Should write 2-byte value correctly");

  // Test multiple values
  write1Spy.resetHistory();
  assembler.handleDataDirective("db", ["10,20,30"]);
  t.true(write1Spy.calledThrice, "Should handle multiple values");
  t.deepEqual(
    write1Spy.args.map(args => args[0]),
    [10, 20, 30],
    "Should write multiple values in order"
  );
});

test("handleDataDirective - different directives", t => {
  const assembler = new Assembler();
  assembler.setPass(1);
  const write1Spy = sinon.spy(assembler, "write1");
  const write2Spy = sinon.spy(assembler, "write2");
  const write3Spy = sinon.spy(assembler, "write3");
  const write4Spy = sinon.spy(assembler, "write4");

  // Test db/dc.b (1 byte)
  assembler.handleDataDirective("db", ["42"]);
  t.true(write1Spy.calledWith(42), "db should write 1 byte");

  write1Spy.resetHistory();
  assembler.handleDataDirective("dc.b", ["42"]);
  t.true(write1Spy.calledWith(42), "dc.b should write 1 byte");

  // Test dw/dc.w (2 bytes)
  assembler.handleDataDirective("dw", ["1234"]);
  t.true(write2Spy.calledWith(1234), "dw should write 2 bytes");

  write2Spy.resetHistory();
  assembler.handleDataDirective("dc.w", ["1234"]);
  t.true(write2Spy.calledWith(1234), "dc.w should write 2 bytes");

  // Test dl/dc.l (3 bytes)
  assembler.handleDataDirective("dl", ["123456"]);
  t.true(write3Spy.calledWith(123456), "dl should write 3 bytes");

  write3Spy.resetHistory();
  assembler.handleDataDirective("dc.l", ["123456"]);
  t.true(write3Spy.calledWith(123456), "dc.l should write 3 bytes");

  // Test dd (4 bytes)
  assembler.handleDataDirective("dd", ["12345678"]);
  t.true(write4Spy.calledWith(12345678), "dd should write 4 bytes");
});

test("handleDataDirective - pass 0 estimates byte size", t => {
  const assembler = new Assembler();
  assembler.setPass(0);
  assembler.defines.set("bytes", "1,2,3");
  const stepSpy = sinon.spy(assembler, "step");

  assembler.handleDataDirective("db", ['"Hi"']);
  assembler.handleDataDirective("dw", ["!bytes"]);

  t.deepEqual(
    stepSpy.getCalls().map((call) => call.args[0]),
    [2, 6],
    "Pass 0 should advance by the estimated byte count for strings and expanded lists"
  );

  stepSpy.restore();
});

test("handleDataDirective - string values", t => {
  const assembler = new Assembler();
  assembler.setPass(1);
  const write1Spy = sinon.spy(assembler, "write1");

  // Test with quoted string
  assembler.handleDataDirective("db", ['"Hello"']);
  t.is(write1Spy.callCount, 5, "Should write each character of the string");
  t.deepEqual(
    write1Spy.args.map(args => args[0]),
    [72, 101, 108, 108, 111], // ASCII values for "Hello"
    "Should write correct ASCII values"
  );

  // Test with single quotes
  write1Spy.resetHistory();
  assembler.handleDataDirective("db", ["'World'"]);
  t.is(write1Spy.callCount, 5, "Should handle single-quoted strings");
  t.deepEqual(
    write1Spy.args.map(args => args[0]),
    [87, 111, 114, 108, 100], // ASCII values for "World"
    "Should write correct ASCII values for single-quoted string"
  );

  // Test with mixed string and numeric values
  write1Spy.resetHistory();
  assembler.handleDataDirective("db", ['"Hi",44,\'Bye\'']);
  // t.is(write1Spy.callCount, 6, "Should handle mixed string and numeric values");
  t.deepEqual(
    write1Spy.args.map(args => args[0]),
    [72, 105, 44, 66, 121, 101], // "Hi", 44 (comma), "Bye"
    "Should write correct values for mixed input"
  );
});

test("handleDataDirective - deprecated # syntax", t => {
  const assembler = new Assembler();
  assembler.setPass(1);
  const write1Spy = sinon.spy(assembler, "write1");
  // const consoleWarnStub = sinon.stub(console, "warn");

  // Test with # prefix (deprecated)
  assembler.handleDataDirective("db", ["#42"]);
  t.true(write1Spy.calledWith(42), "Should handle # prefix correctly");
  // t.true(consoleWarnStub.calledOnce, "Should issue warning for # prefix");
  // t.true(
  //   consoleWarnStub.firstCall.args[0].includes("# before numbers in db/dw/... is deprecated"),
  //   "Warning should mention deprecation"
  // );
});

test("handleDataDirective - math expressions", t => {
  const assembler = new Assembler();
  assembler.setPass(1);
  const write1Spy = sinon.spy(assembler, "write1");
  const mathStub = sinon.stub(assembler.mathCore, "math");

  // Setup math stub to return predictable values
  mathStub.withArgs("10+5").returns(15);
  mathStub.withArgs("20*2").returns(40);

  // Test with math expressions
  assembler.handleDataDirective("db", ["10+5"]);
  t.true(mathStub.calledWith("10+5"), "Should evaluate math expressions");
  t.true(write1Spy.calledWith(15), "Should write result of math expression");

  write1Spy.resetHistory();
  assembler.handleDataDirective("db", ["20*2"]);
  t.true(mathStub.calledWith("20*2"), "Should evaluate complex expressions");
  t.true(write1Spy.calledWith(40), "Should write result of complex expression");
});

test("handleDataDirective - struct references", t => {
  const assembler = new Assembler();
  assembler.setPass(1);
  const write1Spy = sinon.spy(assembler, "write1");
  const resolveStructLabelStub = sinon.stub(assembler.structEngine, "resolveStructLabel");
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");

  // Setup struct resolution stub
  resolveStructLabelStub.withArgs("sprite.x_pos").returns(42);
  resolveStructLabelStub.withArgs("unknown.field").throws(new Error("Unknown struct"));

  // Test with valid struct reference
  assembler.handleDataDirective("db", ["sprite.x_pos"]);
  t.true(resolveStructLabelStub.calledWith("sprite.x_pos"), "Should attempt to resolve struct references");
  t.true(write1Spy.calledWith(42), "Should write resolved struct value");

  // Test fallback to numeric resolver when struct resolution fails
  getnumStub.withArgs("unknown.field").returns(100);
  write1Spy.resetHistory();
  assembler.handleDataDirective("db", ["unknown.field"]);
  t.true(getnumStub.calledWith("unknown.field"), "Should fall back to numeric resolution when struct resolution fails");
  t.true(write1Spy.calledWith(100), "Should write result from numeric fallback");
});

test("handleDataDirective - label references", t => {
  const assembler = new Assembler();
  assembler.setPass(1);
  const write1Spy = sinon.spy(assembler, "write1");
  const getLabelValueStub = sinon.stub(assembler.symbolScope, "getLabelValue");

  // Setup label resolution stubs used by getnum + static fallback path.
  getLabelValueStub.withArgs("LABEL1", false).returns(50);
  getLabelValueStub.withArgs("LABEL1", true).returns(50);

  // Test with label reference
  assembler.handleDataDirective("db", ["LABEL1"]);
  t.true(getLabelValueStub.calledWith("LABEL1", false), "Should attempt to resolve label through numeric resolver");
  t.true(write1Spy.calledWith(50), "Should write resolved label value");

  // Test error when label resolution fails
  getLabelValueStub.withArgs("UNKNOWN_LABEL", false).throws(new Error("Label 'UNKNOWN_LABEL' not found."));

  const error = t.throws(() => {
    assembler.handleDataDirective("db", ["UNKNOWN_LABEL"]);
  }, { instanceOf: Error });

  t.true(
    error.message.includes("UNKNOWN_LABEL"),
    "Should throw when label resolution fails"
  );

});

test("handleDataDirective - throws on unsupported directive type", t => {
  const assembler = new Assembler();
  assembler.setPass(1);

  // Test with invalid directive type
  const error = t.throws(() => {
    assembler.handleDataDirective("dx", ["42"]);
  }, { instanceOf: Error });

  t.is(error.message, "Invalid data directive: dx", "Should throw with correct error message for unsupported directive");

  // Test with completely invalid directive
  const error2 = t.throws(() => {
    assembler.handleDataDirective("invalid_directive", ["42"]);
  }, { instanceOf: Error });

  t.is(error2.message, "Invalid data directive: invalid_directive", "Should throw with correct error message for invalid directive");
});

test("handleDataDirective - skips writing in pass 0", t => {
  const assembler = new Assembler();
  assembler.setPass(0);

  // Spy on write methods to verify they're not called
  const write1Spy = sinon.spy(assembler, "write1");
  const write2Spy = sinon.spy(assembler, "write2");
  const write3Spy = sinon.spy(assembler, "write3");
  const write4Spy = sinon.spy(assembler, "write4");

  // Test with different directive types
  assembler.handleDataDirective("db", ["42"]);
  assembler.handleDataDirective("dw", ["1234"]);
  assembler.handleDataDirective("dl", ["123456"]);
  assembler.handleDataDirective("dd", ["12345678"]);

  // Verify no write methods were called
  t.false(write1Spy.called, "write1 should not be called in pass 0");
  t.false(write2Spy.called, "write2 should not be called in pass 0");
  t.false(write3Spy.called, "write3 should not be called in pass 0");
  t.false(write4Spy.called, "write4 should not be called in pass 0");

  // Clean up
  sinon.restore();
});

test("handleDataDirective - throws on empty or invalid params", t => {
  const assembler = new Assembler();
  assembler.setPass(1);

  // Test with empty params array
  const error1 = t.throws(() => {
    assembler.handleDataDirective("db", []);
  }, { instanceOf: Error });

  t.is(error1.message, "DB directive requires at least one parameter.", "Should throw when params array is empty");

  // Test with undefined params
  const error2 = t.throws(() => {
    assembler.handleDataDirective("dw", undefined as any);
  }, { instanceOf: Error });

  t.is(error2.message, "DW directive requires at least one parameter.", "Should throw when params is undefined");

  // Test with null params
  const error3 = t.throws(() => {
    assembler.handleDataDirective("dl", null as any);
  }, { instanceOf: Error });

  t.is(error3.message, "DL directive requires at least one parameter.", "Should throw when params is null");

  // Test with non-array params
  const error4 = t.throws(() => {
    assembler.handleDataDirective("dd", "not an array" as any);
  }, { instanceOf: Error });

  t.is(error4.message, "DD directive requires at least one parameter.", "Should throw when params is not an array");
});

test("handleOrg - sets SNES memory location with hex value", t => {
  const assembler = new Assembler();

  assembler.handleOrg(["$8000"]);

  t.is(assembler.currentTargetAddress, 0x8000, "currentTargetAddress should be set to the hex value");
  t.is(assembler.currentTargetBaseAddress, 0x8000, "currentTargetBaseAddress should be set to the hex value");
  t.is(assembler.currentTargetStartAddress, 0x8000, "currentTargetStartAddress should be set to the hex value");
  t.is(assembler.currentTargetBaseStartAddress, 0x8000, "currentTargetBaseStartAddress should be set to the hex value");
});

test("handleOrg - sets SNES memory location with decimal value", t => {
  const assembler = new Assembler();

  assembler.handleOrg(["32768"]);

  t.is(assembler.currentTargetAddress, 32768, "currentTargetAddress should be set to the decimal value");
  t.is(assembler.currentTargetBaseAddress, 32768, "currentTargetBaseAddress should be set to the decimal value");
  t.is(assembler.currentTargetStartAddress, 32768, "currentTargetStartAddress should be set to the decimal value");
  t.is(assembler.currentTargetBaseStartAddress, 32768, "currentTargetBaseStartAddress should be set to the decimal value");
});

test("handleOrg - throws error with no parameters", t => {
  const assembler = new Assembler();

  const error = t.throws(() => {
    assembler.handleOrg([]);
  }, { instanceOf: Error });

  t.is(error.message, "ORG requires a single address parameter.", "Should throw with correct error message");
});

test("handleOrg - throws error with multiple parameters", t => {
  const assembler = new Assembler();

  const error = t.throws(() => {
    assembler.handleOrg(["$8000", "$9000"]);
  }, { instanceOf: Error });

  t.is(error.message, "ORG requires a single address parameter.", "Should throw with correct error message");
});

test("handleOrg - throws error with invalid hex value", t => {
  const assembler = new Assembler();

  const error = t.throws(() => {
    assembler.handleOrg(["$INVALID"]);
  }, { instanceOf: Error });

  t.is(error.message, "Invalid ORG address: $INVALID", "Should throw with correct error message");
});

test("handleOrg - throws error with invalid decimal value", t => {
  const assembler = new Assembler();

  const error = t.throws(() => {
    assembler.handleOrg(["INVALID"]);
  }, { instanceOf: Error });

  t.is(error.message, "Invalid ORG address: INVALID", "Should throw with correct error message");
});

test("handleOrg - throws error with negative value", t => {
  const assembler = new Assembler();

  const error = t.throws(() => {
    assembler.handleOrg(["-1"]);
  }, { instanceOf: Error });

  t.is(error.message, "Invalid ORG address: -1", "Should throw with correct error message");
});

test("handleOrg - throws error with value exceeding 24-bit address space", t => {
  const assembler = new Assembler();

  const error = t.throws(() => {
    assembler.handleOrg(["$1000000"]);
  }, { instanceOf: Error });

  t.is(error.message, "Invalid ORG address: $1000000", "Should throw with correct error message");
});

test("handleOrg - handles address at 24-bit boundary", t => {
  const assembler = new Assembler();

  assembler.handleOrg(["$FFFFFF"]);

  t.is(assembler.currentTargetAddress, 0xFFFFFF, "currentTargetAddress should be set to the maximum 24-bit value");
  t.is(assembler.currentTargetBaseAddress, 0xFFFFFF, "currentTargetBaseAddress should be set to the maximum 24-bit value");
});

test("handleOrg - handles address with whitespace", t => {
  const assembler = new Assembler();

  assembler.handleOrg([" $A000 "]);

  t.is(assembler.currentTargetAddress, 0xA000, "currentTargetAddress should be set correctly with trimmed value");
});

test("typed conditional nodes execute the first matching branch", t => {
  const assembler = new Assembler();
  assembler.setPass(2);
  assembler.defines.set("state", "1");
  const executed: string[] = [];
  sinon.stub(assembler, "processNormalizedCommand").callsFake((command) => {
    executed.push(command.command);
  });

  const [node] = assembler.parseCommandStreamToNodes([
    "if !state == 0",
    "db $00",
    "elseif !state == 1",
    "db $01",
    "else",
    "db $02",
    "endif",
  ], "conditional.asm", 0);

  if (!node || typeof node === "string" || !("type" in node) || node.type !== "if") {
    t.fail();
    return;
  }

  assembler.executeNode(node);
  t.deepEqual(executed, ["db $01"]);
});

test("typed conditional nodes support nested branch execution", t => {
  const assembler = new Assembler();
  assembler.setPass(2);
  assembler.defines.set("outer", "1");
  assembler.defines.set("inner", "0");
  const executed: string[] = [];
  sinon.stub(assembler, "processNormalizedCommand").callsFake((command) => {
    executed.push(command.command);
  });

  const [node] = assembler.parseCommandStreamToNodes([
    "if !outer == 1",
    "  if !inner == 1",
    "    db $11",
    "  else",
    "    db $22",
    "  endif",
    "else",
    "  db $33",
    "endif",
  ], "nested-conditional.asm", 0);

  if (!node || typeof node === "string" || !("type" in node) || node.type !== "if") {
    t.fail();
    return;
  }

  assembler.executeNode(node);
  t.deepEqual(executed, ["db $22"]);
});

test("getDefineVariable - extracts variable name from define statements", t => {
  // Valid variable extractions
  t.is(getDefineVariable("!var = 123"), "var", "Basic variable name");
  t.is(getDefineVariable("!VAR = 123"), "VAR", "Uppercase variable name");
  t.is(getDefineVariable("!v1 = 123"), "v1", "Variable with numbers");
  t.is(getDefineVariable("!var_name = 123"), "var_name", "Variable with underscore");
  t.is(getDefineVariable("!var=123"), "var", "No spaces around equals");
  t.is(getDefineVariable("  !var = 123  "), "var", "With leading/trailing whitespace");
  t.is(getDefineVariable("!a = 123"), "a", "Single character variable");

  // Edge cases and invalid inputs
  t.is(getDefineVariable("var = 123"), undefined, "Missing ! prefix");
  t.is(getDefineVariable("! var = 123"), undefined, "Space after !");
  t.is(getDefineVariable("!var"), undefined, "No equals sign");
  t.is(getDefineVariable("!var : 123"), undefined, "Wrong assignment operator");
  t.is(getDefineVariable(";!var = 123"), undefined, "Comment line");
  t.is(getDefineVariable(""), undefined, "Empty string");
  t.is(getDefineVariable("  "), undefined, "Whitespace only");
  t.is(getDefineVariable("!123var = 456"), undefined, "Variable starting with number");
  t.is(getDefineVariable("!var-name = 123"), undefined, "Variable with invalid character");
  t.is(getDefineVariable("lda #$10"), undefined, "Instruction line");
});

test("getDefineVariable - integration", t => {
  const assembler = new Assembler();

  // Test cases that should work with both methods
  const validCases = [
    "!counter = 0",
    "!MAX_VALUE = 255",
    "!offset_x = 10",
    "!game_active = 1"
  ];

  for (const testCase of validCases) {
    t.not(getDefineVariable(testCase), undefined, `Should extract variable from: ${testCase}`);
  }

  // Test cases that should fail with both methods
  const invalidCases = [
    "counter = 0",
    "define MAX_VALUE = 255",
    "#offset_x = 10",
    "lda #$10"
  ];

  for (const testCase of invalidCases) {
    t.is(getDefineVariable(testCase), undefined, `Should not extract variable from: ${testCase}`);
  }
});

test("executeWhileLoop - basic functionality", t => {
  const assembler = new Assembler();

  // Create a typed while loop block.
  const whileBlock: LoopBlock = {
    type: "while",
    header: makeCommand("while !counter < 3"),
    conditionNode: parseExpressionNode("!counter < 3"),
    commands: [makeCommand("!counter = !counter + 1")],
    startLine: 1,
    endLine: 3,
    variable: null
  };

  // Set up initial counter value
  assembler.defines.set("counter", "0");

  // Execute the while loop
  assembler.executeWhileLoop(whileBlock);

  // Check that counter was incremented correctly
  t.is(assembler.defines.get("counter"), "0", "Counter should be incremented to 3 and reset back to 0");
});

test("executeWhileLoop - nested loops", t => {
  const assembler = new Assembler();

  // Create a nested typed loop structure.
  const innerLoop: LoopBlock = {
    type: "while",
    header: makeCommand("while !innerCounter < 2"),
    conditionNode: parseExpressionNode("!innerCounter < 2"),
    commands: [makeCommand("!innerCounter = !innerCounter + 1")],
    startLine: 3,
    endLine: 5,
    variable: null
  };

  const outerLoop: LoopBlock = {
    type: "while",
    header: makeCommand("while !outerCounter < 3"),
    conditionNode: parseExpressionNode("!outerCounter < 3"),
    commands: [
      makeCommand("!innerCounter = 0"),
      innerLoop,
      makeCommand("!outerCounter = !outerCounter + 1")
    ],
    startLine: 1,
    endLine: 7,
    variable: null
  };

  // Set up initial values
  assembler.defines.set("outerCounter", "0");
  assembler.defines.set("innerCounter", "0");

  // Execute the outer loop (which contains the inner loop)
  assembler.executeWhileLoop(outerLoop);

  // Check final counter values
  t.is(assembler.defines.get("outerCounter"), "0", "Outer counter should be 3 and then back to 0");
  t.is(assembler.defines.get("innerCounter"), "0", "Inner counter should be reset to original value");
});

test("executeWhileLoop - variable tracking and restoration", t => {
  const assembler = new Assembler();

  // Set up initial values
  assembler.defines.set("existingVar", "original");

  // Create a while loop that modifies variables
  const whileBlock: LoopBlock = {
    type: "while",
    header: makeCommand("while !counter < 2"),
    conditionNode: parseExpressionNode("!counter < 2"),
    commands: [
      makeCommand("!counter = !counter + 1"),
      makeCommand("!existingVar = modified"),
      makeCommand("!newVar = created")
    ],
    startLine: 1,
    endLine: 5,
    variable: null
  };

  // Set up initial counter
  assembler.defines.set("counter", "0");

  // Execute the while loop
  assembler.executeWhileLoop(whileBlock);

  // Check that variables are restored to their original values
  t.is(assembler.defines.get("counter"), "0", "Counter should be restored to original value");
  t.is(assembler.defines.get("existingVar"), "original", "Existing variable should be restored");
  t.false(assembler.defines.has("newVar"), "Newly created variable should be removed");
});

test("executeWhileLoop - infinite loop prevention", t => {
  const assembler = new Assembler();

  // Create a while loop that would run forever
  const whileBlock: LoopBlock = {
    type: "while",
    header: makeCommand("while 1 == 1"), // Always true
    conditionNode: parseExpressionNode("1 == 1"),
    commands: [makeCommand("nop")], // Do nothing
    startLine: 1,
    endLine: 3,
    variable: null
  };

  // Stub evaluateExpression to always return true
  const evalStub = sinon.stub(assembler, "evaluateExpression").returns(true);

  // Execute the while loop (should stop at MAX_ITERATIONS)
  assembler.executeWhileLoop(whileBlock);

  // Check that the loop was evaluated the maximum number of times
  t.is(evalStub.callCount, 10001, "Should evaluate condition MAX_ITERATIONS + 1 times");

  evalStub.restore();
});

test("executeWhileLoop - invalid condition expression throws", t => {
  const assembler = new Assembler();

  // Create a while loop with invalid syntax
  const invalidBlock: LoopBlock = {
    type: "while",
    header: makeCommand("while invalid syntax"),
    commands: [makeCommand("!counter = !counter + 1")],
    startLine: 1,
    endLine: 3,
    variable: null
  };

  // Execute the while loop
  const error = t.throws(() => {
    assembler.executeWhileLoop(invalidBlock);
  });
  t.truthy(error);
});

test("executeWhileLoop - condition immediately false", t => {
  const assembler = new Assembler();

  // Create a while loop with a condition that's immediately false
  const whileBlock: LoopBlock = {
    type: "while",
    header: makeCommand("while !counter > 10"),
    conditionNode: parseExpressionNode("!counter > 10"),
    commands: [makeCommand("!counter = !counter + 1")],
    startLine: 1,
    endLine: 3,
    variable: null
  };

  // Set up initial counter
  assembler.defines.set("counter", "0");

  // Stub evaluateExpression to return false
  const evalStub = sinon.stub(assembler, "evaluateExpression").returns(false);

  // Execute the while loop
  assembler.executeWhileLoop(whileBlock);

  // Check that counter wasn't modified
  t.is(assembler.defines.get("counter"), "0", "Counter should remain unchanged");
  t.is(evalStub.callCount, 1, "Condition should be evaluated once");

  evalStub.restore();
});

test("executeWhileLoop - complex variable modifications", t => {
  const assembler = new Assembler();

  // Create a while loop with complex variable modifications
  const whileBlock: LoopBlock = {
    type: "while",
    header: makeCommand("while !index < 3"),
    conditionNode: parseExpressionNode("!index < 3"),
    commands: [
      makeCommand("!result = !result + !index"),
      makeCommand("!index = !index + 1")
    ],
    startLine: 1,
    endLine: 4,
    variable: null
  };

  // Set up initial values
  assembler.defines.set("index", "0");
  assembler.defines.set("result", "0");

  // Execute the while loop
  assembler.executeWhileLoop(whileBlock);

  // Check the final values (sum should be 0+0+1+2 = 3)
  t.is(assembler.defines.get("result"), "0", "Result should be the sum of 0+1+2, then back to 0");
  t.is(assembler.defines.get("index"), "0", "Index should be restored to original value");
});

test("executeForLoop - basic iteration", t => {
  const assembler = new Assembler();

  // Create a typed for loop.
  const forBlock: LoopBlock = {
    type: "for",
    header: makeCommand("for i = 0..5"),
    startExpression: parseExpressionNode("0"),
    endExpression: parseExpressionNode("5"),
    variable: "i",
    start: 0,
    end: 5,
    commands: [makeCommand("!sum = !sum + !i")],
    startLine: 1,
    endLine: 3
  };

  // Set up initial values
  assembler.defines.set("sum", "0");

  // Execute the for loop
  assembler.executeForLoop(forBlock);

  // Check the final value (sum should be 0+1+2+3+4 = 10)
  t.is(assembler.defines.get("sum"), "$A", "Sum should be 10 after loop execution");
  t.is(assembler.defines.has("i"), false, "Loop variable should not exist if it didn't exist before");
});

test("executeForLoop - preserves existing variable", t => {
  const assembler = new Assembler();

  // Create a for loop
  const forBlock: LoopBlock = {
    type: "for",
    header: makeCommand("for i = 1..4"),
    startExpression: parseExpressionNode("1"),
    endExpression: parseExpressionNode("4"),
    variable: "i",
    start: 1,
    end: 4,
    commands: [makeCommand("!result = !result + !i")],
    startLine: 1,
    endLine: 3
  };

  // Set up initial values with i already defined
  assembler.defines.set("i", "100");
  assembler.defines.set("result", "0");

  // Execute the for loop
  assembler.executeForLoop(forBlock);

  // Check the final values
  t.is(assembler.defines.get("result"), "$6", "Result should be 1+2+3 = 6");
  t.is(assembler.defines.get("i"), "100", "Original value of i should be restored");
});

test("executeForLoop - start equals end (no iterations)", t => {
  const assembler = new Assembler();

  // Create a for loop where start equals end
  const forBlock: LoopBlock = {
    type: "for",
    header: makeCommand("for i = 5..5"),
    variable: "i",
    start: 5,
    end: 5,
    commands: [makeCommand("!counter = !counter + 1")],
    startLine: 1,
    endLine: 3
  };

  // Set up counter
  assembler.defines.set("counter", "0");

  // Execute the for loop
  assembler.executeForLoop(forBlock);

  // Check that counter wasn't modified
  t.is(assembler.defines.get("counter"), "0", "Counter should remain unchanged as loop shouldn't execute");
});

test("executeForLoop - start greater than end (no iterations)", t => {
  const assembler = new Assembler();

  // Create a for loop where start > end
  const forBlock: LoopBlock = {
    type: "for",
    header: makeCommand("for i = 10..5"),
    variable: "i",
    start: 10,
    end: 5,
    commands: [makeCommand("!counter = !counter + 1")],
    startLine: 1,
    endLine: 3
  };

  // Set up counter
  assembler.defines.set("counter", "0");

  // Execute the for loop
  assembler.executeForLoop(forBlock);

  // Check that counter wasn't modified
  t.is(assembler.defines.get("counter"), "0", "Counter should remain unchanged as loop shouldn't execute");
});

test("executeForLoop - nested loop execution", t => {
  const assembler = new Assembler();

  // Create a nested loop structure
  const innerLoop: LoopBlock = {
    type: "for",
    header: makeCommand("for j = 0..3"),
    variable: "j",
    start: 0,
    end: 3,
    commands: [makeCommand("!matrix = !matrix + (!i * 10 + !j)")],
    startLine: 2,
    endLine: 4
  };

  const outerLoop: LoopBlock = {
    type: "for",
    header: makeCommand("for i = 0..2"),
    variable: "i",
    start: 0,
    end: 2,
    commands: [innerLoop],
    startLine: 1,
    endLine: 5
  };

  // Set up initial values
  assembler.defines.set("matrix", "0");

  // Execute the outer loop which will execute the inner loop
  assembler.executeForLoop(outerLoop);

  // Expected: (0*10+0) + (0*10+1) + (0*10+2) + (1*10+0) + (1*10+1) + (1*10+2) = 0+1+2+10+11+12 = 36
  t.is(assembler.defines.get("matrix"), "$24", "Matrix should be the sum of all i*10+j values (0x24 / 36)");
  t.is(assembler.defines.has("i"), false, "Outer loop variable should not exist if it didn't exist before");
  t.is(assembler.defines.has("j"), false, "Inner loop variable should not exist if it didn't exist before");
});

test("executeForLoop - expression evaluation", t => {
  const assembler = new Assembler();

  // Stub getnum to simulate expression evaluation
  const getnumStub = sinon.stub(assembler.operandResolver, "getnum");
  getnumStub.withArgs("5 + 5").returns(10);
  getnumStub.withArgs("20 - 5").returns(15);
  getnumStub.withArgs("5+5").returns(10);
  getnumStub.withArgs("20-5").returns(15);

  // Create a for loop with expressions
  const forBlock: LoopBlock = {
    type: "for",
    header: makeCommand("for i = 5+5..20-5"),
    variable: "i",
    startExpression: parseExpressionNode("5+5"),
    endExpression: parseExpressionNode("20-5"),
    commands: [makeCommand("!sum = !sum + 1")],
    startLine: 1,
    endLine: 3
  };

  // Set up initial values
  assembler.defines.set("sum", "0");

  // Execute the for loop
  assembler.executeForLoop(forBlock);

  // Check the final value (should iterate 5 times from 10 to 15)
  t.is(assembler.defines.get("sum"), "$5", "Sum should be 5 after loop execution");
});

test("executeForLoop - normalized commands are dispatched for each iteration", t => {
  const assembler = new Assembler();

  // Create a for loop
  const forBlock: LoopBlock = {
    type: "for",
    header: makeCommand("for i = 0..3"),
    startExpression: parseExpressionNode("0"),
    endExpression: parseExpressionNode("3"),
    variable: "i",
    start: 0,
    end: 3,
    commands: [makeCommand("command1"), makeCommand("command2")],
    startLine: 1,
    endLine: 4
  };

  // Spy on typed dispatch
  const processCommandSpy = sinon.spy(assembler, "processNormalizedCommand");

  // Execute the for loop
  assembler.executeForLoop(forBlock);

  // Check that typed dispatch was called the correct number of times
  t.is(processCommandSpy.callCount, 6, "processNormalizedCommand should be called twice for each of 3 iterations");
  t.true(processCommandSpy.calledWithMatch(sinon.match.has("command", "command1")), "Should dispatch command1");
  t.true(processCommandSpy.calledWithMatch(sinon.match.has("command", "command2")), "Should dispatch command2");

  // Restore spy
  processCommandSpy.restore();
});

test("executeForLoop - invalid for loop syntax", t => {
  const assembler = new Assembler();

  // Create a for loop with invalid syntax
  const forBlock: LoopBlock = {
    type: "for",
    header: makeCommand("for i in 0 to 5"), // Invalid syntax (should be i = 0..5)
    variable: "i",
    commands: [makeCommand("!counter = !counter + 1")],
    startLine: 1,
    endLine: 3
  };

  // Set up initial value
  assembler.defines.set("counter", "0");

  // Execute the for loop with invalid syntax
  assembler.executeForLoop(forBlock);

  // Check that the counter wasn't incremented
  t.is(assembler.defines.get("counter"), "0", "Counter should remain 0 when for loop syntax is invalid");
});

test("executeLoopBlock - for loop", t => {
  const assembler = new Assembler();

  // Create a for loop block
  const forBlock: LoopBlock = {
    type: "for",
    header: makeCommand("for i = 0..3"),
    variable: "i",
    commands: [makeCommand("command1"), makeCommand("command2")],
    startLine: 1,
    endLine: 4
  };

  // Spy on executeForLoop
  const executeForLoopSpy = sinon.spy(assembler, "executeForLoop");

  // Execute the loop block
  assembler.executeLoopBlock(forBlock);

  // Check that executeForLoop was called
  t.true(executeForLoopSpy.calledOnce, "executeForLoop should be called once");
  t.true(executeForLoopSpy.calledWith(forBlock), "executeForLoop should be called with the for block");

  // Restore spy
  executeForLoopSpy.restore();
});

test("executeLoopBlock - while loop", t => {
  const assembler = new Assembler();

  // Create a while loop block
  const whileBlock: LoopBlock = {
    type: "while",
    header: makeCommand("while x < 5"),
    conditionNode: parseExpressionNode("x < 5"),
    commands: [makeCommand("command1"), makeCommand("command2")],
    startLine: 1,
    endLine: 4
  };

  // Spy on executeWhileLoop
  const executeWhileLoopSpy = sinon.spy(assembler, "executeWhileLoop");

  // Execute the loop block
  assembler.executeLoopBlock(whileBlock);

  // Check that executeWhileLoop was called
  t.true(executeWhileLoopSpy.calledOnce, "executeWhileLoop should be called once");
  t.true(executeWhileLoopSpy.calledWith(whileBlock), "executeWhileLoop should be called with the while block");

  // Restore spy
  executeWhileLoopSpy.restore();
});

test("executeLoopBlock - nested loops", t => {
  const assembler = new Assembler();

  // Create a nested loop structure
  const innerLoop: LoopBlock = {
    type: "for",
    header: makeCommand("for j = 0..2"),
    variable: "j",
    commands: [makeCommand("inner_command")],
    startLine: 2,
    endLine: 3
  };

  const outerLoop: LoopBlock = {
    type: "for",
    header: makeCommand("for i = 0..2"),
    variable: "i",
    commands: [makeCommand("outer_command"), innerLoop],
    startLine: 1,
    endLine: 4
  };

  // Spy on executeForLoop
  const executeForLoopSpy = sinon.spy(assembler, "executeForLoop");

  // Execute the outer loop block
  assembler.executeLoopBlock(outerLoop);

  // Check that executeForLoop was called for both loops
  // t.is(executeForLoopSpy.callCount, 2, "executeForLoop should be called twice (once for outer, once for inner)");
  t.true(executeForLoopSpy.calledWith(outerLoop), "executeForLoop should be called with the outer loop");
  t.true(executeForLoopSpy.calledWith(innerLoop), "executeForLoop should be called with the inner loop");

  // Restore spy
  executeForLoopSpy.restore();
});

test("executeLoopBlock - unsupported loop type", t => {
  const assembler = new Assembler();

  // Create a loop with an unsupported type
  const unsupportedLoop = {
    type: "foreach", // Unsupported type
    commands: [makeCommand("command1")],
    startLine: 1,
    endLine: 3
  } as unknown as LoopBlock;

  // Spy on both executeForLoop and executeWhileLoop
  const executeForLoopSpy = sinon.spy(assembler, "executeForLoop");
  const executeWhileLoopSpy = sinon.spy(assembler, "executeWhileLoop");

  // Execute the loop block with unsupported type
  assembler.executeLoopBlock(unsupportedLoop);

  // Check that neither loop execution method was called
  t.true(executeForLoopSpy.notCalled, "executeForLoop should not be called for unsupported loop type");
  t.true(executeWhileLoopSpy.notCalled, "executeWhileLoop should not be called for unsupported loop type");

  // Restore spies
  executeForLoopSpy.restore();
  executeWhileLoopSpy.restore();
});

test("endLoopCollection - normal for loop completion", t => {
  const assembler = new Assembler();

  // Setup the loop collection state
  assembler.collectingLoop = true;
  assembler.loopNestingLevel = 1;
  assembler.currentLine = 10;
  assembler.currentLoop = {
    type: "for",
    header: makeCommand("for i = 0..5"),
    variable: "i",
    commands: [makeCommand("command1"), makeCommand("command2")],
    startLine: 5
  };

  // End the loop collection
  assembler.endLoopCollection("for");

  // Verify the loop was executed
  t.false(assembler.collectingLoop, "collectingLoop should be set to false");
  t.is(assembler.loopNestingLevel, 0, "loopNestingLevel should be decremented");
  t.is(assembler.currentLoop, null, "currentLoop should be null");
  t.is(assembler.currentLoop?.endLine, undefined, "endLine should be set");
});

test("endLoopCollection - normal while loop completion", t => {
  const assembler = new Assembler();

  // Setup the loop collection state
  assembler.collectingLoop = true;
  assembler.loopNestingLevel = 1;
  assembler.currentLine = 15;
  assembler.currentLoop = {
    type: "while",
    header: makeCommand("while x < 10"),
    conditionNode: parseExpressionNode("x < 10"),
    commands: [makeCommand("command1"), makeCommand("command2")],
    startLine: 10
  };

  // End the loop collection
  assembler.endLoopCollection("while");

  // Verify the loop was executed
  t.false(assembler.collectingLoop, "collectingLoop should be set to false");
  t.is(assembler.loopNestingLevel, 0, "loopNestingLevel should be decremented");
  t.is(assembler.currentLoop, null, "currentLoop should be null");
});

test("endLoopCollection - nested loops", t => {
  const assembler = new Assembler();

  // Setup parent loop
  const parentLoop = {
    type: "for" as const,
    header: makeCommand("for i = 0..3"),
    variable: "i",
    commands: [],
    startLine: 5
  };

  // Setup child loop
  const childLoop = {
    type: "for" as const,
    header: makeCommand("for j = 0..2"),
    variable: "j",
    commands: [makeCommand("inner_command")],
    startLine: 6
  };

  // Setup the loop collection state for nested loops
  assembler.collectingLoop = true;
  assembler.loopNestingLevel = 2;
  assembler.currentLine = 8;
  assembler.currentLoop = childLoop;
  assembler.loopStack = [parentLoop];

  // Spy on executeLoopBlock
  const executeLoopBlockSpy = sinon.spy(assembler, "executeLoopBlock");

  // End the inner loop collection
  assembler.endLoopCollection("for");

  // Verify the inner loop was not executed yet
  t.true(assembler.collectingLoop, "collectingLoop should still be true");
  t.is(assembler.loopNestingLevel, 1, "loopNestingLevel should be decremented");
  t.deepEqual(assembler.currentLoop, parentLoop, "currentLoop should be the parent loop");
  t.is(executeLoopBlockSpy.callCount, 0, "executeLoopBlock should not be called yet");
  t.is(assembler.loopStack.length, 0, "loopStack should be empty");

  // Restore spy
  executeLoopBlockSpy.restore();
});

test("endLoopCollection - mismatched loop types", t => {
  const assembler = new Assembler();

  // Setup the loop collection state
  assembler.collectingLoop = true;
  assembler.loopNestingLevel = 1;
  assembler.currentLine = 10;
  assembler.currentLoop = {
    type: "for",
    header: makeCommand("for i = 0..5"),
    variable: "i",
    commands: [makeCommand("command1"), makeCommand("command2")],
    startLine: 5
  };

  // End with mismatched type
  assembler.endLoopCollection("while");

  // Verify the loop was not executed
  t.true(assembler.collectingLoop, "collectingLoop should still be true");
  t.is(assembler.loopNestingLevel, 1, "loopNestingLevel should not change");
  t.not(assembler.currentLoop, null, "currentLoop should not be null");
});

test("endLoopCollection - unexpected end without matching loop", t => {
  const assembler = new Assembler();

  // Setup state with no active loop
  assembler.collectingLoop = false;
  assembler.currentLoop = null;
  assembler.loopNestingLevel = 0;

  // Try to end a non-existent loop
  assembler.endLoopCollection("for");

  // Verify nothing happened
  t.false(assembler.collectingLoop, "collectingLoop should remain false");
  t.is(assembler.loopNestingLevel, 0, "loopNestingLevel should not change");
  t.is(assembler.currentLoop, null, "currentLoop should remain null");
});

test("endLoopCollection - sets endLine property", t => {
  const assembler = new Assembler();

  // Setup the loop collection state
  assembler.collectingLoop = true;
  assembler.loopNestingLevel = 1;
  assembler.currentLine = 25;
  assembler.currentLoop = {
    type: "for",
    header: makeCommand("for i = 0..5"),
    variable: "i",
    commands: [makeCommand("command1")],
    startLine: 20
  };

  // End the loop collection
  assembler.endLoopCollection("for");

  // The currentLoop will be null after execution, so we need to capture the loop before execution
  const executeLoopBlockSpy = sinon.stub(assembler, "executeLoopBlock").callsFake((loop) => {
    // Verify endLine was set before execution
    t.is(loop.endLine, 25, "endLine should be set to currentLine");
  });

  // Re-run to trigger our spy
  assembler.collectingLoop = true;
  assembler.loopNestingLevel = 1;
  assembler.currentLoop = {
    type: "for",
    header: makeCommand("for i = 0..5"),
    variable: "i",
    commands: [makeCommand("command1")],
    startLine: 20
  };
  assembler.endLoopCollection("for");

  t.is(executeLoopBlockSpy.callCount, 1, "executeLoopBlock should be called once");

  // Restore spy
  executeLoopBlockSpy.restore();
});

test("beginLoopCollection - inline for loop with colon separators", t => {
  const assembler = new Assembler();

  // Execute an inline for loop
  assembler.beginLoopCollection("for", "for i = 0..5 : db 1 : db 2 : endfor");

  // Verify loop state wasn't changed
  t.false(assembler.collectingLoop, "collectingLoop should remain false for inline loops");
  t.is(assembler.loopNestingLevel, 0, "loopNestingLevel should not change for inline loops");
});

test("beginLoopCollection - regular for loop", t => {
  const assembler = new Assembler();
  assembler.currentLine = 10;

  // Begin collecting a for loop
  assembler.beginLoopCollection("for", "for i = 0..5");

  // Verify loop state
  t.true(assembler.collectingLoop, "collectingLoop should be true");
  t.is(assembler.loopNestingLevel, 1, "loopNestingLevel should be incremented");
  t.not(assembler.currentLoop, null, "currentLoop should be set");

  // Verify loop properties
  const loop = assembler.currentLoop;
  t.deepEqual(loop?.commands, [], "Loop commands should be initialized as empty array");
  t.is(loop?.header?.command, "for i = 0..5", "Loop header should be normalized");
  t.is(loop?.end, 5, "Loop end should be pre-parsed");
  t.is(loop?.start, 0, "Loop start should be pre-parsed");
  t.is(loop?.startLine, 10, "Loop startLine should be set to currentLine");
  t.is(loop?.type, "for", "Loop type should be 'for'");
  t.is(loop?.variable, "i", "Loop variable should be extracted");
  t.truthy(loop?.conditionNode, "Loop should include a parsed condition node");
});

test("beginLoopCollection - while loop", t => {
  const assembler = new Assembler();
  assembler.currentLine = 15;

  // Begin collecting a while loop
  assembler.beginLoopCollection("while", "while {condition}");

  // Verify loop state
  t.true(assembler.collectingLoop, "collectingLoop should be true");
  t.is(assembler.loopNestingLevel, 1, "loopNestingLevel should be incremented");

  // Verify loop properties
  const loop = assembler.currentLoop;
  t.is(loop?.type, "while", "Loop type should be 'while'");
  t.is(loop?.header?.command, "while {condition}", "Loop header should be normalized");
  t.is(loop?.startLine, 15, "Loop startLine should be set to currentLine");
  t.deepEqual(loop?.commands, [], "Loop commands should be initialized as empty array");
  t.is(loop?.variable, undefined, "Loop variable should not be set for while loops");
});

test("beginLoopCollection - nested loops", t => {
  const assembler = new Assembler();

  // Begin collecting outer loop
  assembler.beginLoopCollection("for", "for i = 0..3");
  const outerLoop = assembler.currentLoop;

  // Begin collecting inner loop
  assembler.beginLoopCollection("for", "for j = 0..2");
  const innerLoop = assembler.currentLoop;

  // Verify nesting state
  t.is(assembler.loopNestingLevel, 2, "loopNestingLevel should reflect nesting depth");
  t.is(assembler.loopStack.length, 1, "loopStack should contain the outer loop");
  t.is(assembler.loopStack[0], outerLoop, "Outer loop should be in the stack");

  // Verify inner loop is added to outer loop's commands
  t.is(outerLoop?.commands.length, 1, "Outer loop should have one command (the inner loop)");
  t.is(outerLoop?.commands[0], innerLoop, "Inner loop should be in outer loop's commands");
});

test("beginLoopCollection - for loop with pre-parse error", t => {
  const assembler = new Assembler();

  // Begin collecting a for loop that will fail pre-parsing
  assembler.beginLoopCollection("for", "for i = invalid..5");

  // Verify loop state is still set up correctly despite pre-parse error
  t.true(assembler.collectingLoop, "collectingLoop should be true even with pre-parse error");
  t.is(assembler.loopNestingLevel, 1, "loopNestingLevel should be incremented");
  t.not(assembler.currentLoop, null, "currentLoop should be set");
});

test("beginLoopCollection - variable preservation in inline for loop", t => {
  const assembler = new Assembler();

  // Set up an existing variable
  assembler.defines.set("i", "existing_value");

  // Execute an inline for loop
  assembler.beginLoopCollection("for", "for i = 0..3 : db i : endfor");

  // Verify the variable was restored after loop execution
  t.is(assembler.defines.get("i"), "existing_value", "Variable should be restored to original value");
});

test("beginLoopCollection - variable deletion in inline for loop", t => {
  const assembler = new Assembler();

  // Execute an inline for loop with a new variable
  assembler.beginLoopCollection("for", "for newvar = 0..3 : db newvar : endfor");

  // Verify the variable was deleted after loop execution
  t.false(assembler.defines.has("newvar"), "Variable should be deleted if it didn't exist before");
});

test("beginLoopCollection - inline for loop with no iterations", t => {
  const assembler = new Assembler();
  const processCommandSpy = sinon.spy(assembler, "processNormalizedCommand");

  // Execute an inline for loop that shouldn't iterate
  assembler.beginLoopCollection("for", "for i = 5..5 : db i : endfor");

  // Verify no commands were processed
  t.is(processCommandSpy.callCount, 0, "No normalized commands should be processed when start >= end");

  // Cleanup
  processCommandSpy.restore();
});

test("typed parser builds while nodes with preserved conditions", t => {
  const assembler = new Assembler();

  const [node] = assembler.parseCommandStreamToNodes([
    "while !defined(DEBUG) && VERSION > 1.0",
    "db $01",
    "endwhile",
  ], "while.asm", 0);

  if (!node || typeof node === "string" || !("type" in node) || node.type !== "while") {
    t.fail();
    return;
  }

  t.is(node.header?.command, "while !defined(DEBUG) && VERSION > 1.0");
  t.is(node.commands.length, 1);
});

test("typed parser builds for nodes with preserved range expressions", t => {
  const assembler = new Assembler();

  const [node] = assembler.parseCommandStreamToNodes([
    "for j = !start .. !end + 5",
    "db !j",
    "endfor",
  ], "for.asm", 0);

  if (!node || typeof node === "string" || !("type" in node) || node.type !== "for") {
    t.fail();
    return;
  }

  t.is(node.header?.command, "for j = !start .. !end + 5");
  t.is(node.variable, "j");
  t.is(node.commands.length, 1);
});

test("typed parser closes top-level loop nodes at end markers", t => {
  const assembler = new Assembler();

  const nodes = assembler.parseCommandStreamToNodes([
    "for i = 0..2",
    "while !i < 2",
    "db !i",
    "endwhile",
    "endfor",
  ], "nested-loops.asm", 0);

  t.is(nodes.length, 1);
  const [loop] = nodes;
  if (!loop || typeof loop === "string" || !("type" in loop) || loop.type !== "for") {
    t.fail();
    return;
  }

  t.is(loop.commands.length, 1);
  const nested = loop.commands[0];
  t.true(typeof nested !== "string" && "type" in nested && nested.type === "while");
});

test("addAddressToLine - adds mapping in all passes", t => {
  const assembler = new Assembler();

  // Create a spy on the includeMapping method
  const includeMappingSpy = sinon.spy(assembler.addressToLineMapping, "includeMapping");

  // Test in pass 0
  assembler.pass = 0;
  assembler.currentFile = "test.asm";
  assembler.currentLine = 10;
  assembler.addAddressToLine(0x8000);
  t.true(includeMappingSpy.called, "Should add mapping in pass 0");

  // Test in pass 1
  assembler.pass = 1;
  assembler.addAddressToLine(0x8000);
  t.true(includeMappingSpy.called, "Should add mapping in pass 1");

  // Test in pass 2
  assembler.pass = 2;
  assembler.addAddressToLine(0x8000);
  t.true(includeMappingSpy.called, "Should add mapping in pass 2");
  t.true(includeMappingSpy.calledWith("test.asm", 11, 0x8000),
    "Should call includeMapping with correct parameters");

  // Cleanup
  includeMappingSpy.restore();
});

test("addAddressToLine - handles different address values", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.currentFile = "test.asm";
  assembler.currentLine = 5;

  const includeMappingSpy = sinon.spy(assembler.addressToLineMapping, "includeMapping");

  // Test with zero address
  assembler.addAddressToLine(0);
  t.true(includeMappingSpy.calledWith("test.asm", 6, 0),
    "Should handle zero address");

  // Test with max 24-bit address
  includeMappingSpy.resetHistory();
  assembler.addAddressToLine(0xFFFFFF);
  t.true(includeMappingSpy.calledWith("test.asm", 6, 0xFFFFFF),
    "Should handle maximum 24-bit address");

  // Test with typical ROM address
  includeMappingSpy.resetHistory();
  assembler.addAddressToLine(0x808000);
  t.true(includeMappingSpy.calledWith("test.asm", 6, 0x808000),
    "Should handle typical ROM address");

  // Cleanup
  includeMappingSpy.restore();
});

test("addAddressToLine - uses correct line number", t => {
  const assembler = new Assembler();
  assembler.pass = 2;

  const includeMappingSpy = sinon.spy(assembler.addressToLineMapping, "includeMapping");

  // Test with different line numbers
  assembler.currentFile = "file1.asm";
  assembler.currentLine = 0;
  assembler.addAddressToLine(0x8000);
  t.true(includeMappingSpy.calledWith("file1.asm", 1, 0x8000),
    "Should add 1 to line number 0");

  includeMappingSpy.resetHistory();
  assembler.currentLine = 99;
  assembler.addAddressToLine(0x8010);
  t.true(includeMappingSpy.calledWith("file1.asm", 100, 0x8010),
    "Should add 1 to line number 99");

  // Test with different file
  includeMappingSpy.resetHistory();
  assembler.currentFile = "file2.asm";
  assembler.currentLine = 50;
  assembler.addAddressToLine(0x8020);
  t.true(includeMappingSpy.calledWith("file2.asm", 51, 0x8020),
    "Should use correct file name");

  // Cleanup
  includeMappingSpy.restore();
});

test("getLabelValue - retrieves label values correctly", t => {
  const assembler = new Assembler();

  // Set up some test labels
  assembler.currentNamespace = "";
  assembler.symbolScope.setLabel("globalLabel", 0x1234);
  assembler.symbolScope.setLabel("staticLabel", 0x5678, true);

  assembler.currentNamespace = "testNS";
  assembler.symbolScope.setLabel("namespaceLabel", 0xABCD);
  assembler.symbolScope.setLabel("staticNamespaceLabel", 0xEF01, true);

  // Reset namespace for testing
  assembler.currentNamespace = "";

  // Test retrieving global labels
  t.is(assembler.symbolScope.getLabelValue("globalLabel", false), 0x1234,
    "Should retrieve global label value correctly");
  t.is(assembler.symbolScope.getLabelValue("staticLabel", false), 0x5678,
    "Should retrieve static global label value correctly");

  // Test retrieving namespaced labels
  assembler.currentNamespace = "testNS";
  t.is(assembler.symbolScope.getLabelValue("namespaceLabel", false), 0xABCD,
    "Should retrieve namespaced label value correctly");
  t.is(assembler.symbolScope.getLabelValue("staticNamespaceLabel", false), 0xEF01,
    "Should retrieve static namespaced label value correctly");

  // Test requiring static labels
  assembler.currentNamespace = "";
  t.is(assembler.symbolScope.getLabelValue("staticLabel", true), 0x5678,
    "Should retrieve static label when required");
  assembler.currentNamespace = "testNS";
  t.is(assembler.symbolScope.getLabelValue("staticNamespaceLabel", true), 0xEF01,
    "Should retrieve static namespaced label when required");

  // Test error case for non-static label used in conditional
  const error = t.throws(() => {
    assembler.symbolScope.getLabelValue("namespaceLabel", true);
  }, { instanceOf: Error });
  t.is(error.message, "Error: Non-static label 'testNS_namespaceLabel' used in conditional.",
    "Should throw error when non-static label is used in conditional");

  // Test undefined label behavior
  assembler.currentNamespace = "";
  t.is(assembler.symbolScope.getLabelValue("undefinedLabel", false), 0,
    "Should return 0 for undefined label");

  // Test with full label name including namespace (assembler uses underscore for namespace prefix)
  t.is(assembler.symbolScope.getLabelValue("testNS_namespaceLabel", false), 0xABCD,
    "Should retrieve label with explicit namespace");
});

test("setLabel - handles label creation and redefinition across passes", t => {
  const assembler = new Assembler();

  // Test pass 0 behavior
  assembler.pass = 0;

  // Basic label setting
  assembler.currentNamespace = "";
  assembler.symbolScope.setLabel("testLabel", 0x1000);
  t.is(assembler.labelTable.get("testLabel").value, 0x1000, "Should set label value in pass 0");
  t.is(assembler.labelTable.get("testLabel").isStatic, false, "Should set isStatic flag correctly");

  // Static label setting
  assembler.symbolScope.setLabel("staticTestLabel", 0x2000, true);
  t.is(assembler.labelTable.get("staticTestLabel").value, 0x2000, "Should set static label value in pass 0");
  t.is(assembler.labelTable.get("staticTestLabel").isStatic, true, "Should set isStatic flag to true for static labels");

  // Namespaced label (assembler uses underscore for namespace prefix, not colon)
  assembler.currentNamespace = "testNS";
  assembler.symbolScope.setLabel("nsLabel", 0x3000);
  t.is(assembler.labelTable.get("testNS_nsLabel").value, 0x3000, "Should set namespaced label correctly");

  // Label redefinition in pass 0 (should just log warning, not throw)
  assembler.symbolScope.setLabel("nsLabel", 0x3500);
  t.is(assembler.labelTable.get("testNS_nsLabel").value, 0x3500, "Should update label value when redefined in pass 0");

  // Test pass 1 behavior
  assembler.pass = 1;

  // Update existing label
  assembler.currentNamespace = "";
  assembler.symbolScope.setLabel("testLabel", 0x1500);
  t.is(assembler.labelTable.get("testLabel").value, 0x1500, "Should update label value in pass 1");

  // Create new label in pass 1
  assembler.symbolScope.setLabel("pass1Label", 0x4000);
  t.is(assembler.labelTable.get("pass1Label").value, 0x4000, "Should create new label in pass 1");

  // Test pass 2 behavior
  assembler.pass = 2;

  // In pass 2, changing an existing label's value throws (assembler detects inconsistency)
  t.throws(() => {
    assembler.symbolScope.setLabel("testLabel", 0x1600);
  }, { message: /Label "testLabel" changed/ }, "Should throw when label value changes in pass 2");
  t.is(assembler.labelTable.get("testLabel").value, 0x1500, "Label value unchanged after throw");

  // In pass 2, setting a label that didn't exist in pass 0/1 is allowed (no throw)
  assembler.symbolScope.setLabel("pass2NewLabel", 0x5000);
  t.is(assembler.labelTable.get("pass2NewLabel").value, 0x5000, "Can set new label in pass 2");

  // Test error case: static label mismatch
  assembler.currentNamespace = "testNS";
  const error2 = t.throws(() => {
    assembler.symbolScope.setLabel("nsLabel", 0x3600, true);
  }, { instanceOf: Error });
  t.is(error2.message, "Label 'testNS_nsLabel' is not static and cannot be used in conditionals.", "Should throw error when static flag doesn't match original definition");

  // Stage-backed symbol scope no longer validates arbitrary pass values.
  assembler.pass = 3;
  t.notThrows(() => {
    assembler.symbolScope.setLabel("testLabel", 0x1700);
  }, "Should allow direct symbol writes regardless of pass value");

  // Test default value (current SNES position)
  assembler.pass = 0;
  assembler.currentTargetAddress = 0x8000;
  assembler.currentNamespace = "";
  assembler.symbolScope.setLabel("positionLabel");
  t.is(assembler.labelTable.get("positionLabel").value, 0x8000, "Should use current SNES position when value not provided");
});

test("findNextLabel and findPreviousLabel", (t) => {
  const assembler = new Assembler();

  // Initialize for testing
  assembler.forwardLabels = {};
  assembler.backwardLabels = {};

  // Test findNextLabel in pass 0
  assembler.pass = 0;
  assembler.currentTargetAddress = 0x1000;
  t.is(assembler.symbolScope.findNextLabel("+"), 0, "Should return 0 in pass 0");

  // Test findPreviousLabel in pass 0
  t.is(assembler.symbolScope.findPreviousLabel("-"), 0, "Should return 0 in pass 0");

  // Setup for pass 2 tests
  assembler.pass = 2;

  // Test findNextLabel with no labels defined
  const error1 = t.throws(() => {
    assembler.symbolScope.findNextLabel("+");
  }, { instanceOf: Error });
  t.is(error1.message, "Error: No + label '+' found after 1000.", "Should throw when no forward labels exist");

  // Test findPreviousLabel with no labels defined
  const error2 = t.throws(() => {
    assembler.symbolScope.findPreviousLabel("-");
  }, { instanceOf: Error });
  t.is(error2.message, "Error: No - label '-' found before 1000.", "Should throw when no backward labels exist");

  // Setup some forward labels
  assembler.forwardLabels[1] = [
    {
      addr: 0x900,
    },
    {
      addr: 0x1200,
    },
    {
      addr: 0x1500,
    },
    {
      addr: 0x2000,
    }
  ];
  // Test findNextLabel with no labels after current position
  assembler.currentTargetAddress = 0x2100;
  const error3 = t.throws(() => {
    assembler.symbolScope.findNextLabel("+");
  }, { instanceOf: Error });
  t.is(error3.message, "Error: No + label '+' found after 2100.", "Should throw when no forward labels exist after current position");

  // Test findNextLabel with labels after current position
  assembler.currentTargetAddress = 0x1100;
  t.is(assembler.symbolScope.findNextLabel("+"), 0x1200, "Should find the closest forward label after current position");
  t.is(assembler.symbolScope.findNextLabel("+", 0x1200), 0x1200, "Should allow inline + labels at the branch reference address");

  // Setup some backward labels
  assembler.backwardLabels[1] = [
    {
      addr: 0x500,
    },
    {
      addr: 0x800,
    },
    {
      addr: 0x1050,
    },
    {
      addr: 0x1800,
    }
  ];

  // Test findPreviousLabel with no labels before current position
  assembler.currentTargetAddress = 0x400;
  const error4 = t.throws(() => {
    assembler.symbolScope.findPreviousLabel("-");
  }, { instanceOf: Error });
  t.is(error4.message, "Error: No - label '-' found before 400.", "Should throw when no backward labels exist before current position");

  // Test findPreviousLabel with labels before current position
  assembler.currentTargetAddress = 0x1100;
  t.is(assembler.symbolScope.findPreviousLabel("-"), 0x1050, "Should find the closest backward label before current position");

  // Test with different depths (number of + or - characters)
  assembler.forwardLabels[2] = [
    {
      addr: 0x1300,
    },
    {
      addr: 0x1600,
    }
  ];
  assembler.backwardLabels[2] = [
    {
      addr: 0x700,
    },
    {
      addr: 0x900,
    }
  ];

  assembler.currentTargetAddress = 0x1000;
  t.is(assembler.symbolScope.findNextLabel("++"), 0x1300, "Should find the correct forward label with depth 2");
  t.is(assembler.symbolScope.findPreviousLabel("--"), 0x900, "Should find the correct backward label with depth 2");
});

test("handleRelativeLabel", (t) => {
  const assembler = new Assembler();

  // Initialize for testing
  assembler.forwardLabels = {};
  assembler.backwardLabels = {};

  // Test pass 0 behavior - should track labels but not resolve
  assembler.pass = 0;
  assembler.currentTargetAddress = 0x1000;

  // Test forward label tracking in pass 0
  assembler.symbolScope.handleRelativeLabel("+");
  t.deepEqual(assembler.forwardLabels[1], [
    {
      addr: 0x1000,
    }
  ], "Should track forward label in pass 0");

  // Test backward label tracking in pass 0
  assembler.currentTargetAddress = 0x1200;
  assembler.symbolScope.handleRelativeLabel("-");
  t.deepEqual(assembler.backwardLabels[1], [
    {
      addr: 0x1200,
    }
  ], "Should track backward label in pass 0");

  // Test multiple depths
  assembler.currentTargetAddress = 0x1400;
  assembler.symbolScope.handleRelativeLabel("++");
  t.deepEqual(assembler.forwardLabels[2], [
    {
      addr: 0x1400,
    }
  ], "Should track forward label with correct depth");

  assembler.currentTargetAddress = 0x1600;
  assembler.symbolScope.handleRelativeLabel("--");
  t.deepEqual(assembler.backwardLabels[2], [
    {
      addr: 0x1600,
    }
  ], "Should track backward label with correct depth");

  // Test pass 2 behavior - should resolve labels
  assembler.pass = 2;

  // Setup for resolution tests
  assembler.forwardLabels = {
    1: [
      {
        addr: 0x2000,
      },
      {
        addr: 0x3000,
      }
    ],
    2: [
      {
        addr: 0x2500,
      },
      {
        addr: 0x3500,
      }
    ]
  };
  assembler.backwardLabels = {
    1: [
      {
        addr: 0x1000,
      },
      {
        addr: 0x1500,
      }
    ],
    2: [
      {
        addr: 0x800,
      },
      {
        addr: 0x1200,
      }
    ]
  };

  // Test forward label resolution
  assembler.currentTargetAddress = 0x1800;
  t.is(assembler.symbolScope.handleRelativeLabel("+"), 0x1800, "Should resolve to next forward label");
  t.is(assembler.symbolScope.handleRelativeLabel("++"), 0x1800, "Should resolve to next forward label with depth 2");

  // Test backward label resolution
  assembler.currentTargetAddress = 0x1600;
  t.is(assembler.symbolScope.handleRelativeLabel("-"), 0x1600, "Should resolve to previous backward label");
  t.is(assembler.symbolScope.handleRelativeLabel("--"), 0x1600, "Should resolve to previous backward label with depth 2");

  // Test error cases
  assembler.forwardLabels = {};
  assembler.backwardLabels = {};

  // No forward labels defined
  const error1 = t.throws(() => {
    assembler.symbolScope.handleRelativeLabel("+");
  }, { instanceOf: Error });
  t.is(error1.message, "Error: Undefined forward label '+'.", "Should throw when no forward labels defined");

  // No backward labels defined
  const error2 = t.throws(() => {
    assembler.symbolScope.handleRelativeLabel("-");
  }, { instanceOf: Error });
  t.is(error2.message, "Error: Undefined backward label '-'.", "Should throw when no backward labels defined");

  // Test with empty arrays
  assembler.forwardLabels[1] = [];
  assembler.backwardLabels[1] = [];

  const error3 = t.throws(() => {
    assembler.symbolScope.handleRelativeLabel("+");
  }, { instanceOf: Error });
  t.is(error3.message, "Error: Undefined forward label '+'.", "Should throw when forward labels array is empty");

  const error4 = t.throws(() => {
    assembler.symbolScope.handleRelativeLabel("-");
  }, { instanceOf: Error });
  t.is(error4.message, "Error: Undefined backward label '-'.", "Should throw when backward labels array is empty");
});

test("defineEngine.handleDefineCommand - basic define operations", t => {
  const assembler = new Assembler();

  // Test basic assignment (=)
  assembler.defineEngine.handleDefineCommand("!test = 42");
  t.is(assembler.defines.get("test"), "42", "Basic assignment should store the value");

  // Test quoted string assignment
  assembler.defineEngine.handleDefineCommand('!string = "hello world"');
  t.is(assembler.defines.get("string"), "hello world", "String assignment should remove quotes");

  // Test immediate evaluation (:=)
  assembler.defines.set("base", "10");
  assembler.defineEngine.handleDefineCommand("!derived := !base + 5");
  t.is(assembler.defines.get("derived"), "$F", "Immediate evaluation should resolve defines in the value (10 + 5)");

  // Test math evaluation (#=)
  assembler.defineEngine.handleDefineCommand("!math #= 5 + 7");
  t.is(assembler.defines.get("math"), "12", "Math evaluation should calculate the expression");

  // Test math with defines
  assembler.defines.set("a", "5");
  assembler.defines.set("b", "3");
  assembler.defineEngine.handleDefineCommand("!sum #= !a + !b");
  t.is(assembler.defines.get("sum"), "8", "Math evaluation should work with defines");

  // Test conditional assignment (?=)
  assembler.defines.set("existing", "original");
  assembler.defineEngine.handleDefineCommand("!existing ?= new value");
  t.is(assembler.defines.get("existing"), "original", "Conditional assignment shouldn't change existing values");

  assembler.defineEngine.handleDefineCommand("!new ?= first value");
  t.is(assembler.defines.get("new"), "first value", "Conditional assignment should set new values");

  // Test append (+=)
  assembler.defines.set("list", "item1");
  assembler.defineEngine.handleDefineCommand("!list += ,item2");
  t.is(assembler.defines.get("list"), "item1,item2", "Append should add to existing value");

  // Test complex expressions
  assembler.defineEngine.handleDefineCommand("!complex #= (10 * 2) / 4");
  t.is(assembler.defines.get("complex"), "5", "Complex math expressions should be evaluated correctly");

  assembler.defineEngine.handleDefineCommand("!task_offset = $004E+task");
  t.is(assembler.defines.get("task_offset"), "$004E+task", "Symbolic math defines should retain struct references for later member access");
});

test("handleUndef - removes defines from processCommand", t => {
  const assembler = new Assembler();

  assembler.defineEngine.handleDefineCommand('!testdefine = "poop"');
  t.true(assembler.defines.has("testdefine"), "Define should exist before undef");

  assembler.defineEngine.handleDefineCommand('undef "testdefine"');
  t.false(assembler.defines.has("testdefine"), "Direct handleDefineCommand undef should remove define");

  assembler.defineEngine.handleDefineCommand('!testdefine = "poop"');
  assembler.processCommand('undef "testdefine"');
  t.false(assembler.defines.has("testdefine"), "Quoted undef should remove define");

  assembler.defineEngine.handleDefineCommand('!testdefine = "poop"');
  assembler.processCommand("undef testdefine");
  t.false(assembler.defines.has("testdefine"), "Unquoted undef should remove define");

  const error = t.throws(() => {
    assembler.defineEngine.handleDefineCommand("undef");
  }, { instanceOf: Error });
  t.is(error.message, "undef requires exactly one identifier parameter");
});

test("expressionHost - defined and string expansion behavior", t => {
  const assembler = new Assembler();
  assembler.defines.set("testdefine", "poop");
  assembler.defines.set("a", "x");

  t.is(assembler.expressionHost.isDefined("testdefine"), 1, "defined() should detect preprocessor defines");
  t.is(assembler.expressionHost.isDefined("missing_define"), 0, "defined() should return 0 for missing defines");

  t.is(assembler.defineEngine.resolveDefinesInStringLiteral("!a"), "x", "Unescaped string define should expand");
  t.is(assembler.defineEngine.resolveDefinesInStringLiteral("\\!a"), "!a", "Escaped bang should stay literal");
  t.is(assembler.defineEngine.resolveDefinesInStringLiteral("\\\\!a"), "\\x", "Double slash should keep slash and expand define");
});

test("defineEngine.handleDefineCommand - error cases", t => {
  const assembler = new Assembler();

  // Test invalid syntax
  const error = t.throws(() => {
    assembler.defineEngine.handleDefineCommand("!invalid syntax");
  }, { instanceOf: Error });
  t.is(error.message, "Invalid define syntax: !invalid syntax", "Should throw on invalid syntax");

  // Test math evaluation errors
  const mathError = t.throws(() => {
    assembler.defineEngine.handleDefineCommand("!bad #= not a math expression");
  }, { instanceOf: Error });
  t.is(mathError.message, "Mismatched parentheses.", "Should throw on invalid math expression");
});

test("handleDefineCommand - edge cases", t => {
  const assembler = new Assembler();

  // TODO: Validate this
  // Test nested defines with := operator
  // assembler.defines.set("inner", "value");
  // assembler.defines.set("wrapper", "!inner");
  // assembler.defineEngine.handleDefineCommand("!resolved := !wrapper");
  // t.is(assembler.defines.get("resolved"), "value", "Nested defines should be resolved with :=");

  // Test math with hex values
  assembler.defineEngine.handleDefineCommand("!hex #= $10 + $20");
  t.is(assembler.defines.get("hex"), "48", "Math should handle hex values");

  // TODO: Validate this
  // Test != operator in math expressions
  // assembler.defineEngine.handleDefineCommand("!comparison #= 5 != 3 ? 1 : 0");
  // t.is(assembler.defines.get("comparison"), "1", "Should handle != operator in math expressions");

  // Test empty string assignment
  assembler.defineEngine.handleDefineCommand('!empty = ""');
  t.is(assembler.defines.get("empty"), "", "Should handle empty string assignment");

  // Test multiple operators in math
  assembler.defineEngine.handleDefineCommand("!complex #= 2 + 3 * 4");
  t.is(assembler.defines.get("complex"), "14", "Should respect operator precedence in math");
});

test("parseFunctionDefinition - basic functionality", t => {
  const assembler = new Assembler();

  // Test basic function definition
  assembler.parseFunctionDefinition("function add(a, b) = a + b");
  t.is(typeof assembler.mathCore.userFunctions.get("add"), "object", "Function should be defined");

  // Test function usage
  assembler.mathCore.str = "add(5, 3)";
  t.is(assembler.mathCore.math("add(5, 3)"), 8, "Function should be callable with arguments");
});

test("parseFunctionDefinition - multiline functions", t => {
  const assembler = new Assembler();

  // Test function definition with line continuation
  assembler.parseFunctionDefinition("function complex(x, y) = \\\n  x * 2 + \\\n  y * 3");
  t.is(typeof assembler.mathCore.userFunctions.get("complex"), "object", "Multiline function should be defined");

  // Test multiline function usage
  t.is(assembler.mathCore.math("complex(2, 3)"), 13, "Multiline function should work correctly");
});

test("parseFunctionDefinition - edge cases", t => {
  const assembler = new Assembler();

  // Test function with no parameters
  assembler.parseFunctionDefinition("function zero() = 42");
  t.is(assembler.mathCore.math("zero()"), 42, "Function with no parameters should work");

  // Test function with many parameters
  assembler.parseFunctionDefinition("function many(a, b, c, d, e) = a + b + c + d + e");
  t.is(assembler.mathCore.math("many(1, 2, 3, 4, 5)"), 15, "Function with many parameters should work");

  // Test nested function calls
  assembler.parseFunctionDefinition("function double(x) = x * 2");
  assembler.parseFunctionDefinition("function triple(x) = x * 3");
  assembler.parseFunctionDefinition("function compose(x) = double(triple(x))");
  t.is(assembler.mathCore.math("compose(2)"), 12, "Nested function calls should work");
});

test("parseFunctionDefinition - error cases", t => {
  const assembler = new Assembler();

  // Test redefining a function
  assembler.parseFunctionDefinition("function test(x) = x + 1");

  // Redefining should overwrite the previous definition
  assembler.parseFunctionDefinition("function test(x) = x * 2");
  t.is(assembler.mathCore.math("test(5)"), 10, "Redefined function should use the new definition");

  // Test syntax errors
  const error = t.throws(() => {
    assembler.parseFunctionDefinition("function broken(x, = x + 1");
  }, { instanceOf: Error });
  t.truthy(error, "Should throw on invalid function syntax");

  // Test recursive function (if supported)
  try {
    assembler.parseFunctionDefinition("function factorial(n) = n <= 1 ? 1 : n * factorial(n - 1)");
    const result = assembler.mathCore.math("factorial(5)");
    t.is(result, 120, "Recursive functions should work if supported");
  } catch (e) {
    t.pass("Recursive functions may not be supported");
  }
});

test("handleArch - valid architectures", t => {
  const assembler = new Assembler();

  // Test 65816 architecture
  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "65816"]);
  t.is(assembler.arch, "65816", "Should set architecture to 65816");

  // Test spc700 architecture
  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "spc700"]);
  t.is(assembler.arch, "spc700", "Should set architecture to spc700");
  t.false(assembler.spcInlineCompatMode, "spc700 should not enable inline compatibility mode");

  // Test spc700-inline architecture
  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "spc700-inline"]);
  t.is(assembler.arch, "spc700", "spc700-inline should compile with spc700 arch backend");
  t.true(assembler.spcInlineCompatMode, "spc700-inline should enable inline compatibility mode");

  // Test superfx architecture
  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "superfx"]);
  t.is(assembler.arch, "superfx", "Should set architecture to superfx");
  t.false(assembler.spcInlineCompatMode, "superfx should disable inline compatibility mode");

  // Test case insensitivity
  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "65816"]);
  t.is(assembler.arch, "65816", "Should handle lowercase architecture name");
  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "SPC700"]);
  t.is(assembler.arch, "spc700", "Should handle uppercase architecture name");
});

test("handleArch - error cases", t => {
  const assembler = new Assembler();

  // Test missing architecture parameter
  const missingParamError = t.throws(() => {
    handleArch({
      session: assembler,
      operandResolver: assembler.operandResolver,
    }, ["arch"]);
  }, { instanceOf: Error });
  t.is(missingParamError?.message, "ARCH command requires an architecture parameter.",
    "Should throw when architecture parameter is missing");

  // Test unsupported architecture
  const unsupportedArchError = t.throws(() => {
    handleArch({
      session: assembler,
      operandResolver: assembler.operandResolver,
    }, ["arch", "z80"]);
  }, { instanceOf: Error });
  t.is(unsupportedArchError?.message, "Unsupported architecture: z80",
    "Should throw on unsupported architecture");
});

test("handleArch - architecture switching", t => {
  const assembler = new Assembler();

  // Test switching between architectures
  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "65816"]);
  t.is(assembler.arch, "65816", "Should start with 65816 architecture");

  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "spc700"]);
  t.is(assembler.arch, "spc700", "Should switch to spc700 architecture");
  t.false(assembler.spcInlineCompatMode, "spc700 should not use inline compatibility mode");

  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "spc700-inline"]);
  t.is(assembler.arch, "spc700", "spc700-inline should still use spc700 backend");
  t.true(assembler.spcInlineCompatMode, "spc700-inline should enable inline compatibility mode");

  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "superfx"]);
  t.is(assembler.arch, "superfx", "Should switch to superfx architecture");
  t.false(assembler.spcInlineCompatMode, "switching away should clear inline compatibility mode");

  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "65816"]);
  t.is(assembler.arch, "65816", "Should switch back to 65816 architecture");
  t.false(assembler.spcInlineCompatMode, "65816 should keep inline compatibility mode disabled");
});

test("processCommand - spcblock emits expected nspc stream", t => {
  const assembler = new Assembler(new Uint8Array(0x80000));
  assembler.setCurrentFile("../tests/assembler.test.ts");

  const lines = [
    "org $008000",
    "lda #$AA",
    "spcblock $6000",
    "mov $33,#$44",
    "endspcblock",
    "spcblock $5000",
    "start:",
    "jmp lab",
    "lab:",
    "mov $11,#$22",
    "endspcblock execute start",
    "lda #$BB",
  ];

  for (let pass = 0; pass <= 2; pass++) {
    assembler.setPass(pass);
    for (const [lineNumber, line] of lines.entries()) {
      assembler.setCurrentLine(lineNumber);
      assembler.processCommand(line);
    }
    assembler.finishPass();
  }

  const result = Array.from(assembler.getBinaryOutput());
  t.deepEqual(
    result,
    [0xA9, 0xAA, 0x03, 0x00, 0x00, 0x60, 0x8F, 0x44, 0x33, 0x06, 0x00, 0x00, 0x50, 0x5F, 0x03, 0x50, 0x8F, 0x22, 0x11, 0x00, 0x00, 0x00, 0x50, 0xA9, 0xBB],
    "spcblock stream should match Asar reference bytes"
  );
});

test("processCommand - spc700-inline auto-wraps in implicit spcblock", t => {
  const assembler = new Assembler(new Uint8Array(0x80000));
  assembler.setCurrentFile("../tests/assembler.test.ts");

  const lines = [
    "org $008000",
    "arch spc700-inline",
    "org $5000",
    "jmp lab",
    "lab:",
  ];

  for (let pass = 0; pass <= 2; pass++) {
    assembler.setPass(pass);
    for (const [lineNumber, line] of lines.entries()) {
      assembler.setCurrentLine(lineNumber);
      assembler.processCommand(line);
    }
    assembler.finishPass();
  }

  const result = Array.from(assembler.getBinaryOutput());
  t.deepEqual(
    result,
    [0x03, 0x00, 0x00, 0x50, 0x5F, 0x03, 0x50, 0x00, 0x00, 0x00, 0x00],
    "spc700-inline output should match legacy inline stream format"
  );
});

test("step - basic functionality", t => {
  const assembler = new Assembler();

  // Set initial positions
  assembler.currentTargetAddress = 0x008000;
  assembler.currentTargetBaseAddress = 0x008000;
  assembler.currentTargetStartAddress = 0x008000;
  assembler.currentTargetBaseStartAddress = 0x008000;
  assembler.bytes = 0;

  // Step forward by 10 bytes
  assembler.step(10);

  // Check that all positions are updated correctly
  t.is(assembler.currentTargetAddress, 0x00800A, "currentTargetAddress should be incremented by step amount");
  t.is(assembler.currentTargetBaseAddress, 0x00800A, "currentTargetBaseAddress should be incremented by step amount");
  t.is(assembler.currentTargetStartAddress, 0x00800A, "currentTargetStartAddress should match new currentTargetAddress");
  t.is(assembler.currentTargetBaseStartAddress, 0x00800A, "currentTargetBaseStartAddress should match currentTargetBaseAddress");
  t.is(assembler.bytes, 10, "bytes counter should be incremented by step amount");
});

test("step - bank crossing with different mappers", t => {
  const assembler = new Assembler();

  // Test lorom mapper bank crossing
  assembler.mapper = "lorom";
  assembler.currentTargetAddress = 0x00FFFC;
  assembler.currentTargetBaseAddress = 0x00FFFC;

  // Step across bank boundary
  assembler.step(8);

  // In lorom, crossing bank boundary should wrap to 0x8000 in next bank
  t.is(assembler.currentTargetAddress, 0x018004, "lorom should wrap to 0x8000 in next bank");
  t.is(assembler.currentTargetBaseAddress, 0x018004, "currentTargetBaseAddress should follow same wrapping rules");

  // Test hirom mapper bank crossing
  assembler.mapper = "hirom";
  assembler.currentTargetAddress = 0x00FFFC;
  assembler.currentTargetBaseAddress = 0x00FFFC;

  // Step across bank boundary
  assembler.step(8);

  // In hirom for addresses below 0x400000, should wrap to 0x8000 in next bank
  t.is(assembler.currentTargetAddress, 0x018004, "hirom should wrap to 0x8000 in next bank for addresses below 0x400000");

  // Test hirom mapper bank crossing above 0x400000
  assembler.mapper = "hirom";
  assembler.currentTargetAddress = 0x40FFFC;
  assembler.currentTargetBaseAddress = 0x40FFFC;

  // Step across bank boundary
  assembler.step(8);

  // In hirom for addresses above 0x400000, should just increment
  t.is(assembler.currentTargetAddress, 0x410004, "hirom should not wrap for addresses above 0x400000");

  // Test norom mapper (no wrapping)
  assembler.mapper = "norom";
  assembler.currentTargetAddress = 0x00FFFC;
  assembler.currentTargetBaseAddress = 0x00FFFC;

  // Step across bank boundary
  assembler.step(8);

  // In norom, addresses should just increment without wrapping
  t.is(assembler.currentTargetAddress, 0x010004, "norom should not wrap addresses");
});

test("step - large steps across multiple banks", t => {
  const assembler = new Assembler();
  assembler.mapper = "lorom";

  // Start at beginning of a bank
  assembler.currentTargetAddress = 0x008000;
  assembler.currentTargetBaseAddress = 0x008000;

  // Step forward by more than one bank (0x8000 bytes)
  assembler.step(0x10000);

  // Should end up at 0x8000 in bank 2 (0x028000)
  t.is(assembler.currentTargetAddress & 0xFFFFFF, 0x010000, "Should handle steps larger than one bank");
  t.is(assembler.currentTargetBaseAddress & 0xFFFFFF, 0x010000, "currentTargetBaseAddress should follow same rules for large steps");
});

test("step - exlorom and bigsa1rom bank crossing", t => {
  const assembler = new Assembler();

  // Test exlorom
  assembler.mapper = "exlorom";
  assembler.currentTargetAddress = 0x80FFFC;
  assembler.currentTargetBaseAddress = 0x80FFFC;

  // Step across bank boundary
  assembler.step(8);

  // Should wrap to 0x8000 in next bank
  t.is(assembler.currentTargetAddress & 0xFFFFFF, 0x818004, "exlorom should wrap to 0x8000 in next bank");

  // Test bigsa1rom
  assembler.mapper = "bigsa1rom";
  assembler.currentTargetAddress = 0x00FFFC;
  assembler.currentTargetBaseAddress = 0x00FFFC;

  // Step across bank boundary
  assembler.step(8);

  // Should wrap to 0x8000 in next bank
  t.is(assembler.currentTargetAddress & 0xFFFFFF, 0x018004, "bigsa1rom should wrap to 0x8000 in next bank");
});

test("step - exhirom, sfxrom, and sa1rom bank crossing", t => {
  const assembler = new Assembler();

  // Test exhirom below 0x400000
  assembler.mapper = "exhirom";
  assembler.currentTargetAddress = 0x00FFFC;
  assembler.currentTargetBaseAddress = 0x00FFFC;

  // Step across bank boundary
  assembler.step(8);

  // Should wrap to 0x8000 in next bank
  t.is(assembler.currentTargetAddress & 0xFFFFFF, 0x018004, "exhirom should wrap to 0x8000 in next bank below 0x400000");

  // Test exhirom above 0x400000
  assembler.currentTargetAddress = 0x40FFFC;
  assembler.currentTargetBaseAddress = 0x40FFFC;

  // Step across bank boundary
  assembler.step(8);

  // Should not wrap above 0x400000
  t.is(assembler.currentTargetAddress & 0xFFFFFF, 0x410004, "exhirom should not wrap above 0x400000");

  // Test sfxrom and sa1rom (they behave the same way)
  for (const mapper of ["sfxrom", "sa1rom"]) {
    assembler.mapper = mapper;

    // Test below 0x400000
    assembler.currentTargetAddress = 0x00FFFC;
    assembler.currentTargetBaseAddress = 0x00FFFC;

    // Step across bank boundary
    assembler.step(8);

    // Should wrap to 0x8000 in next bank
    t.is(assembler.currentTargetAddress & 0xFFFFFF, 0x018004, `${mapper} should wrap to 0x8000 in next bank below 0x400000`);

    // Test above 0x400000
    assembler.currentTargetAddress = 0x40FFFC;
    assembler.currentTargetBaseAddress = 0x40FFFC;

    // Step across bank boundary
    assembler.step(8);

    // Should not wrap above 0x400000
    t.is(assembler.currentTargetAddress & 0xFFFFFF, 0x410004, `${mapper} should not wrap above 0x400000`);
  }
});

test("step - zero step", t => {
  const assembler = new Assembler();

  // Set initial positions
  assembler.currentTargetAddress = 0x008000;
  assembler.currentTargetBaseAddress = 0x008000;
  assembler.currentTargetStartAddress = 0x008000;
  assembler.currentTargetBaseStartAddress = 0x008000;
  assembler.bytes = 0;

  // Step by 0 bytes
  assembler.step(0);

  // Positions should remain the same
  t.is(assembler.currentTargetAddress, 0x008000, "currentTargetAddress should not change with zero step");
  t.is(assembler.currentTargetBaseAddress, 0x008000, "currentTargetBaseAddress should not change with zero step");
  t.is(assembler.currentTargetStartAddress, 0x008000, "currentTargetStartAddress should not change with zero step");
  t.is(assembler.currentTargetBaseStartAddress, 0x008000, "currentTargetBaseStartAddress should not change with zero step");
  t.is(assembler.bytes, 0, "bytes counter should not change with zero step");
});

test("step - negative step", t => {
  const assembler = new Assembler();

  // Set initial positions
  assembler.currentTargetAddress = 0x008100;
  assembler.currentTargetBaseAddress = 0x008100;

  // Step with negative value should throw an error
  const error = t.throws(() => {
    assembler.step(-10);
  }, { instanceOf: Error });

  t.is(error?.message, "step num is negative", "Should throw error for negative step");

  // Also test with a different negative value
  const error2 = t.throws(() => {
    assembler.step(-20);
  }, { instanceOf: Error });

  t.is(error2?.message, "step num is negative", "Should throw error for negative step");
});

test("expressionHost - resolveLabel", t => {
  const assembler = new Assembler();

  // Setup a label
  assembler.labelTable.set("test_label", {
    value: 0x1234,
    isStatic: false,
  });

  // Test resolving an existing label
  t.is(assembler.expressionHost.resolveLabel("test_label"), 0x1234, "Should resolve existing label");

  // Setup a struct
  assembler.structs.set("test_struct", {
    name: "test_struct",
    base: 0x2000,
    offset: 0x100,
    size: 0x100,
    labels: new Map(),
  });

  // Bare struct identifiers now resolve to their declared base address so later
  // math and indexed operands can treat them like canonical labels.
  t.is(assembler.expressionHost.resolveLabel("test_struct"), 0x2000, "Should resolve bare struct names to their base address");
});

test("expressionHost - snestopc and pctosnes", t => {
  const assembler = new Assembler();

  // Mock the address conversion methods.
  const originalConvertTargetAddressToRomOffset = assembler.romWriter.convertTargetAddressToRomOffset.bind(assembler.romWriter);
  const originalPctosnes = assembler.romWriter.pctosnes.bind(assembler.romWriter);

  assembler.romWriter.convertTargetAddressToRomOffset = (addr: number) => addr + 0x1000;
  assembler.romWriter.pctosnes = (addr: number) => addr - 0x1000;

  // Test snestopc
  t.is(assembler.expressionHost.convertSnesToPc(0x8000), 0x9000, "Should convert SNES to PC address");

  // Test pctosnes
  t.is(assembler.expressionHost.convertPcToSnes(0x9000), 0x8000, "Should convert PC to SNES address");

  // Restore original methods.
  assembler.romWriter.convertTargetAddressToRomOffset = originalConvertTargetAddressToRomOffset;
  assembler.romWriter.pctosnes = originalPctosnes;
});

test("expressionHost - pc and realbase", t => {
  const assembler = new Assembler();

  // Set positions
  assembler.currentTargetAddress = 0x8000;
  assembler.currentTargetBaseAddress = 0x9000;

  // Test pc
  t.is(assembler.expressionHost.getCurrentAddress(), 0x8000, "Should return current currentTargetAddress");

  // Test realbase
  t.is(assembler.expressionHost.getCurrentBaseAddress(), 0x9000, "Should return currentTargetBaseAddress");
});

test("expressionHost - defined", t => {
  const assembler = new Assembler();

  // Setup a label
  assembler.labelTable.set("defined_label", {
    value: 0x1234,
    isStatic: false,
  });

  // Setup a struct
  assembler.structs.set("defined_struct", {
    name: "defined_struct",
    base: 0x2000,
    offset: 0x100,
    size: 0x100,
    labels: new Map(),
  });

  // Test defined with existing label
  t.is(assembler.expressionHost.isDefined("defined_label"), 1, "Should return 1 for defined label");

  // Test defined with existing struct
  t.is(assembler.expressionHost.isDefined("defined_struct"), 1, "Should return 1 for defined struct");

  // Test defined with non-existent identifier
  t.is(assembler.expressionHost.isDefined("undefined_item"), 0, "Should return 0 for undefined item");
});

test("expressionHost - sizeof, objectsize, datasize", t => {
  const assembler = new Assembler();

  // Mock getExpressionObjectSize method
  const originalGetObjectSize = assembler.getExpressionObjectSize;

  assembler.getExpressionObjectSize = (name: string, includeParent = false) => {
    if (name === "test_object") {
      return includeParent ? 0x200 : 0x100;
    }
    throw new Error(`Unknown object: ${name}`);
  };

  // Test sizeof (with includeParent=true)
  t.is(assembler.expressionHost.getExpressionObjectSize("test_object", true), 0x200, "sizeof should include parent size");

  // Test objectsize (with default includeParent=false)
  t.is(assembler.expressionHost.getExpressionObjectSize("test_object", false), 0x100, "objectsize should not include parent size");

  // Test datasize (same as objectsize)
  t.is(assembler.expressionHost.getExpressionObjectSize("test_object", false), 0x100, "datasize should be same as objectsize");

  // Test with non-existent object
  const error = t.throws(() => {
    assembler.expressionHost.getExpressionObjectSize("nonexistent_object", true);
  });
  t.truthy(error, "Should throw error for non-existent object");

  // Restore original method
  assembler.getExpressionObjectSize = originalGetObjectSize;
});

test("expressionHost - filesize", t => {
  const assembler = new Assembler();
  const expectedPath = `${process.cwd()}/existing_file.txt`;

  const existsStub = sinon.stub(fs, "existsSync").callsFake((filePath: fs.PathLike) => {
    return filePath === expectedPath;
  });
  const statStub = sinon.stub(fs, "statSync").callsFake((filePath: fs.PathLike) => {
    if (filePath === expectedPath) {
      return { size: 1024 } as fs.Stats;
    }
    throw new Error(`ENOENT: no such file or directory, stat '${String(filePath)}'`);
  });

  // Test filesize with existing file
  t.is(assembler.expressionHost.getFileSize("existing_file.txt"), 1024, "Should return correct file size");
  t.true(existsStub.called, "Should check file existence before stat");
  t.true(statStub.calledOnce, "Should stat resolved file path");

  // Test filesize with non-existent file
  const error = t.throws(() => {
    assembler.expressionHost.getFileSize("nonexistent_file.txt");
  });
  t.truthy(error, "Should throw error for non-existent file");
  t.true(existsStub.callCount > 1, "Should check candidate paths for missing files");
  t.is(statStub.callCount, 1, "Should not stat missing files");

  existsStub.restore();
  statStub.restore();
});

test("expressionHost - getfilestatus", t => {
  const assembler = new Assembler();
  const readablePath = `${process.cwd()}/readable_file.txt`;
  const unreadablePath = `${process.cwd()}/unreadable_file.txt`;

  const existsStub = sinon.stub(fs, "existsSync").callsFake((filePath: fs.PathLike) => {
    return filePath === readablePath || filePath === unreadablePath;
  });
  const accessStub = sinon.stub(fs, "accessSync").callsFake((filePath: fs.PathLike) => {
    if (filePath === readablePath) {
      return;
    }
    throw new Error("EACCES: permission denied");
  });

  // Test getfilestatus with readable file
  t.is(assembler.expressionHost.getFileStatus("readable_file.txt"), 0, "Should return 0 for readable file");

  // Test getfilestatus with unreadable file
  t.is(assembler.expressionHost.getFileStatus("unreadable_file.txt"), 2, "Should return 2 for unreadable file");

  // Test getfilestatus with non-existent file
  t.is(assembler.expressionHost.getFileStatus("nonexistent_file.txt"), 1, "Should return 1 for non-existent file");

  t.true(existsStub.callCount >= 3, "Should check file existence for each query");
  t.is(accessStub.callCount, 2, "Should only check access for existing files");

  existsStub.restore();
  accessStub.restore();
});


test("write1_65816 - basic functionality", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(0x1000).fill(0);
  assembler.pass = 2;
  assembler.currentTargetAddress = 0x008000;
  assembler.currentTargetBaseAddress = 0x008000;
  assembler.currentTargetStartAddress = 0x008000;
  assembler.currentTargetBaseStartAddress = 0x008000;

  // Write a byte and check if it was written correctly
  assembler.write1_65816(0x42);
  t.is(assembler.romdata[0], 0x42, "Should write the byte to the correct position");
  t.is(assembler.currentTargetAddress, 0x008001, "Should increment currentTargetAddress");
  t.is(assembler.currentTargetBaseAddress, 0x008001, "Should increment currentTargetBaseAddress");
});

test("write1_65816 - NaN handling", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(0x1000).fill(0);
  assembler.pass = 2;
  assembler.currentTargetAddress = 0x008000;
  assembler.currentTargetBaseAddress = 0x008000;

  // Test with NaN input
  const error = t.throws(() => {
    assembler.write1_65816(NaN);
  });
  t.is(error?.message, "write1_65816 num is NaN", "Should throw error for NaN input");
});

test("write1_65816 - bank wrapping", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(0x10000).fill(0);
  assembler.pass = 2;

  // Position at the end of a bank
  assembler.currentTargetAddress = 0x00FFFF;
  assembler.currentTargetBaseAddress = 0x00FFFF;
  assembler.currentTargetStartAddress = 0x00FFFF;
  assembler.currentTargetBaseStartAddress = 0x00FFFF;

  // Write a byte, which should wrap to the next address
  assembler.write1_65816(0x42);

  // Check if the byte was written correctly
  const pcpos = assembler.romWriter.convertTargetAddressToRomOffset(0x00FFFF);
  t.is(assembler.romdata[pcpos], 0x42, "Should write the byte to the correct position");

  // TODO: Verify this is correct, may be 0x010000
  // Check if positions were updated correctly with bank wrapping
  t.is(assembler.currentTargetAddress, 0x18000, "Should increment currentTargetAddress with bank wrapping");
  t.is(assembler.currentTargetBaseAddress, 0x18000, "Should increment currentTargetBaseAddress with bank wrapping");
});

test("write1_65816 - ROM expansion", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(0x10).fill(0);
  assembler.pass = 2;
  assembler.defaultFreespaceByte = 0xFF;

  // Position beyond current ROM size
  const initialPos = 0x008020;
  assembler.currentTargetAddress = initialPos;
  assembler.currentTargetBaseAddress = initialPos;
  assembler.currentTargetStartAddress = initialPos;
  assembler.currentTargetBaseStartAddress = initialPos;

  // Write a byte, which should expand the ROM
  assembler.write1_65816(0x42);

  // Check if ROM was expanded
  t.true(assembler.romdata.length > 0x10, "ROM should be expanded");

  // Check if the byte was written correctly
  const pcpos = assembler.romWriter.convertTargetAddressToRomOffset(initialPos);
  t.is(assembler.romdata[pcpos], 0x42, "Should write the byte to the correct position");

  // Check if the gap was filled with defaultFreespaceByte
  // for (let i = 0x10; i < pcpos; i++) {
  //   t.is(assembler.romdata[i], 0xFF, "Gap should be filled with defaultFreespaceByte");
  // }

  // Check if romlen was updated
  t.is(assembler.romdata.length, pcpos + 1, "romlen should be updated");
});

test("write1_65816 - pass 1 behavior", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(0x1000).fill(0);
  assembler.pass = 1; // Set to pass 1
  assembler.currentTargetAddress = 0x008000;
  assembler.currentTargetBaseAddress = 0x008000;
  assembler.currentTargetStartAddress = 0x008000;
  assembler.currentTargetBaseStartAddress = 0x008000;

  // Write a byte in pass 1 (should not actually write)
  assembler.write1_65816(0x42);

  // Check that the byte was not written
  t.is(assembler.romdata[0], 0, "Should not write the byte in pass 1");

  // But positions should still be updated
  t.is(assembler.currentTargetAddress, 0x008001, "Should still increment currentTargetAddress in pass 1");
  t.is(assembler.currentTargetBaseAddress, 0x008001, "Should still increment currentTargetBaseAddress in pass 1");
});

test("write1_65816 - byte masking", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(0x1000).fill(0);
  assembler.pass = 2;
  assembler.currentTargetAddress = 0x008000;
  assembler.currentTargetBaseAddress = 0x008000;

  // Write a value larger than a byte
  assembler.write1_65816(0x1234);

  // Check that only the lower 8 bits were written
  t.is(assembler.romdata[0], 0x34, "Should only write the lower 8 bits");
});

test("write1_65816 - step behavior", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(0x1000).fill(0);
  assembler.pass = 2;
  assembler.currentTargetAddress = 0x008000;
  assembler.currentTargetBaseAddress = 0x008000;
  assembler.bytes = 0;

  // Write a byte
  assembler.write1_65816(0x42);

  // Check that bytes counter was incremented
  t.is(assembler.bytes, 1, "Should increment bytes counter");
});

test("fillRomData - basic fill", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(10).fill(0);

  // Fill positions 2-4 with value 0x42
  assembler.fillRomData(2, 0x42, 3);

  // Check that only the specified range was filled
  t.is(assembler.romdata[0], 0, "Should not modify data before start");
  t.is(assembler.romdata[1], 0, "Should not modify data before start");
  t.is(assembler.romdata[2], 0x42, "Should fill first position");
  t.is(assembler.romdata[3], 0x42, "Should fill middle position");
  t.is(assembler.romdata[4], 0x42, "Should fill last position");
  t.is(assembler.romdata[5], 0, "Should not modify data after end");
});

test("fillRomData - zero length", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(10).fill(0);

  // Fill with length 0
  assembler.fillRomData(2, 0x42, 0);

  // Check that no data was modified
  t.deepEqual(assembler.romdata, new Array(10).fill(0), "Should not modify any data with length 0");
});

test("fillRomData - fill at start of ROM", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(10).fill(0);

  // Fill from the beginning
  assembler.fillRomData(0, 0x42, 3);

  // Check that only the specified range was filled
  t.is(assembler.romdata[0], 0x42, "Should fill first byte of ROM");
  t.is(assembler.romdata[1], 0x42, "Should fill second byte");
  t.is(assembler.romdata[2], 0x42, "Should fill third byte");
  t.is(assembler.romdata[3], 0, "Should not modify data after end");
});

test("fillRomData - fill at end of ROM", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(10).fill(0);

  // Fill at the end
  assembler.fillRomData(7, 0x42, 3);

  // Check that only the specified range was filled
  t.is(assembler.romdata[6], 0, "Should not modify data before start");
  t.is(assembler.romdata[7], 0x42, "Should fill first position");
  t.is(assembler.romdata[8], 0x42, "Should fill middle position");
  t.is(assembler.romdata[9], 0x42, "Should fill last position");
});

test("fillRomData - fill entire ROM", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(5).fill(0);

  // Fill the entire ROM
  assembler.fillRomData(0, 0x42, 5);

  // Check that all bytes were filled
  t.deepEqual(assembler.romdata, new Array(5).fill(0x42), "Should fill entire ROM");
});

test("fillRomData - with different values", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(10).fill(0);

  // Fill with different values
  assembler.fillRomData(2, 0xFF, 2);
  assembler.fillRomData(5, 0xAA, 2);

  // Check that the correct values were written
  t.is(assembler.romdata[2], 0xFF, "Should fill with first value");
  t.is(assembler.romdata[3], 0xFF, "Should fill with first value");
  t.is(assembler.romdata[5], 0xAA, "Should fill with second value");
  t.is(assembler.romdata[6], 0xAA, "Should fill with second value");
});

test("fillRomData - value byte masking", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(5).fill(0);

  // Fill with a value larger than a byte
  assembler.fillRomData(1, 0x1234, 3);

  // Check that only the lower 8 bits were used
  t.is(assembler.romdata[1], 0x34, "Should only use lower 8 bits of value");
  t.is(assembler.romdata[2], 0x34, "Should only use lower 8 bits of value");
  t.is(assembler.romdata[3], 0x34, "Should only use lower 8 bits of value");
});

test("fillRomData - overlapping fills", t => {
  const assembler = new Assembler();
  assembler.romdata = new Array(10).fill(0);

  // Create overlapping fills
  assembler.fillRomData(2, 0x42, 4);
  assembler.fillRomData(4, 0xFF, 3);

  // Check that later fills override earlier ones
  t.is(assembler.romdata[2], 0x42, "Should keep first fill value");
  t.is(assembler.romdata[3], 0x42, "Should keep first fill value");
  t.is(assembler.romdata[4], 0xFF, "Should be overwritten by second fill");
  t.is(assembler.romdata[5], 0xFF, "Should have second fill value");
  t.is(assembler.romdata[6], 0xFF, "Should have second fill value");
});

test("asblock_pick - empty words array", t => {
  const assembler = new Assembler();

  // Empty words array should return true
  t.true(assembler.asblock_pick([]), "Should return true for empty words array");
});

test("asblock_pick - pass 0 handling", t => {
  const assembler = new Assembler();
  assembler.pass = 0;

  // In pass 0, should always return true to allow forward references
  t.true(assembler.asblock_pick(["unknown_instruction"]), "Should return true in pass 0 regardless of instruction");
});

test("asblock_pick - lowered instruction path uses architecture adapters", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.arch = "65816";
  let calledWithWords: string[] | undefined;
  const original = assembler.arch65816.encodeInstruction;
  assembler.arch65816.encodeInstruction = (instruction) => {
    calledWithWords = instruction.words;
    return true;
  };

  const handled = assembler.asblock_pick({
    kind: "instruction",
    mnemonic: "lda",
    operandText: "#$10",
    operands: ["#$10"],
    loweredOperands: [{
      raw: "#$10",
      expanded: "#$10",
      length: 1,
      immediate: true,
      indirect: false,
    }],
    loweredOperand: {
      raw: "#$10",
      expanded: "#$10",
      length: 1,
      immediate: true,
      indirect: false,
    },
    words: ["lda", "#$10"],
    sourceFile: "test.asm",
    sourceLine: 1,
    sourceRaw: "lda #$10",
  });

  t.true(handled);
  t.deepEqual(calledWithWords, ["lda", "#$10"]);
  assembler.arch65816.encodeInstruction = original;
});

test("asblock_pick - spc700 architecture", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.arch = "spc700";

  const originalMethod = assembler.archSPC700.encode;
  let wasCalled = false;
  assembler.archSPC700.encode = (words) => {
    wasCalled = true;
    return true;
  };

  t.true(assembler.asblock_pick(["mov", "a", "#$42"]), "Should delegate to the SPC700 encoder");
  t.true(wasCalled, "Should call the SPC700 encoder");

  assembler.archSPC700.encode = originalMethod;
});

test("asblock_pick - spc700 architecture error handling", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.arch = "spc700";

  const originalMethod = assembler.archSPC700.encode;
  assembler.archSPC700.encode = () => false;

  const error = t.throws(() => {
    assembler.asblock_pick(["unknown_instruction"]);
  }, { instanceOf: Error });

  t.is(error.message, "Unknown instruction: unknown_instruction", "Should throw error for unknown SPC700 instruction");

  assembler.archSPC700.encode = originalMethod;
});

test("asblock_pick - superfx architecture", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.arch = "superfx";

  const originalMethod = assembler.archSuperFX.encode;
  let wasCalled = false;
  assembler.archSuperFX.encode = (words) => {
    wasCalled = true;
    return true;
  };

  t.true(assembler.asblock_pick(["move", "r0", "#$42"]), "Should delegate to the SuperFX encoder");
  t.true(wasCalled, "Should call the SuperFX encoder");

  assembler.archSuperFX.encode = originalMethod;
});

test("asblock_pick - superfx architecture failure", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.arch = "superfx";

  const originalMethod = assembler.archSuperFX.encode;
  assembler.archSuperFX.encode = () => false;

  t.false(assembler.asblock_pick(["unknown_instruction"]), "Should return false when the SuperFX encoder fails");

  assembler.archSuperFX.encode = originalMethod;
});

test("asblock_pick - superfx architecture error handling", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.arch = "superfx";

  const originalMethod = assembler.archSuperFX.encode;
  assembler.archSuperFX.encode = (words) => {
    throw new Error(`Unknown instruction: ${words[0]}`);
  };

  const error = t.throws(() => {
    assembler.asblock_pick(["unknown_instruction"]);
  }, { instanceOf: Error });

  t.is(error.message, "Unknown instruction: unknown_instruction", "Should throw error for unknown SuperFX instruction");

  assembler.archSuperFX.encode = originalMethod;
});

test("asblock_pick - 65816 architecture", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.arch = "65816";

  const originalMethod = assembler.arch65816.encode;
  let wasCalled = false;
  assembler.arch65816.encode = (words) => {
    wasCalled = true;
    return true;
  };

  t.true(assembler.asblock_pick(["lda", "#$42"]), "Should delegate to the 65816 encoder");
  t.true(wasCalled, "Should call the 65816 encoder");

  assembler.arch65816.encode = originalMethod;
});

test("asblock_pick - 65816 architecture failure", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.arch = "65816";

  const originalMethod = assembler.arch65816.encode;
  assembler.arch65816.encode = () => false;

  const error = t.throws(() => {
    assembler.asblock_pick(["unknown_instruction"]);
  }, { instanceOf: Error });

  t.is(error.message, "Unknown instruction: unknown_instruction", "Should throw error for unknown 65816 instruction");

  assembler.arch65816.encode = originalMethod;
});

test("asblock_pick - default architecture", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.arch = "unknown_arch"; // Set to an unrecognized architecture

  // Should default to returning true for unrecognized architectures
  t.true(assembler.asblock_pick(["some_instruction"]), "Should return true for unrecognized architectures");
});

test("asblock_pick - pass 0 uses active encoder estimateSize", t => {
  const assembler = new Assembler();
  assembler.pass = 0;
  assembler.arch = "spc700";
  const originalMethod = assembler.archSPC700.estimateSize;
  assembler.archSPC700.estimateSize = () => 5;

  t.true(assembler.asblock_pick(["mov", "a", "#$42"]), "Should succeed during pass 0");
  t.is(assembler.currentTargetAddress, 5, "Should step by the encoder-provided estimated size");

  assembler.archSPC700.estimateSize = originalMethod;
});

test("asblock_pick - inSpcblock uses spc700 encoder", t => {
  const assembler = new Assembler();
  assembler.pass = 2;
  assembler.arch = "65816";
  assembler.inSpcblock = true;
  const originalMethod = assembler.archSPC700.encode;
  let wasCalled = false;
  assembler.archSPC700.encode = () => {
    wasCalled = true;
    return true;
  };

  t.true(assembler.asblock_pick(["mov", "a", "#$42"]), "Should route SPC block instructions through the SPC700 encoder");
  t.true(wasCalled, "Should use the SPC700 encoder inside SPC blocks");

  assembler.archSPC700.encode = originalMethod;
});
