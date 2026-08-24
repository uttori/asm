import fs from "node:fs";
import path from "node:path";
import { spy, stub } from "sinon";
import { test } from "./ava-helper.js";

import { Assembler } from "./test-assembler.js";
import { MemoryAssemblyFileProvider } from "../packages/core/src/file-provider.js";
import { createNormalizedCommand } from "../packages/core/src/ir/normalized-command.js";
import { handleArch } from "../packages/core/src/directives/layout.js";

const commandNode = (command: string) => createNormalizedCommand(
  command,
  command,
  command.trim().split(/\s+/),
  "test.asm",
  1
);

test("macro engine expands fixed and variadic parameters", (t) => {
  const assembler = new Assembler();

  const expanded = assembler.macroEngine.expandMacroLine(
    "db <value>, <...[1]>, sizeof(...)",
    new Map([["value", "$10"]]),
    ["$20", "$30"],
    2,
  );

  t.is(expanded, "db $10, $20, 2");
});

test("macro engine handles definition lifecycle through normalized dispatch", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processNormalizedCommand(commandNode("macro set_define()"), false);
  assembler.processNormalizedCommand(commandNode("!macro_value = 3"), false);
  assembler.processNormalizedCommand(commandNode("endmacro"), false);
  assembler.processNormalizedCommand(commandNode("%set_define()"), false);

  t.true(assembler.macros.has("set_define"));
  t.is(assembler.defines.get("macro_value"), "3");
});

test("macro engine handles labeled invocations after label consumption", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processNormalizedCommand(commandNode("macro set_define()"), false);
  assembler.processNormalizedCommand(commandNode("!macro_value = 7"), false);
  assembler.processNormalizedCommand(commandNode("endmacro"), false);
  assembler.processNormalizedCommand(commandNode("Entry: %set_define()"), false);

  t.is(assembler.currentParentLabel, "Entry");
  t.is(assembler.defines.get("macro_value"), "7");
});

test("normalized dispatch rewrite path preserves labeled macro invocation order", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processNormalizedCommand(commandNode("macro set_define()"), false);
  assembler.processNormalizedCommand(commandNode("!macro_value = 11"), false);
  assembler.processNormalizedCommand(commandNode("endmacro"), false);
  assembler.processNormalizedCommand(commandNode("Entry: %set_define()"), true);

  t.is(assembler.currentParentLabel, "Entry");
  t.is(assembler.defines.get("macro_value"), "11");
});

test("define engine resolves standalone define commands through normalized dispatch", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processNormalizedCommand(commandNode("!emit = arch spc700"), false);
  assembler.processNormalizedCommand(commandNode("!emit"), false);

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

  assembler.processNormalizedCommand(commandNode("global Main: arch spc700"), false);

  t.is(assembler.currentParentLabel, "Main");
  t.true(assembler.currentParentIsGlobal);
  t.is(assembler.arch, "spc700");
});

test("processCommand routes raw loop directives into the typed incremental parser", (t) => {
  const assembler = new Assembler();

  assembler.processCommand("for i = 0..2");

  t.is(assembler.incrementalProgramParseState.loopStack.length, 1);
  t.is(assembler.incrementalProgramParseState.roots.length, 1);
  t.deepEqual(assembler.incrementalProgramParseState.roots[0], assembler.incrementalProgramParseState.loopStack[0]);
});

test("pre-dispatch pipeline loads test rom directive", (t) => {
  const targetRom = new Uint8Array([1, 2, 3, 4]);
  const assembler = new Assembler(targetRom);

  assembler.processCommand(";`+");

  t.deepEqual(Array.from(assembler.outputBytes.slice(0, 4)), [1, 2, 3, 4]);
});

test("normalized dispatch also loads test rom directive", (t) => {
  const targetRom = new Uint8Array([1, 2, 3, 4]);
  const assembler = new Assembler(targetRom);

  // Tree execution enters through processNormalizedCommand, so this directive
  // must retain the same bootstrap semantics as raw processCommand.
  assembler.processNormalizedCommand(commandNode(";`+"), false);

  t.deepEqual(Array.from(assembler.outputBytes.slice(0, 4)), [1, 2, 3, 4]);
});

test("normalized command preprocessing handles character mappings", (t) => {
  const assembler = new Assembler();
  const handleCharacterMapping = spy(assembler.directiveRuntime, "handleCharacterMapping");

  assembler.processNormalizedCommand(commandNode('"A" = $42'), false);

  t.true(handleCharacterMapping.calledOnceWithExactly(['"A"', "=", "$42"]));
  t.is(assembler.characterMappings.get("A"), 0x42);
});

