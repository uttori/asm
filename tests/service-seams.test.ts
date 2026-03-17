import { stub } from "sinon";
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

test("pre-dispatch pipeline collects loop body commands", (t) => {
  const assembler = new Assembler();
  assembler.collectingLoop = true;
  assembler.currentLoop = {
    type: "for",
    commands: [],
    startLine: 1,
  };

  assembler.processCommand("db $01");

  t.is(assembler.currentLoop.commands.length, 1);
  const [command] = assembler.currentLoop.commands;
  t.true(typeof command !== "string" && "source" in command);
  if (typeof command !== "string" && "source" in command) {
    t.is(command.source.raw, "db $01");
    t.is(command.kind, "unknown");
  }
});

test("pre-dispatch pipeline maps while endif to handleEndIf", (t) => {
  const assembler = new Assembler();
  const endIf = stub(assembler, "handleEndIf");
  assembler.collectingLoop = true;
  assembler.currentLoop = {
    type: "while",
    commands: [],
    startLine: 1,
  };

  assembler.processCommand("endif");

  t.true(endIf.calledOnce);
});

test("pre-dispatch pipeline intercepts raw loop directives", (t) => {
  const assembler = new Assembler();
  const handleFor = stub(assembler, "handleFor");

  assembler.processCommand("for i = 0..2");

  t.true(handleFor.calledOnce);
  t.deepEqual(handleFor.firstCall.args[0], ["i", "=", "0..2"]);
});

test("pre-dispatch pipeline loads test rom directive", (t) => {
  const targetRom = new Uint8Array([1, 2, 3, 4]);
  const assembler = new Assembler(targetRom);

  assembler.processCommand(";`+");

  t.deepEqual(Array.from(assembler.romdata.slice(0, 4)), [1, 2, 3, 4]);
});

test("normalized dispatch also loads test rom directive", (t) => {
  const targetRom = new Uint8Array([1, 2, 3, 4]);
  const assembler = new Assembler(targetRom);

  // Tree execution enters through processNormalizedCommand, so this directive
  // must retain the same bootstrap semantics as raw processCommand.
  assembler.processNormalizedCommand(commandNode(";`+"), false);

  t.deepEqual(Array.from(assembler.romdata.slice(0, 4)), [1, 2, 3, 4]);
});

