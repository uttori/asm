import { stub } from "sinon";
import { test } from "./ava-helper.js";

import { Assembler, type StructDefinition } from "../src/assembler.js";
import {
  isReferenceExpressionNode,
  parseLeadingReferenceExpression,
  parseExpressionNode,
  renderReferenceExpressionNode,
  type ExpressionNode,
  type ReferenceExpressionNode,
} from "../src/ir/expression-node.js";
import { createNormalizedCommand, createPendingCommand } from "../src/ir/normalized-command.js";

type AssemblerReferenceTestAccess = {
  resolveReferenceExpressionNode: (expression: ReferenceExpressionNode) => ExpressionNode;
  normalizeReferenceExpressionNode: (expression: ReferenceExpressionNode) => string;
  evaluateReferenceExpressionNode: (expression: ReferenceExpressionNode) => number;
};

test("normalized command captures provenance and classification", (t) => {
  const command = createNormalizedCommand(
    "Main: db $01",
    "Main: db $01",
    ["Main:", "db", "$01"],
    "test.asm",
    12,
  );

  t.is(command.source.file, "test.asm");
  t.is(command.source.line, 12);
  t.is(command.source.raw, "Main: db $01");
  t.is(command.labelName, "Main");
  t.is(command.kind, "labelDefinition");
});

test("pending command preserves raw loop body input", (t) => {
  const command = createPendingCommand("db $01 ; loop body", "loop.asm", 8);

  t.is(command.source.file, "loop.asm");
  t.is(command.source.line, 8);
  t.is(command.source.raw, "db $01 ; loop body");
  t.is(command.command, "db $01 ; loop body");
});

test("normalized command derives semantic payloads for conditions, ranges, assignments, and incbin", (t) => {
  const whileCommand = createNormalizedCommand("while !COUNT < 2", "while !COUNT < 2", ["while", "!COUNT", "<", "2"], "test.asm", 3);
  const forCommand = createNormalizedCommand("for i = 0..2", "for i = 0..2", ["for", "i", "=", "0..2"], "test.asm", 4);
  const assignmentCommand = createNormalizedCommand("Label = bank($123456)", "Label = bank($123456)", ["Label", "=", "bank($123456)"], "test.asm", 5);
  const incbinCommand = createNormalizedCommand("incbin \"test.bin\":$1..$3", "incbin \"test.bin\":$1..$3", ["incbin", "\"test.bin\":$1..$3"], "test.asm", 6);

  t.deepEqual(whileCommand.parsed.condition?.expression, parseExpressionNode("!COUNT < 2"));
  t.deepEqual(forCommand.parsed.forLoop, {
    variable: "i",
    range: parseExpressionNode("0..2"),
    start: parseExpressionNode("0"),
    end: parseExpressionNode("2"),
  });
  t.deepEqual(assignmentCommand.parsed.assignment, {
    target: "Label",
    expression: parseExpressionNode("bank($123456)"),
  });
  t.deepEqual(incbinCommand.parsed.incbinRange, {
    range: parseExpressionNode("$1..$3"),
    start: parseExpressionNode("$1"),
    end: parseExpressionNode("$3"),
  });
});

test("normalized command derives macro include data and label split semantics", (t) => {
  const macroInvoke = createNormalizedCommand("%emit($10, bank($123456))", "%emit($10, bank($123456))", ["%emit($10,", "bank($123456))"], "test.asm", 7);
  const include = createNormalizedCommand('include "macros.asm"', 'include "macros.asm"', ["include", "\"macros.asm\""], "test.asm", 8);
  const data = createNormalizedCommand("db $01, bank($123456), \"TEXT\"", "db $01, bank($123456), \"TEXT\"", ["db", "$01,", "bank($123456),", "\"TEXT\""], "test.asm", 9);
  const labeled = createNormalizedCommand("Main: db $01", "Main: db $01", ["Main:", "db", "$01"], "test.asm", 10);
  const opcode = createNormalizedCommand("lda #$10", "lda #$10", ["lda", "#$10"], "test.asm", 11);
  const directive = createNormalizedCommand("org $808000", "org $808000", ["org", "$808000"], "test.asm", 12);

  t.deepEqual(macroInvoke.parsed.macroInvocation, {
    name: "emit",
    args: ["$10", "bank($123456)"],
  });
  t.deepEqual(include.parsed.includeTarget, {
    directive: "include",
    target: "\"macros.asm\"",
  });
  t.deepEqual(data.parsed.dataDirective, {
    directive: "db",
    operands: ["$01", "bank($123456)", "\"TEXT\""],
  });
  t.deepEqual(labeled.parsed.labelSplit, {
    label: "Main",
    trailing: "db $01",
  });
  t.deepEqual(opcode.parsed.opcodeOperands, {
    mnemonic: "lda",
    operandText: "#$10",
    operands: ["#$10"],
  });
  t.deepEqual(directive.parsed.directiveArgs, {
    name: "org",
    args: ["$808000"],
  });
});

