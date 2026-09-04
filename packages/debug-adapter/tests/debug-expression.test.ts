import { evaluateDebugExpression, formatDebugExpressionValue } from "../src/index.js";
import { test } from "../../../tests/ava-helper.js";

const registers = [
  { name: "A", value: "1234", bits: 16 },
  { name: "PC", value: "80ff00", bits: 24 },
] as const;

const evaluate = (expression: string): bigint =>
  evaluateDebugExpression(expression, registers).value;

test("debug expressions use native integer syntax and stopped-frame registers", (t) => {
  t.deepEqual(evaluateDebugExpression("a", registers), { value: 0x1234n, bits: 16 });
  t.is(evaluate("$10 + %10 + 0x10 + 0b10 + 10"), 46n);
  t.is(evaluate("2 + 3 * 4"), 14n);
  t.is(evaluate("2 ** 3 ** 2"), 512n);
  t.is(evaluate("17 / 3"), 5n);
  t.is(evaluate("17 % 3"), 2n);
  t.is(evaluate("($F0 | $0F) & $FF"), 0xffn);
  t.is(evaluate("($F0 ^ $0F) >> 4"), 0xfn);
  t.is(evaluate("1 << 8"), 0x100n);
  t.is(evaluate("1 < 2 && 3 >= 3"), 1n);
  t.is(evaluate("1 > 2 || 3 != 3"), 0n);
  t.is(evaluate("3 = 3"), 1n);
  t.is(evaluate("3 == 4"), 0n);
  t.is(evaluate("3 <= 3"), 1n);
  t.is(evaluate("^PC"), 0x80n);
  t.is(evaluate(">PC"), 0xffn);
  t.is(evaluate("<PC"), 0n);
  t.is(evaluate("-1 + +2"), 1n);
  t.is(evaluate("~0"), -1n);
  t.is(formatDebugExpressionValue(-0x12n), "-0x12");
  t.is(formatDebugExpressionValue(0x12n), "0x12");
});

test("debug expressions reject unknown state, malformed syntax, and expensive values", (t) => {
  t.throws(() => evaluate(""), { message: /cannot be empty/ });
  t.throws(() => evaluate("x"), { message: /Unknown register 'x'/ });
  t.throws(() => evaluate("$"), { message: /empty number/ });
  t.throws(() => evaluate("1 @ 2"), { message: /Unsupported.*'@'/ });
  t.throws(() => evaluate("(1 + 2"), { message: /missing '\)'/ });
  t.throws(() => evaluate("1 2"), { message: /Unexpected/ });
  t.throws(() => evaluate("1 / 0"), { message: /divides by zero/ });
  t.throws(() => evaluate("1 << 256"), { message: /shift must be between/ });
  t.throws(() => evaluate("2 ** 256"), { message: /exponent must be between/ });
  t.throws(() => evaluate("3 ** 255"), { message: /exceeds 256 bits/ });
  t.throws(() => evaluate("!1"), { message: /requires a number/ });
  t.throws(() => evaluate("1".repeat(257)), { message: /exceeds 256 characters/ });

  t.throws(
    () => evaluateDebugExpression("broken", [{ name: "broken", value: "not-hex", bits: 8 }]),
    { message: /invalid hexadecimal/ },
  );
  t.throws(
    () =>
      evaluateDebugExpression("flag", [
        { name: "FLAG", value: "1", bits: 1 },
        { name: "Flag", value: "0", bits: 1 },
      ]),
    { message: /ambiguous/ },
  );
});
