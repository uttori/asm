import ava, { type TestFn } from "ava";
import sinon from "sinon";

import { executeParsedCommands } from "../../src/parser/execute-ir.js";
import type { ParsedCommand } from "../../src/parser/ir.js";
const test = ava as unknown as TestFn;

const createAssemblerDouble = () => {
  const assembler = {
    pass: 0,
    currentFile: "test.asm",
    currentLine: 0,
    setCurrentLine: sinon.spy((line: number) => {
      assembler.currentLine = line;
    }),
    processCommand: sinon.spy(),
    setLabel: sinon.spy(),
    handleDataDirective: sinon.spy(),
    callMacro: sinon.spy(),
    handleIf: sinon.spy(),
    handleElseIf: sinon.spy(),
    handleElse: sinon.spy(),
    handleEndIf: sinon.spy(),
    handleWhile: sinon.spy(),
    handleEndWhile: sinon.spy(),
    handleFor: sinon.spy(),
    handleEndFor: sinon.spy()
  };
  return assembler;
};

test("executeParsedCommands executes label semantics natively", t => {
  const assembler = createAssemblerDouble();
  const parsed: ParsedCommand[] = [{
    kind: "label",
    raw: "Start:",
    sourceLine: 2,
    labelKind: "declaration",
    labelName: "Start"
  }];

  executeParsedCommands(assembler as never, parsed, { nativeSemanticSlices: true });
  t.true(assembler.setLabel.calledOnceWithExactly("Start"));
  t.true(assembler.processCommand.notCalled);
});

test("executeParsedCommands executes db directive via CodeEmitter service", t => {
  const assembler = createAssemblerDouble();
  const parsed: ParsedCommand[] = [{
    kind: "directive",
    raw: "db $01, $02",
    sourceLine: 1,
    directive: "db",
    argumentsRaw: "$01, $02",
    arguments: ["$01", "$02"]
  }];

  executeParsedCommands(assembler as never, parsed, { nativeSemanticSlices: true });
  t.true(assembler.handleDataDirective.calledOnceWithExactly("db", ["$01, $02"]));
  t.true(assembler.processCommand.notCalled);
});

test("executeParsedCommands delegates macro invocations to MacroExpander", t => {
  const assembler = createAssemblerDouble();
  const parsed: ParsedCommand[] = [{
    kind: "macro-call",
    raw: "SomeMacro 1, 2",
    sourceLine: 4,
    macroName: "SomeMacro"
  }];

  executeParsedCommands(assembler as never, parsed);
  t.true(assembler.callMacro.calledOnceWithExactly("SomeMacro 1, 2"));
});

test("executeParsedCommands executes control flow directives via manager", t => {
  const assembler = createAssemblerDouble();
  const parsed: ParsedCommand[] = [{
    kind: "directive",
    raw: "if 1",
    sourceLine: 9,
    directive: "if",
    argumentsRaw: "1",
    arguments: ["1"]
  }];

  executeParsedCommands(assembler as never, parsed);
  t.true(assembler.processCommand.calledOnceWithExactly("if 1"));
});
