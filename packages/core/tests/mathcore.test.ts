import { test } from "../../../tests/ava-helper.js";
import type { ExpressionHost } from "../src/architecture-types.js";
import { runWithInternalInstrumentation } from "../src/internal-instrumentation.js";
import { parseExpressionNode, renderReferenceExpressionNode } from "../src/ir/expression-node.js";
import { MathCore } from "../src/mathcore.js";
import { B11MathOracle } from "./fixtures/b11-math-oracle.js";

const createExpressionHost = (overrides: Partial<ExpressionHost> = {}): ExpressionHost => ({
  resolveReference: (node) => {
    const value = (overrides.resolveLabel ?? (() => 0))(renderReferenceExpressionNode(node));
    if (typeof value !== "number") {
      return {
        kind: "error",
        error: new Error(
          `Reference '${renderReferenceExpressionNode(node)}' did not resolve to a numeric value.`,
        ),
      };
    }
    return { kind: "resolved", value };
  },
  resolveLabel: () => 0,
  convertLogicalToOutputOffset: (address) => address,
  convertOutputOffsetToLogical: (offset) => offset,
  getCurrentAddress: () => 0,
  getCurrentBaseAddress: () => 0,
  isDefined: () => 0,
  getExpressionObjectSize: () => 0,
  getFileSize: () => 0,
  getFileStatus: () => 1,
  canReadFile: () => 0,
  readFile: () => 0,
  canReadBaseImage: () => 0,
  readBaseImage: () => 0,
  ...overrides,
});

test("native parsed and string expressions preserve legacy precedence, grouping and rounding", (t) => {
  const corpus = [
    "2 ** 3 ** 2",
    "2 ** (3 ** 2)",
    "10 / 3 + 2.7",
    "2.7 * 3",
    "(2.7) * 3",
    "5 / 2 * 3",
    "5 / (2 * 3)",
    "-5 / 2",
    "~$0F & $FF",
    "!$0F & $FF",
    "%1010 + %0011",
    "12 % 5",
    "<$123456 + >$123456",
    "^$123456",
    "<:$123456",
    "3 << 1 + 2",
    "7 & 3 == 3",
    "0 || 1 && 2",
    "max(2, 3) + min(5, 4)",
    "sqrt(81) + cos(0)",
    "Label + 3",
    "Object.field[2] + 1",
    "defined(name)",
    ...[
      "+",
      "-",
      "*",
      "/",
      "%",
      "**",
      "<<",
      ">>",
      "&",
      "|",
      "^",
      "<",
      ">",
      "==",
      "!=",
      "&&",
      "||",
    ].flatMap((operator) => [`7 ${operator} 3`, `7 ${operator} 3 + 2`, `(7 ${operator} 3) + 2`]),
  ];
  for (const round of [false, true]) {
    for (const expression of corpus) {
      const legacy = new B11MathOracle();
      const current = new MathCore();
      legacy.host = current.host = createExpressionHost({
        resolveLabel: () => 17,
        isDefined: () => 1,
      });
      legacy.math_round = current.math_round = round;
      const expected = legacy.evaluateStringExpression(expression);
      const parsed = parseExpressionNode(expression);
      t.not(parsed.type, "raw", expression);
      t.is(current.math(expression), expected, `${expression}, rounded=${round}`);
      t.is(current.math(parsed), expected, `IR ${expression}, rounded=${round}`);
    }
  }
  const math = new MathCore();
  t.is(math.math(parseExpressionNode("2 ** 3 ** 2")), 64);
  t.is(math.math(parseExpressionNode("2 ** (3 ** 2)")), 512);
  math.math_round = true;
  t.is(math.math("2.7 * 3"), 8);
  t.is(math.math("(2.7) * 3"), 6);
  t.is(math.math("10 / 3 + 2.7"), 5);
});

test("parsed expression errors retain numeric diagnostic identity and reference spans", (t) => {
  for (const expression of ["5 / 0", "5 % 0", "(-1) ** 0.5", "2 +", "(2 + 3"]) {
    const legacy = t.throws(() => new B11MathOracle().evaluateStringExpression(expression));
    const current = t.throws(() => new MathCore().math(expression));
    t.is(current.message, legacy.message, expression);
  }
  const node = parseExpressionNode("  Label + 3", {
    text: " ".repeat(100) + "  Label + 3",
    offset: 100,
    line: 4,
  });
  if (node.type !== "binary") {
    t.fail("Expected parsed binary expression");
    return;
  }
  t.is(node.left.span?.start, 102);
  t.is(node.right.span?.start, 110);
});

test("reset - resets math core state", (t) => {
  const mathCore = new MathCore();

  // Set up some state to be reset
  mathCore.math_round = true;
  mathCore.userFunctions.set("testFunc", { args: ["x"], content: "x * 2" });

  // Verify the state is set
  t.true(mathCore.math_round);
  t.true(mathCore.userFunctions.has("testFunc"));

  // Call reset
  mathCore.reset();

  // Verify the state has been reset
  t.false(mathCore.math_round);
  t.false(mathCore.userFunctions.has("testFunc"));
});

test("reset - doesn't affect built-in functions", (t) => {
  const mathCore = new MathCore();

  t.is(mathCore.math("sqrt(16)"), 4);
  t.is(mathCore.math("sin(0)"), 0);

  mathCore.reset();

  t.is(mathCore.math("sqrt(16)"), 4);
  t.is(mathCore.math("sin(0)"), 0);
});

test("reset - doesn't affect operators", (t) => {
  const mathCore = new MathCore();

  // Check that operators exist before reset
  t.truthy(mathCore.operators["+"]);
  t.truthy(mathCore.operators["*"]);

  // Call reset
  mathCore.reset();

  // Verify operators still exist after reset
  t.truthy(mathCore.operators["+"]);
  t.truthy(mathCore.operators["*"]);
});

test("math - basic arithmetic", (t) => {
  const mathCore = new MathCore();

  // Addition
  t.is(mathCore.math("5 + 3"), 8);

  // Subtraction
  t.is(mathCore.math("10 - 4"), 6);

  // Multiplication
  t.is(mathCore.math("6 * 7"), 42);

  // Division
  t.is(mathCore.math("20 / 5"), 4);

  // Modulo
  t.is(mathCore.math("17 % 5"), 2);

  // Exponentiation
  t.is(mathCore.math("2 ** 3"), 8);
});

test("math - caches only pure string expressions within an assembly snapshot", (t) => {
  const mathCore = new MathCore();
  let label = 5;
  mathCore.host = createExpressionHost({ resolveLabel: () => label });
  const { metrics } = runWithInternalInstrumentation(() => {
    t.is(mathCore.math("5 + 3"), 8);
    t.is(mathCore.math("5 + 3"), 8);
    t.is(mathCore.math("DynamicLabel"), 5);
    label = 9;
    t.is(mathCore.math("DynamicLabel"), 9, "syntax reuse must not cache state-dependent values");
    mathCore.beginAssemblySnapshot();
    t.is(mathCore.math("5 + 3"), 8);
    mathCore.endAssemblySnapshot();
    t.is(mathCore.math("5 + 3"), 8);
  });
  t.is(metrics.counters.pureStringExpressionCacheHits, 1);
  t.is(metrics.counters.pureStringExpressionCacheMisses, 3);
  t.is(metrics.counters.expressionRawFallbackEvaluations, 0);
});

test("math - records instrumentation when a run is active", (t) => {
  const mathCore = new MathCore();
  mathCore.host = createExpressionHost({ resolveLabel: () => 7 });
  const node = {
    type: "binary" as const,
    operator: "+" as const,
    left: { type: "literal" as const, value: "1" },
    right: { type: "literal" as const, value: "2" },
  };
  const impure = { type: "identifier" as const, name: "LABEL" };

  const { metrics } = runWithInternalInstrumentation(() => {
    t.is(mathCore.math("5 + 3"), 8);
    t.is(mathCore.math("5 + 3"), 8);
    t.is(mathCore.math(node), 3);
    t.is(mathCore.math(node), 3);
    t.is(mathCore.math(impure), 7);
  });

  t.true(metrics.counters.expressionEvaluations >= 5);
  t.true(metrics.counters.expressionStringEvaluations >= 2);
  t.true(metrics.counters.expressionNodeEvaluations >= 3);
  t.true(metrics.counters.pureExpressionEvaluations >= 2);
  t.true(metrics.counters.pureStringExpressionEvaluations >= 2);
});