test("directive effects stay behind the runtime service host contract", (t) => {
  const assembler = new Assembler();
  assembler.characterMappings.set("A", 0x10);

  t.deepEqual(assembler.directiveRuntime.processStringWithMapping("AB"), [0x10, 0x42]);
  t.false("handleCharacterMapping" in assembler);
  t.false("processStringWithMapping" in assembler);
  t.false("writeDataByLength" in assembler);
});

test("struct engine restores write position after struct definition lifecycle", (t) => {
  const assembler = new Assembler();
  const originalAddress = 0x808123;
  assembler.cursorAddress.setWritePosition(originalAddress);

  assembler.structEngine.handleStruct(["struct", "Player", "$808000"]);
  t.truthy(assembler.currentStruct);
  t.is(assembler.currentTargetAddress, 0x808000);
  assembler.currentStruct.offset = 4;
  assembler.structEngine.handleEndStruct(["endstruct"]);

  t.is(assembler.currentStruct, null);
  t.is(assembler.currentTargetAddress, originalAddress);
  t.true(assembler.structs.has("Player"));
});

test("expression host readBaseImage and readFile preserve defaults and bounds behavior", (t) => {
  const assembler = new Assembler(new Uint8Array([0x11, 0x22, 0x33]));
  assembler.targetState.readFunctionsEnabled = true;
  const romStart = assembler.outputWriter.fromOutputOffset(0);

  t.is(assembler.expressionHost.readBaseImage(romStart, 2), 0x2211);
  t.is(assembler.expressionHost.readBaseImage(assembler.outputWriter.fromOutputOffset(2), 2, 0x77), 0x77);
  t.throws(() => assembler.expressionHost.readBaseImage(assembler.outputWriter.fromOutputOffset(2), 2), { message: /out of bounds/i });

  const fixturePath = path.join(process.cwd(), "tests", "read-expression.bin");
  try {
    fs.writeFileSync(fixturePath, Buffer.from([0xAA, 0xBB, 0xCC]));
    t.is(assembler.expressionHost.canReadFile(fixturePath, 1, 2), 1);
    t.is(assembler.expressionHost.readFile(fixturePath, 0, 2), 0xBBAA);
    t.is(assembler.expressionHost.readFile(fixturePath, 5, 1, 0x44), 0x44);
    t.throws(() => assembler.expressionHost.readFile(fixturePath, 5, 1), { message: /out of bounds/i });
  } finally {
    if (fs.existsSync(fixturePath)) {
      fs.unlinkSync(fixturePath);
    }
  }
});

test("symbol scope resolves stored local relative labels", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("collectDefinitions");
  assembler.currentTargetAddress = 0x1234;

  assembler.symbolScope.handleRelativeLabel("+");

  assembler.activateStage("emitProgram");
  t.is(assembler.symbolScope.findNextLabel("+", 0x1200), 0x1234);
});

test("symbol scope does not treat a suffix of the current sublabel as that sublabel", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("resolveLayout");

  assembler.currentTargetAddress = 0x01c0d9;
  assembler.symbolScope.handleLabelDefinition("gm0f_run_level");
  assembler.currentTargetAddress = 0x01c137;
  assembler.symbolScope.handleLabelDefinition(".check_start_select");
  assembler.currentTargetAddress = 0x01c14b;
  assembler.symbolScope.handleLabelDefinition(".start_select");

  assembler.currentParentLabel = "gm0f_run_level_check_start_select";
  t.is(assembler.symbolScope.getLabelValue(".start_select", false), 0x01c14b);
});

test("symbol scope resolves nested sublabels through current parent", (t) => {
  const assembler = new Assembler();

  assembler.symbolScope.handleLabelDefinition("Main");
  assembler.symbolScope.handleLabelDefinition(".Child");

  t.is(assembler.symbolScope.getLabelValue(".Child", false), assembler.currentTargetAddress);
  t.is(assembler.symbolScope.getLabelValue("Main_Child", false), assembler.currentTargetAddress);
});

test("symbol scope preserves nested hierarchy during pass zero label collection", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("collectDefinitions");

  assembler.symbolScope.handleLabelDefinition("arthur_sprites");
  assembler.symbolScope.handleLabelDefinition(".underwear");
  assembler.symbolScope.handleLabelDefinition("..idle");

  t.true(assembler.labelTable.has("arthur_sprites_underwear_idle"));
  t.is(assembler.currentParentLabel, "arthur_sprites_underwear_idle");
});

