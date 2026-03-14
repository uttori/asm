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

  t.deepEqual(assembler.currentLoop?.conditionNode, {
    type: "range",
    start: { type: "raw", value: "i = 0" },
    end: { type: "literal", value: "2" },
  });
});

test("math and operand resolver accept expression nodes", (t) => {
  const assembler = new Assembler();

  t.is(assembler.mathCore.math(parseExpressionNode("bank($123456)")), 0x12);
  t.is(assembler.operandResolver.getnum(parseExpressionNode("bank($123456)")), 0x12);
  t.true(assembler.evaluateExpression(parseExpressionNode("5 > 3")));
  t.is(assembler.mathCore.math(parseExpressionNode("1 + 2 * 3")), 7);
  t.is(assembler.mathCore.math(parseExpressionNode("<:$123456")), 0x12);
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

  const structStub = stub(assembler, "resolveStructMember");
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

  const structStub = stub(assembler, "resolveStructMember");
  structStub.withArgs("Player[2].hp").returns(33);

  t.is(assembler.expressionHost.resolveLabel("MyStruct"), 0);
  t.is(assembler.expressionHost.resolveLabel("Player[1 + 1].hp"), 33);
});

test("mathcore legacy string parsing routes compound references through the reference subtree", (t) => {
  const assembler = new Assembler();
  const structStub = stub(assembler, "resolveStructMember");
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