test("math - order of operations", (t) => {
  const mathCore = new MathCore();

  // PEMDAS test
  t.is(mathCore.math("2 + 3 * 4"), 14);

  // Complex expression
  t.is(mathCore.math("10 - 2 * 3 + 4 / 2"), 6);

  // With parentheses
  t.is(mathCore.math("(2 + 3) * 4"), 20);

  // Nested parentheses
  t.is(mathCore.math("2 * (3 + (4 - 1))"), 12);
});

test("math - bitwise operations", (t) => {
  const mathCore = new MathCore();

  // Bitwise AND
  t.is(mathCore.math("12 & 5"), 4);

  // Bitwise OR
  t.is(mathCore.math("12 | 5"), 13);

  // Bitwise XOR
  t.is(mathCore.math("12 ^ 5"), 9);

  // Bitwise shift left
  t.is(mathCore.math("5 << 2"), 20);

  // Bitwise shift right
  t.is(mathCore.math("20 >> 2"), 5);
});

test("math - comparison operations", (t) => {
  const mathCore = new MathCore();

  // Equal
  t.is(mathCore.math("5 == 5"), 1);
  t.is(mathCore.math("5 = 5"), 1);

  t.is(mathCore.math("5 == 6"), 0);
  t.is(mathCore.math("5 = 6"), 0);

  // Not equal
  t.is(mathCore.math("5 != 6"), 1);

  t.is(mathCore.math("5 != 5"), 0);

  // Less than
  t.is(mathCore.math("5 < 10"), 1);

  t.is(mathCore.math("10 < 5"), 0);

  // Greater than
  t.is(mathCore.math("10 > 5"), 1);

  t.is(mathCore.math("5 > 10"), 0);

  // Less than or equal
  t.is(mathCore.math("5 <= 5"), 1);

  t.is(mathCore.math("6 <= 5"), 0);

  // Greater than or equal
  t.is(mathCore.math("5 >= 5"), 1);

  t.is(mathCore.math("4 >= 5"), 0);
});

test("math - logical operations", (t) => {
  const mathCore = new MathCore();

  // Logical AND
  t.is(mathCore.math("1 && 1"), 1);

  t.is(mathCore.math("1 && 0"), 0);

  // Logical OR
  t.is(mathCore.math("1 || 0"), 1);

  t.is(mathCore.math("0 || 0"), 0);

  // Complex logical expression
  t.is(mathCore.math("(5 > 3) && (10 != 5)"), 1);

  t.is(mathCore.math("(5 < 3) || (10 == 5)"), 0);
});

test("math - error cases", (t) => {
  const mathCore = new MathCore();

  // Division by zero
  t.throws(() => mathCore.math("10 / 0"), { message: "Division by zero" });

  // Modulo by zero
  t.throws(() => mathCore.math("10 % 0"), { message: "Modulo by zero" });

  // Invalid expression
  t.throws(() => mathCore.math("5 + * 3"));

  // Unmatched parentheses
  t.throws(() => mathCore.math("(5 + 3"), { message: "Mismatched parentheses." });

  t.throws(() => mathCore.math("5 + 3)"));
});

test("math - number formats", (t) => {
  const mathCore = new MathCore();

  // Hexadecimal (with $)
  t.is(mathCore.math("$10 + $20"), 48); // 16 + 32 = 48

  // Hexadecimal (with 0x)
  t.is(mathCore.math("0x10 + 0x20"), 48); // 16 + 32 = 48

  // Binary
  t.is(mathCore.math("%1010 + %0101"), 15); // 10 + 5 = 15

  // Decimal
  t.is(mathCore.math("10.5 + 20.5"), 31);

  // VT / FF / NBSP / BOM are whitespace, same as String#trim
  t.is(mathCore.math("1\u000b+\u000c2\u00a0+\ufeff3"), 6);
});

test("math - resolves local labels in arithmetic", (t) => {
  const mathCore = new MathCore();
  mathCore.host = createExpressionHost({
    resolveLabel: (label) => (label === ".src" ? 0x1234 : 0),
  });

  t.is(mathCore.math(".src >> 8"), 0x12);
});

test("math - offset handles local label arguments", (t) => {
  const mathCore = new MathCore();
  mathCore.host = createExpressionHost({
    resolveLabel: (label) => {
      if (label === ".base") {
        return 0x8871;
      }
      if (label === ".target") {
        return 0x888a;
      }
      return 0;
    },
  });

  t.is(mathCore.math("offset(.base, .target)"), 0x19);

  t.throws(
    () => {
      mathCore.math("offset(.base)");
    },
    { message: "offset() expects exactly 2 numeric arguments." },
  );
});

test("math - operator precedence", (t) => {
  const mathCore = new MathCore();

  // Test all precedence levels
  // Enable priority-based evaluation
  const result = mathCore.math("1 || 0 && 1 | 2 ^ 3 & 4 == 4 > 3 << 1 + 2 * 3 ** 2");

  // Expected: 1 || (0 && (1 | (2 ^ (3 & (4 == (4 > (3 << (1 + (2 * (3 ** 2))))))))))
  // 3**2 = 9, 2*9 = 18, 1+18 = 19, 3<<19 = 3*2^19 (large), 4>large = 0, 4==0 = 0, 3&0 = 0, 2^0 = 2, 1|2 = 3, 0&&3 = 0, 1||0 = 1
  t.is(result, 1);
});

test("math - two-character operators respect precedence", (t) => {
  const mathCore = new MathCore();

  t.is(mathCore.math("1 + 0 && 0"), 0);
  t.is(mathCore.math("1 + 1 && 0"), 0);
  t.is(mathCore.math("2 * 3 == 6"), 1);
  t.is(mathCore.math("1 + 2 << 3"), 24);
  t.is(mathCore.math("2 ** 3 ** 2"), 64);
});

test("math - rounding", (t) => {
  const mathCore = new MathCore();

  // Without rounding
  mathCore.math_round = false;
  t.is(mathCore.math("5 / 2"), 2.5);

  // With rounding
  mathCore.math_round = true;
  t.is(mathCore.math("5 / 2"), 2);

  // Reset flag
  mathCore.math_round = false;
});

test("math - complex expressions", (t) => {
  const mathCore = new MathCore();

  // Multiple operations with different precedence
  t.is(mathCore.math("2 ** 3 * 4 + 5 * 6 / 3 - 7"), 32 + 10 - 7); // 35

  // Complex expression with parentheses
  t.is(mathCore.math("((2 + 3) * 4 + (6 / 2)) ** 2"), 23 * 23); // 529

  // Mix of different operations
  t.is(mathCore.math("10 & 7 | 4 ^ 2 + 3 * 4 / 2"), (10 & 7) | (4 ^ (2 + 6))); // 2 | 4 ^ 8 = 14
});

test("math - depth parameter", (t) => {
  const mathCore = new MathCore();

  // Test with different depth values
  t.is(mathCore.math("1 + 2 * 3"), 7); // Normal evaluation
});

test("math - with label resolver", (t) => {
  const mathCore = new MathCore();

  mathCore.host = createExpressionHost({
    resolveLabel: (id) => {
      if (id === "LABEL1") {
        return 10;
      }
      if (id === "LABEL2") {
        return 20;
      }
      throw new Error(`Unknown label: ${id}`);
    },
  });

  // Test with labels
  t.is(mathCore.math("LABEL1 + LABEL2"), 30);

  // Test with unknown label
  t.throws(() => mathCore.math("LABEL1 + UNKNOWN_LABEL"), {
    message: "Unknown label: UNKNOWN_LABEL",
  });
});