test("symbol scope keeps sibling single-dot labels under the enclosing global label", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("collectDefinitions");

  assembler.symbolScope.handleLabelDefinition("_018049");
  assembler.symbolScope.handleLabelDefinition(".804D");
  assembler.symbolScope.handleLabelDefinition(".8051");
  assembler.symbolScope.handleLabelDefinition(".8053");

  t.true(assembler.labelTable.has("_018049_804D"));
  t.true(assembler.labelTable.has("_018049_8051"));
  t.true(assembler.labelTable.has("_018049_8053"));
  t.false(assembler.labelTable.has("_018049_804D_8051"));
  t.false(assembler.labelTable.has("_018049_804D_8051_8053"));
});

test("symbol scope preserves underscore-containing global parents for single-dot labels", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("collectDefinitions");

  assembler.symbolScope.handleLabelDefinition("stage1_earthquake");
  assembler.symbolScope.handleLabelDefinition("stage1_earthquake_tiles");
  assembler.symbolScope.handleLabelDefinition(".1");
  assembler.symbolScope.handleLabelDefinition(".2");

  t.true(assembler.labelTable.has("stage1_earthquake_tiles_1"));
  t.true(assembler.labelTable.has("stage1_earthquake_tiles_2"));
  t.false(assembler.labelTable.has("stage1_earthquake_1"));
  t.false(assembler.labelTable.has("stage1_earthquake_2"));
});

test("symbol scope keeps sibling double-dot labels under the enclosing local label", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("collectDefinitions");

  assembler.symbolScope.handleLabelDefinition("random_values");
  assembler.symbolScope.handleLabelDefinition(".idx");
  assembler.symbolScope.handleLabelDefinition("..beginner");
  assembler.symbolScope.handleLabelDefinition("..normal");

  t.true(assembler.labelTable.has("random_values_idx_beginner"));
  t.true(assembler.labelTable.has("random_values_idx_normal"));
  t.false(assembler.labelTable.has("random_values_idx_beginner_normal"));
});

test("symbol scope keeps underscore-containing single-dot labels as double-dot parents", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("collectDefinitions");

  assembler.symbolScope.handleLabelDefinition("spc_0E00");
  assembler.symbolScope.handleLabelDefinition(".stage1");
  assembler.symbolScope.handleLabelDefinition("..ch8");
  assembler.currentTargetAddress += 1;
  assembler.symbolScope.handleLabelDefinition(".stage1_boss");
  assembler.symbolScope.handleLabelDefinition("..ch8");
  assembler.currentTargetAddress += 1;
  assembler.symbolScope.handleLabelDefinition("..ch7");

  t.true(assembler.labelTable.has("spc_0E00_stage1_ch8"));
  t.true(assembler.labelTable.has("spc_0E00_stage1_boss_ch8"));
  t.true(assembler.labelTable.has("spc_0E00_stage1_boss_ch7"));
  t.is(assembler.labelTable.get("spc_0E00_stage1_ch8")?.value, 0);
  t.is(assembler.labelTable.get("spc_0E00_stage1_boss_ch8")?.value, 1);
  t.is(assembler.labelTable.get("spc_0E00_stage1_boss_ch7")?.value, 2);
});

test("symbol scope prefers exact single-dot locals before shortened underscore fallbacks", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("collectDefinitions");

  assembler.symbolScope.handleLabelDefinition("_00ED00");
  assembler.symbolScope.handleLabelDefinition(".arthur_underwear");
  assembler.symbolScope.handleLabelDefinition("..knockback");
  assembler.currentTargetAddress += 1;
  assembler.symbolScope.handleLabelDefinition(".arthur_steel");
  assembler.symbolScope.handleLabelDefinition("..knockback");
  assembler.currentTargetAddress += 1;
  assembler.symbolScope.handleLabelDefinition(".arthur_upgraded_armor");
  assembler.symbolScope.handleLabelDefinition(".gold");

  t.is(assembler.symbolScope.getLabelValue(".arthur_underwear_knockback", false), 0);
});