test("command pipeline handles character mappings through normalized dispatch", (t) => {
  const assembler = new Assembler();

  assembler.processNormalizedCommand(commandNode('"A" = $42'), false);

  t.is(assembler.characterMappings.get("A"), 0x42);
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

test("symbol scope preserves nested hierarchy during pass zero label collection", (t) => {
  const assembler = new Assembler();
  assembler.pass = 0;

  assembler.handleLabelDefinition("arthur_sprites");
  assembler.handleLabelDefinition(".underwear");
  assembler.handleLabelDefinition("..idle");

  t.true(assembler.labelTable.has("arthur_sprites_underwear_idle"));
  t.is(assembler.currentParentLabel, "arthur_sprites_underwear_idle");
});

test("symbol scope keeps sibling single-dot labels under the enclosing global label", (t) => {
  const assembler = new Assembler();
  assembler.pass = 0;

  assembler.handleLabelDefinition("_018049");
  assembler.handleLabelDefinition(".804D");
  assembler.handleLabelDefinition(".8051");
  assembler.handleLabelDefinition(".8053");

  t.true(assembler.labelTable.has("_018049_804D"));
  t.true(assembler.labelTable.has("_018049_8051"));
  t.true(assembler.labelTable.has("_018049_8053"));
  t.false(assembler.labelTable.has("_018049_804D_8051"));
  t.false(assembler.labelTable.has("_018049_804D_8051_8053"));
});

test("symbol scope preserves underscore-containing global parents for single-dot labels", (t) => {
  const assembler = new Assembler();
  assembler.pass = 0;

  assembler.handleLabelDefinition("stage1_earthquake");
  assembler.handleLabelDefinition("stage1_earthquake_tiles");
  assembler.handleLabelDefinition(".1");
  assembler.handleLabelDefinition(".2");

  t.true(assembler.labelTable.has("stage1_earthquake_tiles_1"));
  t.true(assembler.labelTable.has("stage1_earthquake_tiles_2"));
  t.false(assembler.labelTable.has("stage1_earthquake_1"));
  t.false(assembler.labelTable.has("stage1_earthquake_2"));
});

test("symbol scope keeps sibling double-dot labels under the enclosing local label", (t) => {
  const assembler = new Assembler();
  assembler.pass = 0;

  assembler.handleLabelDefinition("random_values");
  assembler.handleLabelDefinition(".idx");
  assembler.handleLabelDefinition("..beginner");
  assembler.handleLabelDefinition("..normal");

  t.true(assembler.labelTable.has("random_values_idx_beginner"));
  t.true(assembler.labelTable.has("random_values_idx_normal"));
  t.false(assembler.labelTable.has("random_values_idx_beginner_normal"));
});

test("symbol scope keeps underscore-containing single-dot labels as double-dot parents", (t) => {
  const assembler = new Assembler();
  assembler.pass = 0;

  assembler.handleLabelDefinition("spc_0E00");
  assembler.handleLabelDefinition(".stage1");
  assembler.handleLabelDefinition("..ch8");
  assembler.snespos += 1;
  assembler.handleLabelDefinition(".stage1_boss");
  assembler.handleLabelDefinition("..ch8");
  assembler.snespos += 1;
  assembler.handleLabelDefinition("..ch7");

  t.true(assembler.labelTable.has("spc_0E00_stage1_ch8"));
  t.true(assembler.labelTable.has("spc_0E00_stage1_boss_ch8"));
  t.true(assembler.labelTable.has("spc_0E00_stage1_boss_ch7"));
  t.is(assembler.labelTable.get("spc_0E00_stage1_ch8")?.value, 0);
  t.is(assembler.labelTable.get("spc_0E00_stage1_boss_ch8")?.value, 1);
  t.is(assembler.labelTable.get("spc_0E00_stage1_boss_ch7")?.value, 2);
});

test("symbol scope prefers exact single-dot locals before shortened underscore fallbacks", (t) => {
  const assembler = new Assembler();
  assembler.pass = 0;

  assembler.handleLabelDefinition("_00ED00");
  assembler.handleLabelDefinition(".arthur_underwear");
  assembler.handleLabelDefinition("..knockback");
  assembler.snespos += 1;
  assembler.handleLabelDefinition(".arthur_steel");
  assembler.handleLabelDefinition("..knockback");
  assembler.snespos += 1;
  assembler.handleLabelDefinition(".arthur_upgraded_armor");
  assembler.handleLabelDefinition(".gold");

  t.is(assembler.getLabelValue(".arthur_underwear_knockback", false), 0);
});

test("symbol scope returns single-dot labels to the top-level parent after nested locals", (t) => {
  const assembler = new Assembler();
  assembler.pass = 0;

  assembler.handleLabelDefinition("_00ED00");
  assembler.handleLabelDefinition(".arthur_underwear");
  assembler.handleLabelDefinition("..knockback");
  assembler.handleLabelDefinition(".arthur_steel");

  t.true(assembler.labelTable.has("_00ED00_arthur_underwear"));
  t.true(assembler.labelTable.has("_00ED00_arthur_underwear_knockback"));
  t.true(assembler.labelTable.has("_00ED00_arthur_steel"));
  t.false(assembler.labelTable.has("_00ED00_arthur_underwear_arthur_steel"));
});

test("symbol scope keeps double-dot labels under the active global root when shorter prefixes exist", (t) => {
  const assembler = new Assembler();
  assembler.pass = 0;

  assembler.handleLabelDefinition("arthur");
  assembler.handleLabelDefinition("arthur_sprites");
  assembler.handleLabelDefinition(".underwear");
  assembler.handleLabelDefinition("..idle");

  t.true(assembler.labelTable.has("arthur_sprites_underwear_idle"));
  t.false(assembler.labelTable.has("arthur_sprites_idle"));
});

test("symbol scope resolves namespaced local sibling labels without collapsing doubled separators", (t) => {
  const assembler = new Assembler();
  assembler.currentNamespace = "knife";
  assembler.pass = 0;

  assembler.handleLabelDefinition("_E449");
  assembler.handleLabelDefinition(".E44C");
  assembler.handleLabelDefinition(".E4CA");

  assembler.pass = 1;
  assembler.currentNamespace = "knife";
  assembler.currentParentLabel = "knife__E449_E44C";

  t.true(assembler.labelTable.has("knife__E449_E4CA"));
  t.is(assembler.getLabelValue(".E4CA", false), assembler.labelTable.get("knife__E449_E4CA")?.value);
});

test("symbol scope falls back to global labels when a namespace-local symbol is absent", (t) => {
  const assembler = new Assembler();
  assembler.pass = 1;

  assembler.setLabel("difficulty", 0x27C, true);
  assembler.currentNamespace = "zombie";

  t.false(assembler.labelTable.has("zombie_difficulty"));
  t.is(assembler.getLabelValue("difficulty", false), 0x27C);
});

test("symbol scope resolves local labels under underscore-prefixed parents", (t) => {
  const assembler = new Assembler();
  assembler.pass = 1;

  assembler.currentParentLabel = "_0083C2_83C3_83DE";
  assembler.labelTable.set("_0083C2_83EB", {
    value: 0x83EB,
    isStatic: false,
    isMacroLabel: false,
    modifiesHierarchy: true,
  });

  t.is(assembler.getLabelValue(".83EB", false), 0x83EB);
});

test("symbol scope resolves compressed nested local label references", (t) => {
  const assembler = new Assembler();
  assembler.pass = 1;

  assembler.currentParentLabel = "random_values_difficulty_offset";
  assembler.labelTable.set("random_values_difficulty_offset_idx_beginner", {
    value: 0x1234,
    isStatic: false,
    isMacroLabel: false,
    modifiesHierarchy: true,
  });

  t.is(assembler.getLabelValue(".idx_beginner", false), 0x1234);
});

test("symbol scope resolves double-dot local label references", (t) => {
  const assembler = new Assembler();
  assembler.pass = 1;

  assembler.currentParentLabel = "_00ED00_arthur_underwear";
  assembler.labelTable.set("_00ED00_arthur_underwear_idle", {
    value: 0xED39,
    isStatic: false,
    isMacroLabel: false,
    modifiesHierarchy: true,
  });

  t.is(assembler.getLabelValue("..idle", false), 0xED39);
});

test("pre-dispatch pipeline skips non-conditional commands in false blocks", (t) => {
  const assembler = new Assembler();
  assembler.condStack.push({ type: "if", cond: false });
  stub(assembler, "addAddressToLine");

  assembler.processCommand("!skipped = 1");

  t.false(assembler.defines.has("skipped"));
});

test("pre-dispatch pipeline re-resolves elseif before dispatch", (t) => {
  const assembler = new Assembler();
  const handleElseIf = stub(assembler, "handleElseIf");
  stub(assembler, "addAddressToLine");
  assembler.defines.set("cond_value", "1");
  assembler.numtrue = 0;
  assembler.numif = 1;

  assembler.processCommand("elseif !cond_value");

  t.true(handleElseIf.calledOnceWithExactly(["1"]));
});

test("front-end service handles named and static labels through normalized dispatch", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");

  assembler.processNormalizedCommand(commandNode("Main:"), false);
  assembler.processNormalizedCommand(commandNode("Const = $10"), false);

  t.is(assembler.getLabelValue("Main", false), assembler.snespos);
  t.is(assembler.getLabelValue("Const", true), 0x10);
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

  assembler.executeNodeStream(assembler.parseCommandStreamToNodes([
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

  const createLoopNodeStub = stub(assembler, "createLoopCommandNode");
  stub(assembler, "processNormalizedCommand").callsFake(() => {});
  assembler.executeNode(commandNode);
  t.false(createLoopNodeStub.called);
});

test("macro/include lifting exposes typed macro and include nodes", (t) => {
  const assembler = new Assembler();
  stub(assembler, "addAddressToLine");
  assembler.setPass(0);
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

  const includeNode = assembler.createIncludeNode("inline.asm", "if 1\ndb $01\nendif");
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
  assembler.executeNodeStream(nodes);
  t.deepEqual(executed, ["db $01"]);
});

test("stage runner builds program once and executes all stages", (t) => {
  const assembler = new Assembler();
  const parseSpy = stub(assembler, "parseCommandStreamToNodes").callThrough();
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
  stagedAssembler.assembleProgram(program);

  // Cached pass program should be reused across stage executions.
  t.true(parseSpy.calledOnce);
  t.is(assembler.romdata[0], 0x01);
});

test("stage execution state is recreated per collect stage run", (t) => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel("db $01", "test.asm", 0);

  assembler.setWritePosition(0x808000);
  const firstCollect = assembler.runStage("collectDefinitions", program) as { cursor: { snespos: number } };
  t.is(firstCollect.cursor.snespos, 0x808001);

  assembler.setWritePosition(0x80A000);
  const secondCollect = assembler.runStage("collectDefinitions", program) as { cursor: { snespos: number } };
  t.not(firstCollect, secondCollect);
  t.is(secondCollect.cursor.snespos, 0x80A001);
});

test("stage states keep symbols/control/write state isolated by stage", (t) => {
  const assembler = new Assembler();
  const program = assembler.buildProgramModel("Label:\ndb $01", "test.asm", 0);
  const collect = assembler.runStage("collectDefinitions", program) as {
    symbols: { labelTable: Map<string, unknown> };
    control: object;
    writeState: object;
  };
  const layout = assembler.runStage("resolveLayout", program) as {
    symbols: { labelTable: Map<string, unknown> };
    control: object;
    writeState: object;
  };

  t.not(collect.symbols.labelTable, layout.symbols.labelTable);
  t.not(collect.control, layout.control);
  t.not(collect.writeState, layout.writeState);
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

  assembler.handleArch(["arch", "spc700-inline"]);
  t.is(assembler.arch, "spc700");
  t.true(assembler.spcInlineCompatMode);

  assembler.handleArch(["arch", "superfx"]);
  t.is(assembler.arch, "superfx");
  t.false(assembler.spcInlineCompatMode);
});