test("math - error handling", (t) => {
  const mathCore = new MathCore();

  // Test division by zero
  t.throws(
    () => {
      mathCore.math("10 / 0");
    },
    { message: "Division by zero" },
  );

  // Test modulo by zero
  t.throws(
    () => {
      mathCore.math("10 % 0");
    },
    { message: "Modulo by zero" },
  );

  // Test mismatched parentheses (too many opening)
  t.throws(
    () => {
      mathCore.math("(10 + 5");
    },
    { message: "Mismatched parentheses." },
  );

  // Test mismatched parentheses (too many closing)
  t.throws(
    () => {
      mathCore.math("10 + 5)");
    },
    { message: "Mismatched parentheses." },
  );

  // Test invalid input with comma
  t.throws(
    () => {
      mathCore.math("10, 20");
    },
    { message: "Invalid input: , 20" },
  );

  t.throws(
    () => {
      mathCore.math("");
    },
    { message: "Invalid input: empty expression." },
  );

  t.throws(
    () => {
      mathCore.math("   ");
    },
    { message: "Invalid input: empty expression." },
  );

  // Test NaN result
  t.throws(
    () => {
      mathCore.math("0 / 0");
    },
    { message: /Division by zero|Invalid number/ },
  );
});

test("callFunction - dispatches to user functions", (t) => {
  const mathCore = new MathCore();

  // Set up a user function
  mathCore.userFunctions.set("double", { args: ["x"], content: "x * 2" });

  // Test that callFunction correctly dispatches to user function
  t.is(mathCore.callFunction("double", [5]), 10);
  t.is(mathCore.callFunction("double", [0]), 0);
  t.is(mathCore.callFunction("double", [-3]), -6);
});

test("callFunction - dispatches to built-in functions", (t) => {
  const mathCore = new MathCore();

  // Test with some built-in math functions
  t.is(mathCore.callFunction("sqrt", [16]), 4);
  t.is(mathCore.callFunction("min", [5, 3, 8]), 3);
  t.is(mathCore.callFunction("max", [5, 3, 8]), 8);
  t.is(mathCore.callFunction("clamp", [15, 0, 10]), 10);
});

test("callFunction - handles string arguments for appropriate functions", (t) => {
  const mathCore = new MathCore();

  mathCore.host = createExpressionHost({
    isDefined: (name) => (name === "some_symbol" ? 1 : 0),
  });

  // Test with a function that can accept string arguments
  t.is(mathCore.callFunction("defined", ["some_symbol"]), 1);
});

test("callFunction - throws error for invalid function", (t) => {
  const mathCore = new MathCore();

  // Test with non-existent function
  t.throws(
    () => {
      mathCore.callFunction("nonexistent", [1, 2]);
    },
    { message: "Unknown built-in function 'nonexistent'" },
  );
});

test("callUserFunction - basic functionality", (t) => {
  const mathCore = new MathCore();

  // Set up a simple user function
  mathCore.userFunctions.set("add", { args: ["a", "b"], content: "a + b" });

  // Test basic function call
  t.is(mathCore.callUserFunction("add", [5, 3]), 8);

  // Test with different values
  t.is(mathCore.callUserFunction("add", [10, 20]), 30);
  t.is(mathCore.callUserFunction("add", [0, 0]), 0);
  t.is(mathCore.callUserFunction("add", [-5, 5]), 0);
});

test("callUserFunction - complex expressions", (t) => {
  const mathCore = new MathCore();

  // Set up functions with more complex expressions
  mathCore.userFunctions.set("square", { args: ["x"], content: "x * x" });
  mathCore.userFunctions.set("polynomial", { args: ["x", "y"], content: "3*x*x + 2*y - 5" });

  // Test the functions
  t.is(mathCore.callUserFunction("square", [4]), 16);
  t.is(mathCore.callUserFunction("polynomial", [2, 3]), 3 * 4 + 2 * 3 - 5); // 3*2^2 + 2*3 - 5 = 12 + 6 - 5 = 13
});

test("callUserFunction - extra arguments", (t) => {
  const mathCore = new MathCore();

  // Set up a function
  mathCore.userFunctions.set("sum", { args: ["a", "b"], content: "a + b" });

  // Test with extra arguments (should ignore extras)
  t.is(mathCore.callUserFunction("sum", [1, 2, 3, 4]), 3);
});

test("callUserFunction - error cases", (t) => {
  const mathCore = new MathCore();

  // Set up a function
  mathCore.userFunctions.set("multiply", { args: ["a", "b"], content: "a * b" });

  // Test function not found
  t.throws(
    () => {
      mathCore.callUserFunction("nonexistent", [1, 2]);
    },
    { message: "User function 'nonexistent' not found." },
  );

  // Test insufficient arguments
  t.throws(
    () => {
      mathCore.callUserFunction("multiply", [5]);
    },
    { message: "Function 'multiply' expects at least 2 argument(s)." },
  );
});

test("callUserFunction - supports string arguments", (t) => {
  const mathCore = new MathCore();
  mathCore.host = createExpressionHost({
    readFile: (filename, pos, size) => {
      if (size === 1 && filename === "data/64kb.bin" && pos === 1) {
        return 0x20;
      }
      return 0x10;
    },
  });

  mathCore.userFunctions.set("readfile1_incremented", {
    args: ["filename", "pos"],
    content: "readfile1(filename, pos) + 1",
  });

  t.is(mathCore.callUserFunction("readfile1_incremented", ["data/64kb.bin", 0]), 0x11);
  t.is(mathCore.callUserFunction("readfile1_incremented", ["data/64kb.bin", 1]), 0x21);
});

test("callUserFunction - nested expressions", (t) => {
  const mathCore = new MathCore();

  // Set up functions that could be used together
  mathCore.userFunctions.set("double", { args: ["x"], content: "x * 2" });
  mathCore.userFunctions.set("complex", { args: ["a"], content: "double(a) + 5" });

  // Test with nested function call in the expression
  // t.is(mathCore.callUserFunction("double", [3]), 6);

  // This should work if the math method can handle nested function calls
  // The complex function calls double(a) + 5, which should be 2*3 + 5 = 11
  t.is(mathCore.callUserFunction("complex", [3]), 11);
});

test("callUserFunction - parameter substitution", (t) => {
  const mathCore = new MathCore();

  // Test that parameters are correctly substituted
  mathCore.userFunctions.set("paramTest", {
    args: ["value", "multiplier"],
    content: "value * multiplier + value",
  });

  // Should substitute 'value' with 10 and 'multiplier' with 3
  t.is(mathCore.callUserFunction("paramTest", [10, 3]), 10 * 3 + 10); // 40

  // Test with parameter names that could be substrings of others
  mathCore.userFunctions.set("substrTest", {
    args: ["a", "aa"],
    content: "a + aa",
  });

  // Should correctly distinguish between 'a' and 'aa'
  t.is(mathCore.callUserFunction("substrTest", [5, 10]), 15);
});