test("symbol scope returns single-dot labels to the top-level parent after nested locals", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("collectDefinitions");

  assembler.symbolScope.handleLabelDefinition("_00ED00");
  assembler.symbolScope.handleLabelDefinition(".arthur_underwear");
  assembler.symbolScope.handleLabelDefinition("..knockback");
  assembler.symbolScope.handleLabelDefinition(".arthur_steel");

  t.true(assembler.labelTable.has("_00ED00_arthur_underwear"));
  t.true(assembler.labelTable.has("_00ED00_arthur_underwear_knockback"));
  t.true(assembler.labelTable.has("_00ED00_arthur_steel"));
  t.false(assembler.labelTable.has("_00ED00_arthur_underwear_arthur_steel"));
});

test("symbol scope keeps double-dot labels under the active global root when shorter prefixes exist", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("collectDefinitions");

  assembler.symbolScope.handleLabelDefinition("arthur");
  assembler.symbolScope.handleLabelDefinition("arthur_sprites");
  assembler.symbolScope.handleLabelDefinition(".underwear");
  assembler.symbolScope.handleLabelDefinition("..idle");

  t.true(assembler.labelTable.has("arthur_sprites_underwear_idle"));
  t.false(assembler.labelTable.has("arthur_sprites_idle"));
});

test("symbol scope resolves namespaced local sibling labels without collapsing doubled separators", (t) => {
  const assembler = new Assembler();
  assembler.currentNamespace = "knife";
  assembler.activateStage("collectDefinitions");

  assembler.symbolScope.handleLabelDefinition("_E449");
  assembler.symbolScope.handleLabelDefinition(".E44C");
  assembler.symbolScope.handleLabelDefinition(".E4CA");

  assembler.activateStage("resolveLayout");
  assembler.currentNamespace = "knife";
  assembler.currentParentLabel = "knife__E449_E44C";

  t.true(assembler.labelTable.has("knife__E449_E4CA"));
  t.is(assembler.symbolScope.getLabelValue(".E4CA", false), assembler.labelTable.get("knife__E449_E4CA")?.value ?? 0);
});

test("symbol scope falls back to global labels when a namespace-local symbol is absent", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("resolveLayout");

  assembler.symbolScope.setLabel("difficulty", 0x27C, true);
  assembler.currentNamespace = "zombie";

  t.false(assembler.labelTable.has("zombie_difficulty"));
  t.is(assembler.symbolScope.getLabelValue("difficulty", false), 0x27C);
});

test("symbol scope resolves local labels under underscore-prefixed parents", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("resolveLayout");

  assembler.currentParentLabel = "_0083C2_83C3_83DE";
  assembler.labelTable.set("_0083C2_83EB", {
    value: 0x83EB,
    isStatic: false,
    isMacroLabel: false,
    modifiesHierarchy: true,
  });

  t.is(assembler.symbolScope.getLabelValue(".83EB", false), 0x83EB);
});

test("symbol scope resolves compressed nested local label references", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("resolveLayout");

  assembler.currentParentLabel = "random_values_difficulty_offset";
  assembler.labelTable.set("random_values_difficulty_offset_idx_beginner", {
    value: 0x1234,
    isStatic: false,
    isMacroLabel: false,
    modifiesHierarchy: true,
  });

  t.is(assembler.symbolScope.getLabelValue(".idx_beginner", false), 0x1234);
});

test("symbol scope resolves double-dot local label references", (t) => {
  const assembler = new Assembler();
  assembler.activateStage("resolveLayout");

  assembler.currentParentLabel = "_00ED00_arthur_underwear";
  assembler.labelTable.set("_00ED00_arthur_underwear_idle", {
    value: 0xED39,
    isStatic: false,
    isMacroLabel: false,
    modifiesHierarchy: true,
  });

  t.is(assembler.symbolScope.getLabelValue("..idle", false), 0xED39);
});

test("typed conditional nodes skip inactive branches during execution", (t) => {
  const assembler = new Assembler();
  const executed: string[] = [];
  stub(assembler, "processNormalizedCommand").callsFake((command) => {
    executed.push(command.command);
  });

  const [node] = assembler.parseCommandStreamToNodes([
    "if 0",
    "db $10",
    "else",
    "db $20",
    "endif",
  ], "typed-conditional.asm", 0);

  if (!node || typeof node === "string" || !("type" in node) || node.type !== "if") {
    t.fail();
    return;
  }

  assembler.lowerAndExecuteRuntimeNodes([node]);
  t.deepEqual(executed, ["db $20"]);
});

