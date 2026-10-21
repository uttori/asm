import { restore, spy, stub } from "sinon";

import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import { createNormalizedCommand } from "../../src/ir/normalized-command.js";

test.afterEach(() => {
  restore();
});

const commandNode = (command: string) =>
  createNormalizedCommand(command, command, command.trim().split(/\s+/), "test.asm", 1);

test("directive registry dispatches fill aliases", (t) => {
  const assembler = new Assembler();
  const handled = assembler.directiveRegistry.dispatch(
    "fillword",
    ["fillword", "$1234"],
    "fillword $1234",
  );

  t.true(handled);
  t.deepEqual(assembler.fillbyte.slice(0, 6), [0x34, 0x12, 0x34, 0x12, 0x34, 0x12]);
});

test("directive registry evaluates assert and error through the assembler session", (t) => {
  const assembler = new Assembler();

  t.true(assembler.directiveRegistry.dispatch("assert", ["assert", "1"], "assert 1"));
  t.throws(() => assembler.directiveRegistry.dispatch("assert", ["assert", "0"], "assert 0"), {
    message: "Assertion failed.",
  });
  t.throws(() => assembler.directiveRegistry.dispatch("error", ["error"], "error"), {
    message: "error command.",
  });
});

test("directive registry reuses shared data handler for aliases", (t) => {
  const assembler = new Assembler();
  const dataSpy = spy(assembler.directiveRuntime, "executeDataStatement");
  stub(assembler, "addAddressToLine");

  const handled = assembler.directiveRegistry.dispatch("dc.w", ["dc.w", "$1234"], "dc.w $1234");

  t.true(handled);
  t.true(dataSpy.calledOnce);
  t.is(dataSpy.firstCall.args[0].width, 2);
});

test("directive registry returns false for unknown directives", (t) => {
  const assembler = new Assembler();
  const handled = assembler.directiveRegistry.dispatch(
    "not-a-directive",
    ["not-a-directive"],
    "not-a-directive",
  );

  t.false(handled);
});

test("directive registry dispatches struct and incbin directives", (t) => {
  const assembler = new Assembler();
  const structSpy = stub(assembler.structEngine, "executeStruct");
  const readFileSpy = stub(assembler.includeSource, "readFile").returns(
    new Uint8Array([0x01, 0x02]),
  );
  // This dispatch fixture supplies bytes directly, so source provenance must use the same stub.
  const sliceSpy = stub(assembler.includeSource, "recordBinarySlice");
  stub(assembler, "write1");
  stub(assembler, "recordCurrentAddress");

  const handledStruct = assembler.directiveRegistry.dispatch(
    "struct",
    ["struct", "Sprite"],
    "struct Sprite",
  );
  const handledIncbin = assembler.directiveRegistry.dispatch(
    "incbin",
    ["incbin", "test.bin"],
    'incbin "test.bin"',
  );

  t.true(handledStruct);
  t.true(handledIncbin);
  t.is(structSpy.firstCall.args[0].name, "Sprite");
  t.true(readFileSpy.calledOnceWithExactly("test.bin"));
  t.true(sliceSpy.calledOnceWithExactly("test.bin", 0, 2, new Uint8Array([0x01, 0x02])));
});

test("normalized dispatch routes extracted directives through the registry", (t) => {
  const assembler = new Assembler();
  assembler.setCurrentFile("test.asm");
  assembler.includedFiles.set("test.asm", { included: true, guarded: false });
  const opcodeSpy = spy(assembler, "asblock_pick");
  stub(assembler, "addAddressToLine");

  assembler.processNormalizedCommand(commandNode("includeonce"), false);

  t.true(assembler.includedFiles.get("test.asm")?.guarded ?? false);
  t.false(opcodeSpy.called);
});