test("pending command can capture normalized loop-body semantics", (t) => {
  const command = createPendingCommand(
    "Label = 1 ; keep comment",
    "loop.asm",
    9,
    "Label = 1",
    ["Label", "=", "1"],
  );

  t.is(command.command, "Label = 1");
  t.deepEqual(command.parsed.assignment, {
    target: "Label",
    expression: parseExpressionNode("1"),
  });
});

test("expression nodes parse range and call syntax", (t) => {
  const rangeNode = parseExpressionNode("0..$20");
  const callNode = parseExpressionNode("incbin($10, $20)");

  t.deepEqual(rangeNode, {
    type: "range",
    start: { type: "literal", value: "0" },
    end: { type: "literal", value: "$20" },
  });

  t.deepEqual(callNode, {
    type: "call",
    callee: { type: "identifier", name: "incbin" },
    arguments: [
      { type: "literal", value: "$10" },
      { type: "literal", value: "$20" },
    ],
  });
});

test("expression nodes parse binary precedence and unary operators", (t) => {
  const binaryNode = parseExpressionNode("1 + 2 * 3");
  const unaryNode = parseExpressionNode("<:$123456");
  const defineNode = parseExpressionNode("!VALUE + Player[1].hp");

  t.deepEqual(binaryNode, {
    type: "binary",
    operator: "+",
    left: { type: "literal", value: "1" },
    right: {
      type: "binary",
      operator: "*",
      left: { type: "literal", value: "2" },
      right: { type: "literal", value: "3" },
    },
  });

  t.deepEqual(unaryNode, {
    type: "unary",
    operator: "<:",
    argument: { type: "literal", value: "$123456" },
  });

  t.deepEqual(defineNode, {
    type: "binary",
    operator: "+",
    left: { type: "defineReference", name: "VALUE", braced: false },
    right: {
      type: "member",
      object: {
        type: "index",
        object: { type: "identifier", name: "Player" },
        index: { type: "literal", value: "1" },
      },
      property: { type: "identifier", name: "hp" },
    },
  });
});

test("loop collection creates a structural condition node", (t) => {
  const assembler = new Assembler();
  assembler.beginLoopCollection("for", "for i = 0..2");

  t.deepEqual(assembler.currentLoop?.rangeNode, {
    type: "range",
    start: { type: "literal", value: "0" },
    end: { type: "literal", value: "2" },
  });
  t.is(assembler.currentLoop?.variable, "i");
  t.deepEqual(assembler.currentLoop?.startExpression, { type: "literal", value: "0" });
  t.deepEqual(assembler.currentLoop?.endExpression, { type: "literal", value: "2" });
});

test("loop collection stores normalized command nodes in loop bodies", (t) => {
  const assembler = new Assembler();
  assembler.currentFile = "loop.asm";
  assembler.currentLine = 0;
  assembler.setPass(1);

  assembler.beginLoopCollection("while", "while !COUNT < 2");
  assembler.currentLine = 1;
  assembler.processCommand("Label = 1 ; comment");

  t.is(assembler.currentLoop?.commands.length, 1);
  const bodyCommand = assembler.currentLoop?.commands[0];
  if (!bodyCommand || typeof bodyCommand === "string" || "type" in bodyCommand) {
    t.fail();
    return;
  }

  t.is(bodyCommand.source.raw, "Label = 1 ; comment");
  t.is(bodyCommand.command, "Label = 1");
  t.deepEqual(bodyCommand.parsed.assignment, {
    target: "Label",
    expression: parseExpressionNode("1"),
  });
});

