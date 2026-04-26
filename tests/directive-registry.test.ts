import sinon from "sinon";
import { test } from "./ava-helper.js";

import { Assembler } from "../src/assembler.js";
import { createNormalizedCommand } from "../src/ir/normalized-command.js";

const commandNode = (command: string) => createNormalizedCommand(
  command,
  command,
  command.trim().split(/\s+/),
  "test.asm",
  1
);

test("directive registry dispatches fill aliases", t => {
  const assembler = new Assembler();
  const handled = assembler.directiveRegistry.dispatch("fillword", ["fillword", "$1234"], "fillword $1234");

  t.true(handled);
  t.deepEqual(assembler.fillbyte.slice(0, 6), [0x34, 0x12, 0x34, 0x12, 0x34, 0x12]);
});

test("directive registry reuses shared data handler for aliases", t => {
  const assembler = new Assembler();
  const spy = sinon.spy(assembler, "handleDataDirective");
  sinon.stub(assembler, "addAddressToLine");

  const handled = assembler.directiveRegistry.dispatch("dc.w", ["dc.w", "$1234"], "dc.w $1234");

  t.true(handled);
  t.true(spy.calledOnceWithExactly("dc.w", ["$1234"]));
});

test("directive registry returns false for unknown directives", t => {
  const assembler = new Assembler();
  const handled = assembler.directiveRegistry.dispatch("not-a-directive", ["not-a-directive"], "not-a-directive");

  t.false(handled);
});

test("directive registry dispatches struct and incbin directives", t => {
  const assembler = new Assembler();
  const structSpy = sinon.stub(assembler.structEngine, "handleStruct");
  const readFileSpy = sinon.stub(assembler, "readFile").returns(new Uint8Array([0x01, 0x02]));
  sinon.stub(assembler, "write1");
  sinon.stub(assembler, "recordCurrentAddress");

  const handledStruct = assembler.directiveRegistry.dispatch("struct", ["struct", "Sprite"], "struct Sprite");
  const handledIncbin = assembler.directiveRegistry.dispatch("incbin", ["incbin", "test.bin"], 'incbin "test.bin"');

  t.true(handledStruct);
  t.true(handledIncbin);
  t.true(structSpy.calledOnceWithExactly(["struct", "Sprite"]));
  t.true(readFileSpy.calledOnceWithExactly("test.bin"));
});

test("normalized dispatch routes extracted directives through the registry", t => {
  const assembler = new Assembler();
  assembler.setCurrentFile("test.asm");
  assembler.includedFiles.set("test.asm", { included: true, guarded: false });
  const opcodeSpy = sinon.spy(assembler, "asblock_pick");
  sinon.stub(assembler, "addAddressToLine");

  assembler.processNormalizedCommand(commandNode("includeonce"), false);

  t.true(assembler.includedFiles.get("test.asm")?.guarded ?? false);
  t.false(opcodeSpy.called);
});

test("normalized dispatch preserves check bankcross behavior", t => {
  const assembler = new Assembler();
  sinon.stub(assembler, "addAddressToLine");

  assembler.processNormalizedCommand(commandNode("check bankcross half"), false);
  t.is(assembler.bankCrossCheckMode, "half");

  assembler.processNormalizedCommand(commandNode("check bankcross on"), false);
  t.is(assembler.bankCrossCheckMode, "full");
});

test("lowered directive dispatch preserves data directive behavior", t => {
  const assembler = new Assembler();
  const dataSpy = sinon.spy(assembler, "handleDataDirective");
  sinon.stub(assembler, "addAddressToLine");

  const normalized = createNormalizedCommand(
    "db $01, bank($123456), \"TEXT\"",
    "db $01, bank($123456), \"TEXT\"",
    ["db", "$01,", "bank($123456),", "\"TEXT\""],
    "test.asm",
    1
  );

  assembler.processNormalizedCommand(normalized, false);

  t.true(dataSpy.calledOnce);
  t.truthy(dataSpy.firstCall.args[1]?.length);
});

test("command lowering lowers safe non-data directives directly", t => {
  const assembler = new Assembler();
  const normalized = createNormalizedCommand(
    "org $808000",
    "org $808000",
    ["org", "$808000"],
    "test.asm",
    1
  );

  const lowered = assembler.commandLoweringService.lowerExecutableNode(normalized);

  t.is(lowered.kind, "directive");
  if (lowered.kind !== "directive") {
    t.fail();
    return;
  }
  t.is(lowered.keyword, "org");
  t.deepEqual(lowered.words, ["org", "$808000"]);
});

test("command lowering preserves preprocessing-sensitive commands", t => {
  const assembler = new Assembler();
  const defineCommand = createNormalizedCommand("!value = $01", "!value = $01", ["!value", "=", "$01"], "test.asm", 1);
  const labelCommand = createNormalizedCommand("Label:", "Label:", ["Label:"], "test.asm", 2);
  const macroPlaceholderCommand = createNormalizedCommand("db $04, <value>", "db $04, <value>", ["db", "$04,", "<value>"], "test.asm", 3);

  const loweredDefine = assembler.commandLoweringService.lowerExecutableNode(defineCommand);
  const loweredLabel = assembler.commandLoweringService.lowerExecutableNode(labelCommand);
  const loweredMacroPlaceholder = assembler.commandLoweringService.lowerExecutableNode(macroPlaceholderCommand);

  t.is(loweredDefine.kind, "command");
  t.is(loweredLabel.kind, "command");
  t.is(loweredMacroPlaceholder.kind, "command");
});

test("lowered safe directives dispatch without normalized passthrough", t => {
  const assembler = new Assembler();
  const processSpy = sinon.spy(assembler, "processNormalizedCommand");
  const normalized = commandNode("check bankcross half");
  const lowered = assembler.commandLoweringService.lowerExecutableNode(normalized);

  assembler.executeLoweredNode(lowered);

  t.false(processSpy.called);
  t.is(assembler.bankCrossCheckMode, "half");
});
