import { stub } from "sinon";
import { test } from "../ava-helper.js";
import { Assembler } from "../test-assembler.js";
import { createNormalizedCommand } from "../../src/ir/normalized-command.js";

const commandNode = (command: string) => createNormalizedCommand(
  command,
  command,
  command.trim().split(/\s+/),
  "macro-test.asm",
  1,
);

test("macro control expressions ignore blank and inline-comment text", t => {
  const assembler = new Assembler();
  const evaluateExpression = stub(assembler, "evaluateExpression").returns(true);

  t.false(assembler.macroEngine.evaluateMacroControlExpression(" ; ignored"));
  t.true(assembler.macroEngine.evaluateMacroControlExpression("1 == 1 ; ignored"));
  t.true(evaluateExpression.calledOnceWithExactly("1 == 1"));
});

test("macro control state covers nested branches and loop terminators", t => {
  const assembler = new Assembler();
  stub(assembler, "evaluateExpression").callsFake(expression => expression === "true");
  const engine = assembler.macroEngine;

  engine.updateMacroExpansionControlState("");
  engine.updateMacroExpansionControlState("elseif true");
  engine.updateMacroExpansionControlState("else");
  engine.updateMacroExpansionControlState("endif");
  t.deepEqual(engine.macroExpansionControlStack, []);

  engine.updateMacroExpansionControlState("if false");
  t.false(engine.isMacroExpansionActive());
  engine.updateMacroExpansionControlState("elseif true");
  t.true(engine.isMacroExpansionActive());
  engine.updateMacroExpansionControlState("elseif true");
  t.false(engine.isMacroExpansionActive());
  engine.updateMacroExpansionControlState("else");
  t.false(engine.isMacroExpansionActive());
  engine.updateMacroExpansionControlState("endif");

  engine.updateMacroExpansionControlState("if true");
  engine.updateMacroExpansionControlState("if false");
  engine.updateMacroExpansionControlState("elseif true");
  t.true(engine.isMacroExpansionActive());
  engine.updateMacroExpansionControlState("endif");
  engine.updateMacroExpansionControlState("endif");

  engine.updateMacroExpansionControlState("while true");
  t.true(engine.isMacroExpansionLoopActive());
  engine.updateMacroExpansionControlState("endwhile");
  engine.updateMacroExpansionControlState("for item = 0..1");
  t.true(engine.isMacroExpansionLoopActive());
  engine.updateMacroExpansionControlState("endfor");
  engine.updateMacroExpansionControlState("unknown");
  t.deepEqual(engine.macroExpansionControlStack, []);
});

test("macro definition parsing validates headers and variadic duplicates", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;

  t.false(engine.handleDefinitionCommand(commandNode("nop")));
  t.throws(() => engine.handleDefinitionCommand(commandNode("macro invalid")));
  t.true(engine.handleDefinitionCommand(commandNode("macro emit(value, ...)")));
  t.true(engine.handleDefinitionCommand(commandNode("db <value>")));
  t.true(engine.handleDefinitionCommand(commandNode("endmacro")));
  t.true(assembler.macros.get("emit")?.variadic);

  engine.handleDefinitionCommand(commandNode("macro emit()"));
  t.throws(() => engine.handleDefinitionCommand(commandNode("endmacro")));
});

test("macro definitions capture the defining file from the header command", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  assembler.currentFile = "/assemble.asm";

  t.true(engine.handleDefinitionCommand(createNormalizedCommand(
    "macro LoadFiles()",
    "macro LoadFiles()",
    ["macro", "LoadFiles()"],
    "/game/rommap.asm",
    1,
  )));
  t.true(engine.handleDefinitionCommand(createNormalizedCommand(
    "incsrc ../SNES_Macros.asm",
    "incsrc ../SNES_Macros.asm",
    ["incsrc", "../SNES_Macros.asm"],
    "/game/rommap.asm",
    2,
  )));
  t.true(engine.handleDefinitionCommand(createNormalizedCommand(
    "endmacro",
    "endmacro",
    ["endmacro"],
    "/game/rommap.asm",
    3,
  )));

  t.is(assembler.macros.get("LoadFiles")?.sourceFile, "/game/rommap.asm");
});

test("callMacro resolves body commands against the defining file", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  assembler.currentFile = "/caller.asm";
  const seenFiles: string[] = [];
  const processCommand = stub(assembler, "processCommand").callsFake(() => {
    seenFiles.push(assembler.currentFile);
  });
  assembler.macros.set("LoadFiles", {
    name: "LoadFiles",
    params: [],
    variadic: false,
    body: [commandNode("incsrc ../SNES_Macros.asm")],
    sourceFile: "/game/rommap.asm",
  });

  engine.callMacro("LoadFiles()");

  t.deepEqual(seenFiles, ["/game/rommap.asm"]);
  t.is(assembler.currentFile, "/caller.asm");
  t.true(processCommand.calledOnce);
});