test("typed loop nodes execute through normalized dispatch", (t) => {
  const assembler = new Assembler();
  assembler.setPass(2);
  assembler.currentFile = "/Users/matthew/uttori/snes-asm-js/tests/ir.test.ts";
  const executed: Array<{ command: string; value: string | undefined }> = [];
  stub(assembler, "processNormalizedCommand").callsFake((command) => {
    executed.push({ command: command.command, value: assembler.defines.get("i") });
  });
  assembler.beginLoopCollection("for", "for i = 0..3");
  assembler.currentLoop?.commands.push(createPendingCommand("db !i", "loop.asm", 1, "db !i", ["db", "!i"]));
  const loop = assembler.currentLoop;
  if (!loop) {
    t.fail();
    return;
  }

  assembler.currentLoop = null;
  assembler.collectingLoop = false;
  assembler.executeLoopBlock(loop);

  t.deepEqual(executed, [
    { command: "db !i", value: "0" },
    { command: "db !i", value: "1" },
    { command: "db !i", value: "2" },
  ]);
});

test("tree pass programs are cached per source block key", (t) => {
  const assembler = new Assembler();
  const commands = ["db $01", "db $02"];
  const first = assembler.getOrBuildPassProgram(commands, "cache.asm", 0);
  const second = assembler.getOrBuildPassProgram(commands, "cache.asm", 0);

  t.is(first, second);
});

test("include nodes and parsed programs keep typed executable leaves", (t) => {
  const assembler = new Assembler();
  const includeNode = assembler.createIncludeNode("include.asm", "db $01\ndb $02");
  const rootNodes = assembler.getOrBuildPassProgram(["db $01", "db $02"], "root.asm", 0);

  t.true(includeNode.commands.every((node) => typeof node !== "string"));
  t.true(rootNodes.every((node) => typeof node !== "string"));
});

test("tree parser resolves ambiguous endif to innermost while block", (t) => {
  const assembler = new Assembler();
  const nodes = assembler.parseCommandStreamToNodes([
    "if 1",
    "while 1",
    "db $01",
    "endif",
    "db $02",
    "endif",
  ]);

  t.is(nodes.length, 1);
  const root = nodes[0];
  if (!root || !("type" in root) || root.type !== "if") {
    t.fail();
    return;
  }

  const [ifBranch] = root.branches;
  t.truthy(ifBranch);
  t.is(ifBranch.commands.length, 2);

  const whileNode = ifBranch.commands[0];
  if (!whileNode || !("type" in whileNode) || whileNode.type !== "while") {
    t.fail();
    return;
  }
  t.is(whileNode.commands.length, 1);

  const trailingCommand = ifBranch.commands[1];
  if (!trailingCommand || !("source" in trailingCommand)) {
    t.fail();
    return;
  }
  t.is(trailingCommand.command, "db $02");
});

test("math and operand resolver accept expression nodes", (t) => {
  const assembler = new Assembler();

  t.is(assembler.mathCore.math(parseExpressionNode("bank($123456)")), 0x12);
  t.is(assembler.operandResolver.getnum(parseExpressionNode("bank($123456)")), 0x12);
  t.true(assembler.evaluateExpression(parseExpressionNode("5 > 3")));
  t.is(assembler.mathCore.math(parseExpressionNode("1 + 2 * 3")), 7);
  t.is(assembler.mathCore.math(parseExpressionNode("<:$123456")), 0x12);
});

test("evaluateExpression wraps node resolution errors with contextual message", (t) => {
  const assembler = new Assembler();
  const missingDefineExpression: ExpressionNode = {
    type: "defineReference",
    name: "MISSING_DEFINE",
    braced: false,
  };

  // Node-based expressions must surface the same diagnostic wrapper as string
  // expressions so integration parity compares equivalent error text.
  const error = t.throws(() => {
    assembler.evaluateExpression(missingDefineExpression);
  });
  t.truthy(error);
  t.true(error.message.startsWith("Error evaluating expression \"!MISSING_DEFINE\""));
});

