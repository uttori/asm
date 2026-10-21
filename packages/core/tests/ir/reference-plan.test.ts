import { spy } from "sinon";

import { test } from "../../../../tests/ava-helper.js";
import { Assembler } from "../../../../tests/test-assembler.js";
import { parseExpressionAtSite } from "../../src/ir/expression-node.js";
import { createNormalizedCommand } from "../../src/ir/normalized-command.js";
import { parseInstructionOperands } from "../../src/ir/parsed-operand.js";
import { ReferencePlanner } from "../../src/ir/reference-plan.js";

test("reference plans preserve repeated occurrences and function-before-argument order", (t) => {
  const planner = new ReferencePlanner();
  const text = "lookup(first + first, second) + third";
  const expression = parseExpressionAtSite(text, "public", { text, offset: 0, line: 7 });
  const plan = planner.expression(expression);
  t.is(planner.expression(expression), plan);
  t.deepEqual(
    plan.map((node) => node.type),
    ["call", "identifier", "identifier", "identifier", "identifier"],
  );
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.setCurrentFile("references.asm");
  assembler.collectExpressionReferences(expression);
  t.deepEqual(
    assembler.symbolReferences.map((reference) => reference.name),
    ["lookup", "first", "first", "second", "third"],
  );
  const first = assembler.symbolReferences.filter((reference) => reference.name === "first");
  t.notDeepEqual(first[0].location.span, first[1].location.span);
  const before = structuredClone(assembler.symbolReferences);
  assembler.clearAnalysisArtifacts();
  assembler.collectExpressionReferences(expression);
  t.deepEqual(assembler.symbolReferences, before);
  t.deepEqual(planner.expression(parseExpressionAtSite("1 + 2 * 3", "public")), []);
});

test("instruction plans invalidate on grammar syntax and physical occurrence changes", (t) => {
  const planner = new ReferencePlanner();
  const grammar = { registers: ["a", "x"], indexRegisters: ["x"], commaIndex: true };
  const raw = "  lda label+label,x";
  const command = createNormalizedCommand(raw, raw.trim(), ["lda", "label+label,x"], "one.asm", 3);
  const operands = parseInstructionOperands("lda", "label+label,x", grammar);
  const plan = planner.instruction(operands, command);
  t.is(planner.instruction(operands, command), plan);
  t.is(plan[0].span?.line, 3);
  const original = structuredClone(plan);
  const replacement = parseInstructionOperands("lda", "label+label,x", grammar);
  t.not(planner.instruction(replacement, command), plan);
  command.source = { ...command.source, line: 9, physical: { text: raw } };
  const moved = planner.instruction(operands, command);
  t.not(moved, plan);
  t.is(moved[0].span?.line, 9);
  t.deepEqual(plan, original);
});

test("cached reference walks resolve struct containers from current define bindings", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  assembler.setCurrentFile("binding.asm");
  const expression = parseExpressionAtSite("!root.field", "public");
  assembler.defines.set("root", "First");
  for (const name of ["First", "Second"]) {
    assembler.structs.set(name, {
      name,
      base: 0,
      offset: 1,
      size: 1,
      labels: new Map([["field", 0]]),
      extensionSize: 0,
    });
  }
  assembler.collectExpressionReferences(expression);
  assembler.defines.set("root", "Second");
  assembler.collectExpressionReferences(expression);
  t.deepEqual(
    assembler.symbolReferences
      .filter((reference) => reference.name === "field")
      .map((reference) => reference.containerName),
    ["First", "Second"],
  );
});

test("static collection skips repeat records but honors metadata enablement, location and clearing", (t) => {
  const assembler = new Assembler();
  t.teardown(() => assembler.dispose());
  const record = spy(assembler, "recordSymbolReference");
  const expression = parseExpressionAtSite("lookup(Item)", "public");
  assembler.collectSourceMetadata = false;
  assembler.collectExpressionReferences(expression);
  t.is(record.callCount, 0);
  assembler.collectSourceMetadata = true;
  assembler.collectExpressionReferences(expression);
  assembler.collectExpressionReferences(expression);
  t.is(record.callCount, 2);
  assembler.setCurrentLine(8);
  assembler.collectExpressionReferences(expression);
  t.is(record.callCount, 4);
  assembler.clearAnalysisArtifacts();
  assembler.collectExpressionReferences(expression);
  t.is(record.callCount, 6);
  t.is(assembler.symbolReferences.length, 2);
});
