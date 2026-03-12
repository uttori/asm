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
