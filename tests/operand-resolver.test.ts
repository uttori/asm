import sinon from "sinon";
import { test } from "./ava-helper.js";

import { OperandResolver } from "../src/operand-resolver.js";

const createResolver = (overrides: Partial<ConstructorParameters<typeof OperandResolver>[0]> = {}) => new OperandResolver({
  resolveDefines: input => input,
  resolveStructLabel: () => {
    throw new Error("Struct not found");
  },
  resolveLabel: () => {
    throw new Error("Label not found");
  },
  hasLabel: () => false,
  evaluateMath: () => 0,
  getPass: () => 2,
  requireStaticLabelLookup: () => false,
  ...overrides,
});

test("determineValueLength - handles numeric ranges", t => {
  const resolver = createResolver();

  t.is(resolver.determineValueLength(0x00, false), 1);
  t.is(resolver.determineValueLength(0xFF, false), 1);
  t.is(resolver.determineValueLength(0x100, false), 2);
  t.is(resolver.determineValueLength(0xFFFF, false), 2);
  t.is(resolver.determineValueLength(0x10000, false), 3);
  t.is(resolver.determineValueLength(0xFFFFFF, false), 3);
});

test("determineValueLength - handles strings and prefixes", t => {
  const resolver = createResolver();

  t.is(resolver.determineValueLength(""), 1);
  t.is(resolver.determineValueLength("FF"), 1);
  t.is(resolver.determineValueLength("$FFff"), 2);
  t.is(resolver.determineValueLength("$7e0000"), 3);
});

test("determineValueLength - respects forceTwoBytes", t => {
  const resolver = createResolver();

  t.is(resolver.determineValueLength(0x42, true), 2);
  t.is(resolver.determineValueLength("$10", true), 2);
  t.is(resolver.determineValueLength(0x123456, true), 2);
});

test("determineValueLength - rejects invalid values", t => {
  const resolver = createResolver();

  t.throws(() => {
    resolver.determineValueLength(null as unknown as string);
  }, { message: /Invalid value type for length determination/ });
  t.throws(() => {
    resolver.determineValueLength(undefined as unknown as string);
  }, { message: /Invalid value type for length determination/ });
  t.throws(() => {
    resolver.determineValueLength({} as unknown as string);
  }, { message: /Invalid value type for length determination/ });
  t.throws(() => {
    resolver.determineValueLength(Number.NaN as unknown as string);
  }, { message: /Invalid value for length determination/ });
});

test("isMathExpression - detects arithmetic and bitwise operators", t => {
  const resolver = createResolver();

  t.true(resolver.isMathExpression("1+2"));
  t.true(resolver.isMathExpression("$30 - $10"));
  t.true(resolver.isMathExpression("2*3"));
  t.true(resolver.isMathExpression("$100 / $10"));
  t.true(resolver.isMathExpression("$FF & $0F"));
  t.true(resolver.isMathExpression("$10 | $01"));
  t.true(resolver.isMathExpression("$FF ^ $0F"));
  t.true(resolver.isMathExpression("1 << 4"));
  t.true(resolver.isMathExpression("16 >> 2"));
});

test("isMathExpression - detects function calls and complex expressions", t => {
  const resolver = createResolver();

  t.true(resolver.isMathExpression("bank($7E0000)"));
  t.true(resolver.isMathExpression("(($10 << 8) | $20) & $FF00"));
  t.true(resolver.isMathExpression("1 + 2 * 3 / 4 & 5 | 6 ^ 7"));
});

test("isMathExpression - ignores plain operands", t => {
  const resolver = createResolver();

  t.false(resolver.isMathExpression("label"));
  t.false(resolver.isMathExpression("$1000"));
  t.false(resolver.isMathExpression("#$10"));
  t.false(resolver.isMathExpression(""));
  t.false(resolver.isMathExpression(null as unknown as string));
  t.false(resolver.isMathExpression(undefined as unknown as string));
  t.false(resolver.isMathExpression(Number.NaN as unknown as string));
});

test("tryResolveLabelInOperand - resolves immediate operands", t => {
  const resolver = createResolver({
    resolveLabel: () => 0x1234,
  });

  t.is(resolver.tryResolveLabelInOperand("#test_label"), "#$1234");
  t.is(resolver.tryResolveLabelInOperand("#$1234"), "#$1234");
  t.is(resolver.tryResolveLabelInOperand("#label,x"), "#label,x");
});

test("tryResolveLabelInOperand - resolves indirect operands", t => {
  const resolver = createResolver({
    resolveLabel: () => 0x1234,
  });

  t.is(resolver.tryResolveLabelInOperand("[test_label]"), "[$1234]");
  t.is(resolver.tryResolveLabelInOperand("[$1234]"), "[$1234]");
  t.is(resolver.tryResolveLabelInOperand("[label,x]"), "[label,x]");
});

test("tryResolveLabelInOperand - resolves indexed operands", t => {
  const resolver = createResolver({
    resolveLabel: () => 0x1234,
  });

  t.is(resolver.tryResolveLabelInOperand("test_label,x"), "$1234,x");
  t.is(resolver.tryResolveLabelInOperand("$1234,x"), "$1234,x");
});

test("tryResolveLabelInOperand - resolves direct operands", t => {
  const resolver = createResolver({
    resolveLabel: () => 0x1234,
  });

  t.is(resolver.tryResolveLabelInOperand("test_label"), "$1234");
});

test("tryResolveLabelInOperand - preserves unresolved operands", t => {
  const resolver = createResolver();

  t.is(resolver.tryResolveLabelInOperand("#unknown_label"), "#unknown_label");
  t.is(resolver.tryResolveLabelInOperand("[unknown_label]"), "[unknown_label]");
  t.is(resolver.tryResolveLabelInOperand("unknown_label,y"), "unknown_label,y");
  t.is(resolver.tryResolveLabelInOperand("unknown_label"), "unknown_label");
});

test("tryResolveLabelInOperand - treats zero as resolved when label exists", t => {
  const resolver = createResolver({
    resolveLabel: () => 0,
    hasLabel: input => input === "zero_label",
  });

  t.is(resolver.tryResolveLabelInOperand("zero_label"), "$0");
});

test("tryResolveLabelInOperand - forwards direct lookups to resolveLabel", t => {
  const resolveLabel = sinon.stub().returns(0x1234);
  const resolver = createResolver({ resolveLabel });

  t.is(resolver.tryResolveLabelInOperand("test_label"), "$1234");
  t.true(resolveLabel.calledWithExactly("test_label", false));
});

test("lowerOperand - returns typed lowered operand metadata", t => {
  const resolver = createResolver({
    resolveDefines: (input) => input.replace("!IMM", "$12"),
  });

  const lowered = resolver.lowerOperand("#!IMM");
  t.is(lowered.raw, "#!IMM");
  t.is(lowered.expanded, "#$12");
  t.is(lowered.length, 1);
  t.is(lowered.indexRegister, undefined);
  t.true(lowered.immediate);
  t.false(lowered.indirect);
});

test("lowerOperand - classifies addressing mode and base expression", t => {
  const resolver = createResolver();
  const loweredIndexed = resolver.lowerOperand("$1234,x");
  t.is(loweredIndexed.mode, "absoluteIndexedX");
  t.is(loweredIndexed.baseExpression, "$1234");

  const loweredStack = resolver.lowerOperand("$12,s");
  t.is(loweredStack.mode, "stackRelative");
  t.is(loweredStack.baseExpression, "$12");
});