test("callBuiltInFunction - JavaScript Math", (t) => {
  const mathCore = new MathCore();

  // Test square root function
  t.is(mathCore.callBuiltInFunction("sqrt", [9]), 3);
  t.is(mathCore.callBuiltInFunction("sqrt", [2]), Math.sqrt(2));

  // Test trigonometric functions
  t.is(mathCore.callBuiltInFunction("sin", [Math.PI / 2]), 1);
  t.is(mathCore.callBuiltInFunction("cos", [0]), 1);
  // Use approximately equal for floating point comparison
  t.true(Math.abs(mathCore.callBuiltInFunction("tan", [Math.PI / 4]) - 1) < 0.0000001);

  // Test inverse trigonometric functions
  t.is(mathCore.callBuiltInFunction("asin", [1]), Math.PI / 2);
  t.is(mathCore.callBuiltInFunction("acos", [1]), 0);
  t.is(mathCore.callBuiltInFunction("atan", [1]), Math.PI / 4);

  // Test alternative names for inverse trigonometric functions
  t.is(mathCore.callBuiltInFunction("arcsin", [1]), Math.PI / 2);
  t.is(mathCore.callBuiltInFunction("arccos", [1]), 0);
  t.is(mathCore.callBuiltInFunction("arctan", [1]), Math.PI / 4);

  // Test logarithmic functions
  t.is(mathCore.callBuiltInFunction("log", [Math.E]), 1);
  t.is(mathCore.callBuiltInFunction("log10", [100]), 2);
  t.is(mathCore.callBuiltInFunction("log2", [8]), 3);

  // Test rounding functions
  t.is(mathCore.callBuiltInFunction("ceil", [3.2]), 4);
  t.is(mathCore.callBuiltInFunction("floor", [3.8]), 3);

  // Test error cases
  t.throws(
    () => {
      mathCore.callBuiltInFunction("sqrt", [-1]);
    },
    { message: "sqrt returned NaN for argument -1" },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("sqrt", [1, 2]);
    },
    { message: "sqrt expects exactly 1 numeric argument." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("sin", ["not a number"]);
    },
    { message: "Function 'sin' expected a numeric argument but got a string: not a number" },
  );
});

test("callBuiltInFunction - min function", (t) => {
  const mathCore = new MathCore();

  // Test with two arguments
  t.is(mathCore.callBuiltInFunction("min", [5, 3]), 3);
  t.is(mathCore.callBuiltInFunction("min", [0, 10]), 0);
  t.is(mathCore.callBuiltInFunction("min", [-5, 5]), -5);

  // Test with more than two arguments
  t.is(mathCore.callBuiltInFunction("min", [5, 3, 7]), 3);
  t.is(mathCore.callBuiltInFunction("min", [10, 20, 5, 15]), 5);

  // Test error case with less than two arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("min", [5]);
    },
    { message: "min() expects at least 2 numeric arguments." },
  );
});

test("callBuiltInFunction - max function", (t) => {
  const mathCore = new MathCore();

  // Test with two arguments
  t.is(mathCore.callBuiltInFunction("max", [5, 3]), 5);
  t.is(mathCore.callBuiltInFunction("max", [0, 10]), 10);
  t.is(mathCore.callBuiltInFunction("max", [-5, 5]), 5);

  // Test with more than two arguments
  t.is(mathCore.callBuiltInFunction("max", [5, 3, 7]), 7);
  t.is(mathCore.callBuiltInFunction("max", [10, 20, 5, 15]), 20);

  // Test error case with less than two arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("max", [5]);
    },
    { message: "max() expects at least 2 numeric arguments." },
  );
});

test("callBuiltInFunction - clamp function", (t) => {
  const mathCore = new MathCore();

  // Test with value within range
  t.is(mathCore.callBuiltInFunction("clamp", [5, 0, 10]), 5);

  // Test with value below minimum
  t.is(mathCore.callBuiltInFunction("clamp", [-5, 0, 10]), 0);

  // Test with value above maximum
  t.is(mathCore.callBuiltInFunction("clamp", [15, 0, 10]), 10);

  // Test with equal bounds
  t.is(mathCore.callBuiltInFunction("clamp", [5, 7, 7]), 7);

  // Test error case with wrong number of arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("clamp", [5, 0]);
    },
    { message: "clamp() expects exactly 3 numeric arguments." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("clamp", [5, 0, 10, 15]);
    },
    { message: "clamp() expects exactly 3 numeric arguments." },
  );
});

test("callBuiltInFunction - safediv function", (t) => {
  const mathCore = new MathCore();

  // Test normal division
  t.is(mathCore.callBuiltInFunction("safediv", [10, 2, 1]), 5);
  t.is(mathCore.callBuiltInFunction("safediv", [7, 2, 1]), 3.5);

  // Test division by zero with default value
  t.is(mathCore.callBuiltInFunction("safediv", [10, 0, 999]), 999);

  // Test error case with wrong number of arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("safediv", [10]);
    },
    { message: "safediv() expects exactly 3 numeric arguments." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("safediv", [10, 2, 0, 5]);
    },
    { message: "safediv() expects exactly 3 numeric arguments." },
  );
});

test("callBuiltInFunction - select function", (t) => {
  const mathCore = new MathCore();

  // Test with condition true (non-zero)
  t.is(mathCore.callBuiltInFunction("select", [1, 10, 20]), 10);
  t.is(mathCore.callBuiltInFunction("select", [42, 10, 20]), 10);

  // Test with condition false (zero)
  t.is(mathCore.callBuiltInFunction("select", [0, 10, 20]), 20);

  // Test error case with wrong number of arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("select", [1, 10]);
    },
    { message: "select() expects exactly 3 numeric arguments." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("select", [1, 10, 20, 30]);
    },
    { message: "select() expects exactly 3 numeric arguments." },
  );
});

test("callBuiltInFunction - not function", (t) => {
  const mathCore = new MathCore();

  // Test with truthy values
  t.is(mathCore.callBuiltInFunction("not", [1]), 0);
  t.is(mathCore.callBuiltInFunction("not", [42]), 0);

  // Test with falsy value
  t.is(mathCore.callBuiltInFunction("not", [0]), 1);

  // Test error case with wrong number of arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("not", []);
    },
    { message: "not() expects exactly 1 numeric argument." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("not", [0, 1]);
    },
    { message: "not() expects exactly 1 numeric argument." },
  );
});

test("callBuiltInFunction - bank function", (t) => {
  const mathCore = new MathCore();

  // Test with various addresses
  t.is(mathCore.callBuiltInFunction("bank", [0x7e0000]), 0x7e);
  t.is(mathCore.callBuiltInFunction("bank", [0x008000]), 0x00);
  t.is(mathCore.callBuiltInFunction("bank", [0x1a8000]), 0x1a);

  // Test error case with wrong number of arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("bank", []);
    },
    { message: "bank() expects exactly 1 numeric argument." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("bank", [0x7e0000, 0x008000]);
    },
    { message: "bank() expects exactly 1 numeric argument." },
  );
});

test("callBuiltInFunction - comparison", (t) => {
  const mathCore = new MathCore();

  // Test equal function
  t.is(mathCore.callBuiltInFunction("equal", [10, 10]), 1);
  t.is(mathCore.callBuiltInFunction("equal", [10, 20]), 0);
  t.throws(
    () => {
      mathCore.callBuiltInFunction("equal", [10]);
    },
    { message: "equal() expects exactly 2 numeric arguments." },
  );

  // Test notequal function
  t.is(mathCore.callBuiltInFunction("notequal", [10, 10]), 0);
  t.is(mathCore.callBuiltInFunction("notequal", [10, 20]), 1);
  t.throws(
    () => {
      mathCore.callBuiltInFunction("notequal", [10]);
    },
    { message: "notequal() expects exactly 2 numeric arguments." },
  );

  // Test less function
  t.is(mathCore.callBuiltInFunction("less", [10, 20]), 1);
  t.is(mathCore.callBuiltInFunction("less", [20, 10]), 0);
  t.is(mathCore.callBuiltInFunction("less", [10, 10]), 0);
  t.throws(
    () => {
      mathCore.callBuiltInFunction("less", [10]);
    },
    { message: "less() expects exactly 2 numeric arguments." },
  );

  // Test lessequal function
  t.is(mathCore.callBuiltInFunction("lessequal", [10, 20]), 1);
  t.is(mathCore.callBuiltInFunction("lessequal", [10, 10]), 1);
  t.is(mathCore.callBuiltInFunction("lessequal", [20, 10]), 0);
  t.throws(
    () => {
      mathCore.callBuiltInFunction("lessequal", [10]);
    },
    { message: "lessequal() expects exactly 2 numeric arguments." },
  );

  // Test greater function
  t.is(mathCore.callBuiltInFunction("greater", [20, 10]), 1);
  t.is(mathCore.callBuiltInFunction("greater", [10, 20]), 0);
  t.is(mathCore.callBuiltInFunction("greater", [10, 10]), 0);
  t.throws(
    () => {
      mathCore.callBuiltInFunction("greater", [10]);
    },
    { message: "greater() expects exactly 2 numeric arguments." },
  );

  // Test greaterequal function
  t.is(mathCore.callBuiltInFunction("greaterequal", [20, 10]), 1);
  t.is(mathCore.callBuiltInFunction("greaterequal", [10, 10]), 1);
  t.is(mathCore.callBuiltInFunction("greaterequal", [10, 20]), 0);
  t.throws(
    () => {
      mathCore.callBuiltInFunction("greaterequal", [10]);
    },
    { message: "greaterequal() expects exactly 2 numeric arguments." },
  );
});

