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
    mathCore.delegate = (name, id) => {
        if (id === "LABEL1")
            return 10;
        if (id === "LABEL2")
            return 20;
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
    mathCore.delegate = (operation, value) => {
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
    t.is(mathCore.math("sizeof(MyStruct) & 15"), 8); // 24 & 15 = 8
    t.is(mathCore.str, "");
    // Test objectsize with bitwise operations
    t.is(mathCore.math("objectsize(MyObject) | 3"), 51); // 48 | 3 = 51
    t.is(mathCore.str, "");
    // Test bitwise XOR with struct functions
    t.is(mathCore.math("sizeof(MyStruct) ^ objectsize(MyObject)"), 24 ^ 48);
    t.is(mathCore.str, "");
    // Test bitwise shifts with struct functions
    t.is(mathCore.math("sizeof(MyStruct) << 1"), 48); // 24 << 1 = 48
    t.is(mathCore.str, "");
    t.is(mathCore.math("objectsize(MyObject) >> 2"), 12); // 48 >> 2 = 12
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
    mathCore.delegate = (operation, value) => {
        if (operation === "resolveLabel") {
            if (value === "LABEL1")
                return 100;
            if (value === "STRUCT_NAME")
                return "MyStruct"; // Return string for struct names
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
    t.is(mathCore.getnum(), "MyStruct");
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
    mathCore.delegate = (name) => {
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
    t.is(mathCore.callUserFunction("polynomial", [2, 3]), 3 * 4 + 2 * 3 - 5); // 3*2^2 + 2*3 - 5 = 12 + 6 - 5 = 13
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
    mathCore.delegate = (name, value) => {
        if (name === "snestopc" && value === "0x8000")
            return 0x018000;
        if (name === "pctosnes" && value === "0x018000")
            return 0x8000;
        if (name === "filesize" && value === "test.bin")
            return 1024;
        if (name === "getfilestatus" && value === "test.bin")
            return 1;
        if (name === "defined" && value === "LABEL")
            return 1;
        if (name === "sizeof" && value === "STRUCT")
            return 16;
        if (name === "objectsize" && value === "OBJECT")
            return 32;
        if (name === "datasize" && value === "DATA")
            return 64;
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
            const filename = args[0];
            const pos = args[1];
            // const num = args[2] as number;
            // Return 1 if filename is valid and position is within range
            if (filename === "test.bin" && pos >= 0 && pos < 0x1000) {
                return 1;
            }
            return 0;
        }
        if (operation.match(/^canreadfile[1-4]$/)) {
            const filename = args[0];
            const pos = args[1];
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
            const pos = args[0];
            // const num = args[1] as number;
            // Return 1 if position is valid, 0 otherwise
            return (pos >= 0 && pos < 0x1000) ? 1 : 0;
        }
        if (operation.startsWith("canread") && operation.length === 8) {
            const pos = args[0];
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
            const pos = args[0];
            // Return different values based on the function
            if (operation === "read1")
                return pos + 1;
            if (operation === "read2")
                return pos + 2;
            if (operation === "read3")
                return pos + 3;
            if (operation === "read4")
                return pos + 4;
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
            const filename = args[0];
            const pos = args[1];
            // Return different values based on the function and arguments
            if (filename === "test.bin") {
                if (operation === "readfile1")
                    return pos + 1;
                if (operation === "readfile2")
                    return pos + 2;
                if (operation === "readfile3")
                    return pos + 3;
                if (operation === "readfile4")
                    return pos + 4;
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
    mathCore.delegate = (name) => {
        if (name === "pc")
            return 0x8000;
        if (name === "realbase")
            return 0xC000;
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
    mathCore.delegate = (name) => {
        throw new Error(`Delegate not implemented for ${name}`);
    };
    t.throws(() => {
        mathCore.callBuiltInFunction("snestopc", ["0x8000"]);
    }, { message: "Delegate not implemented for snestopc" });
    t.throws(() => {
        mathCore.callBuiltInFunction("pctosnes", ["0x018000"]);
    }, { message: "Delegate not implemented for pctosnes" });
    // Test with delegate that returns unexpected values
    mathCore.delegate = (name) => {
        return "not a number";
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
    mathCore.delegate = (operation, value) => {
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
    mathCore.delegate = (operation, value) => {
        if (operation === "sizeof" && value === "myStruct") {
            return 42;
        }
        else if (operation === "objectsize" && value === "myObject") {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0aENvcmUudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIvVXNlcnMvbWF0dGhldy91dHRvcmkvc25lcy1hc20tanMvIiwic291cmNlcyI6WyJ0ZXN0cy9tYXRoQ29yZS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sSUFBSSxNQUFNLEtBQUssQ0FBQztBQUN2QixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFFOUMsSUFBSSxDQUFDLGdDQUFnQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0lBQ3pDLE1BQU0sUUFBUSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7SUFFaEMsZ0NBQWdDO0lBQ2hDLFFBQVEsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0lBQzNCLFFBQVEsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBRTFFLDBCQUEwQjtJQUMxQixDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUM1QixDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFFL0MsYUFBYTtJQUNiLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUVqQixrQ0FBa0M7SUFDbEMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDN0IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0FBQ2xELENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBSSxDQUFDLDJDQUEyQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0lBQ3BELE1BQU0sUUFBUSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7SUFFaEMsbURB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RWpDLFlBQVk7SUFDWixDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFakMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRWpDLFlBQVk7SUFDWixDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFakMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRWpDLGVBQWU7SUFDZixDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFakMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRWpDLHFCQUFxQjtJQUNyQixDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFakMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRWpDLHdCQUF3QjtJQUN4QixDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFakMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ25DLENBQUMsQ0FBQyxDQUFDO0FBRUgsSUFBSSxDQUFDLDJCQUEyQixFQUFFLENBQUMsQ0FBQyxFQUFFO0lBQ3BDLE1BQU0sUUFBUSxHQUFHLElB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LENBQUM7SUFDckIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUM1RCxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzVELENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDNUQsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUM1RCxDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBRTdELHVEQUF1RDtJQUN2RCxRQUFRLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQztJQUN0QixDQUFDLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzVELENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDNUQsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUU3RCx3REFBd0Q7SUFDeEQsUUFBUSxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUM7SUFDdkIsQ0FBQyxD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QUUsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUV6RSxvRkFBb0Y7SUFDcEYsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsY0FBYyxFQUFFLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsY0FBYyxFQUFFLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsY0FBYyxFQUFFLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsY0FBYyxFQUFFLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFNUUsb0ZBQW9GO0lBQ3BGLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLGNBQWMsRUFBRSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzVFLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLGNBQWMsRUFBRSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzVFLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLGNBQWMsRUFBRSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzVFLENBQUMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLGNBQWMsRUFBRSxDQUFDLFVBQVUsRUFBRSxNQUFNLENB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