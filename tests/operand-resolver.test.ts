import sinon from "sinon";
import { test } from "./ava-helper.js";

import { OperandResolver } from "../src/operand-resolver.js";

const createResolver = (overrides: Partial<ConstructorParameters<typeof OperandResolver>[0]> = {}) => new OperandResolver({
  resolveDefines: input => input,
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
    tryResolveLabel: () => 0x1234,
  });

  t.is(resolver.tryResolveLabelInOperand("#test_label"), "#$1234");
  t.is(resolver.tryResolveLabelInOperand("#$1234"), "#$1234");
  t.is(resolver.tryResolveLabelInOperand("#label,x"), "#label,x");
});

test("tryResolveLabelInOperand - resolves indirect operands", t => {
  const resolver = createResolver({
    tryResolveLabel: () => 0x1234,
  });

  t.is(resolver.tryResolveLabelInOperand("[test_label]"), "[$1234]");
  t.is(resolver.tryResolveLabelInOperand("[$1234]"), "[$1234]");
  t.is(resolver.tryResolveLabelInOperand("[label,x]"), "[label,x]");
});

test("tryResolveLabelInOperand - resolves indexed operands", t => {
  const resolver = createResolver({
    tryResolveLabel: () => 0x1234,
  });

  t.is(resolver.tryResolveLabelInOperand("test_label,x"), "$1234,x");
  t.is(resolver.tryResolveLabelInOperand("$1234,x"), "$1234,x");
});

test("tryResolveLabelInOperand - resolves direct operands", t => {
  const resolver = createResolver({
    tryResolveLabel: () => 0x1234,
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
    tryResolveLabel: input => input === "zero_label" ? 0 : undefined,
  });

  t.is(resolver.tryResolveLabelInOperand("zero_label"), "$0");
});

test("tryResolveLabelInOperand - forwards direct lookups to non-throwing label resolution", t => {
  const tryResolveLabel = sinon.stub().returns(0x1234);
  const resolver = createResolver({ tryResolveLabel });

  t.is(resolver.tryResolveLabelInOperand("test_label"), "$1234");
  t.true(tryResolveLabel.calledWithExactly("test_label", false));
});

test("getnum - falls back to math for compound struct expressions", t => {
  const resolveStructLabel = sinon.stub().throws(new Error("Struct not found"));
  const resolveLabel = sinon.stub().throws(new Error("Label not found"));
  const evaluateMath = sinon.stub().withArgs("obj_start+obj[19].base").returns(0x0911);
  const resolver = createResolver({ resolveStructLabel, resolveLabel, evaluateMath });

  t.is(resolver.getnum("obj_start+obj[19].base"), 0x0911);
  t.true(resolveStructLabel.notCalled);
  t.true(resolveLabel.notCalled);
  t.true(evaluateMath.calledOnceWithExactly("obj_start+obj[19].base"));
});

test("getnum - resolves bare struct base labels before plain labels", t => {
  const resolveStructLabel = sinon.stub().withArgs("options").returns(0x1FD9);
  const resolveLabel = sinon.stub().throws(new Error("Label not found"));
  const resolver = createResolver({
    isStructReference: input => input === "options",
    resolveStructLabel,
    resolveLabel,
  });

  t.is(resolver.getnum("options"), 0x1FD9);
  t.true(resolveStructLabel.calledOnceWithExactly("options"));
  t.true(resolveLabel.notCalled);
});

test("getnum - resolves local label arithmetic before generic math fallback", t => {
  const resolveStructLabel = sinon.stub().throws(new Error("Struct not found"));
  const resolveLabel = sinon.stub().withArgs(".8741", false).returns(0x8741);
  const evaluateMath = sinon.stub().throws(new Error("Invalid number"));
  const resolver = createResolver({ resolveStructLabel, resolveLabel, evaluateMath });

  t.is(resolver.getnum(".8741-2"), 0x873F);
  t.true(resolveLabel.calledOnceWithExactly(".8741", false));
  t.true(evaluateMath.notCalled);
});

test("getnum - resolves local label subtraction on both sides before generic math fallback", t => {
  const resolveStructLabel = sinon.stub().throws(new Error("Struct not found"));
  const resolveLabel = sinon.stub().callsFake((label: string) => {
    if (label === ".zone_n") {
      return 0xDA98;
    }
    if (label === ".zone_max") {
      return 0xDA8E;
    }
    throw new Error("Label not found");
  });
  const evaluateMath = sinon.stub().throws(new Error("Invalid number"));
  const resolver = createResolver({ resolveStructLabel, resolveLabel, evaluateMath });

  t.is(resolver.getnum(".zone_n-.zone_max"), 0x0A);
  t.true(resolveLabel.calledWithExactly(".zone_n", false));
  t.true(resolveLabel.calledWithExactly(".zone_max", false));
  t.true(evaluateMath.notCalled);
});