test("callBuiltInFunction - logical operations", (t) => {
  const mathCore = new MathCore();

  // Test and function
  t.is(mathCore.callBuiltInFunction("and", [1, 1]), 1);
  t.is(mathCore.callBuiltInFunction("and", [1, 0]), 0);
  t.is(mathCore.callBuiltInFunction("and", [0, 1]), 0);
  t.is(mathCore.callBuiltInFunction("and", [0, 0]), 0);
  t.throws(
    () => {
      mathCore.callBuiltInFunction("and", [1]);
    },
    { message: "and() expects exactly 2 numeric arguments." },
  );

  // Test or function
  t.is(mathCore.callBuiltInFunction("or", [1, 1]), 1);
  t.is(mathCore.callBuiltInFunction("or", [1, 0]), 1);
  t.is(mathCore.callBuiltInFunction("or", [0, 1]), 1);
  t.is(mathCore.callBuiltInFunction("or", [0, 0]), 0);
  t.throws(
    () => {
      mathCore.callBuiltInFunction("or", [1]);
    },
    { message: "or() expects exactly 2 numeric arguments." },
  );

  // Test nand function
  t.is(mathCore.callBuiltInFunction("nand", [1, 1]), 0);
  t.is(mathCore.callBuiltInFunction("nand", [1, 0]), 1);
  t.is(mathCore.callBuiltInFunction("nand", [0, 1]), 1);
  t.is(mathCore.callBuiltInFunction("nand", [0, 0]), 1);
  t.throws(
    () => {
      mathCore.callBuiltInFunction("nand", [1]);
    },
    { message: "nand() expects exactly 2 numeric arguments." },
  );

  // Test nor function
  t.is(mathCore.callBuiltInFunction("nor", [1, 1]), 0);
  t.is(mathCore.callBuiltInFunction("nor", [1, 0]), 0);
  t.is(mathCore.callBuiltInFunction("nor", [0, 1]), 0);
  t.is(mathCore.callBuiltInFunction("nor", [0, 0]), 1);
  t.throws(
    () => {
      mathCore.callBuiltInFunction("nor", [1]);
    },
    { message: "nor() expects exactly 2 numeric arguments." },
  );

  // Test xor function
  t.is(mathCore.callBuiltInFunction("xor", [1, 1]), 0);
  t.is(mathCore.callBuiltInFunction("xor", [1, 0]), 1);
  t.is(mathCore.callBuiltInFunction("xor", [0, 1]), 1);
  t.is(mathCore.callBuiltInFunction("xor", [0, 0]), 0);
  t.throws(
    () => {
      mathCore.callBuiltInFunction("xor", [1]);
    },
    { message: "xor() expects exactly 2 numeric arguments." },
  );
});

test("callBuiltInFunction - round function", (t) => {
  const mathCore = new MathCore();

  // Test round function with different precisions
  t.is(mathCore.callBuiltInFunction("round", [Math.PI, 2]), 3.14);
  // 3.142 is the round() fixture, not a stand-in constant.
  // oxlint-disable-next-line oxc/approx-constant
  t.is(mathCore.callBuiltInFunction("round", [Math.PI, 3]), 3.142);
  t.is(mathCore.callBuiltInFunction("round", [Math.PI, 0]), 3);
  t.is(mathCore.callBuiltInFunction("round", [-Math.E, 1]), -2.7);

  // Test error case with wrong number of arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("round", [Math.PI]);
    },
    { message: "round() expects exactly 2 numeric arguments." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("round", [Math.PI, 2, 1]);
    },
    { message: "round() expects exactly 2 numeric arguments." },
  );
});

test("callBuiltInFunction - generic host functions with exactly 1 argument", (t) => {
  const mathCore = new MathCore();
  mathCore.host = createExpressionHost({
    getFileSize: (value) => (value === "test.bin" ? 1024 : 0),
    getFileStatus: (value) => (value === "test.bin" ? 1 : 0),
    isDefined: (value) => (value === "LABEL" ? 1 : 0),
    getExpressionObjectSize: (value, baseOnly = false) => {
      if (baseOnly && value === "STRUCT") {
        return 16;
      }
      if (!baseOnly && value === "OBJECT") {
        return 32;
      }
      if (!baseOnly && value === "DATA") {
        return 64;
      }
      return 0;
    },
  });

  // Test filesize function
  t.is(mathCore.callBuiltInFunction("filesize", ["test.bin"]), 1024);

  // Test getfilestatus function
  t.is(mathCore.callBuiltInFunction("getfilestatus", ["test.bin"]), 1);

  // Test defined function
  t.is(mathCore.callBuiltInFunction("defined", ["LABEL"]), 1);

  // Test sizeof function
  t.is(mathCore.callBuiltInFunction("sizeof", ["STRUCT"]), 16);

  // Test objectsize function
  t.is(mathCore.callBuiltInFunction("objectsize", ["OBJECT"]), 32);

  // Test datasize function
  t.is(mathCore.callBuiltInFunction("datasize", ["DATA"]), 64);

  // Test error cases with wrong number of arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("filesize", []);
    },
    { message: "filesize() expects exactly 1 argument." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("sizeof", ["STRUCT", "extra"]);
    },
    { message: "sizeof() expects exactly 1 argument." },
  );
});

test("callBuiltInFunction - canreadfile", (t) => {
  const mathCore = new MathCore();
  mathCore.host = createExpressionHost({
    canReadFile: (filename, pos) => (filename === "test.bin" && pos >= 0 && pos < 0x1000 ? 1 : 0),
  });

  // Test canreadfile with valid filename and position
  t.is(mathCore.callBuiltInFunction("canreadfile", ["test.bin", 100, 10]), 1);

  // Test canreadfile with invalid filename
  t.is(mathCore.callBuiltInFunction("canreadfile", ["invalid.bin", 100, 10]), 0);

  // Test canreadfile with invalid position
  t.is(mathCore.callBuiltInFunction("canreadfile", ["test.bin", 0x2000, 10]), 0);

  // Test canreadfile1, canreadfile2, canreadfile3, canreadfile4 with valid filename and position
  t.is(mathCore.callBuiltInFunction("canreadfile1", ["test.bin", 100]), 1);
  t.is(mathCore.callBuiltInFunction("canreadfile2", ["test.bin", 200]), 1);
  t.is(mathCore.callBuiltInFunction("canreadfile3", ["test.bin", 300]), 1);
  t.is(mathCore.callBuiltInFunction("canreadfile4", ["test.bin", 400]), 1);

  // Test canreadfile1, canreadfile2, canreadfile3, canreadfile4 with invalid filename
  t.is(mathCore.callBuiltInFunction("canreadfile1", ["invalid.bin", 100]), 0);
  t.is(mathCore.callBuiltInFunction("canreadfile2", ["invalid.bin", 200]), 0);
  t.is(mathCore.callBuiltInFunction("canreadfile3", ["invalid.bin", 300]), 0);
  t.is(mathCore.callBuiltInFunction("canreadfile4", ["invalid.bin", 400]), 0);

  // Test canreadfile1, canreadfile2, canreadfile3, canreadfile4 with invalid position
  t.is(mathCore.callBuiltInFunction("canreadfile1", ["test.bin", 0x2000]), 0);
  t.is(mathCore.callBuiltInFunction("canreadfile2", ["test.bin", 0x2000]), 0);
  t.is(mathCore.callBuiltInFunction("canreadfile3", ["test.bin", 0x2000]), 0);
  t.is(mathCore.callBuiltInFunction("canreadfile4", ["test.bin", 0x2000]), 0);

  // Test error cases with wrong number of arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("canreadfile", ["test.bin", 100]);
    },
    { message: "canreadfile expects exactly 3 arguments (filename, pos, num)." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("canreadfile", ["test.bin", 100, 10, 20]);
    },
    { message: "canreadfile expects exactly 3 arguments (filename, pos, num)." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("canreadfile1", ["test.bin"]);
    },
    { message: "canreadfile1() expects exactly 2 arguments." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("canreadfile2", ["test.bin", 100, 10]);
    },
    { message: "canreadfile2() expects exactly 2 arguments." },
  );

  // Test error cases with wrong argument types
  t.throws(
    () => {
      mathCore.callBuiltInFunction("canreadfile", [100, 100, 10]);
    },
    { message: "Function 'canreadfile' expected a string argument but got a number: 100" },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("canreadfile", ["test.bin", "100", 10]);
    },
    { message: "Function 'canreadfile' expected a numeric argument but got a string: 100" },
  );
});