test("normalized dispatch preserves check bankcross behavior", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processNormalizedCommand(commandNode("check bankcross half"), false);
  t.is(assembler.targetState.bankCrossMode, "half");

  assembler.processNormalizedCommand(commandNode("check bankcross on"), false);
  t.is(assembler.targetState.bankCrossMode, "full");
});

test("lowered directive dispatch preserves data directive behavior", (t) => {
  const assembler = new Assembler();
  const dataSpy = spy(assembler.directiveRuntime, "executeDataStatement");
  stub(assembler, "addAddressToLine");

  const normalized = createNormalizedCommand(
    'db $01, bank($123456), "TEXT"',
    'db $01, bank($123456), "TEXT"',
    ["db", "$01,", "bank($123456),", '"TEXT"'],
    "test.asm",
    1,
  );

  assembler.processNormalizedCommand(normalized, false);

  t.true(dataSpy.calledOnce);
  t.truthy(dataSpy.firstCall.args[0].operands.length);
});

test("command lowering lowers safe non-data directives directly", (t) => {
  const assembler = new Assembler();
  const normalized = createNormalizedCommand(
    "org $808000",
    "org $808000",
    ["org", "$808000"],
    "test.asm",
    1,
  );

  const lowered = assembler.commandLoweringService.lowerExecutableNode(normalized);

  t.is(lowered.kind, "pluginSyntax");
  if (lowered.kind !== "pluginSyntax") {
    t.fail();
    return;
  }
  t.is(lowered.command.keyword, "org");
  t.deepEqual(lowered.command.words, ["org", "$808000"]);
});

test("command lowering covers currently safe direct directive families", (t) => {
  const assembler = new Assembler();
  const cases = [
    { command: "arch spc700", keyword: "arch" },
    { command: "lorom", keyword: "lorom" },
    { command: "fill 4", keyword: "fill" },
    { command: "pad $808010", keyword: "pad" },
    { command: "namespace Music", keyword: "namespace" },
    { command: "pushpc", keyword: "pushpc" },
    { command: "pullpc", keyword: "pullpc" },
    { command: "optimize dp always", keyword: "optimize" },
    { command: "startpos $10", keyword: "startpos" },
    { command: "assert 1", keyword: "assert" },
    { command: "error", keyword: "error" },
    { command: "warnpc $8001", keyword: "warnpc" },
    { command: "cleartable", keyword: "cleartable" },
    { command: 'table "font.txt"', keyword: "table" },
  ];

  for (const { command, keyword } of cases) {
    const lowered = assembler.commandLoweringService.lowerExecutableNode(commandNode(command));
    t.is(lowered.kind, "pluginSyntax", command);
    if (lowered.kind !== "pluginSyntax") {
      continue;
    }
    t.is(lowered.command.keyword, keyword, command);
  }
});

test("command lowering uses typed payloads for mixed data", (t) => {
  const assembler = new Assembler();
  const normalized = createNormalizedCommand(
    'db $01, bank($123456), "TEXT"',
    'db $01, bank($123456), "TEXT"',
    ["db", "$01,", "bank($123456),", '"TEXT"'],
    "test.asm",
    1,
  );

  const lowered = assembler.commandLoweringService.lowerExecutableNode(normalized);

  t.is(lowered.kind, "numericData");
});

