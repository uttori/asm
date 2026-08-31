import { test } from "../../../tests/ava-helper.js";

import {
  splitCommaOperands,
  splitSingleOperand,
  splitTopLevelCommaOperands,
} from "../src/architectures/split-operands.js";

test("splitSingleOperand keeps the rest of the line as one operand", (t) => {
  t.deepEqual(splitSingleOperand(""), []);
  t.deepEqual(splitSingleOperand("LDA $12,x"), ["LDA $12,x"]);
});

test("splitCommaOperands splits on every comma", (t) => {
  t.deepEqual(splitCommaOperands(""), []);
  t.deepEqual(splitCommaOperands("R0, R1"), ["R0", "R1"]);
  t.deepEqual(splitCommaOperands("R0,(xx)"), ["R0", "(xx)"]);
});

test("splitTopLevelCommaOperands keeps commas inside parentheses", (t) => {
  t.deepEqual(splitTopLevelCommaOperands(""), []);
  t.deepEqual(splitTopLevelCommaOperands("A,#$12"), ["A", "#$12"]);
  t.deepEqual(splitTopLevelCommaOperands("MOV A,($12+X)"), ["MOV A", "($12+X)"]);
  t.deepEqual(splitTopLevelCommaOperands("A,($12+X),Y"), ["A", "($12+X)", "Y"]);
});