test("callFunction - contributed canread functions", (t) => {
  const mathCore = new MathCore();
  mathCore.host = createExpressionHost({
    canReadBaseImage: (pos) => (pos >= 0 && pos < 0x1000 ? 1 : 0),
  });
  const canReadBaseImage = (args: readonly (number | string)[], size: number): number => {
    const position = args[0];
    if (typeof position !== "number") {
      throw new Error("position must be numeric");
    }
    return mathCore.host!.canReadBaseImage(position, size);
  };
  mathCore.registerExpressionFunction("canread", {
    minimumArguments: 2,
    maximumArguments: 2,
    evaluate: (args) => {
      const size = args[1];
      if (typeof size !== "number") {
        throw new Error("size must be numeric");
      }
      return canReadBaseImage(args, size);
    },
  });
  for (const size of [1, 2, 3, 4]) {
    mathCore.registerExpressionFunction(`canread${size}`, {
      minimumArguments: 1,
      maximumArguments: 1,
      evaluate: (args) => canReadBaseImage(args, size),
    });
  }

  // Test canread with valid position
  t.is(mathCore.callFunction("canread", [100, 10]), 1);

  // Test canread with invalid position
  t.is(mathCore.callFunction("canread", [0x2000, 10]), 0);

  // Test canread1, canread2, canread3, canread4 with valid positions
  t.is(mathCore.callFunction("canread1", [100]), 1);
  t.is(mathCore.callFunction("canread2", [200]), 1);
  t.is(mathCore.callFunction("canread3", [300]), 1);
  t.is(mathCore.callFunction("canread4", [400]), 1);

  // Test canread1, canread2, canread3, canread4 with invalid positions
  t.is(mathCore.callFunction("canread1", [0x2000]), 0);
  t.is(mathCore.callFunction("canread2", [0x2000]), 0);
  t.is(mathCore.callFunction("canread3", [0x2000]), 0);
  t.is(mathCore.callFunction("canread4", [0x2000]), 0);

  // Test error cases with wrong number of arguments
  t.throws(
    () => {
      mathCore.callFunction("canread", [100]);
    },
    { message: "canread() expects exactly 2 argument(s)." },
  );

  t.throws(
    () => {
      mathCore.callFunction("canread", [100, 10, 20]);
    },
    { message: "canread() expects exactly 2 argument(s)." },
  );

  t.throws(
    () => {
      mathCore.callFunction("canread1", []);
    },
    { message: "canread1() expects exactly 1 argument(s)." },
  );

  t.throws(
    () => {
      mathCore.callFunction("canread2", [100, 200]);
    },
    { message: "canread2() expects exactly 1 argument(s)." },
  );

  t.throws(
    () => {
      mathCore.callFunction("canread3", []);
    },
    { message: "canread3() expects exactly 1 argument(s)." },
  );

  t.throws(
    () => {
      mathCore.callFunction("canread4", [100, 200]);
    },
    { message: "canread4() expects exactly 1 argument(s)." },
  );
});

test("callFunction - contributed read functions", (t) => {
  const mathCore = new MathCore();
  mathCore.host = createExpressionHost({
    readBaseImage: (pos, size, defaultValue) => {
      if (pos === 0xffffff && defaultValue !== undefined) {
        return defaultValue;
      }
      return pos + size;
    },
  });
  for (const size of [1, 2, 3, 4]) {
    mathCore.registerExpressionFunction(`read${size}`, {
      minimumArguments: 1,
      maximumArguments: 2,
      evaluate: (args) => {
        const position = args[0];
        const defaultValue = args[1];
        if (typeof position !== "number" || typeof defaultValue === "string") {
          throw new Error("read arguments must be numeric");
        }
        return mathCore.host!.readBaseImage(position, size, defaultValue);
      },
    });
  }

  // Test read1, read2, read3, read4 with 1 argument
  t.is(mathCore.callFunction("read1", [10]), 11);
  t.is(mathCore.callFunction("read2", [20]), 22);
  t.is(mathCore.callFunction("read3", [30]), 33);
  t.is(mathCore.callFunction("read4", [40]), 44);

  // Test with 2 arguments (including default value)
  t.is(mathCore.callFunction("read1", [10, 99]), 11);
  t.is(mathCore.callFunction("read2", [20, 99]), 22);
  t.is(mathCore.callFunction("read3", [30, 99]), 33);
  t.is(mathCore.callFunction("read4", [40, 99]), 44);

  t.is(mathCore.callFunction("read1", [0xffffff, 99]), 99);
  t.is(mathCore.callFunction("read2", [0xffffff, 99]), 99);
  t.is(mathCore.callFunction("read3", [0xffffff, 99]), 99);
  t.is(mathCore.callFunction("read4", [0xffffff, 99]), 99);

  // Test error cases with wrong number of arguments
  t.throws(
    () => {
      mathCore.callFunction("read1", []);
    },
    { message: "read1() expects between 1 and 2 argument(s)." },
  );

  t.throws(
    () => {
      mathCore.callFunction("read2", [10, 20, 30]);
    },
    { message: "read2() expects between 1 and 2 argument(s)." },
  );

  // Test error with string argument
  t.throws(
    () => {
      mathCore.callFunction("read3", ["string"]);
    },
    { message: "read arguments must be numeric" },
  );
});

