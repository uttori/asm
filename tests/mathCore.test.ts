import test from "ava";
import { MathCore } from "../src/mathcore.js";

test("reset - resets math core state", t => {
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

test("reset - doesn't affect built-in functions", t => {
  const mathCore = new MathCore();

  // Check that built-in functions exist before reset
  t.true(mathCore.builtInFunctions.has("sqrt"));
  t.true(mathCore.builtInFunctions.has("sin"));

  // Call reset
  mathCore.reset();

  // Verify built-in functions still exist after reset
  t.true(mathCore.builtInFunctions.has("sqrt"));
  t.true(mathCore.builtInFunctions.has("sin"));
});

test("reset - doesn't affect operators", t => {
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

test("math - basic arithmetic", t => {
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

test("math - order of operations", t => {
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

test("math - bitwise operations", t => {
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

test("math - comparison operations", t => {
  const mathCore = new MathCore();

  // Equal
  t.is(mathCore.math("5 == 5"), 1);

  t.is(mathCore.math("5 == 6"), 0);

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

test("math - logical operations", t => {
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

test("math - error cases", t => {
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

test("math - number formats", t => {
  const mathCore = new MathCore();

  // Hexadecimal (with $)
  t.is(mathCore.math("$10 + $20"), 48); // 16 + 32 = 48

  // Hexadecimal (with 0x)
  t.is(mathCore.math("0x10 + 0x20"), 48); // 16 + 32 = 48

  // Binary
  t.is(mathCore.math("%1010 + %0101"), 15); // 10 + 5 = 15

  // Decimal
  t.is(mathCore.math("10.5 + 20.5"), 31);
});

test("math - operator precedence", t => {
  const mathCore = new MathCore();

  // Test all precedence levels
  // Enable priority-based evaluation
  const result = mathCore.math("1 || 0 && 1 | 2 ^ 3 & 4 == 4 > 3 << 1 + 2 * 3 ** 2");

  // Expected: 1 || (0 && (1 | (2 ^ (3 & (4 == (4 > (3 << (1 + (2 * (3 ** 2))))))))))
  // 3**2 = 9, 2*9 = 18, 1+18 = 19, 3<<19 = 3*2^19 (large), 4>large = 0, 4==0 = 0, 3&0 = 0, 2^0 = 2, 1|2 = 3, 0&&3 = 0, 1||0 = 1
  t.is(result, 1);
});

test("math - rounding", t => {
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

test("math - complex expressions", t => {
  const mathCore = new MathCore();

  // Multiple operations with different precedence
  t.is(mathCore.math("2 ** 3 * 4 + 5 * 6 / 3 - 7"), 32 + 10 - 7); // 35

  // Complex expression with parentheses
  t.is(mathCore.math("((2 + 3) * 4 + (6 / 2)) ** 2"), 23 * 23); // 529

  // Mix of different operations
  // eslint-disable-next-line @stylistic/no-mixed-operators
  t.is(mathCore.math("10 & 7 | 4 ^ 2 + 3 * 4 / 2"), 10 & 7 | 4 ^ (2 + 6)); // 2 | 4 ^ 8 = 14
});

test("math - depth parameter", t => {
  const mathCore = new MathCore();

  // Test with different depth values
  t.is(mathCore.math("1 + 2 * 3"), 7); // Normal evaluation
});

test("math - with label resolver", t => {
  const mathCore = new MathCore();

  // Set up a mock label resolver
  mathCore.delegate = (name: string, id: string) => {
    if (id === "LABEL1") return 10;
    if (id === "LABEL2") return 20;
    throw new Error(`Unknown label: ${id}`);
  };

  // Test with labels
  t.is(mathCore.math("LABEL1 + LABEL2"), 30);

  // Test with unknown label
  t.throws(() => mathCore.math("LABEL1 + UNKNOWN_LABEL"), { message: "Unknown label: UNKNOWN_LABEL" });
});

test("math - error handling", t => {
  const mathCore = new MathCore();

  // Test division by zero
  t.throws(() => {
    mathCore.math("10 / 0");
  }, { message: "Division by zero" });

  // Test modulo by zero
  t.throws(() => {
    mathCore.math("10 % 0");
  }, { message: "Modulo by zero" });

  // Test mismatched parentheses (too many opening)
  t.throws(() => {
    mathCore.math("(10 + 5");
  }, { message: "Mismatched parentheses." });

  // Test mismatched parentheses (too many closing)
  t.throws(() => {
    mathCore.math("10 + 5)");
  }, { message: "Mismatched parentheses." });

  // Test invalid input with comma
  t.throws(() => {
    mathCore.math("10, 20");
  }, { message: "Invalid input: , 20" });

  // Test NaN result
  t.throws(() => {
    mathCore.math("0 / 0");
  }, { message: /Division by zero|Invalid number/ });
});

test("evalMath - function parsing", t => {
  const mathCore = new MathCore();

  // Test inline function definition and usage
  mathCore.str = "function double(x) = x * 2 10";
  t.is(mathCore.evalMath(), undefined);
  t.is(mathCore.str, "");
});

test("evalMath - NaN handling", t => {
  const mathCore = new MathCore();

  // Test NaN detection
  t.throws(() => {
    mathCore.str = "0 / 0";
    mathCore.evalMath();
  }, { message: /Division by zero/ });

  // Test NaN in complex expressions
  t.throws(() => {
    mathCore.str = "5 + (0 / 0)";
    mathCore.evalMath();
  }, { message: /Division by zero/ });

  // Test NaN with function calls
  t.throws(() => {
    mathCore.str = "function badMath(x) = x / 0";
    mathCore.evalMath();
    mathCore.str = "badMath(10)";
    mathCore.evalMath();
  }, { message: /Division by zero/ });

  // Test NaN with built-in functions
  t.throws(() => {
    mathCore.str = "sqrt(-1)";
    mathCore.evalMath();
  }, { message: "sqrt returned NaN for argument -1" });
});

test("evalMath - depth and operator precedence", t => {
  const mathCore = new MathCore();

  // Test basic operator precedence
  mathCore.str = "2 + 3 * 4";
  t.is(mathCore.evalMath(), 14);
  t.is(mathCore.str, "");

  // Test with parentheses changing precedence
  mathCore.str = "(2 + 3) * 4";
  t.is(mathCore.evalMath(), 20);
  t.is(mathCore.str, "");

  // Test with nested parentheses
  mathCore.str = "2 * (3 + (4 - 1))";
  t.is(mathCore.evalMath(), 12);
  t.is(mathCore.str, "");

  // Test with multiple operators of same precedence
  mathCore.str = "10 - 5 - 2";
  t.is(mathCore.evalMath(), 3);
  t.is(mathCore.str, "");

  // Test with stopChar parameter
  mathCore.str = "5 + 10)";
  t.is(mathCore.evalMath(0, ")"), 15);
  t.is(mathCore.str, ")");
});

test("evalMath - math_round behavior", t => {
  const mathCore = new MathCore();

  // Test without math_round
  mathCore.math_round = false;
  mathCore.str = "5 / 2";
  t.is(mathCore.evalMath(), 2.5);
  t.is(mathCore.str, "");

  // Test with math_round
  mathCore.math_round = true;
  mathCore.str = "5 / 2";
  t.is(mathCore.evalMath(), 2);
  t.is(mathCore.str, "");

  // Test with negative numbers
  mathCore.math_round = true;
  mathCore.str = "-5 / 2";
  t.is(mathCore.evalMath(), -2);
  t.is(mathCore.str, "");

  // Test with complex expression
  mathCore.math_round = true;
  mathCore.str = "10 / 3 + 2.7";
  t.is(mathCore.evalMath(), 5);
  t.is(mathCore.str, "");
});

test("peekNextOperator - returns null for empty string", t => {
  const mathCore = new MathCore();
  mathCore.str = "";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), null);
});

test("peekNextOperator - matches two-character operators", t => {
  const mathCore = new MathCore();

  // Test two-character operators
  mathCore.str = "** 5";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "**");

  mathCore.str = "<< 8";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "<<");

  mathCore.str = ">> 2";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), ">>");

  mathCore.str = "<= 10";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "<=");

  mathCore.str = ">= 20";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), ">=");

  mathCore.str = "== 30";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "==");

  mathCore.str = "!= 40";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "!=");

  mathCore.str = "&& true";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "&&");

  mathCore.str = "|| false";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "||");
});

test("peekNextOperator - matches single-character operators", t => {
  const mathCore = new MathCore();

  // Test single-character operators
  mathCore.str = "+ 5";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "+");

  mathCore.str = "- 10";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "-");

  mathCore.str = "* 15";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "*");

  mathCore.str = "/ 20";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "/");

  mathCore.str = "% 25";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "%");

  mathCore.str = "< 30";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "<");

  mathCore.str = "> 35";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), ">");

  mathCore.str = "& 40";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "&");

  mathCore.str = "| 45";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "|");

  mathCore.str = "^ 50";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "^");
});