test("macro-expanded control flow executes through typed nodes", (t) => {
  const assembler = new Assembler();
  const source = [
    "macro emit(flag)",
    "if <flag>",
    "  for i = 0..2",
    "    db !i + 1",
    "  endfor",
    "else",
    "  db $FF",
    "endif",
    "endmacro",
    "%emit(1)",
  ].join("\n");

  for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
    assembler.activateStage(stage);
    assembler.setWritePosition(0x808000);
    for (const [lineNumber, line] of source.split("\n").entries()) {
      assembler.setCurrentLine(lineNumber);
      assembler.assembleblock(line);
    }
    assembler.finishPass();
  }

  t.deepEqual(Array.from(assembler.getBinaryOutput()), [0x01, 0x02]);
});

test("macro-expanded variadic loop bodies defer placeholder resolution until execution", (t) => {
  const assembler = new Assembler();
  const source = [
    "macro emit(...)",
    "  !a = 0",
    "  while !a < sizeof(...)",
    "    db <...[!a]>",
    "    !a #= !a+1",
    "  endwhile",
    "endmacro",
    "%emit(1, 2, 3)",
  ].join("\n");

  for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
    assembler.activateStage(stage);
    assembler.setWritePosition(0x808000);
    for (const [lineNumber, line] of source.split("\n").entries()) {
      assembler.setCurrentLine(lineNumber);
      assembler.assembleblock(line);
    }
    assembler.finishPass();
  }

  t.deepEqual(Array.from(assembler.getBinaryOutput()), [0x01, 0x02, 0x03]);
});

test("front-end service handles named and static labels through normalized dispatch", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processNormalizedCommand(commandNode("Main:"), false);
  assembler.processNormalizedCommand(commandNode("Const = $10"), false);

  t.is(assembler.symbolScope.getLabelValue("Main", false), assembler.currentTargetAddress);
  t.is(assembler.symbolScope.getLabelValue("Const", true), 0x10);
});

test("struct engine records struct members through normalized dispatch", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processNormalizedCommand(commandNode("struct Sprite"), false);
  assembler.processNormalizedCommand(commandNode(".x: skip 2"), false);
  assembler.processNormalizedCommand(commandNode(".y: skip 1"), false);
  assembler.processNormalizedCommand(commandNode("endstruct"), false);

  t.is(assembler.structs.get("Sprite")?.labels.get("x"), 0);
  t.is(assembler.structs.get("Sprite")?.labels.get("y"), 2);
  t.is(assembler.structs.get("Sprite")?.size, 3);
});

test("rom writer converts lorom pc offsets to snes and back", (t) => {
  const assembler = new Assembler();
  assembler.targetState.mapper = "lorom";

  const snesAddress = assembler.outputWriter.fromOutputOffset(0);

  t.is(snesAddress, 0x808000);
  t.is(assembler.outputWriter.toOutputOffset(snesAddress), 0);
});

test("rom writer enforces bank crossing checks before multi-byte writes", (t) => {
  const assembler = new Assembler();
  assembler.targetState.bankCrossMode = "full";
  assembler.currentTargetBaseAddress = 0x00FFFF;

  const error = t.throws(() => {
    assembler.write2(0x1234);
  });

  t.truthy(error);
  t.true(error.message.includes("Ebank_border_crossed"));
});

test("node parser lifts loops and conditionals into typed nodes", (t) => {
  const assembler = new Assembler();
  const nodes = assembler.parseCommandStreamToNodes([
    "if 1",
    "for i = 0..2",
    "db !i",
    "endfor",
    "else",
    "db $ff",
    "endif",
  ]);

  t.is(nodes.length, 1);
  const ifNode = nodes[0];
  if (!ifNode || !("type" in ifNode) || ifNode.type !== "if") {
    t.fail();
    return;
  }
  t.is(ifNode.branches.length, 2);
  t.is(ifNode.branches[0].kind, "if");
  t.is(ifNode.branches[1].kind, "else");
  const firstBranchNode = ifNode.branches[0].commands[0];
  t.truthy(firstBranchNode && typeof firstBranchNode !== "string" && "type" in firstBranchNode && firstBranchNode.type === "for");
});

test("node execution seam dispatches typed command and conditional nodes", (t) => {
  const assembler = new Assembler();
  const processed: string[] = [];
  stub(assembler, "processNormalizedCommand").callsFake((command) => {
    processed.push(command.command);
  });

  assembler.lowerAndExecuteRuntimeNodes(assembler.parseCommandStreamToNodes([
    "if 1",
    "db $01",
    "else",
    "db $ff",
    "endif",
  ]));

  t.deepEqual(processed, ["db $01"]);
});

