import { test } from "../ava-helper.js";
import sinon from "sinon";

import { CompilationBackend } from "../../src-parser/compiler/backend/CompilationBackend.js";
import { executeParsedCommands } from "../../src-parser/parser/execute-ir.js";
import type { ParsedCommand } from "../../src-parser/parser/ir.js";
import { parseTokenizedCommands } from "../../src-parser/parser/parser.js";
import { tokenizeSource } from "../../src-parser/parser/tokenizer.js";

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
  t.true(assembler.handleDataDirective.calledOnceWithExactly("db", ["$01", "$02"]));
  t.true(assembler.processCommand.notCalled);
});

test("executeParsedCommands expands macro calls via backend.getMacro", t => {
  const backend = new CompilationBackend();
  backend.registerMacro("NopMacro", [], ["org $008000", "NOP"]);
  const parsed: ParsedCommand[] = [{
    kind: "macro-call",
    raw: "%NopMacro()",
    sourceLine: 4,
    macroName: "NopMacro",
    argumentsRaw: "",
    arguments: []
  }];

  for (const pass of [0, 1, 2]) {
    backend.setPass(pass);
    executeParsedCommands(backend, parsed);
    backend.finishPass();
  }
  const rom = backend.getBinaryOutput();
  const pc = 0x8000 - 0x8000; // lorom: $008000 -> offset 0
  t.is(rom[pc], 0xea, "NOP (0xEA) emitted at $8000");
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
  t.true(assembler.handleIf.calledOnceWithExactly("1"));
});

test("struct body populates backend and TestStruct.count resolves", t => {
  const backend = new CompilationBackend();
  const source = [
    "org $008000",
    "struct TestStruct",
    ".first: skip 1",
    ".second: skip 1",
    ".count: skip 1",
    "endstruct",
    "if TestStruct.count == 2",
    "endif"
  ].join("\n");
  const tokenized = tokenizeSource(source);
  const parsed = parseTokenizedCommands(tokenized);
  executeParsedCommands(backend, parsed);
  const val = backend.evaluateExpression!("TestStruct.count");
  t.is(val, 2, "TestStruct.count should be 2 after struct is built");
});