test("callBuiltInFunction - readfile", (t) => {
  const mathCore = new MathCore();
  mathCore.host = createExpressionHost({
    readFile: (filename, pos, size, defaultValue) => {
      if (filename === "test.bin") {
        return pos + size;
      }
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error("File not found");
    },
  });

  // Test readfile1, readfile2, readfile3, readfile4 with 2 arguments
  t.is(mathCore.callBuiltInFunction("readfile1", ["test.bin", 10]), 11);
  t.is(mathCore.callBuiltInFunction("readfile2", ["test.bin", 20]), 22);
  t.is(mathCore.callBuiltInFunction("readfile3", ["test.bin", 30]), 33);
  t.is(mathCore.callBuiltInFunction("readfile4", ["test.bin", 40]), 44);

  // Test with 3 arguments (including default value)
  t.is(mathCore.callBuiltInFunction("readfile1", ["test.bin", 10, 99]), 11);
  t.is(mathCore.callBuiltInFunction("readfile2", ["test.bin", 20, 99]), 22);
  t.is(mathCore.callBuiltInFunction("readfile3", ["test.bin", 30, 99]), 33);
  t.is(mathCore.callBuiltInFunction("readfile4", ["test.bin", 40, 99]), 44);

  // Test with nonexistent file but with default value
  t.is(mathCore.callBuiltInFunction("readfile1", ["nonexistent.bin", 10, 99]), 99);
  t.is(mathCore.callBuiltInFunction("readfile2", ["nonexistent.bin", 20, 99]), 99);
  t.is(mathCore.callBuiltInFunction("readfile3", ["nonexistent.bin", 30, 99]), 99);
  t.is(mathCore.callBuiltInFunction("readfile4", ["nonexistent.bin", 40, 99]), 99);

  // Test error cases with wrong number of arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("readfile1", ["test.bin"]);
    },
    { message: "readfile1 expects 2 or 3 arguments (filename, pos, [default])." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("readfile2", []);
    },
    { message: "readfile2 expects 2 or 3 arguments (filename, pos, [default])." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("readfile3", ["test.bin", 10, 20, 30]);
    },
    { message: "readfile3 expects 2 or 3 arguments (filename, pos, [default])." },
  );

  // Test error cases with wrong argument types
  t.throws(
    () => {
      mathCore.callBuiltInFunction("readfile1", [123, 10]);
    },
    { message: "Function 'readfile1' expected a string argument but got a number: 123" },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("readfile2", ["test.bin", "10"]);
    },
    { message: "Function 'readfile2' expected a numeric argument but got a string: 10" },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("readfile3", ["test.bin", 10, "20"]);
    },
    { message: "Function 'readfile3' expected a numeric argument but got a string: 20" },
  );
});

test("callBuiltInFunction - pc & realbase", (t) => {
  const mathCore = new MathCore();
  mathCore.host = createExpressionHost({
    getCurrentAddress: () => 0x8000,
    getCurrentBaseAddress: () => 0xc000,
  });

  // Test pc function
  t.is(mathCore.callBuiltInFunction("pc", []), 0x8000);

  // Test realbase function
  t.is(mathCore.callBuiltInFunction("realbase", []), 0xc000);

  // Test error cases with wrong number of arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("pc", [123]);
    },
    { message: "pc() expects no arguments." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("realbase", ["test"]);
    },
    { message: "realbase() expects no arguments." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("pc", [1, 2, 3]);
    },
    { message: "pc() expects no arguments." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("realbase", [0, "test"]);
    },
    { message: "realbase() expects no arguments." },
  );
});

test("callBuiltInFunction - unhandled", (t) => {
  const mathCore = new MathCore();

  // Test with unknown built-in function
  t.throws(
    () => {
      mathCore.callBuiltInFunction("unknownFunction", []);
    },
    { message: "Unknown built-in function 'unknownFunction'" },
  );

  mathCore.host = createExpressionHost({
    isDefined: () => 1,
  });
  t.is(mathCore.callBuiltInFunction("defined", ["LABEL"]), 1);
});

test("callBuiltInFunction - typed host routes generic file helpers", (t) => {
  const mathCore = new MathCore();
  mathCore.host = {
    resolveLabel: () => 0,
    convertLogicalToOutputOffset: (address) => address - 0x7f0000,
    convertOutputOffsetToLogical: (offset) => offset + 0x800000,
    getCurrentAddress: () => 0x808000,
    getCurrentBaseAddress: () => 0x008000,
    isDefined: (identifier) => (identifier === "LABEL" ? 1 : 0),
    getExpressionObjectSize: () => 4,
    getFileSize: () => 16,
    getFileStatus: () => 0,
    canReadFile: () => 1,
    readFile: (_filename, _position, _size, __value) => 0x34,
    canReadBaseImage: () => 1,
    readBaseImage: () => 0x12,
  };

  t.is(mathCore.callBuiltInFunction("defined", ["LABEL"]), 1);
  t.is(mathCore.callBuiltInFunction("readfile1", ["demo.bin", 0]), 0x34);
});

test("callBuiltInFunction - string comparison", (t) => {
  const mathCore = new MathCore();

  // Test stringsequal function
  t.is(mathCore.callBuiltInFunction("stringsequal", ["hello", "hello"]), 1);
  t.is(mathCore.callBuiltInFunction("stringsequal", ["hello", "Hello"]), 0);
  t.is(mathCore.callBuiltInFunction("stringsequal", ["hello", "world"]), 0);
  t.is(mathCore.callBuiltInFunction("stringsequal", ["", ""]), 1);

  // Test stringsequalnocase function
  t.is(mathCore.callBuiltInFunction("stringsequalnocase", ["hello", "hello"]), 1);
  t.is(mathCore.callBuiltInFunction("stringsequalnocase", ["hello", "Hello"]), 1);
  t.is(mathCore.callBuiltInFunction("stringsequalnocase", ["HELLO", "hello"]), 1);
  t.is(mathCore.callBuiltInFunction("stringsequalnocase", ["hello", "world"]), 0);
  t.is(mathCore.callBuiltInFunction("stringsequalnocase", ["", ""]), 1);

  // Test error cases with wrong number of arguments
  t.throws(
    () => {
      mathCore.callBuiltInFunction("stringsequal", ["hello"]);
    },
    { message: "stringsequal() expects exactly 2 string arguments." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("stringsequal", ["hello", "world", "!"]);
    },
    { message: "stringsequal() expects exactly 2 string arguments." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("stringsequalnocase", ["hello"]);
    },
    { message: "stringsequalnocase() expects exactly 2 string arguments." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("stringsequalnocase", ["hello", "world", "!"]);
    },
    { message: "stringsequalnocase() expects exactly 2 string arguments." },
  );

  // Test error cases with wrong argument types
  t.throws(
    () => {
      mathCore.callBuiltInFunction("stringsequal", [123, "hello"]);
    },
    { message: "Function 'stringsequal' expected a string argument but got a number: 123" },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("stringsequal", ["hello", 123]);
    },
    { message: "Function 'stringsequal' expected a string argument but got a number: 123" },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("stringsequalnocase", [123, "hello"]);
    },
    { message: "Function 'stringsequalnocase' expected a string argument but got a number: 123" },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("stringsequalnocase", ["hello", 123]);
    },
    { message: "Function 'stringsequalnocase' expected a string argument but got a number: 123" },
  );
});

test("callBuiltInFunction - pc, realbase", (t) => {
  const mathCore = new MathCore();

  mathCore.host = createExpressionHost({
    getCurrentAddress: () => 0x8000,
    getCurrentBaseAddress: () => 0xc00000,
  });

  // Test pc function
  t.is(mathCore.callBuiltInFunction("pc", []), 0x8000);

  // Test pc error cases
  t.throws(
    () => {
      mathCore.callBuiltInFunction("pc", ["arg"]);
    },
    { message: "pc() expects no arguments." },
  );

  // Test realbase function
  t.is(mathCore.callBuiltInFunction("realbase", []), 0xc00000);

  // Test realbase error cases
  t.throws(
    () => {
      mathCore.callBuiltInFunction("realbase", ["arg"]);
    },
    { message: "realbase() expects no arguments." },
  );
});

test("numArg", (t) => {
  const mathCore = new MathCore();

  // Test with numeric argument
  t.is(mathCore.numArg("testFunc", 42), 42);
  t.is(mathCore.numArg("testFunc", 0), 0);
  t.is(mathCore.numArg("testFunc", -10), -10);
  t.is(mathCore.numArg("testFunc", 3.14), 3.14);

  // Test with string argument (should throw error)
  t.throws(
    () => {
      mathCore.numArg("testFunc", "string");
    },
    { message: "Function 'testFunc' expected a numeric argument but got a string: string" },
  );

  t.throws(
    () => {
      mathCore.numArg("anotherFunc", "123");
    },
    { message: "Function 'anotherFunc' expected a numeric argument but got a string: 123" },
  );

  // Test with different function names
  t.throws(
    () => {
      mathCore.numArg("sin", "value");
    },
    { message: "Function 'sin' expected a numeric argument but got a string: value" },
  );
});