test("node execution seam does not re-normalize cached command nodes", (t) => {
  const assembler = new Assembler();
  const [commandNode] = assembler.parseCommandStreamToNodes(["db $01"]);
  if (!commandNode || !("source" in commandNode)) {
    t.fail();
    return;
  }

  const createLoopNodeStub = stub(assembler.frontEndService, "createLoopCommandNode");
  stub(assembler, "processNormalizedCommand").callsFake(() => {});
  assembler.lowerAndExecuteRuntimeNodes([commandNode]);
  t.false(createLoopNodeStub.called);
});

test("macro/include lifting exposes typed macro and include nodes", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");
  assembler.activateStage("collectDefinitions");
  assembler.processCommand("macro emit(v)");
  assembler.processCommand("db <v>");
  assembler.processCommand("endmacro");

  const macroNode = assembler.getMacroDefinitionNode("emit");
  t.truthy(macroNode);
  t.is(macroNode?.type, "macroDefinition");
  t.is(macroNode?.body.length, 1);
  if (macroNode && macroNode.body.length > 0) {
    const command = macroNode.body[0];
    t.true(typeof command !== "string" && "source" in command);
  }

  const includeNode = assembler.programModelBuilder.createIncludeNode("inline.asm", "if 1\ndb $01\nendif");
  t.is(includeNode.type, "include");
  t.is(includeNode.commands.length, 1);
  const includeChild = includeNode.commands[0];
  t.true(typeof includeChild !== "string" && "type" in includeChild && includeChild.type === "if");
});

test("typed parser keeps nested condition-loop structures executable", (t) => {
  const assembler = new Assembler();
  const executed: string[] = [];
  stub(assembler, "processNormalizedCommand").callsFake((command) => {
    executed.push(command.command);
  });

  const nodes = assembler.parseCommandStreamToNodes([
    "if 1",
    "for i = 0..1",
    "db $01",
    "endfor",
    "else",
    "db $ff",
    "endif",
  ]);
  assembler.lowerAndExecuteRuntimeNodes(nodes);
  t.deepEqual(executed, ["db $01"]);
});

test("stage runner builds program once and executes all stages", (t) => {
  const assembler = new Assembler();
  const parseSpy = stub(assembler.programModelBuilder, "parseCommandStreamToNodes").callThrough();
  const stagedAssembler = assembler as Assembler & {
    buildProgramModel(source: string, sourceFile?: string, startLine?: number): {
      sourceFile: string;
      startLine: number;
      nodes: unknown[];
    };
    assembleProgram(program: {
      sourceFile: string;
      startLine: number;
      nodes: unknown[];
    }): void;
  };

  const program = stagedAssembler.buildProgramModel("org $808000\ndb $01", "test.asm", 0);
  const [firstNode, secondNode] = program.nodes as Array<{ keyword?: string; words?: string[] }>;
  t.is(firstNode?.keyword, "org");
  t.deepEqual(firstNode?.words, ["org", "$808000"]);
  t.is(secondNode?.keyword, "db");
  t.deepEqual(secondNode?.words, ["db", "$01"]);
  stagedAssembler.assembleProgram(program);

  // Cached pass program should be reused across stage executions.
  t.true(parseSpy.calledOnce);
  const emitStage = assembler.stageExecutionStates.get("emitProgram");
  t.truthy(emitStage);
  t.is(emitStage?.stage, "emitProgram");
  t.is(emitStage?.cursor.currentTargetAddress, 0x808001);
  t.is(assembler.outputBytes[0], 0x01);
});

test("line-by-line assembleblock uses typed control-flow parsing", (t) => {
  const source = [
    "if 1",
    "  db $01",
    "else",
    "  db $02",
    "endif",
    "for i = 0..2",
    "  db !i",
    "endfor",
  ].join("\n");

  const assembleByLine = (): number[] => {
    const assembler = new Assembler();
    for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
      assembler.activateStage(stage);
      for (const [lineNumber, line] of source.split("\n").entries()) {
        assembler.setCurrentLine(lineNumber);
        assembler.assembleblock(line);
      }
      assembler.finishPass();
    }
    return Array.from(assembler.getBinaryOutput());
  };

  const assembleByTree = (): number[] => {
    const assembler = new Assembler();
    for (const stage of ["collectDefinitions", "resolveLayout", "emitProgram"] as const) {
      assembler.activateStage(stage);
      assembler.setCurrentLine(0);
      assembler.assembleblock(source);
      assembler.finishPass();
    }
    return Array.from(assembler.getBinaryOutput());
  };

  t.deepEqual(assembleByLine(), assembleByTree());
});

