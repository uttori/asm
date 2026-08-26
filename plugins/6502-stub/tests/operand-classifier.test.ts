import { test } from "../../../tests/ava-helper.js";

import { OperandResolver } from "../../../packages/core/src/operand-resolver.js";
import { classify6502Operand } from "../src/operand-classifier.js";

const createResolver = () =>
  new OperandResolver({
    resolveDefines: (input) => input,
    isStructReference: () => false,
    resolveStructLabel: () => {
      throw new Error("Struct not found");
    },
    tryResolveLabel: () => undefined,
    resolveLabel: () => {
      throw new Error("Label not found");
    },
    evaluateMath: () => 0,
    shouldDeferExpressionEvaluation: () => false,
    getCurrentAddress: () => 0,
    requireStaticLabelLookup: () => false,
  });

test("6502 classifier covers the baseline addressing matrix", (t) => {
  const resolver = createResolver();
  const cases: Array<[string, string, string]> = [
    ["", "implied", ""],
    ["A", "accumulator", "A"],
    ["#$10", "immediate", "$10"],
    ["$10", "zeroPage", "$10"],
    ["$1234", "absolute", "$1234"],
    ["$10,x", "zeroPageIndexedX", "$10"],
    ["$1234,y", "absoluteIndexedY", "$1234"],
    ["($20,x)", "indexedIndirectX", "$20"],
    ["($20),y", "indirectIndexedY", "$20"],
    ["($1234)", "indirect", "$1234"],
  ];

  for (const [source, mode, baseExpression] of cases) {
    const lowered = classify6502Operand(resolver, source);
    t.is(lowered.mode, mode, source || "implied");
    t.is(lowered.baseExpression, baseExpression, source || "implied");
  }
});

test("6502 classifier does not inherit 65816-only operand forms", (t) => {
  const resolver = createResolver();

  t.is(classify6502Operand(resolver, "$12,s").mode, "unknown");
  t.is(classify6502Operand(resolver, "[$12]").mode, "unknown");
  t.deepEqual(classify6502Operand(resolver, "$123456").metadata, {
    addressOutOfRange: true,
  });
});

test("target-neutral operand syntax preserves unvalidated register names", (t) => {
  const resolver = createResolver();
  const lowered = resolver.lowerOperand("$12,z");

  t.is(lowered.mode, "unknown");
  t.is(lowered.indexRegister, "z");
});