test("host requirement & labelResolver", (t) => {
  const mathCore = new MathCore();

  t.throws(
    () => {
      mathCore.callBuiltInFunction("sizeof", ["myStruct"]);
    },
    { message: "ExpressionHost not set." },
  );

  t.throws(
    () => {
      mathCore.callBuiltInFunction("objectsize", ["myObject"]);
    },
    { message: "ExpressionHost not set." },
  );

  mathCore.host = createExpressionHost({
    getExpressionObjectSize: (value, baseOnly = false) => {
      if (baseOnly && value === "myStruct") {
        return 42;
      }
      if (!baseOnly && value === "myObject") {
        return 24;
      }
      return 0;
    },
  });

  t.is(mathCore.callBuiltInFunction("sizeof", ["myStruct"]), 42);
  t.is(mathCore.callBuiltInFunction("objectsize", ["myObject"]), 24);
});

test("math - typed expression nodes", (t) => {
  const mathCore = new MathCore();
  mathCore.host = createExpressionHost({
    resolveLabel: (label) => {
      if (label === "LABEL") {
        return 16;
      }
      if (label === "STRUCT") {
        return "MyStruct";
      }
      throw new Error(`Unknown label: ${label}`);
    },
    isDefined: (name) => (name === "FLAG" ? 1 : 0),
  });

  t.is(mathCore.math({ type: "literal", value: "42" }), 42);
  t.is(mathCore.math({ type: "literal", value: "$10" }), 16);
  t.is(mathCore.math({ type: "literal", value: "0x10" }), 16);
  t.is(mathCore.math({ type: "literal", value: "%1010" }), 10);
  t.throws(
    () => {
      mathCore.math({ type: "literal", value: "nope" });
    },
    { message: "Unsupported literal expression: nope" },
  );

  t.is(
    mathCore.math({
      type: "unary",
      operator: "-",
      argument: { type: "literal", value: "3" },
    }),
    -3,
  );
  t.is(
    mathCore.math({
      type: "unary",
      operator: "+",
      argument: { type: "literal", value: "3" },
    }),
    3,
  );
  t.is(
    mathCore.math({
      type: "unary",
      operator: "~",
      argument: { type: "literal", value: "0" },
    }),
    ~0,
  );
  t.is(
    mathCore.math({
      type: "unary",
      operator: "<:",
      argument: { type: "literal", value: "65536" },
    }),
    1,
  );
  t.is(
    mathCore.math({
      type: "unary",
      operator: "<",
      argument: { type: "literal", value: "$1234" },
    }),
    0x34,
  );
  t.is(
    mathCore.math({
      type: "unary",
      operator: ">",
      argument: { type: "literal", value: "$1234" },
    }),
    0x12,
  );
  t.is(
    mathCore.math({
      type: "unary",
      operator: "^",
      argument: { type: "literal", value: "$123456" },
    }),
    0x12,
  );
  t.is(
    mathCore.math({
      type: "binary",
      operator: "+",
      left: { type: "literal", value: "1" },
      right: { type: "literal", value: "2" },
    }),
    3,
  );

  t.is(mathCore.math({ type: "identifier", name: "LABEL" }), 16);
  t.throws(
    () => {
      mathCore.math({ type: "defineReference", braced: true, content: "x" });
    },
    { message: "Unknown label: !{x}" },
  );
  t.throws(
    () => {
      mathCore.math({ type: "identifier", name: "STRUCT" });
    },
    { message: "Reference 'STRUCT' did not resolve to a numeric value." },
  );

  t.is(
    mathCore.math({
      type: "call",
      callee: { type: "identifier", name: "sqrt" },
      arguments: [{ type: "identifier", name: "LABEL" }],
    }),
    4,
  );
  t.is(
    mathCore.math({
      type: "call",
      callee: { type: "identifier", name: "defined" },
      arguments: [{ type: "identifier", name: "FLAG" }],
    }),
    1,
  );
  t.is(
    mathCore.math({
      type: "call",
      callee: { type: "identifier", name: "defined" },
      arguments: [{ type: "string", value: "FLAG", quote: '"' }],
    }),
    1,
  );
  t.is(
    mathCore.math({
      type: "call",
      callee: { type: "identifier", name: "defined" },
      arguments: [{ type: "sourceText", value: "FLAG" }],
    }),
    1,
  );
  t.is(
    mathCore.math({
      type: "call",
      callee: { type: "identifier", name: "defined" },
      arguments: [
        {
          type: "binary",
          operator: "+",
          left: { type: "identifier", name: "FLAG" },
          right: { type: "literal", value: "0" },
        },
      ],
    }),
    0,
  );
  t.is(
    mathCore.math({
      type: "call",
      callee: { type: "identifier", name: "sqrt" },
      arguments: [parseExpressionNode("16")],
    }),
    4,
  );
  t.is(
    mathCore.math({
      type: "call",
      callee: { type: "identifier", name: "sqrt" },
      arguments: [{ type: "literal", value: "16" }],
    }),
    4,
  );
  t.throws(
    () => {
      mathCore.math({
        type: "call",
        callee: { type: "identifier", name: "sqrt" },
        arguments: [{ type: "string", value: "16", quote: '"' }],
      });
    },
    { message: /expected a numeric argument/ },
  );
  t.throws(
    () => {
      mathCore.math({
        type: "call",
        callee: { type: "identifier", name: "sqrt" },
        arguments: [
          {
            type: "range",
            start: { type: "literal", value: "1" },
            end: { type: "literal", value: "2" },
          },
        ],
      });
    },
    { message: /expected a numeric argument/ },
  );
  t.throws(
    () => {
      mathCore.math({
        type: "call",
        callee: { type: "identifier", name: "sqrt" },
        arguments: [{ type: "defineReference", braced: true, content: "x" }],
      });
    },
    { message: /expected a numeric argument/ },
  );

  t.throws(
    () => {
      mathCore.math({ type: "string", value: "hi", quote: '"' });
    },
    { message: "String expression is not directly numeric: hi" },
  );
  t.throws(
    () => {
      mathCore.math({
        type: "range",
        start: { type: "literal", value: "1" },
        end: { type: "literal", value: "2" },
      });
    },
    { message: /Range expression is not directly numeric/ },
  );
  t.throws(() => mathCore.math({ type: "raw", value: "1+2" }), {
    message: /Raw expression nodes are not executable/,
  });

  t.is(mathCore.resolveNumericIdentifierArgument("MISSING"), "MISSING");
  t.is(mathCore.resolveNumericIdentifierArgument("STRUCT"), "STRUCT");
});

test("parsed defines and references preserve deferred host resolution across stages", (t) => {
  let value = 0;
  const host = createExpressionHost({ resolveLabel: () => value });
  const expressions = ["!Count + 3", "!{Count} * 2", "Items[1].field + !Offset", ".local + 1"];
  const parsed = new MathCore();
  parsed.host = host;
  for (const stageValue of [0, 5, 23]) {
    value = stageValue;
    for (const expression of expressions) {
      const legacy = new B11MathOracle();
      legacy.host = host;
      t.is(
        parsed.math(expression),
        legacy.evaluateStringExpression(expression),
        `${expression}: ${stageValue}`,
      );
    }
  }
});

// Definitions use the production parser; the frozen evaluator is only a differential oracle.
test("public function definitions share typed source grammar and preserve bit operations", (t) => {
  const mathCore = new MathCore();
  mathCore.parseFunctionDefinition("function highByte(value) = <:value");
  mathCore.parseFunctionDefinition("function makeAddress(bank, offset) = (bank << 16) | offset");
  t.is(mathCore.math("highByte($123456)"), 0x12);
  t.is(mathCore.math("makeAddress($7E, $1234)"), 0x7e1234);
  t.is(mathCore.math("highByte($FFFF)"), 0);
  t.is(mathCore.math("highByte(makeAddress($7E, $1234))"), 0x7e);
  t.is(mathCore.math("makeAddress(0, $FFFF)"), 0xffff);
  t.throws(() => mathCore.parseFunctionDefinition("function broken( = 1"));
});