test("command lowering preserves preprocessing-sensitive commands", (t) => {
  const assembler = new Assembler();
  const defineCommand = createNormalizedCommand(
    "!value = $01",
    "!value = $01",
    ["!value", "=", "$01"],
    "test.asm",
    1,
  );
  const labelCommand = createNormalizedCommand("Label:", "Label:", ["Label:"], "test.asm", 2);
  const macroPlaceholderCommand = createNormalizedCommand(
    "db $04, <value>",
    "db $04, <value>",
    ["db", "$04,", "<value>"],
    "test.asm",
    3,
  );
  const directiveNamedStaticLabel = createNormalizedCommand(
    "FillByte = $EE",
    "FillByte = $EE",
    ["FillByte", "=", "$EE"],
    "test.asm",
    4,
  );

  const loweredDefine = assembler.commandLoweringService.lowerExecutableNode(defineCommand);
  const loweredLabel = assembler.commandLoweringService.lowerExecutableNode(labelCommand);
  const loweredMacroPlaceholder =
    assembler.commandLoweringService.lowerExecutableNode(macroPlaceholderCommand);
  const loweredDirectiveNamedStaticLabel =
    assembler.commandLoweringService.lowerExecutableNode(directiveNamedStaticLabel);

  t.is(loweredDefine.kind, "operation");
  t.is(loweredLabel.kind, "label");
  t.is(loweredMacroPlaceholder.kind, "sourceTemplate");
  t.is(loweredDirectiveNamedStaticLabel.kind, "assignment");
});

test("lowered safe directives dispatch without normalized passthrough", (t) => {
  const assembler = new Assembler();
  const processSpy = spy(assembler, "processNormalizedCommand");
  const normalized = commandNode("check bankcross half");
  const lowered = assembler.commandLoweringService.lowerExecutableNode(normalized);

  assembler.executeLoweredNode(lowered);

  t.false(processSpy.called);
  t.is(assembler.targetState.bankCrossMode, "half");
});

test("direct lowered families and instructions never redispatch normalized commands", (t) => {
  const assembler = new Assembler();
  assembler.setCurrentFile("test.asm");
  assembler.includedFiles.set("test.asm", { included: true, guarded: false });
  stub(assembler.spcRuntime, "handleSpcblock");
  const processSpy = spy(assembler, "processNormalizedCommand");
  const cases = [
    "check bankcross half",
    "fillbyte $AA",
    "namespace Music",
    "pushtable",
    "includeonce",
    "freespacebyte $FF",
    "spcblock $0000",
    "print ignored",
    "nop",
  ];

  for (const command of cases) {
    const lowered = assembler.commandLoweringService.lowerExecutableNode(commandNode(command));
    t.not(lowered.kind, "command", command);
    assembler.executeLoweredNode(lowered);
    t.false(processSpy.called, command);
  }
});

test("front-end command kinds distinguish instructions from preprocess forms", (t) => {
  t.is(commandNode("lda #$01").kind, "opcodeCandidate");
  t.is(commandNode("function add(a, b) = a + b").kind, "functionDefinition");
  t.is(commandNode("global Main: lda #$01").kind, "labelDefinition");
  t.is(commandNode("Entry: lda #$01").kind, "labelDefinition");
});

test("cached define operations execute without source redispatch", (t) => {
  const assembler = new Assembler();
  const lowered = assembler.commandLoweringService.lowerExecutableNode(commandNode("!value = 7"));
  t.is(lowered.kind, "operation");
  if (lowered.kind !== "operation") {
    return;
  }
  const processSpy = spy(assembler, "processNormalizedCommand");

  assembler.executeLoweredNode(lowered);

  t.false(processSpy.called);
  t.is(assembler.defines.get("value"), "7");
});

test("public normalized source entry shares generated fragment parsing", (t) => {
  const unchangedAssembler = new Assembler();
  const unchangedParseSpy = spy(unchangedAssembler.frontEndService, "parseFragmentCommand");
  unchangedAssembler.processNormalizedCommand(commandNode("!value = 1"), true);
  t.true(unchangedParseSpy.calledOnce);
});

test("normalized dispatch reparses context-sensitive variadic macro commands", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("resolveLayout");
  assembler.inMacroExpansion = true;
  assembler.currentVariadicArgs = ["$01"];
  const execute = spy(assembler.directiveRuntime, "executeDataStatement");
  const parseSpy = spy(assembler.frontEndService, "parseFragmentCommand");

  assembler.processNormalizedCommand(commandNode("db <...[0]>"), true);

  t.true(parseSpy.called);
  t.true(execute.calledOnce);
});