test("macro definitions skip collection outside definition stage", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  stub(assembler, "isDefinitionCollectionStage").get(() => false);

  engine.handleDefinitionCommand(commandNode("macro ignored()"));
  engine.handleDefinitionCommand(commandNode("db $01"));
  engine.handleDefinitionCommand(commandNode("endmacro"));

  t.false(assembler.macros.has("ignored"));
  t.false(assembler.inMacroDefinition);
});

test("macro label rewriting covers local, relative, and unresolved references", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  assembler.inMacroExpansion = true;
  assembler.macroLabelInstance = 3;
  assembler.currentTargetAddress = 0x2000;
  assembler.labelTable.set(":macro_3_+", { value: 0x2100, isStatic: false });
  assembler.labelTable.set(":macro_3_-", { value: 0x1F00, isStatic: false });

  t.is(engine.rewriteMacroLabelReferences("lda ?+"), "lda $2100");
  t.is(engine.rewriteMacroLabelReferences("lda ?-"), "lda $1f00");
  t.is(engine.rewriteMacroLabelReferences("?+:"), "?+:");
  t.is(engine.rewriteMacroLabelReferences("?-:"), "?-:");
  t.is(engine.rewriteMacroLabelReferences("nop"), "nop");

  stub(assembler.symbolScope, "getLabelValue")
    .withArgs("?known", false)
    .returns(0x3456);
  t.is(engine.rewriteMacroLabelReferences("lda ?known"), "lda $3456");
  t.is(engine.rewriteMacroLabelReferences("?known: nop"), "?known: nop");
  t.is(engine.rewriteMacroLabelReferences("?known = 1"), "?known = 1");

  stub(assembler, "isDefinitionCollectionStage").get(() => true);
  t.is(engine.rewriteMacroLabelReferences("lda ?missing"), "lda $0000");
});

test("macro relative rewriting falls back to symbol-scope searches", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  assembler.inMacroExpansion = true;
  assembler.macroLabelInstance = 4;
  assembler.currentTargetAddress = 0x2000;
  stub(assembler.symbolScope, "findNextLabel").returns(0x3000);
  stub(assembler.symbolScope, "findPreviousLabel").returns(0x1000);

  t.is(engine.rewriteMacroLabelReferences("lda ?+"), "lda $3000");
  t.is(engine.rewriteMacroLabelReferences("lda ?-"), "lda $1000");
});

test("macro expansion preserves deferred placeholders and validates indexes", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  const args = ["$10", "$20"];
  stub(assembler, "resolvedefines").callsFake(input => input.replace("!index", "1"));
  stub(assembler.mathCore, "math").callsFake(input => Number(input));

  engine.macroExpansionControlStack = [{ type: "for", active: true }];
  t.is(
    engine.expandMacroLine("db <...[!index]>", new Map(), args, args.length),
    "db <...[!index]>",
  );

  engine.macroExpansionControlStack = [{ type: "if", active: false }];
  t.is(
    engine.expandMacroLine("db <...[0]>, sizeof(...)", new Map(), args, args.length),
    "db <...[0]>, sizeof(...)",
  );

  engine.macroExpansionControlStack = [];
  t.throws(() => engine.expandMacroLine("db <...[bad]>", new Map(), args, args.length));
  t.throws(() => engine.expandMacroLine("db <...[3]>", new Map(), args, args.length));
  t.is(engine.expandMacroLine("?local: db <value>", new Map([["value", "$10"]]), [], 0), "?local: db <value>");
});

test("macro define-line expansion resolves legacy and variadic forms", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  assembler.defines.set("legacy", "$30");
  assembler.defines.set("index", "1");
  stub(assembler, "resolvedefines").callsFake(input => input.replace("!index", "1"));
  stub(assembler.mathCore, "math").callsFake(input => Number(input));

  t.is(
    engine.expandMacroLine(
      "!value = <!fixed>, <!legacy>, <...[!index]>, sizeof(...)",
      new Map([["fixed", "$10"]]),
      ["$20", "$21"],
      2,
    ),
    "!value = $10, $30, $21, 2",
  );
  t.is(engine.expandMacroLine("db <!missing>", new Map(), [], 0), "db <!missing>");
  t.throws(() => engine.expandMacroLine("!value = <...[bad]>", new Map(), [], 0));
});

