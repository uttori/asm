import { stub } from "sinon";
import { test } from "./ava-helper.js";

import { Assembler } from "../src/assembler.js";

test("macro engine expands fixed and variadic parameters", (t) => {
  const assembler = new Assembler();

  const expanded = assembler.expandMacroLine(
    "db <value>, <...[1]>, sizeof(...)",
    new Map([["value", "$10"]]),
    ["$20", "$30"],
    2,
  );

  t.is(expanded, "db $10, $20, 2");
});

test("macro engine handles definition lifecycle through processCommand", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processCommand("macro set_define()");
  assembler.processCommand("!macro_value = 3");
  assembler.processCommand("endmacro");
  assembler.processCommand("%set_define()");

  t.true(assembler.macros.has("set_define"));
  t.is(assembler.defines.get("macro_value"), "3");
});

test("define engine resolves standalone define commands through processCommand", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processCommand("!emit = arch spc700");
  assembler.processCommand("!emit");

  t.is(assembler.arch, "spc700");
});

test("front-end service finalizes collected function definitions", (t) => {
  const assembler = new Assembler();
  const parseFunctionDefinition = stub(assembler, "parseFunctionDefinition");

  assembler.inFunctionDefinition = true;
  assembler.functionDefinitionLines = ["function sum(x, y) = x +"];
  assembler.processCommand("y");

  t.true(parseFunctionDefinition.calledOnceWithExactly("function sum(x, y) = x + y"));
  t.false(assembler.inFunctionDefinition);
  t.deepEqual(assembler.functionDefinitionLines, []);
});

test("front-end service handles global labels before directive dispatch", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processCommand("global Main: arch spc700");

  t.is(assembler.currentParentLabel, "Main");
  t.true(assembler.currentParentIsGlobal);
  t.is(assembler.arch, "spc700");
});

test("symbol scope resolves stored local relative labels", (t) => {
  const assembler = new Assembler();
  assembler.pass = 0;
  assembler.snespos = 0x1234;

  assembler.handleRelativeLabel("+");

  assembler.pass = 2;
  t.is(assembler.findNextLabel("+", 0x1200), 0x1234);
});

test("symbol scope resolves nested sublabels through current parent", (t) => {
  const assembler = new Assembler();

  assembler.handleLabelDefinition("Main");
  assembler.handleLabelDefinition(".Child");

  t.is(assembler.getLabelValue(".Child", false), assembler.snespos);
  t.is(assembler.getLabelValue("Main_Child", false), assembler.snespos);
});

test("front-end service handles named and static labels through processCommand", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processCommand("Main:");
  assembler.processCommand("Const = $10");

  t.is(assembler.getLabelValue("Main", false), assembler.snespos);
  t.is(assembler.getLabelValue("Const", true), 0x10);
});

test("struct engine records struct members through processCommand", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processCommand("struct Sprite");
  assembler.processCommand(".x: skip 2");
  assembler.processCommand(".y: skip 1");
  assembler.processCommand("endstruct");

  t.is(assembler.structs.get("Sprite")?.labels.get("x"), 0);
  t.is(assembler.structs.get("Sprite")?.labels.get("y"), 2);
  t.is(assembler.structs.get("Sprite")?.size, 3);
});

test("rom writer converts lorom pc offsets to snes and back", (t) => {
  const assembler = new Assembler();
  assembler.mapper = "lorom";

  const snesAddress = assembler.pctosnes(0);

  t.is(snesAddress, 0x808000);
  t.is(assembler.snestopc(snesAddress), 0);
});

test("rom writer enforces bank crossing checks before multi-byte writes", (t) => {
  const assembler = new Assembler();
  assembler.bankCrossCheckMode = "full";
  assembler.realsnespos = 0x00FFFF;

  const error = t.throws(() => {
    assembler.write2(0x1234);
  });

  t.truthy(error);
  t.true(error.message.includes("Ebank_border_crossed"));
});