test("stage execution state is recreated per collect stage run", (t) => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel("db $01", "test.asm", 0);

  assembler.setWritePosition(0x808000);
  const firstCollect = assembler.runStage("collectDefinitions", program) as { cursor: { currentTargetAddress: number } };
  t.is(firstCollect.cursor.currentTargetAddress, 0x808001);

  assembler.setWritePosition(0x80A000);
  const secondCollect = assembler.runStage("collectDefinitions", program) as { cursor: { currentTargetAddress: number } };
  t.not(firstCollect, secondCollect);
  t.is(secondCollect.cursor.currentTargetAddress, 0x80A001);
});

test("stage states keep symbols, control, and plugin state isolated by stage", (t) => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel("Label:\ndb $01", "test.asm", 0);
  const collect = assembler.runStage("collectDefinitions", program) as {
    symbols: { labelTable: Map<string, unknown> };
    control: object;
    pluginState: Map<string, unknown>;
  };
  const layout = assembler.runStage("resolveLayout", program) as {
    symbols: { labelTable: Map<string, unknown> };
    control: object;
    pluginState: Map<string, unknown>;
  };

  t.not(collect.symbols.labelTable, layout.symbols.labelTable);
  t.not(collect.control, layout.control);
  t.not(collect.pluginState, layout.pluginState);
});

test("instruction dispatch follows active stage capabilities", (t) => {
  const assembler = new Assembler();
  const internalAssembler = assembler as unknown as Record<string, (...args: unknown[]) => unknown>;
  const layoutSpy = stub(internalAssembler, "layoutInstruction").returns(true);
  const emitSpy = stub(internalAssembler, "emitInstruction").returns(true);
  const program = assembler.buildProgramModel("lda #$01", "test.asm", 0);

  assembler.runStage("collectDefinitions", program);
  t.true(layoutSpy.called);

  layoutSpy.resetHistory();
  assembler.runStage("resolveLayout", program);
  t.true(emitSpy.called);
});

test("architecture registry resolves aliases through arch directive", (t) => {
  const assembler = new Assembler();

  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "spc700-inline"]);
  t.is(assembler.arch, "spc700");
  t.true(assembler.targetState.spcInlineCompatibility);

  handleArch({
    session: assembler,
    operandResolver: assembler.operandResolver,
  }, ["arch", "superfx"]);
  t.is(assembler.arch, "superfx");
  t.false(assembler.targetState.spcInlineCompatibility);
});

test("activateStage keeps stage capabilities authoritative", (t) => {
  const assembler = new Assembler();

  assembler.activateStage("collectDefinitions");
  t.true(assembler.isDefinitionCollectionStage);
  t.false(assembler.canEmitBytes);
  t.is(assembler.mode, "layout");

  assembler.activateStage("resolveLayout");
  t.false(assembler.isDefinitionCollectionStage);
  t.false(assembler.canEmitBytes);
  t.is(assembler.mode, "emit");

  assembler.activateStage("emitProgram");
  t.true(assembler.canEmitBytes);
  t.true(assembler.canFinalize);
  t.true(assembler.enforceResolvedLabels);
});

test("runStage materializes a durable lowered program tree", (t) => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel([
    "db $01",
    "if 1",
    "db $02",
    "endif",
  ].join("\n"), "lowered.asm");

  const stageState = assembler.runStage("resolveLayout", program);

  t.truthy(stageState.loweredProgram);
  t.is(stageState.loweredProgram?.nodes[0]?.kind, "command");
  t.is(stageState.loweredProgram?.nodes[1]?.kind, "conditional");
});

test("lowered nested loop and conditional executors select the expected work", t => {
  const assembler = new Assembler();
  const nested = assembler.buildProgramModel([
    "if 1",
    "for i = 0..2",
    "freespacebyte !i",
    "endfor",
    "else",
    "freespacebyte $99",
    "endif",
    "!i = 0",
    "while !i < 2",
    "!i #= !i+1",
    "endwhile",
  ].join("\n"), "lowered-nested-control.asm");
  assembler.executeLoweredNodeStream(assembler.commandLoweringService.lowerProgram(nested).nodes);

  t.is(assembler.outputFillByte, 1);
  t.is(assembler.defines.get("i"), "2");
});