test("peekNextOperator - respects depth parameter", t => {
  const mathCore = new MathCore();

  // Test depth parameter
  // + has priority 4, so it should match when depth <= 2
  mathCore.str = "+ 5";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "+");
  t.is(mathCore.peekNextOperator(mathCore.operators, 1), "+");
  t.is(mathCore.peekNextOperator(mathCore.operators, 2), "+");
  t.is(mathCore.peekNextOperator(mathCore.operators, 4), "+");
  t.is(mathCore.peekNextOperator(mathCore.operators, 5), null);

  // * has priority 5, so it should match when depth <= 5
  mathCore.str = "* 10";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "*");
  t.is(mathCore.peekNextOperator(mathCore.operators, 5), "*");
  t.is(mathCore.peekNextOperator(mathCore.operators, 6), null);

  // ** has priority 4, so it should match when depth <= 4
  mathCore.str = "** 15";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "**");
  t.is(mathCore.peekNextOperator(mathCore.operators, 4), "**");
  t.is(mathCore.peekNextOperator(mathCore.operators, 6), "**");
});

test("peekNextOperator - handles whitespace correctly", t => {
  const mathCore = new MathCore();

  // Test with whitespace
  mathCore.str = "  +  5";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "+");

  mathCore.str = "\t*\n10";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), "*");
});

test("peekNextOperator - returns null for non-operators", t => {
  const mathCore = new MathCore();

  // Test with non-operators
  mathCore.str = "abc";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), null);

  mathCore.str = "123";
  t.is(mathCore.peekNextOperator(mathCore.operators, 0), null);
});

test("consumeWhile - consumes digits", t => {
  const mathCore = new MathCore();

  mathCore.str = "123abc";
  t.is(mathCore.consumeWhile(/\d/), "123");
  t.is(mathCore.str, "abc");

  mathCore.str = "456";
  t.is(mathCore.consumeWhile(/\d/), "456");
  t.is(mathCore.str, "");

  mathCore.str = "abc123";
  t.is(mathCore.consumeWhile(/\d/), "");
  t.is(mathCore.str, "abc123");
});

test("consumeWhile - consumes alphanumeric characters", t => {
  const mathCore = new MathCore();

  mathCore.str = "abc123!@#";
  t.is(mathCore.consumeWhile(/[\dA-Za-z]/), "abc123");
  t.is(mathCore.str, "!@#");

  mathCore.str = "XYZ_123";
  t.is(mathCore.consumeWhile(/[\dA-Za-z]/), "XYZ");
  t.is(mathCore.str, "_123");
});

test("consumeWhile - consumes hexadecimal digits", t => {
  const mathCore = new MathCore();

  mathCore.str = "1A2B3C!";
  t.is(mathCore.consumeWhile(/[\dA-Fa-f]/), "1A2B3C");
  t.is(mathCore.str, "!");

  mathCore.str = "DEADBEEF";
  t.is(mathCore.consumeWhile(/[\dA-Fa-f]/), "DEADBEEF");
  t.is(mathCore.str, "");

  mathCore.str = "DEADZORK";
  t.is(mathCore.consumeWhile(/[\dA-Fa-f]/), "DEAD");
  t.is(mathCore.str, "ZORK");
});

test("consumeWhile - handles empty strings", t => {
  const mathCore = new MathCore();

  mathCore.str = "";
  t.is(mathCore.consumeWhile(/\d/), "");
  t.is(mathCore.str, "");
});

test("consumeWhile - handles whitespace", t => {
  const mathCore = new MathCore();

  mathCore.str = "  \t\n123";
  t.is(mathCore.consumeWhile(/\s/), "  \t\n");
  t.is(mathCore.str, "123");
});

