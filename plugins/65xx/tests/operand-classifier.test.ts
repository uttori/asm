import { test } from "../../../tests/ava-helper.js";

import { OperandResolver } from "../../../packages/core/src/operand-resolver.js";
import { classify65xxOperand } from "../src/operands/classifier.js";

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

test("65xx classifier covers the baseline addressing matrix", (t) => {
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
    const lowered = classify65xxOperand(resolver, source);
    t.is(lowered.mode, mode, source || "implied");
    t.is(lowered.baseExpression, baseExpression, source || "implied");
  }
});

test("65xx classifier owns Commodore and 45GS02 operand forms", (t) => {
  const resolver = createResolver();

  t.is(classify65xxOperand(resolver, "$12,s").mode, "stackRelative");
  t.is(classify65xxOperand(resolver, "($12,s),y").mode, "stackRelativeIndirectIndexedY");
  t.is(classify65xxOperand(resolver, "($12),z").mode, "zeroPageIndirectIndexedZ");
  t.is(classify65xxOperand(resolver, "[$12]").mode, "zeroPageIndirectLong");
  t.is(classify65xxOperand(resolver, "[$12],z").mode, "basePageIndirectIndexedZ");
  t.is(classify65xxOperand(resolver, "Q").mode, "quadAccumulator");
  t.deepEqual(classify65xxOperand(resolver, "$123456").metadata, {
    addressOutOfRange: true,
  });
});

test("target-neutral operand syntax preserves unvalidated register names", (t) => {
  const resolver = createResolver();
  const lowered = resolver.lowerOperand("$12,z");

  t.is(lowered.mode, "unknown");
  t.is(lowered.indexRegister, "z");
});

test("65xx classifier keeps HuC6280 and M740 compound operands architecture-owned", (t) => {
  const resolver = createResolver();

  t.is(classify65xxOperand(resolver, "#$12,$34").mode, "immediateZeroPage");
  t.is(classify65xxOperand(resolver, "#$12,$3456,x").mode, "immediateAbsoluteIndexedX");
  t.is(classify65xxOperand(resolver, "$1000,$2000,$0030").mode, "blockTransfer");
  t.is(classify65xxOperand(resolver, "A,target").mode, "accumulatorRelative");
  t.is(classify65xxOperand(resolver, "$12,#$34").mode, "zeroPageImmediate");
});