test("define references and member/index nodes resolve structurally", (t) => {
  const assembler = new Assembler();
  assembler.defines.set("VALUE", "41");
  assembler.defines.set("NAME_1", "41");
  assembler.defines.set("IDX", "1");

  const structStub = stub(assembler, "resolveStructLabel");
  structStub.withArgs("Player[1].hp").returns(1);

  t.true(assembler.evaluateExpression(parseExpressionNode("!VALUE + 1 == 42")));
  t.true(assembler.evaluateExpression(parseExpressionNode("!{NAME_!IDX} == 41")));
  t.is(assembler.operandResolver.getnum(parseExpressionNode("Player[!IDX].hp")), 1);
});

test("reference subtree helpers classify and render reference expressions", (t) => {
  const reference = parseExpressionNode("Player[1].hp");
  const computedReference = parseExpressionNode("Player[1 + 1].hp");
  const numeric = parseExpressionNode("1 + 2");
  const assembler = new Assembler();

  t.true(isReferenceExpressionNode(reference));
  t.false(isReferenceExpressionNode(numeric));
  if (!isReferenceExpressionNode(reference)) {
    t.fail();
    return;
  }
  if (!isReferenceExpressionNode(computedReference)) {
    t.fail();
    return;
  }

  t.is(renderReferenceExpressionNode(reference), "Player[1].hp");
  t.is(
    renderReferenceExpressionNode(computedReference, {
      renderIndex: (node) => assembler.mathCore.math(node).toString(),
    }),
    "Player[2].hp",
  );
});

test("leading reference parser extracts a reference prefix from larger expressions", (t) => {
  const parsed = parseLeadingReferenceExpression("Player[1 + 1].hp == 2");

  t.truthy(parsed);
  if (!parsed) {
    t.fail();
    return;
  }

  t.is(parsed.length, "Player[1 + 1].hp".length);
  t.is(renderReferenceExpressionNode(parsed.node), "Player[1 + 1].hp");
});

test("assembler reference seam resolves defines and normalizes label paths", (t) => {
  const assembler = new Assembler();
  const access = assembler as unknown as AssemblerReferenceTestAccess;
  assembler.defines.set("IDX", "1");

  const reference = parseExpressionNode("Player[!IDX + 1].hp");
  t.true(isReferenceExpressionNode(reference));
  if (!isReferenceExpressionNode(reference)) {
    t.fail();
    return;
  }

  const resolved = access.resolveReferenceExpressionNode(reference);
  t.true(isReferenceExpressionNode(resolved));
  if (!isReferenceExpressionNode(resolved)) {
    t.fail();
    return;
  }

  const normalized = access.normalizeReferenceExpressionNode(resolved);
  t.is(normalized, "Player[2].hp");

  const structStub = stub(assembler, "resolveStructLabel");
  structStub.withArgs("Player[2].hp").returns(99);
  t.is(access.evaluateReferenceExpressionNode(reference), 99);
});

test("expression host label resolution delegates to canonical reference seam", (t) => {
  const assembler = new Assembler();
  const structDefinition: StructDefinition = {
    name: "MyStruct",
    base: 0,
    offset: 0,
    size: 16,
    labels: new Map(),
  };
  assembler.structs.set("MyStruct", structDefinition);

  const structStub = stub(assembler, "resolveStructLabel");
  structStub.withArgs("MyStruct").returns(0);
  structStub.withArgs("Player[2].hp").returns(33);

  t.is(assembler.expressionHost.resolveLabel("MyStruct"), 0);
  t.is(assembler.expressionHost.resolveLabel("Player[1 + 1].hp"), 33);
});

test("mathcore legacy string parsing routes compound references through the reference subtree", (t) => {
  const assembler = new Assembler();
  const structStub = stub(assembler, "resolveStructLabel");
  structStub.withArgs("Player[2].hp").returns(2);

  t.true(assembler.evaluateExpression("Player[1 + 1].hp == 2"));
  t.is(assembler.mathCore.math("Player[1 + 1].hp"), 2);
});

test("incbin range evaluation adopts expression nodes for bounds", (t) => {
  const assembler = new Assembler();
  const writtenBytes: number[] = [];
  stub(assembler, "addAddressToLine");
  stub(assembler, "readFile").returns(new Uint8Array([0x10, 0x20, 0x30, 0x40]));
  stub(assembler, "write1").callsFake((value: number) => {
    writtenBytes.push(value);
  });

  assembler.handleIncbin(["incbin", "\"test.bin\":$1..$3"]);

  t.deepEqual(writtenBytes, [0x20, 0x30]);
});