test("consumeWhile - handles special characters", t => {
  const mathCore = new MathCore();

  mathCore.str = "!@#$%^abc";
  t.is(mathCore.consumeWhile(/[!#$%&()*@^]/), "!@#$%^");
  t.is(mathCore.str, "abc");
});

test("consumeWhile - handles mixed patterns", t => {
  const mathCore = new MathCore();

  mathCore.str = "a1b2c3!@#";
  t.is(mathCore.consumeWhile(/[\da-z]/), "a1b2c3");
  t.is(mathCore.str, "!@#");

  mathCore.str = "123ABC_xyz";
  t.is(mathCore.consumeWhile(/[\dA-Za-z]/), "123ABC");
  t.is(mathCore.str, "_xyz");
});

test("consumeWhile - handles complex regex patterns", t => {
  const mathCore = new MathCore();

  // Test with a more complex regex that might be used in parsing
  mathCore.str = "var_123 = 456";
  t.is(mathCore.consumeWhile(/[A-Z_a-z]\w*/), "var_");
  t.is(mathCore.str, "123 = 456");
});

test("getnum - basic numeric parsing", t => {
  const mathCore = new MathCore();

  // Test decimal numbers
  mathCore.str = "123";
  t.is(mathCore.getnum(), 123);
  t.is(mathCore.str, "");

  // Test decimal with decimal point
  mathCore.str = "123.45";
  t.is(mathCore.getnum(), 123.45);
  t.is(mathCore.str, "");

  // Test hexadecimal with $ prefix
  mathCore.str = "$ABCD";
  t.is(mathCore.getnum(), 0xABCD);
  t.is(mathCore.str, "");

  // Test hexadecimal with 0x prefix
  mathCore.str = "0xDEAD";
  t.is(mathCore.getnum(), 0xDEAD);
  t.is(mathCore.str, "");

  // Test binary with % prefix
  mathCore.str = "%1010";
  t.is(mathCore.getnum(), 10);
  t.is(mathCore.str, "");
});

test("getnum - sign operators", t => {
  const mathCore = new MathCore();

  // Test negative numbers
  mathCore.str = "-123";
  t.is(mathCore.getnum(), -123);
  t.is(mathCore.str, "");

  // Test positive sign
  mathCore.str = "+456";
  t.is(mathCore.getnum(), 456);
  t.is(mathCore.str, "");
});

test("getnum - bitshift operator", t => {
  const mathCore = new MathCore();

  // Test bitshift operator <:
  mathCore.str = "<:$ABCD";
  t.is(mathCore.getnum(), 0xABCD >>> 16);
  t.is(mathCore.str, "");

  // Test bitshift with decimal
  mathCore.str = "<:65535";
  t.is(mathCore.getnum(), 65535 >>> 16);
  t.is(mathCore.str, "");

  // Test bitshift with negative number
  mathCore.str = "<:-65535";
  t.is(mathCore.getnum(), -65535 >>> 16);
  t.is(mathCore.str, "");

  // Test bitshift with parentheses
  mathCore.str = "<:(65535 + 1)";
  t.is(mathCore.getnum(), 65536 >>> 16);
  t.is(mathCore.str, "");

  // Test bitshift with hex 0x prefix
  mathCore.str = "<:0xFFFF";
  t.is(mathCore.getnum(), 0xFFFF >>> 16);
  t.is(mathCore.str, "");

  // Test bitshift with binary
  mathCore.str = "<:%1111111111111111";
  t.is(mathCore.getnum(), 0xFFFF >>> 16);
  t.is(mathCore.str, "");
});

test("getnum - bitwise NOT operator", t => {
  const mathCore = new MathCore();

  // Test bitwise NOT operator ~
  mathCore.str = "~0";
  t.is(mathCore.getnum(), -1);
  t.is(mathCore.str, "");

  // Test bitwise NOT with decimal
  mathCore.str = "~10";
  t.is(mathCore.getnum(), ~10);
  t.is(mathCore.str, "");

  // Test bitwise NOT with hex
  mathCore.str = "~$FF";
  t.is(mathCore.getnum(), ~0xFF);
  t.is(mathCore.str, "");

  // Test bitwise NOT with parentheses
  mathCore.str = "~(10 + 5)";
  t.is(mathCore.getnum(), ~15);
  t.is(mathCore.str, "");
});

test("getnum - parentheses", t => {
  const mathCore = new MathCore();

  // Test simple parentheses
  mathCore.str = "(123)";
  t.is(mathCore.getnum(), 123);
  t.is(mathCore.str, "");

  // Test nested parentheses
  mathCore.str = "((456))";
  t.is(mathCore.getnum(), 456);
  t.is(mathCore.str, "");

  // Test parentheses with operators
  mathCore.str = "-(10+5)";
  t.is(mathCore.getnum(), -15);
  t.is(mathCore.str, "");

  // Test mismatched parentheses
  mathCore.str = "(123";
  t.throws(() => {
    mathCore.getnum();
  }, { message: "Mismatched parentheses." });
});

test("getnum - struct functions with bitwise operators", t => {
  const mathCore = new MathCore();

  // Setup delegate for sizeof and objectsize
  mathCore.delegate = (operation: string, value: string): number => {
    if (operation === "sizeof" && value === "MyStruct") {
      return 24;
    }
    if (operation === "objectsize" && value === "MyObject") {
      return 48;
    }
    return 0;
  };

  // Test sizeof with identifier
  t.is(mathCore.math("sizeof(MyStruct)"), 24);
  t.is(mathCore.str, "");

  // Test sizeof with quoted string
  t.is(mathCore.math("sizeof(\"MyStruct\")"), 24);
  t.is(mathCore.str, "");

  // Test objectsize
  t.is(mathCore.math("objectsize(MyObject)"), 48);
  t.is(mathCore.str, "");

  // Test sizeof with bitwise operations
  t.is(mathCore.math("sizeof(MyStruct) & 15"), 8);  // 24 & 15 = 8
  t.is(mathCore.str, "");

  // Test objectsize with bitwise operations
  t.is(mathCore.math("objectsize(MyObject) | 3"), 51);  // 48 | 3 = 51
  t.is(mathCore.str, "");

  // Test bitwise XOR with struct functions
  t.is(mathCore.math("sizeof(MyStruct) ^ objectsize(MyObject)"), 24 ^ 48);
  t.is(mathCore.str, "");

  // Test bitwise shifts with struct functions
  t.is(mathCore.math("sizeof(MyStruct) << 1"), 48);  // 24 << 1 = 48
  t.is(mathCore.str, "");

  t.is(mathCore.math("objectsize(MyObject) >> 2"), 12);  // 48 >> 2 = 12
  t.is(mathCore.str, "");

  // Test <: prefix operator with sizeof
  t.is(mathCore.math("<:sizeof(MyStruct)"), 24 >>> 16);
  t.is(mathCore.str, "");

  // Test <: prefix operator with objectsize
  t.is(mathCore.math("<:objectsize(MyObject)"), 48 >>> 16);
  t.is(mathCore.str, "");

  // Test error cases
  t.throws(() => {
    mathCore.math("sizeof(MyStruct");
  }, { message: "Missing closing ')' in sizeof call." });

  t.throws(() => {
    mathCore.math("sizeof(\"MyStruct");
  }, { message: "Missing closing double quote in sizeof call." });
});

test("getnum - function calls", t => {
  const mathCore = new MathCore();

  // Test built-in math functions
  mathCore.str = "sqrt(16)";
  t.is(mathCore.getnum(), 4);
  t.is(mathCore.str, "");

  // Test built-in math functions
  mathCore.str = "<:max(16, 160000)";
  t.is(mathCore.getnum(), 2);
  t.is(mathCore.str, "");

  // Test function with multiple arguments
  mathCore.str = "min(10, 5, 20)";
  t.is(mathCore.getnum(), 5);
  t.is(mathCore.str, "");

  // Test function with string argument
  mathCore.str = "stringsequal(\"hello\", \"hello\")";
  t.is(mathCore.getnum(), 1);
  t.is(mathCore.str, "");

  // Test function with expression arguments
  mathCore.str = "max(5+5, 8*2)";
  t.is(mathCore.getnum(), 16);
  t.is(mathCore.str, "");

  // Test function with trailing content
  mathCore.str = "sqrt(25) + 10";
  t.is(mathCore.getnum(), 5);
  t.is(mathCore.str, "+ 10");

  // Test error cases
  mathCore.str = "sqrt(25";
  t.throws(() => {
    mathCore.getnum();
  }, { message: "Expected \',\' or \')\' in function call arguments: " });

  mathCore.str = "sqrt(,)";
  t.throws(() => {
    mathCore.getnum();
  }, { message: "Invalid number: ,)" });
});

test("getnum - identifier resolution", t => {
  const mathCore = new MathCore();

  // Setup delegate for resolveLabel
  mathCore.delegate = (operation: string, value: string): number | string => {
    if (operation === "resolveLabel") {
      if (value === "LABEL1") return 100;
      if (value === "STRUCT_NAME") return "MyStruct"; // Return string for struct names
      return 0;
    }
    return 0;
  };

  // Test label resolution
  mathCore.str = "LABEL1";
  t.is(mathCore.getnum(), 100);
  t.is(mathCore.str, "");

  // Test struct name resolution (returns string)
  mathCore.str = "STRUCT_NAME";
  t.is(mathCore.getnum(), "MyStruct" as unknown as number);
  t.is(mathCore.str, "");

  // Test invalid number
  mathCore.str = "@invalid";
  t.throws(() => {
    mathCore.getnum();
  }, { message: "Invalid number: @invalid" });
});

test("getnum - user-defined functions", t => {
  const mathCore = new MathCore();

  // Define a user function
  mathCore.userFunctions.set("double", { args: ["x"], content: "x * 2" });
  mathCore.userFunctions.set("add", { args: ["a", "b"], content: "a + b" });

  // Test user function call
  mathCore.str = "double(5)";
  t.is(mathCore.getnum(), 10);
  t.is(mathCore.str, "");

  // Test user function with multiple args
  mathCore.str = "add(10, 20)";
  t.is(mathCore.getnum(), 30);
  t.is(mathCore.str, "");

  // Test user function with expressions
  mathCore.str = "double(3+2)";
  t.is(mathCore.getnum(), 10);
  t.is(mathCore.str, "");

  // Test nested function calls
  mathCore.str = "double(add(3, 7))";
  t.is(mathCore.getnum(), 20);
  t.is(mathCore.str, "");
});

test("parseStringLiteral - basic functionality", t => {
  const mathCore = new MathCore();

  // Test basic string parsing
  mathCore.str = "\"hello world\"";
  t.is(mathCore.parseStringLiteral(), "hello world");
  t.is(mathCore.str, "");

  // Test with trailing content
  mathCore.str = "\"test string\" + other content";
  t.is(mathCore.parseStringLiteral(), "test string");
  t.is(mathCore.str, "+ other content");

  // Test with empty string
  mathCore.str = "\"\"";
  t.is(mathCore.parseStringLiteral(), "");
  t.is(mathCore.str, "");

  // Test with whitespace
  mathCore.str = "\"  spaced  \"  ";
  t.is(mathCore.parseStringLiteral(), "  spaced  ");
  t.is(mathCore.str, "");
});

test("parseStringLiteral - error handling", t => {
  const mathCore = new MathCore();

  // Test with unterminated string
  mathCore.str = "\"unterminated string";
  t.throws(() => {
    mathCore.parseStringLiteral();
  }, { message: "Unterminated string literal in function call." });

  // Test with empty input
  mathCore.str = "";
  t.throws(() => {
    mathCore.parseStringLiteral();
  }, { message: /unterminated string literal|cannot read property/i });
});

test("parseStringLiteral - special characters", t => {
  const mathCore = new MathCore();

  // Test with special characters
  mathCore.str = "\"!@#$%^&*()_+\"";
  t.is(mathCore.parseStringLiteral(), "!@#$%^&*()_+");
  t.is(mathCore.str, "");

  // Test with numbers
  mathCore.str = "\"12345\"";
  t.is(mathCore.parseStringLiteral(), "12345");
  t.is(mathCore.str, "");

  // Test with mixed content
  mathCore.str = "\"abc123!@#\"";
  t.is(mathCore.parseStringLiteral(), "abc123!@#");
  t.is(mathCore.str, "");
});

test("callFunction - dispatches to user functions", t => {
  const mathCore = new MathCore();

  // Set up a user function
  mathCore.userFunctions.set("double", { args: ["x"], content: "x * 2" });

  // Test that callFunction correctly dispatches to user function
  t.is(mathCore.callFunction("double", [5]), 10);
  t.is(mathCore.callFunction("double", [0]), 0);
  t.is(mathCore.callFunction("double", [-3]), -6);
});

test("callFunction - dispatches to built-in functions", t => {
  const mathCore = new MathCore();

  // Test with some built-in math functions
  t.is(mathCore.callFunction("sqrt", [16]), 4);
  t.is(mathCore.callFunction("min", [5, 3, 8]), 3);
  t.is(mathCore.callFunction("max", [5, 3, 8]), 8);
  t.is(mathCore.callFunction("clamp", [15, 0, 10]), 10);
});

test("callFunction - handles string arguments for appropriate functions", t => {
  const mathCore = new MathCore();

  // Mock the delegate method for testing
  mathCore.delegate = (name: string): number => {
    if (name === "defined") {
      return 1; // Simulate that the symbol is defined
    }
    return 0;
  };

  // Test with a function that can accept string arguments
  t.is(mathCore.callFunction("defined", ["some_symbol"]), 1);
});

test("callFunction - throws error for invalid function", t => {
  const mathCore = new MathCore();

  // Test with non-existent function
  t.throws(() => {
    mathCore.callFunction("nonexistent", [1, 2]);
  }, { message: "Unknown built-in function 'nonexistent'" });
});

test("callUserFunction - basic functionality", t => {
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

test("callUserFunction - complex expressions", t => {
  const mathCore = new MathCore();

  // Set up functions with more complex expressions
  mathCore.userFunctions.set("square", { args: ["x"], content: "x * x" });
  mathCore.userFunctions.set("polynomial", { args: ["x", "y"], content: "3*x*x + 2*y - 5" });

  // Test the functions
  t.is(mathCore.callUserFunction("square", [4]), 16);
  t.is(mathCore.callUserFunction("polynomial", [2, 3]), 3*4 + 2*3 - 5); // 3*2^2 + 2*3 - 5 = 12 + 6 - 5 = 13
});

test("callUserFunction - extra arguments", t => {
  const mathCore = new MathCore();

  // Set up a function
  mathCore.userFunctions.set("sum", { args: ["a", "b"], content: "a + b" });

  // Test with extra arguments (should ignore extras)
  t.is(mathCore.callUserFunction("sum", [1, 2, 3, 4]), 3);
});

test("callUserFunction - error cases", t => {
  const mathCore = new MathCore();

  // Set up a function
  mathCore.userFunctions.set("multiply", { args: ["a", "b"], content: "a * b" });

  // Test function not found
  t.throws(() => {
    mathCore.callUserFunction("nonexistent", [1, 2]);
  }, { message: "User function 'nonexistent' not found." });

  // Test insufficient arguments
  t.throws(() => {
    mathCore.callUserFunction("multiply", [5]);
  }, { message: "Function 'multiply' expects at least 2 argument(s)." });

  // Test string arguments
  t.throws(() => {
    mathCore.callUserFunction("multiply", [5, "string"]);
  }, { message: "User function 'multiply' got string argument for param 'b', expected number." });
});

test("callUserFunction - nested expressions", t => {
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

test("callUserFunction - parameter substitution", t => {
  const mathCore = new MathCore();

  // Test that parameters are correctly substituted
  mathCore.userFunctions.set("paramTest", {
    args: ["value", "multiplier"],
    content: "value * multiplier + value"
  });

  // Should substitute 'value' with 10 and 'multiplier' with 3
  t.is(mathCore.callUserFunction("paramTest", [10, 3]), 10 * 3 + 10); // 40

  // Test with parameter names that could be substrings of others
  mathCore.userFunctions.set("substrTest", {
    args: ["a", "aa"],
    content: "a + aa"
  });

  // Should correctly distinguish between 'a' and 'aa'
  t.is(mathCore.callUserFunction("substrTest", [5, 10]), 15);
});

test("callBuiltInFunction - JavaScript Math", t => {
  const mathCore = new MathCore();

  // Test square root function
  t.is(mathCore.callBuiltInFunction("sqrt", [9]), 3);
  t.is(mathCore.callBuiltInFunction("sqrt", [2]), Math.sqrt(2));

  // Test trigonometric functions
  t.is(mathCore.callBuiltInFunction("sin", [Math.PI/2]), 1);
  t.is(mathCore.callBuiltInFunction("cos", [0]), 1);
  // Use approximately equal for floating point comparison
  t.true(Math.abs(mathCore.callBuiltInFunction("tan", [Math.PI/4]) - 1) < 0.0000001);

  // Test inverse trigonometric functions
  t.is(mathCore.callBuiltInFunction("asin", [1]), Math.PI/2);
  t.is(mathCore.callBuiltInFunction("acos", [1]), 0);
  t.is(mathCore.callBuiltInFunction("atan", [1]), Math.PI/4);

  // Test alternative names for inverse trigonometric functions
  t.is(mathCore.callBuiltInFunction("arcsin", [1]), Math.PI/2);
  t.is(mathCore.callBuiltInFunction("arccos", [1]), 0);
  t.is(mathCore.callBuiltInFunction("arctan", [1]), Math.PI/4);

  // Test logarithmic functions
  t.is(mathCore.callBuiltInFunction("log", [Math.E]), 1);
  t.is(mathCore.callBuiltInFunction("log10", [100]), 2);
  t.is(mathCore.callBuiltInFunction("log2", [8]), 3);

  // Test rounding functions
  t.is(mathCore.callBuiltInFunction("ceil", [3.2]), 4);
  t.is(mathCore.callBuiltInFunction("floor", [3.8]), 3);

  // Test error cases
  t.throws(() => {
    mathCore.callBuiltInFunction("sqrt", [-1]);
  }, { message: "sqrt returned NaN for argument -1" });

  t.throws(() => {
    mathCore.callBuiltInFunction("sqrt", [1, 2]);
  }, { message: "sqrt expects exactly 1 numeric argument." });

  t.throws(() => {
    mathCore.callBuiltInFunction("sin", ["not a number"]);
  }, { message: "Function 'sin' expected a numeric argument but got a string: not a number" });
});

test("callBuiltInFunction - min function", t => {
  const mathCore = new MathCore();

  // Test with two arguments
  t.is(mathCore.callBuiltInFunction("min", [5, 3]), 3);
  t.is(mathCore.callBuiltInFunction("min", [0, 10]), 0);
  t.is(mathCore.callBuiltInFunction("min", [-5, 5]), -5);

  // Test with more than two arguments
  t.is(mathCore.callBuiltInFunction("min", [5, 3, 7]), 3);
  t.is(mathCore.callBuiltInFunction("min", [10, 20, 5, 15]), 5);

  // Test error case with less than two arguments
  t.throws(() => {
    mathCore.callBuiltInFunction("min", [5]);
  }, { message: "min() expects at least 2 numeric arguments." });
});

test("callBuiltInFunction - max function", t => {
  const mathCore = new MathCore();

  // Test with two arguments
  t.is(mathCore.callBuiltInFunction("max", [5, 3]), 5);
  t.is(mathCore.callBuiltInFunction("max", [0, 10]), 10);
  t.is(mathCore.callBuiltInFunction("max", [-5, 5]), 5);

  // Test with more than two arguments
  t.is(mathCore.callBuiltInFunction("max", [5, 3, 7]), 7);
  t.is(mathCore.callBuiltInFunction("max", [10, 20, 5, 15]), 20);

  // Test error case with less than two arguments
  t.throws(() => {
    mathCore.callBuiltInFunction("max", [5]);
  }, { message: "max() expects at least 2 numeric arguments." });
});

test("callBuiltInFunction - clamp function", t => {
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
  t.throws(() => {
    mathCore.callBuiltInFunction("clamp", [5, 0]);
  }, { message: "clamp() expects exactly 3 numeric arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("clamp", [5, 0, 10, 15]);
  }, { message: "clamp() expects exactly 3 numeric arguments." });
});

test("callBuiltInFunction - safediv function", t => {
  const mathCore = new MathCore();

  // Test normal division
  t.is(mathCore.callBuiltInFunction("safediv", [10, 2, 1]), 5);
  t.is(mathCore.callBuiltInFunction("safediv", [7, 2, 1]), 3.5);

  // Test division by zero with default value
  t.is(mathCore.callBuiltInFunction("safediv", [10, 0, 999]), 999);

  // Test error case with wrong number of arguments
  t.throws(() => {
    mathCore.callBuiltInFunction("safediv", [10]);
  }, { message: "safediv() expects exactly 3 numeric arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("safediv", [10, 2, 0, 5]);
  }, { message: "safediv() expects exactly 3 numeric arguments." });
});

test("callBuiltInFunction - select function", t => {
  const mathCore = new MathCore();

  // Test with condition true (non-zero)
  t.is(mathCore.callBuiltInFunction("select", [1, 10, 20]), 10);
  t.is(mathCore.callBuiltInFunction("select", [42, 10, 20]), 10);

  // Test with condition false (zero)
  t.is(mathCore.callBuiltInFunction("select", [0, 10, 20]), 20);

  // Test error case with wrong number of arguments
  t.throws(() => {
    mathCore.callBuiltInFunction("select", [1, 10]);
  }, { message: "select() expects exactly 3 numeric arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("select", [1, 10, 20, 30]);
  }, { message: "select() expects exactly 3 numeric arguments." });
});

test("callBuiltInFunction - not function", t => {
  const mathCore = new MathCore();

  // Test with truthy values
  t.is(mathCore.callBuiltInFunction("not", [1]), 0);
  t.is(mathCore.callBuiltInFunction("not", [42]), 0);

  // Test with falsy value
  t.is(mathCore.callBuiltInFunction("not", [0]), 1);

  // Test error case with wrong number of arguments
  t.throws(() => {
    mathCore.callBuiltInFunction("not", []);
  }, { message: "not() expects exactly 1 numeric argument." });

  t.throws(() => {
    mathCore.callBuiltInFunction("not", [0, 1]);
  }, { message: "not() expects exactly 1 numeric argument." });
});

test("callBuiltInFunction - bank function", t => {
  const mathCore = new MathCore();

  // Test with various addresses
  t.is(mathCore.callBuiltInFunction("bank", [0x7E0000]), 0x7E);
  t.is(mathCore.callBuiltInFunction("bank", [0x008000]), 0x00);
  t.is(mathCore.callBuiltInFunction("bank", [0x1A8000]), 0x1A);

  // Test error case with wrong number of arguments
  t.throws(() => {
    mathCore.callBuiltInFunction("bank", []);
  }, { message: "bank() expects exactly 1 numeric argument." });

  t.throws(() => {
    mathCore.callBuiltInFunction("bank", [0x7E0000, 0x008000]);
  }, { message: "bank() expects exactly 1 numeric argument." });
});

test("callBuiltInFunction - comparison", t => {
  const mathCore = new MathCore();

  // Test equal function
  t.is(mathCore.callBuiltInFunction("equal", [10, 10]), 1);
  t.is(mathCore.callBuiltInFunction("equal", [10, 20]), 0);
  t.throws(() => {
    mathCore.callBuiltInFunction("equal", [10]);
  }, { message: "equal() expects exactly 2 numeric arguments." });

  // Test notequal function
  t.is(mathCore.callBuiltInFunction("notequal", [10, 10]), 0);
  t.is(mathCore.callBuiltInFunction("notequal", [10, 20]), 1);
  t.throws(() => {
    mathCore.callBuiltInFunction("notequal", [10]);
  }, { message: "notequal() expects exactly 2 numeric arguments." });

  // Test less function
  t.is(mathCore.callBuiltInFunction("less", [10, 20]), 1);
  t.is(mathCore.callBuiltInFunction("less", [20, 10]), 0);
  t.is(mathCore.callBuiltInFunction("less", [10, 10]), 0);
  t.throws(() => {
    mathCore.callBuiltInFunction("less", [10]);
  }, { message: "less() expects exactly 2 numeric arguments." });

  // Test lessequal function
  t.is(mathCore.callBuiltInFunction("lessequal", [10, 20]), 1);
  t.is(mathCore.callBuiltInFunction("lessequal", [10, 10]), 1);
  t.is(mathCore.callBuiltInFunction("lessequal", [20, 10]), 0);
  t.throws(() => {
    mathCore.callBuiltInFunction("lessequal", [10]);
  }, { message: "lessequal() expects exactly 2 numeric arguments." });

  // Test greater function
  t.is(mathCore.callBuiltInFunction("greater", [20, 10]), 1);
  t.is(mathCore.callBuiltInFunction("greater", [10, 20]), 0);
  t.is(mathCore.callBuiltInFunction("greater", [10, 10]), 0);
  t.throws(() => {
    mathCore.callBuiltInFunction("greater", [10]);
  }, { message: "greater() expects exactly 2 numeric arguments." });

  // Test greaterequal function
  t.is(mathCore.callBuiltInFunction("greaterequal", [20, 10]), 1);
  t.is(mathCore.callBuiltInFunction("greaterequal", [10, 10]), 1);
  t.is(mathCore.callBuiltInFunction("greaterequal", [10, 20]), 0);
  t.throws(() => {
    mathCore.callBuiltInFunction("greaterequal", [10]);
  }, { message: "greaterequal() expects exactly 2 numeric arguments." });
});

test("callBuiltInFunction - logical operations", t => {
  const mathCore = new MathCore();

  // Test and function
  t.is(mathCore.callBuiltInFunction("and", [1, 1]), 1);
  t.is(mathCore.callBuiltInFunction("and", [1, 0]), 0);
  t.is(mathCore.callBuiltInFunction("and", [0, 1]), 0);
  t.is(mathCore.callBuiltInFunction("and", [0, 0]), 0);
  t.throws(() => {
    mathCore.callBuiltInFunction("and", [1]);
  }, { message: "and() expects exactly 2 numeric arguments." });

  // Test or function
  t.is(mathCore.callBuiltInFunction("or", [1, 1]), 1);
  t.is(mathCore.callBuiltInFunction("or", [1, 0]), 1);
  t.is(mathCore.callBuiltInFunction("or", [0, 1]), 1);
  t.is(mathCore.callBuiltInFunction("or", [0, 0]), 0);
  t.throws(() => {
    mathCore.callBuiltInFunction("or", [1]);
  }, { message: "or() expects exactly 2 numeric arguments." });

  // Test nand function
  t.is(mathCore.callBuiltInFunction("nand", [1, 1]), 0);
  t.is(mathCore.callBuiltInFunction("nand", [1, 0]), 1);
  t.is(mathCore.callBuiltInFunction("nand", [0, 1]), 1);
  t.is(mathCore.callBuiltInFunction("nand", [0, 0]), 1);
  t.throws(() => {
    mathCore.callBuiltInFunction("nand", [1]);
  }, { message: "nand() expects exactly 2 numeric arguments." });

  // Test nor function
  t.is(mathCore.callBuiltInFunction("nor", [1, 1]), 0);
  t.is(mathCore.callBuiltInFunction("nor", [1, 0]), 0);
  t.is(mathCore.callBuiltInFunction("nor", [0, 1]), 0);
  t.is(mathCore.callBuiltInFunction("nor", [0, 0]), 1);
  t.throws(() => {
    mathCore.callBuiltInFunction("nor", [1]);
  }, { message: "nor() expects exactly 2 numeric arguments." });

  // Test xor function
  t.is(mathCore.callBuiltInFunction("xor", [1, 1]), 0);
  t.is(mathCore.callBuiltInFunction("xor", [1, 0]), 1);
  t.is(mathCore.callBuiltInFunction("xor", [0, 1]), 1);
  t.is(mathCore.callBuiltInFunction("xor", [0, 0]), 0);
  t.throws(() => {
    mathCore.callBuiltInFunction("xor", [1]);
  }, { message: "xor() expects exactly 2 numeric arguments." });
});

test("callBuiltInFunction - round function", t => {
  const mathCore = new MathCore();

  // Test round function with different precisions
  t.is(mathCore.callBuiltInFunction("round", [3.14159, 2]), 3.14);
  t.is(mathCore.callBuiltInFunction("round", [3.14159, 3]), 3.142);
  t.is(mathCore.callBuiltInFunction("round", [3.14159, 0]), 3);
  t.is(mathCore.callBuiltInFunction("round", [-2.718, 1]), -2.7);

  // Test error case with wrong number of arguments
  t.throws(() => {
    mathCore.callBuiltInFunction("round", [3.14159]);
  }, { message: "round() expects exactly 2 numeric arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("round", [3.14159, 2, 1]);
  }, { message: "round() expects exactly 2 numeric arguments." });
});

test("callBuiltInFunction - delegate functions with exactly 1 argument", t => {
  const mathCore = new MathCore();

  // Set up delegate to return specific values for various functions
  mathCore.delegate = (name: string, value: string | number) => {
    if (name === "snestopc" && value === "0x8000") return 0x018000;
    if (name === "pctosnes" && value === "0x018000") return 0x8000;
    if (name === "filesize" && value === "test.bin") return 1024;
    if (name === "getfilestatus" && value === "test.bin") return 1;
    if (name === "defined" && value === "LABEL") return 1;
    if (name === "sizeof" && value === "STRUCT") return 16;
    if (name === "objectsize" && value === "OBJECT") return 32;
    if (name === "datasize" && value === "DATA") return 64;
    return 0;
  };

  // Test snestopc function
  t.is(mathCore.callBuiltInFunction("snestopc", ["0x8000"]), 0x018000);

  // Test pctosnes function
  t.is(mathCore.callBuiltInFunction("pctosnes", ["0x018000"]), 0x8000);

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
  t.throws(() => {
    mathCore.callBuiltInFunction("snestopc", []);
  }, { message: "snestopc() expects exactly 1 argument." });

  t.throws(() => {
    mathCore.callBuiltInFunction("pctosnes", ["0x8000", "extra"]);
  }, { message: "pctosnes() expects exactly 1 argument." });

  t.throws(() => {
    mathCore.callBuiltInFunction("filesize", []);
  }, { message: "filesize() expects exactly 1 argument." });

  t.throws(() => {
    mathCore.callBuiltInFunction("sizeof", ["STRUCT", "extra"]);
  }, { message: "sizeof() expects exactly 1 argument." });
});

test("callBuiltInFunction - canreadfile", t => {
  const mathCore = new MathCore();

  // Mock the delegate function to handle canreadfile calls
  mathCore.delegate = (operation, ...args) => {
    if (operation === "canreadfile") {
      const filename = args[0] as string;
      const pos = args[1] as number;
      // const num = args[2] as number;

      // Return 1 if filename is valid and position is within range
      if (filename === "test.bin" && pos >= 0 && pos < 0x1000) {
        return 1;
      }
      return 0;
    }

    if (operation.match(/^canreadfile[1-4]$/)) {
      const filename = args[0] as string;
      const pos = args[1] as number;

      // Return 1 if filename is valid and position is within range
      if (filename === "test.bin" && pos >= 0 && pos < 0x1000) {
        return 1;
      }
      return 0;
    }

    return 0;
  };

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
  t.throws(() => {
    mathCore.callBuiltInFunction("canreadfile", ["test.bin", 100]);
  }, { message: "canreadfile expects exactly 3 arguments (filename, pos, num)." });

  t.throws(() => {
    mathCore.callBuiltInFunction("canreadfile", ["test.bin", 100, 10, 20]);
  }, { message: "canreadfile expects exactly 3 arguments (filename, pos, num)." });

  t.throws(() => {
    mathCore.callBuiltInFunction("canreadfile1", ["test.bin"]);
  }, { message: "canreadfile1() expects exactly 2 arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("canreadfile2", ["test.bin", 100, 10]);
  }, { message: "canreadfile2() expects exactly 2 arguments." });

  // Test error cases with wrong argument types
  t.throws(() => {
    mathCore.callBuiltInFunction("canreadfile", [100, 100, 10]);
  }, { message: "Function 'canreadfile' expected a string argument but got a number: 100" });

  t.throws(() => {
    mathCore.callBuiltInFunction("canreadfile", ["test.bin", "100", 10]);
  }, { message: "Function 'canreadfile' expected a numeric argument but got a string: 100" });
});

test("callBuiltInFunction - canread", t => {
  const mathCore = new MathCore();

  // Mock the delegate function to handle canread calls
  mathCore.delegate = (operation, ...args) => {
    if (operation === "canread") {
      const pos = args[0] as number;
      // const num = args[1] as number;
      // Return 1 if position is valid, 0 otherwise
      return (pos >= 0 && pos < 0x1000) ? 1 : 0;
    }

    if (operation.startsWith("canread") && operation.length === 8) {
      const pos = args[0] as number;
      // const size = args[1] as number;
      // Return 1 if position is valid, 0 otherwise
      return (pos >= 0 && pos < 0x1000) ? 1 : 0;
    }

    return 0;
  };

  // Test canread with valid position
  t.is(mathCore.callBuiltInFunction("canread", [100, 10]), 1);

  // Test canread with invalid position
  t.is(mathCore.callBuiltInFunction("canread", [0x2000, 10]), 0);

  // Test canread1, canread2, canread3, canread4 with valid positions
  t.is(mathCore.callBuiltInFunction("canread1", [100]), 1);
  t.is(mathCore.callBuiltInFunction("canread2", [200]), 1);
  t.is(mathCore.callBuiltInFunction("canread3", [300]), 1);
  t.is(mathCore.callBuiltInFunction("canread4", [400]), 1);

  // Test canread1, canread2, canread3, canread4 with invalid positions
  t.is(mathCore.callBuiltInFunction("canread1", [0x2000]), 0);
  t.is(mathCore.callBuiltInFunction("canread2", [0x2000]), 0);
  t.is(mathCore.callBuiltInFunction("canread3", [0x2000]), 0);
  t.is(mathCore.callBuiltInFunction("canread4", [0x2000]), 0);

  // Test error cases with wrong number of arguments
  t.throws(() => {
    mathCore.callBuiltInFunction("canread", [100]);
  }, { message: "canread expects exactly 2 numeric arguments (pos, num)." });

  t.throws(() => {
    mathCore.callBuiltInFunction("canread", [100, 10, 20]);
  }, { message: "canread expects exactly 2 numeric arguments (pos, num)." });

  t.throws(() => {
    mathCore.callBuiltInFunction("canread1", []);
  }, { message: "canread1 expects exactly 1 numeric argument." });

  t.throws(() => {
    mathCore.callBuiltInFunction("canread2", [100, 200]);
  }, { message: "canread2 expects exactly 1 numeric argument." });

  t.throws(() => {
    mathCore.callBuiltInFunction("canread3", []);
  }, { message: "canread3 expects exactly 1 numeric argument." });

  t.throws(() => {
    mathCore.callBuiltInFunction("canread4", [100, 200]);
  }, { message: "canread4 expects exactly 1 numeric argument." });
});

test("callBuiltInFunction - read", t => {
  const mathCore = new MathCore();

  // Mock the delegate function to handle read calls
  mathCore.delegate = (operation, ...args) => {
    if (operation.startsWith("read")) {
      const pos = args[0] as number;

      // Return different values based on the function
      if (operation === "read1") return pos + 1;
      if (operation === "read2") return pos + 2;
      if (operation === "read3") return pos + 3;
      if (operation === "read4") return pos + 4;

      // Handle default value case
      if (args.length === 2) {
        return args[1]; // Return the default value
      }
    }
    return 0;
  };

  // Test read1, read2, read3, read4 with 1 argument
  t.is(mathCore.callBuiltInFunction("read1", [10]), 11);
  t.is(mathCore.callBuiltInFunction("read2", [20]), 22);
  t.is(mathCore.callBuiltInFunction("read3", [30]), 33);
  t.is(mathCore.callBuiltInFunction("read4", [40]), 44);

  // Test with 2 arguments (including default value)
  t.is(mathCore.callBuiltInFunction("read1", [10, 99]), 11);
  t.is(mathCore.callBuiltInFunction("read2", [20, 99]), 22);
  t.is(mathCore.callBuiltInFunction("read3", [30, 99]), 33);
  t.is(mathCore.callBuiltInFunction("read4", [40, 99]), 44);

  // Test with invalid position but with default value
  mathCore.delegate = (operation, ...args) => {
    if (operation.startsWith("read") && args.length === 2) {
      return args[1]; // Return the default value
    }
    throw new Error("Invalid position");
  };

  t.is(mathCore.callBuiltInFunction("read1", [0xFFFFFF, 99]), 99);
  t.is(mathCore.callBuiltInFunction("read2", [0xFFFFFF, 99]), 99);
  t.is(mathCore.callBuiltInFunction("read3", [0xFFFFFF, 99]), 99);
  t.is(mathCore.callBuiltInFunction("read4", [0xFFFFFF, 99]), 99);

  // Test error cases with wrong number of arguments
  t.throws(() => {
    mathCore.callBuiltInFunction("read1", []);
  }, { message: "read1 expects 1 or 2 numeric arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("read2", [10, 20, 30]);
  }, { message: "read2 expects 1 or 2 numeric arguments." });

  // Test error with string argument
  t.throws(() => {
    mathCore.callBuiltInFunction("read3", ["string"]);
  }, { message: "Function 'read3' expected a numeric argument but got a string: string" });
});

test("callBuiltInFunction - readfile", t => {
  const mathCore = new MathCore();

  // Mock the delegate function to handle readfile calls
  mathCore.delegate = (operation, ...args) => {
    if (operation.startsWith("readfile")) {
      const filename = args[0] as string;
      const pos = args[1] as number;

      // Return different values based on the function and arguments
      if (filename === "test.bin") {
        if (operation === "readfile1") return pos + 1;
        if (operation === "readfile2") return pos + 2;
        if (operation === "readfile3") return pos + 3;
        if (operation === "readfile4") return pos + 4;
      }

      // Handle default value case
      if (args.length === 3) {
        return args[2]; // Return the default value
      }

      // Simulate file not found or read error
      if (filename === "nonexistent.bin") {
        throw new Error("File not found");
      }
    }
    return 0;
  };

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
  t.throws(() => {
    mathCore.callBuiltInFunction("readfile1", ["test.bin"]);
  }, { message: "readfile1 expects 2 or 3 arguments (filename, pos, [default])." });

  t.throws(() => {
    mathCore.callBuiltInFunction("readfile2", []);
  }, { message: "readfile2 expects 2 or 3 arguments (filename, pos, [default])." });

  t.throws(() => {
    mathCore.callBuiltInFunction("readfile3", ["test.bin", 10, 20, 30]);
  }, { message: "readfile3 expects 2 or 3 arguments (filename, pos, [default])." });

  // Test error cases with wrong argument types
  t.throws(() => {
    mathCore.callBuiltInFunction("readfile1", [123, 10]);
  }, { message: "Function 'readfile1' expected a string argument but got a number: 123" });

  t.throws(() => {
    mathCore.callBuiltInFunction("readfile2", ["test.bin", "10"]);
  }, { message: "Function 'readfile2' expected a numeric argument but got a string: 10" });

  t.throws(() => {
    mathCore.callBuiltInFunction("readfile3", ["test.bin", 10, "20"]);
  }, { message: "Function 'readfile3' expected a numeric argument but got a string: 20" });
});

test("callBuiltInFunction - pc & realbase", t => {
  const mathCore = new MathCore();

  // Set up delegate to return specific values for pc and realbase
  mathCore.delegate = (name: string) => {
    if (name === "pc") return 0x8000;
    if (name === "realbase") return 0xC000;
    return 0;
  };

  // Test pc function
  t.is(mathCore.callBuiltInFunction("pc", []), 0x8000);

  // Test realbase function
  t.is(mathCore.callBuiltInFunction("realbase", []), 0xC000);

  // Test error cases with wrong number of arguments
  t.throws(() => {
    mathCore.callBuiltInFunction("pc", [123]);
  }, { message: "pc() expects no arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("realbase", ["test"]);
  }, { message: "realbase() expects no arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("pc", [1, 2, 3]);
  }, { message: "pc() expects no arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("realbase", [0, "test"]);
  }, { message: "realbase() expects no arguments." });
});

test("callBuiltInFunction - unhandled", t => {
  const mathCore = new MathCore();

  // Test with unknown built-in function
  t.throws(() => {
    mathCore.callBuiltInFunction("unknownFunction", []);
  }, { message: "Unknown built-in function 'unknownFunction'" });

  // Test with unimplemented delegate functions
  mathCore.delegate = (name: string) => {
    throw new Error(`Delegate not implemented for ${name}`);
  };

  t.throws(() => {
    mathCore.callBuiltInFunction("snestopc", ["0x8000"]);
  }, { message: "Delegate not implemented for snestopc" });

  t.throws(() => {
    mathCore.callBuiltInFunction("pctosnes", ["0x018000"]);
  }, { message: "Delegate not implemented for pctosnes" });

  // Test with delegate that returns unexpected values
  mathCore.delegate = (name: string) => {
    return "not a number" as any;
  };

  // This should not throw as the delegate is responsible for proper type conversion
  const result = mathCore.callBuiltInFunction("defined", ["LABEL"]);
  t.is(typeof result, "string");
  t.is(result, "not a number");
});

test("callBuiltInFunction - string comparison", t => {
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
  t.throws(() => {
    mathCore.callBuiltInFunction("stringsequal", ["hello"]);
  }, { message: "stringsequal() expects exactly 2 string arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("stringsequal", ["hello", "world", "!"]);
  }, { message: "stringsequal() expects exactly 2 string arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("stringsequalnocase", ["hello"]);
  }, { message: "stringsequalnocase() expects exactly 2 string arguments." });

  t.throws(() => {
    mathCore.callBuiltInFunction("stringsequalnocase", ["hello", "world", "!"]);
  }, { message: "stringsequalnocase() expects exactly 2 string arguments." });

  // Test error cases with wrong argument types
  t.throws(() => {
    mathCore.callBuiltInFunction("stringsequal", [123, "hello"]);
  }, { message: "Function 'stringsequal' expected a string argument but got a number: 123" });

  t.throws(() => {
    mathCore.callBuiltInFunction("stringsequal", ["hello", 123]);
  }, { message: "Function 'stringsequal' expected a string argument but got a number: 123" });

  t.throws(() => {
    mathCore.callBuiltInFunction("stringsequalnocase", [123, "hello"]);
  }, { message: "Function 'stringsequalnocase' expected a string argument but got a number: 123" });

  t.throws(() => {
    mathCore.callBuiltInFunction("stringsequalnocase", ["hello", 123]);
  }, { message: "Function 'stringsequalnocase' expected a string argument but got a number: 123" });
});

test("callBuiltInFunction - pc, realbase", (t) => {
  const mathCore = new MathCore();

  // Setup delegate function to handle these operations
  mathCore.delegate = (operation: string, value?: string): number => {
    if (operation === "pc") {
      return 0x8000;
    }
    if (operation === "realbase") {
      return 0xC00000;
    }
    return 0;
  };

  // Test pc function
  t.is(mathCore.callBuiltInFunction("pc", []), 0x8000);

  // Test pc error cases
  t.throws(() => {
    mathCore.callBuiltInFunction("pc", ["arg"]);
  }, { message: "pc() expects no arguments." });

  // Test realbase function
  t.is(mathCore.callBuiltInFunction("realbase", []), 0xC00000);

  // Test realbase error cases
  t.throws(() => {
    mathCore.callBuiltInFunction("realbase", ["arg"]);
  }, { message: "realbase() expects no arguments." });
});

test("numArg", t => {
  const mathCore = new MathCore();

  // Test with numeric argument
  t.is(mathCore.numArg("testFunc", 42), 42);
  t.is(mathCore.numArg("testFunc", 0), 0);
  t.is(mathCore.numArg("testFunc", -10), -10);
  t.is(mathCore.numArg("testFunc", 3.14), 3.14);

  // Test with string argument (should throw error)
  t.throws(() => {
    mathCore.numArg("testFunc", "string");
  }, { message: "Function 'testFunc' expected a numeric argument but got a string: string" });

  t.throws(() => {
    mathCore.numArg("anotherFunc", "123");
  }, { message: "Function 'anotherFunc' expected a numeric argument but got a string: 123" });

  // Test with different function names
  t.throws(() => {
    mathCore.numArg("sin", "value");
  }, { message: "Function 'sin' expected a numeric argument but got a string: value" });
});

test("strArg", t => {
  const mathCore = new MathCore();

  // Test with string argument
  t.is(mathCore.strArg("testFunc", "hello"), "hello");
  t.is(mathCore.strArg("testFunc", ""), "");
  t.is(mathCore.strArg("testFunc", "123"), "123");

  // Test with numeric argument (should throw error)
  t.throws(() => {
    mathCore.strArg("testFunc", 42);
  }, { message: "Function 'testFunc' expected a string argument but got a number: 42" });

  t.throws(() => {
    mathCore.strArg("anotherFunc", 0);
  }, { message: "Function 'anotherFunc' expected a string argument but got a number: 0" });

  // Test with different function names
  t.throws(() => {
    mathCore.strArg("sizeof", 123);
  }, { message: "Function 'sizeof' expected a string argument but got a number: 123" });
});

test("parseFunctionDefinition", t => {
  const mathCore = new MathCore();

  // Test valid function definition with no parameters
  mathCore.str = "function noParams() = 42";
  mathCore.parseFunctionDefinition();
  t.true(mathCore.userFunctions.has("noParams"));
  t.deepEqual(mathCore.userFunctions.get("noParams"), { args: [], content: "42" });

  // Test valid function definition with parameters
  mathCore.str = "function add(a, b) = a + b";
  mathCore.parseFunctionDefinition();
  t.true(mathCore.userFunctions.has("add"));
  t.deepEqual(mathCore.userFunctions.get("add"), { args: ["a", "b"], content: "a + b" });

  // Test function with whitespace
  mathCore.str = "function   multiply(x,   y)  =  x * y";
  mathCore.parseFunctionDefinition();
  t.true(mathCore.userFunctions.has("multiply"));
  t.deepEqual(mathCore.userFunctions.get("multiply"), { args: ["x", "y"], content: "x * y" });

  // Test function with line continuation
  mathCore.str = "function complex(a, b) = a + \\\nb * 2";
  mathCore.parseFunctionDefinition();
  t.true(mathCore.userFunctions.has("complex"));
  t.deepEqual(mathCore.userFunctions.get("complex"), { args: ["a", "b"], content: "a + b * 2" });

  // Test function overwriting existing function
  mathCore.str = "function add(x) = x + 10";
  mathCore.parseFunctionDefinition();
  t.true(mathCore.userFunctions.has("add"));
  t.deepEqual(mathCore.userFunctions.get("add"), { args: ["x"], content: "x + 10" });

  // Test invalid function definition syntax
  mathCore.str = "function = 42";
  t.throws(() => {
    mathCore.parseFunctionDefinition();
  }, { message: "Invalid function definition syntax." });

  mathCore.str = "function badSyntax() 42";
  t.throws(() => {
    mathCore.parseFunctionDefinition();
  }, { message: "Invalid function definition syntax." });
});

test("delegate & labelResolver", (t) => {
  const mathCore = new MathCore();

  // Test delegate function with default behavior
  t.throws(() => {
    mathCore.delegate("sizeof", "myStruct");
  }, { message: "Delegate not set for sizeof, myStruct" });

  t.throws(() => {
    mathCore.delegate("objectsize", "myObject");
  }, { message: "Delegate not set for objectsize, myObject" });

  // Test setting and using custom delegate function
  mathCore.delegate = (operation: string, value: string): number => {
    if (operation === "sizeof" && value === "myStruct") {
      return 42;
    } else if (operation === "objectsize" && value === "myObject") {
      return 24;
    }
    return 0;
  };

  t.is(mathCore.delegate("sizeof", "myStruct"), 42);
  t.is(mathCore.delegate("objectsize", "myObject"), 24);
  t.is(mathCore.delegate("unknown", "value"), 0);

  // Test built-in functions that use delegate
  t.is(mathCore.callBuiltInFunction("sizeof", ["myStruct"]), 42);
  t.is(mathCore.callBuiltInFunction("objectsize", ["myObject"]), 24);
});

test("user-defined function with bitshifting", (t) => {
  const mathCore = new MathCore();

  // Define a function that uses bitshifting
  mathCore.str = "function highByte(value) = <:value";
  mathCore.parseFunctionDefinition();
  t.true(mathCore.userFunctions.has("highByte"));
  t.deepEqual(mathCore.userFunctions.get("highByte"), { args: ["value"], content: "<:value" });

  // Define a more complex function that combines bitshifting with other operations
  mathCore.str = "function makeAddress(bank, offset) = (bank << 16) | offset";
  mathCore.parseFunctionDefinition();
  t.true(mathCore.userFunctions.has("makeAddress"));
  t.deepEqual(mathCore.userFunctions.get("makeAddress"), { args: ["bank", "offset"], content: "(bank << 16) | offset" });

  // Test calling the highByte function with different values
  mathCore.str = "highByte(0x123456)";
  t.is(mathCore.evalMath(0), 0x12);

  mathCore.str = "highByte(65535)";
  t.is(mathCore.evalMath(0), 0);

  mathCore.str = "highByte(256)";
  t.is(mathCore.evalMath(0), 0);

  mathCore.str = "highByte(0)";
  t.is(mathCore.evalMath(0), 0x00);

  // Test calling the makeAddress function
  mathCore.str = "makeAddress(0x7E, 0x1234)";
  t.is(mathCore.evalMath(0), 0x7E1234);

  mathCore.str = "makeAddress(0, 0xFFFF)";
  t.is(mathCore.evalMath(0), 0xFFFF);

  // Test nested function calls
  mathCore.str = "highByte(makeAddress(0x7E, 0x1234))";
  t.is(mathCore.evalMath(0), 0x7E);

  // Test with expressions as arguments
  mathCore.str = "highByte(0x1000 + 0x234)";
  t.is(mathCore.evalMath(0), 0);

  mathCore.str = "makeAddress(1 + 2, 0x1000 + 0x234)";
  t.is(mathCore.evalMath(0), 0x031234);

  // Test with complex expressions
  mathCore.str = "makeAddress(highByte(0xABCDEF) & 0x7F, 0x1234 | 0x8000)";
  t.is(mathCore.evalMath(0), 0x2B9234);
});