test("lowered loop and conditional executors select the expected work", t => {
  const assembler = new Assembler();
  const loops = assembler.buildProgramModel([
    "for i = 0..2",
    "freespacebyte !i",
    "endfor",
    "!i = 0",
    "while !i < 2",
    "!i #= !i+1",
    "endwhile",
  ].join("\n"), "lowered-loops.asm");
  const loweredLoops = assembler.commandLoweringService.lowerProgram(loops);

  assembler.executeLoweredNodeStream(loweredLoops.nodes);

  t.is(assembler.outputFillByte, 1);
  t.is(assembler.defines.get("i"), "2");

  const conditional = assembler.buildProgramModel([
    "if 0",
    "freespacebyte $11",
    "elseif 1",
    "freespacebyte $22",
    "else",
    "freespacebyte $33",
    "endif",
  ].join("\n"), "lowered-conditional.asm");
  assembler.executeLoweredNodeStream(assembler.commandLoweringService.lowerProgram(conditional).nodes);

  t.is(assembler.outputFillByte, 0x22);
});

test("lowered instructions refresh against architecture changes at dispatch", t => {
  const assembler = new Assembler();
  const spcDefinition = assembler.architectureRegistry.getDefinition("spc700");
  const mainDefinition = assembler.architectureRegistry.getDefinition("65816");
  if (!spcDefinition || !mainDefinition) {
    t.fail("registered architectures must support operand classification");
    return;
  }
  const spcLowerSpy = spy(spcDefinition, "classifyOperand");
  const mainLowerSpy = spy(mainDefinition, "classifyOperand");
  const program = assembler.buildProgramModel([
    "arch spc700",
    "nop",
    "arch 65816",
    "nop",
  ].join("\n"), "arch-switch.asm");

  const lowered = assembler.commandLoweringService.lowerProgram(program);
  assembler.executeLoweredNodeStream(lowered.nodes);

  t.is(spcLowerSpy.callCount, 1);
  t.is(mainLowerSpy.callCount, 3);
});

test("analyzeSource accumulates multiple diagnostics and references", (t) => {
  const assembler = new Assembler();
  const result = assembler.analyzeSource([
    "db MissingOne",
    "db MissingTwo",
  ].join("\n"), "analysis.asm");

  t.true(result.diagnostics.length >= 2);
  t.true(result.references.some((entry) => entry.name === "MissingOne"));
  t.true(result.references.some((entry) => entry.name === "MissingTwo"));
});

test("file provider can serve includes from virtual documents", (t) => {
  const fileProvider = new MemoryAssemblyFileProvider(new Map<string, string>([
    ["/proj/main.asm", 'include "shared.asm"'],
    ["/proj/shared.asm", "db $01"],
  ]));
  const assembler = new Assembler(undefined, { fileProvider });
  assembler.setCurrentFile("/proj/main.asm");

  assembler.includeSource.includeFile("shared.asm");

  t.is(assembler.currentTargetAddress, 1);
  t.true(assembler.includedFiles.has("/proj/shared.asm"));
});

test("lowered include executes nested conditional control flow", (t) => {
  const fileProvider = new MemoryAssemblyFileProvider(new Map<string, string>([
    ["/proj/main.asm", 'include "child.asm"'],
    ["/proj/child.asm", [
      "if 1",
      "for i = 0..2",
      "db !i",
      "endfor",
      "else",
      "db $ff",
      "endif",
    ].join("\n")],
  ]));
  const assembler = new Assembler(undefined, { fileProvider });
  assembler.activateStage("emitProgram");
  assembler.setWritePosition(0x808000);
  assembler.setCurrentFile("/proj/main.asm");

  assembler.includeSource.includeFile("child.asm");

  t.deepEqual(Array.from(assembler.getBinaryOutput()), [0x00, 0x01]);
});

test("analyzeWorkspace isolates documents into separate analysis sessions", (t) => {
  const assembler = new Assembler();
  const results = assembler.analyzeWorkspace([
    { source: "SharedLabel:\n  db $01", sourceFile: "a.asm" },
    { source: "db SharedLabel", sourceFile: "b.asm" },
  ]);

  t.is(results.length, 2);
  t.true(results[0].symbols.some((entry) => entry.kind === "label" && entry.name === "SharedLabel"));
  t.false(results[0].diagnostics.some((entry) => entry.message.includes("not found")));
  t.true(results[1].diagnostics.length >= 1);
  t.true(results[1].diagnostics.some((entry) => entry.message.includes("SharedLabel")));
  t.true(results[1].references.some((entry) => entry.name === "SharedLabel"));
});