test("getnum - resolves local label bitshifts before generic math fallback", t => {
  const resolveStructLabel = sinon.stub().throws(new Error("Struct not found"));
  const resolveLabel = sinon.stub().withArgs(".src", false).returns(0x1234);
  const evaluateMath = sinon.stub().throws(new Error("Invalid number"));
  const resolver = createResolver({ resolveStructLabel, resolveLabel, evaluateMath });

  t.is(resolver.getnum(".src>>8"), 0x12);
  t.true(resolveLabel.calledOnceWithExactly(".src", false));
  t.true(evaluateMath.notCalled);
});

test("getnum - leaves plain numeric math on the evaluator path", t => {
  const evaluateMath = sinon.stub().withArgs("10+5").returns(15);
  const resolver = createResolver({ evaluateMath });

  t.is(resolver.getnum("10+5"), 15);
  t.true(evaluateMath.calledOnceWithExactly("10+5"));
});

test("getnum - normalizes numeric literal base members", t => {
  const resolver = createResolver();

  t.is(resolver.getnum("$90F.base"), 0x090F);
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

test("lowerOperand - tolerates whitespace in indexed indirect operands", t => {
  const resolver = createResolver();

  const loweredIndexedIndirect = resolver.lowerOperand("(.C8BD, X)");
  t.is(loweredIndexedIndirect.mode, "indexedIndirectX");
  t.is(loweredIndexedIndirect.baseExpression, ".C8BD");

  const loweredIndirectIndexed = resolver.lowerOperand("($12), Y");
  t.is(loweredIndirectIndexed.mode, "indirectIndexedY");
  t.is(loweredIndirectIndexed.baseExpression, "$12");
});

test("lowerOperand - classifies generic indexed Y operands", t => {
  const resolver = createResolver();

  const lowered = resolver.lowerOperand("obj.active, Y");

  t.is(lowered.mode, "absoluteIndexedY");
  t.is(lowered.baseExpression, "obj.active");
  t.is(lowered.indexRegister, "y");
});

test("lowerOperand - keeps resolved 24-bit indexed X operands long", t => {
  const evaluateMath = sinon.stub().withArgs("_04984F_9879-$02").returns(0x049877);
  const resolver = createResolver({ evaluateMath });

  const lowered = resolver.lowerOperand("_04984F_9879-$02,X");

  t.is(lowered.expanded, "$49877,X");
  t.is(lowered.length, 3);
  t.is(lowered.mode, "absoluteLongIndexedX");
  t.is(lowered.baseExpression, "$49877");
  t.is(lowered.indexRegister, "x");
});

test("lowerOperand - shortens same-bank 24-bit indexed X labels", t => {
  const tryResolveLabel = sinon.stub().withArgs("save_file_ptr", false).returns(0x108012);
  const resolver = createResolver({
    tryResolveLabel,
    getCurrentAddress: () => 0x10801a,
  });

  const lowered = resolver.lowerOperand("save_file_ptr,x");

  t.is(lowered.expanded, "$108012,x");
  t.is(lowered.length, 2);
  t.is(lowered.mode, "absoluteIndexedX");
  t.is(lowered.indexRegister, "x");
});

test("lowerOperand - shortens same-bank resolved indexed X operands", t => {
  const tryResolveLabel = sinon.stub().withArgs("_048AD3", false).returns(0x048AD3);
  const resolver = createResolver({
    tryResolveLabel,
    getCurrentAddress: () => 0x048AFD,
  });

  const lowered = resolver.lowerOperand("_048AD3,X");

  t.is(lowered.expanded, "$48AD3,X");
  t.is(lowered.length, 2);
  t.is(lowered.mode, "absoluteIndexedX");
  t.is(lowered.baseExpression, "$48AD3");
  t.is(lowered.indexRegister, "x");
});

test("lowerOperand - keeps bank-0 indexed X labels long from another bank", t => {
  const tryResolveLabel = sinon.stub().withArgs("raphael_mode7_matrix_a_d", false).returns(0x00e954);
  const resolver = createResolver({
    tryResolveLabel,
    getCurrentAddress: () => 0x01b487,
  });

  const lowered = resolver.lowerOperand("raphael_mode7_matrix_a_d,x");

  t.is(lowered.expanded, "$E954,x");
  t.is(lowered.length, 3);
  t.is(lowered.mode, "absoluteLongIndexedX");
  t.is(lowered.indexRegister, "x");
});

test("lowerOperand - keeps bank-0 indexed X labels absolute in bank 0", t => {
  const tryResolveLabel = sinon.stub().withArgs("raphael_mode7_matrix_a_d", false).returns(0x00e954);
  const resolver = createResolver({
    tryResolveLabel,
    getCurrentAddress: () => 0x008000,
  });

  const lowered = resolver.lowerOperand("raphael_mode7_matrix_a_d,x");

  t.is(lowered.expanded, "$E954,x");
  t.is(lowered.length, 2);
  t.is(lowered.mode, "absoluteIndexedX");
  t.is(lowered.indexRegister, "x");
});

test("lowerOperand - keeps 4-digit hex indexed X absolute even from another bank", t => {
  const resolver = createResolver({
    getCurrentAddress: () => 0x01b487,
  });

  const lowered = resolver.lowerOperand("$E954,x");

  t.is(lowered.length, 2);
  t.is(lowered.mode, "absoluteIndexedX");
});

test("lowerOperand - dp-range labels are not explicit direct page", t => {
  const tryResolveLabel = sinon.stub().withArgs("sprite_yspeed", false).returns(0x07);
  const resolver = createResolver({ tryResolveLabel });

  const lowered = resolver.lowerOperand("sprite_yspeed");

  t.is(lowered.expanded, "$7");
  t.false(lowered.explicitDirectPage);
});

test("lowerOperand - two-digit hex is explicit direct page", t => {
  const resolver = createResolver();
  const lowered = resolver.lowerOperand("$07");

  t.is(lowered.expanded, "$07");
  t.true(lowered.explicitDirectPage);
});

test("lowerOperand - define-expanded two-digit hex is explicit direct page", t => {
  const resolver = createResolver({
    resolveDefines: (input) => input.replaceAll("!s_spr_wildcard_5_lo_dp", "$76"),
  });

  const dp = resolver.lowerOperand("!s_spr_wildcard_5_lo_dp");
  t.is(dp.expanded, "$76");
  t.true(dp.explicitDirectPage);

  const indexed = resolver.lowerOperand("!s_spr_wildcard_5_lo_dp,x");
  t.is(indexed.expanded, "$76,x");
  t.true(indexed.explicitDirectPageIndexedX);
});

test("lowerOperand - keeps explicit 6-digit hex long even in the current bank", t => {
  const resolver = createResolver({
    getCurrentAddress: () => 0x00E12A,
  });

  const lowered = resolver.lowerOperand("$007972");

  t.is(lowered.expanded, "$007972");
  t.is(lowered.length, 3);
  t.is(lowered.mode, "absoluteLong");
});

test("lowerOperand - collapses immediate bitmask expressions to operand width", t => {
  const resolveDefines = sinon.stub().callsFake((input: string) => input.replaceAll("!x", "$40").replaceAll("!a", "$80"));
  const evaluateMath = sinon.stub().withArgs("$40|$80").returns(0xC0);
  const resolver = createResolver({ resolveDefines, evaluateMath });

  const lowered = resolver.lowerOperand("#!x|!a");

  t.is(lowered.expanded, "#$C0");
  t.is(lowered.length, 1);
  t.true(lowered.immediate);
  t.is(lowered.baseExpression, "$C0");
});

test("expandOperand - evaluates only the indexed base expression", t => {
  const evaluateMath = sinon.stub().withArgs("stack_offsets+0").returns(0xA307);
  const resolver = createResolver({ evaluateMath });

  const expanded = resolver.expandOperand("stack_offsets+0,X");

  t.is(expanded.expanded, "$A307,X");
  t.is(expanded.length, 2);
  t.true(evaluateMath.calledOnceWithExactly("stack_offsets+0"));
});

test("splitMathOperandSuffix - strips ,x after grouping bank math", t => {
  const resolver = createResolver();

  t.deepEqual(resolver.splitMathOperandSuffix("($7F0000&$FF0000)+$03,x"), {
    expression: "($7F0000&$FF0000)+$03",
    suffix: ",x",
  });
  t.deepEqual(resolver.splitMathOperandSuffix("($60,x)"), {
    expression: "($60,x)",
    suffix: "",
  });
  t.deepEqual(resolver.splitMathOperandSuffix("[$20],y"), {
    expression: "[$20]",
    suffix: ",y",
  });
});

test("expandOperand - evaluates grouping bank math before ,x", t => {
  const evaluateMath = sinon.stub().withArgs("($7F0000&$FF0000)+$03").returns(0x7F0003);
  const resolver = createResolver({ evaluateMath });

  const expanded = resolver.expandOperand("($7F0000&$FF0000)+$03,x");

  t.is(expanded.expanded, "$7F0003,x");
  t.is(expanded.length, 3);
  t.true(evaluateMath.calledOnceWithExactly("($7F0000&$FF0000)+$03"));
});

test("expandOperand - normalizes immediate numeric base members", t => {
  const resolver = createResolver({
    resolveDefines: (input) => input.replace("!OBJ_BASE", "$90F"),
  });

  const expanded = resolver.expandOperand("#!OBJ_BASE.base");

  t.is(expanded.expanded, "#$90F");
  t.is(expanded.length, 2);
});