test("macro !<param> keeps the define name instead of resolving the value", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  assembler.defines.set("TEMP2", "0");
  assembler.defines.set("TRUE", "1");
  assembler.defines.set("TEMP", "");
  assembler.activateStage("collectDefinitions");

  const params = new Map([
    ["StartOfList", "TEMP2"],
    ["StringVar", "TEMP"],
    ["NewString", "Joypad"],
  ]);
  t.is(
    engine.expandMacroLine("if !<StartOfList> != !TRUE", params, [], 0),
    "if !TEMP2 != !TRUE",
  );
  t.is(engine.expandMacroLine("!<StartOfList> = !FALSE", params, [], 0), "!TEMP2 = !FALSE");
  t.is(
    engine.expandMacroLine('!<StringVar> += "<NewString>"', params, [], 0),
    '!TEMP += "Joypad"',
  );
  t.is(
    engine.expandMacroLine("if !<StartOfList> != !TRUE", new Map([["StartOfList", "!TEMP2"]]), [], 0),
    "if !TEMP2 != !TRUE",
  );
  t.true(assembler.evaluateExpression("!TEMP2 != !TRUE"));
});

test("variadic placeholder resolution handles defines, errors, and no-op input", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  assembler.currentVariadicArgs = ["$10", "$20"];
  assembler.defines.set("index", "1");
  stub(assembler, "resolvedefines").callsFake(input => input.replace("!index", "1"));
  stub(assembler.mathCore, "math").callsFake(input => Number(input));

  t.is(engine.resolveVariadicPlaceholders("db $01"), "db $01");
  t.is(
    engine.resolveVariadicPlaceholders("db <...[!index]>, sizeof(...)"),
    "db $20, 2",
  );
  t.throws(() => engine.resolveVariadicPlaceholders("db <...[bad]>"));
  t.throws(() => engine.resolveVariadicPlaceholders("db <...[2]>"));
});

test("processMacroLine handles inactive lines, labels, and assignments", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  const processCommand = stub(assembler, "processCommand");
  const setLabel = stub(assembler.symbolScope, "setLabel");
  const relative = stub(assembler.symbolScope, "handleRelativeLabel");

  engine.macroExpansionControlStack = [{ type: "if", active: false }];
  engine.processMacroLine("db $01");
  t.false(processCommand.called);
  engine.processMacroLine("else");
  t.true(processCommand.calledOnce);

  engine.macroExpansionControlStack = [];
  engine.processMacroLine("?+: db $02");
  t.true(relative.calledOnce);
  t.true(processCommand.calledWith("db $02"));
  engine.processMacroLine("?-:");
  t.true(relative.calledTwice);

  engine.processMacroLine("?local: db $03");
  t.true(setLabel.calledWith("?local", undefined, false, true));
  engine.processMacroLine("?empty:");
  t.true(setLabel.calledWith("?empty", undefined, false, true));

  engine.processMacroLine("?constant = 4");
  t.true(setLabel.calledWith("?constant", 4, true, true));
});

test("callMacro parses quoted arguments and restores expansion state", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  const processCommand = stub(assembler, "processCommand");
  assembler.currentMacroName = "outer";
  assembler.currentVariadicCount = 7;
  assembler.currentVariadicArgs = ["saved"];
  assembler.currentParentLabel = "Parent";
  assembler.currentParentIsGlobal = true;
  engine.macroExpansionControlStack = [{ type: "if", active: true }];
  assembler.macros.set("emit", {
    name: "emit",
    params: ["first"],
    variadic: true,
    body: [
      commandNode("db <first>, <...[0]>"),
      commandNode("db sizeof(...)"),
    ],
    sourceFile: "macro-test.asm",
  });

  engine.callMacro('emit("$10,still", "$20", "escaped ""quote""")');

  t.true(processCommand.calledWith("db $10,still, $20"));
  t.true(processCommand.calledWith("db 2"));
  t.is(assembler.currentMacroName, "outer");
  t.is(assembler.currentVariadicCount, 7);
  t.deepEqual(assembler.currentVariadicArgs, ["saved"]);
  t.is(assembler.currentParentLabel, "Parent");
  t.true(assembler.currentParentIsGlobal);
  t.deepEqual(engine.macroExpansionControlStack, [{ type: "if", active: true }]);
});

test("callMacro handles bare invocations and missing macros", t => {
  const assembler = new Assembler();
  const engine = assembler.macroEngine;
  const processCommand = stub(assembler, "processCommand");
  assembler.macros.set("empty", {
    name: "empty",
    params: [],
    variadic: false,
    body: [commandNode("nop")],
    sourceFile: "macro-test.asm",
  });
  assembler.macros.set("fixed", {
    name: "fixed",
    params: ["value"],
    variadic: false,
    body: [commandNode("db <value>")],
    sourceFile: "macro-test.asm",
  });

  engine.callMacro("%empty");
  engine.callMacro("fixed");
  t.true(processCommand.calledWith("nop"));
  t.true(processCommand.calledWith("db "));
  t.throws(() => engine.callMacro("missing"));
  t.throws(() => engine.callMacro("missing()"));
});
