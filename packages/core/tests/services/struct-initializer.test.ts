import { test } from "../../../../tests/ava-helper.js";
import {
  splitInitializerList,
  parseStructInitializer,
  isOpenStructInitializer,
} from "../../src/services/struct-initializer.js";

test("initializer lists preserve nested expressions, quoted commas, and one trailing comma", (t) => {
  t.deepEqual(splitInitializerList("1, fn(2, 3), [4, 5], { x = 6 }, \"a,b\", 'c,d',"), [
    "1",
    "fn(2, 3)",
    "[4, 5]",
    "{ x = 6 }",
    '"a,b"',
    "'c,d'",
  ]);
  t.deepEqual(splitInitializerList(String.raw`"a\",b", 2`), [String.raw`"a\",b"`, "2"]);
  t.deepEqual(splitInitializerList("  "), []);
  for (const text of ["(]", "]", "[1}"]) {
    t.throws(() => splitInitializerList(text), { message: /Mismatched/ });
  }
  for (const text of [",1", "1,,2"]) {
    t.throws(() => splitInitializerList(text), { message: /Empty/ });
  }
  for (const text of ["[1", "'open", '"open']) {
    t.throws(() => splitInitializerList(text), { message: /Unclosed/ });
  }
});

test("named initializers distinguish scalar expressions and arrays without evaluating them", (t) => {
  t.deepEqual(
    parseStructInitializer(' { name = "a,b", point.x = fn(1, 2), values = [3, 4,], empty = [] } '),
    new Map<string, string | string[]>([
      ["name", '"a,b"'],
      ["point.x", "fn(1, 2)"],
      ["values", ["3", "4"]],
      ["empty", []],
    ]),
  );
  t.deepEqual(parseStructInitializer("{}"), new Map());
  t.throws(() => parseStructInitializer("x = 1"), { message: /named initializer/ });
  t.throws(() => parseStructInitializer("{ x }"), { message: /Expected 'field = value'/ });
  t.throws(() => parseStructInitializer("{ x = 1, x = 2 }"), {
    message: /Duplicate initializer field/,
  });
  t.throws(() => parseStructInitializer("{ x = [1] + 2 }"), {
    message: /Unclosed array initializer/,
  });
});

test("implicit continuation is limited to record statements and ignores braces in strings", (t) => {
  t.true(isOpenStructInitializer("  dataStruct Point, { x = 1,"));
  t.true(isOpenStructInitializer("[points] { x = 1,"));
  t.true(isOpenStructInitializer("DATASTRUCT X, { nested = { x = 1 }"));
  t.false(isOpenStructInitializer("db '{'"));
  t.false(isOpenStructInitializer("dataStruct X, { value = '{' }"));
  t.false(isOpenStructInitializer(String.raw`dataStruct X, { value = "a\"{b" }`));
  t.false(isOpenStructInitializer("dataStruct X, { value = 1 }"));
});
