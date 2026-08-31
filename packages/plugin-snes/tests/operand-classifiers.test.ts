import { test } from "../../../tests/ava-helper.js";
import { createEncoderTestHost } from "../../../tests/architecture/test-stubs.js";

import {
  classifyGenericOperand,
  classify65816Operand,
  classifySpc700Operand,
  classifySuperFxOperand,
} from "../src/architectures/operand-classifiers.js";

test("classifyGenericOperand treats empty indexed spelling as non-numeric", (t) => {
  const lowered = classifyGenericOperand({ raw: ",x", expanded: "$76,x", length: 1 });
  t.false(lowered.explicitDirectPage);
  t.false(lowered.explicitDirectPageIndexedX);
  t.is(lowered.mode, "directPageIndexedX");
});

test("classifyGenericOperand treats ! % and digit spellings as explicit DP", (t) => {
  t.true(
    classifyGenericOperand({ raw: "!flag", expanded: "$76", length: 1 }).explicitDirectPage,
  );
  t.true(
    classifyGenericOperand({ raw: "%01110110", expanded: "$76", length: 1 }).explicitDirectPage,
  );
  t.true(classifyGenericOperand({ raw: "118", expanded: "$76", length: 1 }).explicitDirectPage);
  t.false(
    classifyGenericOperand({ raw: "label", expanded: "$76", length: 1 }).explicitDirectPage,
  );
});

test("classifyGenericOperand classifies bit addresses by hex width", (t) => {
  t.is(
    classifyGenericOperand({ raw: "$12.3", expanded: "$12.3", length: 1 }).mode,
    "directPageBit",
  );
  t.is(
    classifyGenericOperand({ raw: "$0027.3", expanded: "$0027.3", length: 2 }).mode,
    "absoluteBit",
  );
});

test("classifyGenericOperand classifies (R0)+ as registerIndirectAutoIncrement", (t) => {
  const lowered = classifyGenericOperand({ raw: "(R0)+", expanded: "(R0)+", length: 1 });
  t.is(lowered.mode, "registerIndirectAutoIncrement");
  t.is(lowered.registerName, "r0");
  t.is(lowered.baseExpression, "R0");
});

test("classifyGenericOperand shortens 24-bit hex,x when length is under 3", (t) => {
  const shortened = classifyGenericOperand({
    raw: "$123456,x",
    expanded: "$123456,x",
    length: 2,
  });
  t.is(shortened.mode, "absoluteIndexedX");
  t.is(shortened.baseExpression, "$123456");
});

test("classifyGenericOperand uses length for non-hex indexed X", (t) => {
  const long = classifyGenericOperand({ raw: "table,x", expanded: "table,x", length: 3 });
  t.is(long.mode, "absoluteLongIndexedX");
  t.is(long.baseExpression, "table");
});

test("architecture classifiers expand then classify", (t) => {
  const { operandResolver } = createEncoderTestHost();
  t.is(classify65816Operand(operandResolver, "#$12").mode, "immediate");
  t.is(classifySpc700Operand(operandResolver, "A").mode, "register");
  t.is(classifySuperFxOperand(operandResolver, "(R0)+").mode, "registerIndirectAutoIncrement");
});
