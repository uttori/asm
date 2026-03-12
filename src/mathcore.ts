import type { ExpressionHost } from "./architecture-types.js";

let debug = (..._: unknown[]) => {};
/* c8 ignore next 4 */
try {
  const { default: d } = await import("debug");
  debug = d("MathCore");
} catch {}

export class MathCore {
  host?: ExpressionHost;
  math_round: boolean = false;

  userFunctions: Map<string, { args: string[]; content: string }> = new Map();
  builtInFunctions: Map<string, (arg: number) => number> = new Map([
    ["sqrt", Math.sqrt],
    ["sin", Math.sin],
    ["cos", Math.cos],
    ["tan", Math.tan],
    ["asin", Math.asin],
    ["acos", Math.acos],
    ["atan", Math.atan],
    ["log", Math.log],
    ["log10", Math.log10],
    ["log2", Math.log2],
    ["ceil", Math.ceil],
    ["floor", Math.floor]
  ]);
  operators: { [key: string]: { priority: number; operation: (a: number, b: number) => number } } = {
    "**": { priority: 6, operation: (a, b) => Math.pow(a, b) },
    "*":  { priority: 5, operation: (a, b) => a * b },
    "/":  { priority: 5, operation: (a, b) => (b !== 0 ? a / b : this.throwMathError("Division by zero")) },
    "%":  { priority: 5, operation: (a, b) => (b !== 0 ? a % b : this.throwMathError("Modulo by zero")) },
    "+":  { priority: 4, operation: (a, b) => a + b },
    "-":  { priority: 4, operation: (a, b) => a - b },
    "<<": { priority: 3, operation: (a, b) => a << b },
    ">>": { priority: 3, operation: (a, b) => a >> b },
    "&":  { priority: 3, operation: (a, b) => a & b },
    "|":  { priority: 3, operation: (a, b) => a | b },
    "^":  { priority: 3, operation: (a, b) => a ^ b },
    "<":  { priority: 2, operation: (a, b) => a < b ? 1 : 0 },
    ">":  { priority: 2, operation: (a, b) => a > b ? 1 : 0 },
    "<=": { priority: 2, operation: (a, b) => a <= b ? 1 : 0 },
    ">=": { priority: 2, operation: (a, b) => a >= b ? 1 : 0 },
    "==": { priority: 2, operation: (a, b) => a === b ? 1 : 0 },
    "!=": { priority: 2, operation: (a, b) => a !== b ? 1 : 0 },
    "&&": { priority: 1, operation: (a, b) => (a && b) ? 1 : 0 },
    "||": { priority: 0, operation: (a, b) => (a || b) ? 1 : 0 },
  }

  str: string = "";

  constructor() {}

  /**
   * Initialize the math core.
   */
  reset(): void {
    debug("reset");
    this.math_round = false;
    this.userFunctions.clear();
  }

  /**
   * Evaluates an expression.
   * This is a direct conversion of `math` in `asar_math.cpp`.
   * @param {string} expression The expression to evaluate.
   * @returns {number} The result of the expression.
   */
  math = (expression: string): number => {
    debug("math", expression);
    this.str = expression.trim();

    const rval = this.evalMath(0);

    if (this.str.length > 0) {
      if (this.str.startsWith(",")) {
        throw new Error(`Invalid input: ${this.str}`);
      } else {
        throw new Error("Mismatched parentheses.");
      }
    }

    debug(`math: ${expression} = ${rval}`);
    return rval;
  }

  /**
   * Evaluates a mathematical expression.
   * This replaces the C++ `eval` function.
   * @param {number} depth The current depth of nested expressions.
   * @param {string} [stopChar] The character to stop the evaluation at.
   * @returns {number} The result of the evaluated expression.
   */
  evalMath(depth: number = 0, stopChar?: string): number {
    debug("evalMath", { depth, stopChar }, this.str);

    let left: number;

    // If there's a function definition inline, parse and skip it.
    if (this.str.startsWith("function")) {
      this.parseFunctionDefinition();
      left = this.evalMath(depth, stopChar);
    } else if (this.str.length > 0) {
      left = this.getnum();
    }

    if (Number.isNaN(left)) {
      throw new Error(`Invalid number: ${left}`);
    }
    debug("evalMath after getnum", left);

    // Ensure we've trimmed the string after getnum returns
    this.str = this.str.trim();

    // After getnum, we might still have leftover operators to process.
    // Keep processing them until we're done or hit the stopChar
    while (this.str.trim().length > 0) {
      this.str = this.str.trim();

      // Break if we hit our stopping character (for a nested call)
      if (stopChar && this.str.startsWith(stopChar)) {
        break;
      }

      // Break if we hit a closing bracket or comma outside of their context
      if ([",", ")", "]"].includes(this.str[0])) {
        break;
      }

      // if (this.math_round) {
      //   left = Math.trunc(left);
      // }

      // Peek for the next operator
      const op = this.peekNextOperator(this.operators, depth);
      debug("evalMath peekNextOperator =", op);

      // No valid operator at this level => done with this level
      if (!op) break;

      // Consume the operator from the string
      this.str = this.str.substring(op.length).trim();

      // Evaluate the right side at a higher depth
      const right = this.evalMath(this.operators[op].priority + 1, stopChar);
      debug("evalMath right =", { right, op, left });

      // Apply the operation
      left = this.operators[op].operation(left, right);
    }

    if (this.math_round) {
      left = Math.trunc(left);
    }

    if (Number.isNaN(left)) {
      throw new Error(`Invalid number: ${left}`);
    }
    debug("evalMath =", left);
    return left;
  }

  /**
   * Helper function to peek ahead at the next 1-2 characters and return a matching operator if found and depth-allowed.
   * @param {object} operators The operators to check.
   * @param {number} depth The current depth of nested expressions.
   * @returns {string | null} The matching operator or null if no match.
   */
  peekNextOperator(
    operators: { [key: string]: { priority: number } },
    depth: number
  ): string | null {
    // Trim the expression to avoid whitespace confusion.
    this.str = this.str.trim();
    if (this.str.length === 0) {
      debug("peekNextOperator = null", this.str);
      return null;
    }

    // Try matching the next two characters first.
    if (this.str.length >= 2) {
      const twoChars = this.str.slice(0, 2);
      // NOTE: `&& operators[twoChars].priority >= depth` was removed as it would fail to match `&&`
      if (operators[twoChars]) {
        debug("peekNextOperator twoChars", twoChars);
        return twoChars;
      }
    }

    // Otherwise, check a single character operator.
    const oneChar = this.str[0];
    if (operators[oneChar] && operators[oneChar].priority >= depth) {
      debug("peekNextOperator oneChar", oneChar);
      return oneChar;
    }

    // No operator matched
    debug("peekNextOperator = null", this.str);
    return null;
  }

  /**
   * Parses numbers from a string while consuming valid characters.
   * @param {RegExp} regex The regular expression to test against the string.
   * @returns {string} The substring of the string that matches the regular expression.
   */
  consumeWhile(regex: RegExp): string {
    debug("consumeWhile", regex);
    let i = 0;
    while (i < this.str.length && regex.test(this.str[i])) {
      i++;
    }
    const result = this.str.substring(0, i);
    this.str = this.str.substring(i);
    return result;
  }

  /**
   * Retrieves a number from the string.
   * This implements `getnumcore` and `getnum`.
   * @returns {number} The number from the string.
   */
  getnum = (): number => {
    debug("getnum:", this.str);
    this.str = this.str.trim();

    // Process prefix operators FIRST - before any function call processing
    let applyBitshift = false;
    let sign = 1;

    // Check for prefix operators in a loop
    while (true) {
      if (this.str.startsWith("<:")) {
        this.str = this.str.substring(2).trim();
        applyBitshift = true;
      } else if (this.str.startsWith("~")) {
        this.str = this.str.substring(1).trim();
        return ~this.getnum(); // Immediately compute bitwise NOT
      } else if (this.str.startsWith("-")) {
        this.str = this.str.substring(1).trim();
        sign *= -1;
      } else if (this.str.startsWith("+")) {
        this.str = this.str.substring(1).trim();
        // '+' is a no-op
      } else {
        break;
      }
    }

    // If the expression starts with a function that takes a struct, parse its parameter as a string.
    const structFns = ["sizeof", "objectsize"];
    for (const fn of structFns) {
      const prefix = fn + "(";
      if (this.str.startsWith(prefix)) {
        // Remove the function name and opening parenthesis
        this.str = this.str.substring(prefix.length).trim();
        let param = "";

        // Parse the parameter (string or identifier)
        if (this.str.startsWith('"')) {
          this.str = this.str.substring(1).trim();
          const endQuoteIndex = this.str.indexOf('"');
          if (endQuoteIndex === -1) {
            throw new Error(`Missing closing double quote in ${fn} call.`);
          }
          param = this.str.substring(0, endQuoteIndex);
          this.str = this.str.substring(endQuoteIndex + 1).trim();
        } else {
          param = this.consumeWhile(/[\w.]/);
        }

        // Verify and remove the closing parenthesis
        if (!this.str.startsWith(")")) {
          throw new Error(`Missing closing ')' in ${fn} call.`);
        }

        // IMPORTANT: Save remaining content after the closing parenthesis
        const remainingAfterCall = this.str.substring(1).trim();

        // Call the function and get result
        const result = this.callFunction(fn, [param]);

        // Restore remaining content
        this.str = remainingAfterCall;
        debug("getnum leftover after struct fn:", this.str);

        // Apply sign and bitshift
        let value = sign * result;
        if (applyBitshift) {
          value = value >>> 16;
        }
        return value;
      }
    }

    // If the next token is a function call: e.g. myFunc(1234)
    const funcCallMatch = this.str.match(/^(\w+)\s*\(/);
    if (funcCallMatch) {
      debug("getnum function:", funcCallMatch);
      // Extract the function name
      const fnName = funcCallMatch[1];
      debug("getnum fnName =", fnName);

      // Remove the matched portion from this.str (e.g. "myFunc(")
      this.str = this.str.substring(funcCallMatch[0].length - 1).trim();
      debug("getnum this.str =", this.str);

      // Now parse arguments inside parentheses
      const args: (number | string)[] = [];
      // First character is '('
      if (this.str[0] === "(") {
        this.str = this.str.substring(1).trim(); // remove '('
        // parse arguments until ')'
        if (!this.str.startsWith(")")) {
          while (true) {
            this.str = this.str.trim();
            // Consume leading comma so next argument is parsed without it (e.g. after string literal)
            if (this.str.startsWith(",")) {
              this.str = this.str.substring(1).trim();
            }
            debug("getnum this.str while 1 =", this.str);
            if (this.str.startsWith(")")) {
              break;
            }
            // Check if next argument starts with double quote => string argument
            if (this.str.startsWith('"')) {
              // parse string literal
              const strVal = this.parseStringLiteral();
              args.push(strVal);
            } else {
              // parse numeric expression
              const val = this.evalMath(0, ")");
              args.push(val);
            }

            this.str = this.str.trim();
            debug("getnum this.str while 2 =", this.str);
            if (this.str.startsWith(")")) {
              break;
            }
            if (this.str.startsWith(",")) {
              this.str = this.str.substring(1).trim();
              continue;
            } else {
              throw new Error(`Expected ',' or ')' in function call arguments: ${this.str}`);
            }
          }
        }
        // After the closing parenthesis we may have more content
        const remainingAfterCall = this.str.substring(1).trim();

        // Now calculate the function result
        const result = this.callFunction(fnName, args);
        debug("getnum result =", result);

        // Set this.str to everything AFTER the function call
        this.str = remainingAfterCall;
        debug("getnum leftover string =", this.str);

        // Apply sign and bitshift
        let value = sign * result;
        if (applyBitshift) {
          value = value >>> 16;
        }
        return value;
      }
    }

    // Now parse a raw number literal, a parenthesized expression, or an identifier (label).
    let value: number;
    if (this.str.startsWith("(")) {
      this.str = this.str.substring(1).trim();
      // Use evalMath(0, ")") to parse until the matching ')'
      value = this.evalMath(0, ")");
      debug("getnum this.str", this.str);
      if (!this.str.startsWith(")")) {
        throw new Error("Mismatched parentheses.");
      }
      // Remove the closing parenthesis
      this.str = this.str.substring(1).trim();
    } else if (this.str.startsWith("$")) {
      this.str = this.str.substring(1);
      value = parseInt(this.consumeWhile(/[\dA-Fa-f]/), 16);
    } else if (this.str.startsWith("0x")) {
      this.str = this.str.substring(2);
      value = parseInt(this.consumeWhile(/[\dA-Fa-f]/), 16);
    } else if (this.str.startsWith("%")) {
      this.str = this.str.substring(1);
      value = parseInt(this.consumeWhile(/[01]/), 2);
    } else if (/\d/.test(this.str[0])) {
      value = parseFloat(this.consumeWhile(/[\d.]/));
    } else {
      // Fallback: try to resolve identifiers (e.g. label resolver).
      // Parse compound ids: StructName.member, StructName[index].member, StructName.Child.member
      const idMatch = this.str.match(/^([A-Z_a-z]\w*)/);
      if (idMatch) {
        let compoundId = idMatch[1];
        this.str = this.str.substring(idMatch[1].length).trim();
        while (this.str.startsWith(".") || this.str.startsWith("[")) {
          if (this.str.startsWith(".")) {
            this.str = this.str.substring(1).trim();
            const memberMatch = this.str.match(/^([A-Z_a-z]\w*)/);
            if (!memberMatch) break;
            compoundId += "." + memberMatch[1];
            this.str = this.str.substring(memberMatch[1].length).trim();
          } else if (this.str.startsWith("[")) {
            this.str = this.str.substring(1).trim();
            const indexVal = this.evalMath(0, "]");
            if (!this.str.startsWith("]")) throw new Error("Mismatched brackets in struct index");
            this.str = this.str.substring(1).trim();
            compoundId += "[" + indexVal + "]";
          }
        }
        const resolved = this.getHost().resolveLabel(compoundId);
        if (typeof resolved === "number") {
          value = resolved;
        } else {
          // If resolved is a string (e.g. a struct name) then return it as is
          // so built-in functions like sizeof get the correct string.
          return resolved as unknown as number;
        }
      } else {
        throw new Error(`Invalid number: ${this.str}`);
      }
    }

    // Finally, apply sign and optional <:
    value = sign * value;
    if (applyBitshift) {
      value = value >>> 16;
    }
    return value;
  }

  /**
   * Safe wrapper to handle division by zero.
   * @param {string} message The message to throw.
   */
  throwMathError = (message: string): number => {
    throw new Error(message);
  }

  /**
   * Parses a string literal from the current string with support for quotes.
   * @returns {string} The parsed string literal.
   */
  parseStringLiteral = (): string => {
    debug("parseStringLiteral")
    // We know this.str starts with a double-quote
    let i = 1; // skip leading "
    let result = "";
    while (i < this.str.length && this.str[i] !== '"') {
      // simple approach: no escape sequences
      result += this.str[i];
      i++;
    }
    if (i >= this.str.length) {
      throw new Error("Unterminated string literal in function call.");
    }
    // skip the closing quote
    i++;
    // remove from this.str
    this.str = this.str.substring(i).trim();
    return result;
  }

  /**
   * Calls either a built-in or user-defined function by name, passing an array of arguments which can be strings or numbers.
   * @param {string} name The name of the function to call.
   * @param {Array<number | string>} args The arguments to pass to the function.
   * @returns {number} The result of the function call.
   */
  callFunction = (name: string, args: (number | string)[]): number => {
    debug("callFunction", { name, args });
    // 1) Check user-defined
    if (this.userFunctions.has(name)) {
      return this.callUserFunction(name, args);
    }
    // 2) If built-in, dispatch:
    return this.callBuiltInFunction(name, args);
  }

  /**
   * Calls a user-defined function by name, passing an array of arguments which can be strings or numbers.
   * @param {string} name The name of the function to call.
   * @param {Array<number | string>} args The arguments to pass to the function.
   * @returns {number} The result of the function call.
   */
  callUserFunction = (name: string, args: (number | string)[]): number => {
    debug("callUserFunction", { name, args });

    // Get the function definition
    const func = this.userFunctions.get(name);
    if (!func) {
      throw new Error(`User function '${name}' not found.`);
    }

    // Check arguments
    if (args.length < func.args.length) {
      throw new Error(
        `Function '${name}' expects at least ${func.args.length} argument(s).`
      );
    }

    // Get the function body
    let content = func.content;

    // Replace parameters with their values
    for (let i = 0; i < func.args.length; i++) {
      const paramName = func.args[i];
      const argValue = args[i];

      // Replace all occurrences of the parameter name with its value
      // Use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${paramName}\\b`, "g");
      const replacement = typeof argValue === "string" ? JSON.stringify(argValue) : argValue.toString();
      content = content.replace(regex, replacement);
    }

    debug("callUserFunction content =", content);

    // Parse the replaced content
    const result = this.math(content);

    debug("callUserFunction =", result);
    return result;
  }

  /**
   * Calls a built-in function by name, passing an array of arguments which can be strings or numbers.
   * @param {string} name The name of the function to call.
   * @param {Array<number | string>} args The arguments to pass to the function.
   * @returns {number} The result of the function call.
   */
  callBuiltInFunction = (name: string, args: (number | string)[]): number => {
    debug("callBuiltInFunction", { name, args });
    switch (name) {
      // --- Trigonometric & Logarithmic functions ---
      case "sqrt":
      case "sin":
      case "cos":
      case "tan":
      case "asin":
      case "acos":
      case "atan":
      // Aliases for inverse trig functions
      case "arcsin":
      case "arccos":
      case "arctan":
      case "log":
      case "log10":
      case "log2":
      case "ceil":
      case "floor": {
        if (args.length !== 1) throw new Error(`${name} expects exactly 1 numeric argument.`);
        // Check for aliases and map them to their standard functions
        if (name === "arcsin") name = "asin";
        if (name === "arccos") name = "acos";
        if (name === "arctan") name = "atan";
        const val = this.numArg(name, args[0]);
        const mapping: { [key: string]: (x: number) => number } = {
          sqrt: Math.sqrt,
          sin: Math.sin,
          cos: Math.cos,
          tan: Math.tan,
          asin: Math.asin,
          acos: Math.acos,
          atan: Math.atan,
          log: Math.log,
          log10: Math.log10,
          log2: Math.log2,
          ceil: Math.ceil,
          floor: Math.floor,
        };
        const result = mapping[name](val);
        if (Number.isNaN(result)) {
          throw new Error(`${name} returned NaN for argument ${val}`);
        }
        return result;
      }
      // Min, Max, Clamp
      case "min": {
        if (args.length < 2) throw new Error("min() expects at least 2 numeric arguments.");
        // Convert all arguments to numbers
        const numArgs = args.map(arg => this.numArg(name, arg));
        return Math.min(...numArgs);
      }
      case "max": {
        if (args.length < 2) throw new Error("max() expects at least 2 numeric arguments.");
        // Convert all arguments to numbers
        const numArgs = args.map(arg => this.numArg(name, arg));
        return Math.max(...numArgs);
      }
      case "clamp": {
        if (args.length !== 3) throw new Error("clamp() expects exactly 3 numeric arguments.");
        const value = this.numArg(name, args[0]);
        const minVal = this.numArg(name, args[1]);
        const maxVal = this.numArg(name, args[2]);
        return Math.max(minVal, Math.min(maxVal, value));
      }
      // --- Safe Division and Conditional Selection ---
      case "safediv": {
        if (args.length !== 3) throw new Error("safediv() expects exactly 3 numeric arguments.");
        const dividend = this.numArg(name, args[0]);
        const divisor = this.numArg(name, args[1]);
        const defaultValue = this.numArg(name, args[2]);
        return divisor === 0 ? defaultValue : dividend / divisor;
      }
      case "select": {
        if (args.length !== 3) throw new Error("select() expects exactly 3 numeric arguments.");
        const statement = this.numArg(name, args[0]);
        const trueVal = this.numArg(name, args[1]);
        const falseVal = this.numArg(name, args[2]);
        return statement !== 0 ? trueVal : falseVal;
      }
      // --- Logical Operations ---
      case "not": {
        if (args.length !== 1) throw new Error("not() expects exactly 1 numeric argument.");
        const value = this.numArg(name, args[0]);
        return value === 0 ? 1 : 0;
      }
      case "bank": {
        if (args.length !== 1) throw new Error("bank() expects exactly 1 numeric argument.");
        // Return the bank of the value by shifting 16 bits to the right and masking with 0xFF
        return (this.numArg(name, args[0]) >> 16) & 0xFF;
      }
      // --- Comparison Functions ---
      case "equal": {
        if (args.length !== 2) throw new Error("equal() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) === this.numArg(name, args[1]) ? 1 : 0;
      }
      case "notequal": {
        if (args.length !== 2) throw new Error("notequal() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) !== this.numArg(name, args[1]) ? 1 : 0;
      }
      case "less": {
        if (args.length !== 2) throw new Error("less() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) < this.numArg(name, args[1]) ? 1 : 0;
      }
      case "lessequal": {
        if (args.length !== 2) throw new Error("lessequal() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) <= this.numArg(name, args[1]) ? 1 : 0;
      }
      case "greater": {
        if (args.length !== 2) throw new Error("greater() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) > this.numArg(name, args[1]) ? 1 : 0;
      }
      case "greaterequal": {
        if (args.length !== 2) throw new Error("greaterequal() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) >= this.numArg(name, args[1]) ? 1 : 0;
      }
      // --- Logical Bitwise Operations ---
      case "and": {
        if (args.length !== 2) throw new Error("and() expects exactly 2 numeric arguments.");
        return (this.numArg(name, args[0]) && this.numArg(name, args[1])) ? 1 : 0;
      }
      case "or": {
        if (args.length !== 2) throw new Error("or() expects exactly 2 numeric arguments.");
        return (this.numArg(name, args[0]) || this.numArg(name, args[1])) ? 1 : 0;
      }
      case "nand": {
        if (args.length !== 2) throw new Error("nand() expects exactly 2 numeric arguments.");
        return !(this.numArg(name, args[0]) && this.numArg(name, args[1])) ? 1 : 0;
      }
      case "nor": {
        if (args.length !== 2) throw new Error("nor() expects exactly 2 numeric arguments.");
        return !(this.numArg(name, args[0]) || this.numArg(name, args[1])) ? 1 : 0;
      }
      case "xor": {
        if (args.length !== 2) throw new Error("xor() expects exactly 2 numeric arguments.");
        const a = this.numArg(name, args[0]);
        const b = this.numArg(name, args[1]);
        return ((a ? 1 : 0) ^ (b ? 1 : 0)) ? 1 : 0;
      }
      // --- Rounding ---
      case "round": {
        if (args.length !== 2) throw new Error("round() expects exactly 2 numeric arguments.");
        const number = this.numArg(name, args[0]);
        const precision = this.numArg(name, args[1]);
        return parseFloat(number.toFixed(precision));
      }
      // --- String Comparisons ---
      case "stringsequal": {
        if (args.length !== 2) throw new Error("stringsequal() expects exactly 2 string arguments.");
        const str1 = this.strArg(name, args[0]);
        const str2 = this.strArg(name, args[1]);
        return str1 === str2 ? 1 : 0;
      }
      case "stringsequalnocase": {
        if (args.length !== 2) throw new Error("stringsequalnocase() expects exactly 2 string arguments.");
        const str1 = this.strArg(name, args[0]);
        const str2 = this.strArg(name, args[1]);
        return str1.toLowerCase() === str2.toLowerCase() ? 1 : 0;
      }
      // --- SNES/PC Address Conversion ---
      case "snestopc":
      case "pctosnes": {
        if (args.length !== 1) throw new Error(`${name}() expects exactly 1 argument.`);
        const value = this.numArg(name, args[0]);
        return name === "snestopc"
          ? this.getHost().convertSnesToPc(value)
          : this.getHost().convertPcToSnes(value);
      }
      // --- Filesize & File Status ---
      case "filesize":
      case "getfilestatus": {
        if (args.length !== 1) throw new Error(`${name}() expects exactly 1 argument.`);
        const value = this.strArg(name, args[0]);
        return name === "filesize"
          ? this.getHost().getFileSize(value)
          : this.getHost().getFileStatus(value);
      }
      // --- Preprocessor/Struct & Data Size Functions ---
      case "defined":
      case "sizeof":
      case "objectsize":
      case "datasize": {
        if (args.length !== 1) throw new Error(`${name}() expects exactly 1 argument.`);
        const value = this.strArg(name, args[0]);
        if (name === "defined") {
          return this.getHost().isDefined(value);
        }
        return this.getHost().getObjectSize(value, name === "sizeof");
      }
      // --- File Can-Read functions ---
      case "canreadfile1":
      case "canreadfile2":
      case "canreadfile3":
      case "canreadfile4": {
        if (args.length !== 2) throw new Error(`${name}() expects exactly 2 arguments.`);
        const filename = this.strArg(name, args[0]);
        const pos = this.numArg(name, args[1]);
        return this.getHost().canReadFile(filename, pos, parseInt(name.slice(-1), 10));
      }
      case "canreadfile": {
        if (args.length !== 3) throw new Error("canreadfile expects exactly 3 arguments (filename, pos, num).");
        const filename = this.strArg(name, args[0]);
        const pos = this.numArg(name, args[1]);
        const num = this.numArg(name, args[2]);
        return this.getHost().canReadFile(filename, pos, num);
      }
      // --- ROM Can-Read functions ---
      case "canread1":
      case "canread2":
      case "canread3":
      case "canread4": {
        if (args.length !== 1) throw new Error(`${name} expects exactly 1 numeric argument.`);
        const pos = this.numArg(name, args[0]);
        const size = parseInt(name.slice(-1), 10);
        return this.getHost().canReadRom(pos, size);
      }
      case "canread": {
        if (args.length !== 2) throw new Error("canread expects exactly 2 numeric arguments (pos, num).");
        const pos = this.numArg(name, args[0]);
        const num = this.numArg(name, args[1]);
        return this.getHost().canReadRom(pos, num);
      }
      // --- ROM Reading functions ---
      case "read1":
      case "read2":
      case "read3":
      case "read4": {
        if (args.length < 1 || args.length > 2)
          throw new Error(`${name} expects 1 or 2 numeric arguments.`);
        const pos = this.numArg(name, args[0]);
        const size = parseInt(name.slice(-1), 10);
        if (args.length === 1) {
          return this.getHost().readRom(pos, size);
        } else {
          const defVal = this.numArg(name, args[1]);
          return this.getHost().readRom(pos, size, defVal);
        }
      }
      // --- File Reading functions ---
      case "readfile1":
      case "readfile2":
      case "readfile3":
      case "readfile4": {
        if (args.length < 2 || args.length > 3) throw new Error(`${name} expects 2 or 3 arguments (filename, pos, [default]).`);
        const filename = this.strArg(name, args[0]);
        const pos = this.numArg(name, args[1]);
        const size = parseInt(name.slice(-1), 10);
        if (args.length === 3) {
          const defVal = this.numArg(name, args[2]);
          return this.getHost().readFile(filename, pos, size, defVal);
        } else {
          return this.getHost().readFile(filename, pos, size);
        }
      }
      // --- PC/Realbase ---
      case "pc":
      case "realbase": {
        if (args.length !== 0) throw new Error(`${name}() expects no arguments.`);
        return name === "pc"
          ? this.getHost().getCurrentAddress()
          : this.getHost().getCurrentBaseAddress();
      }
      default: {
        throw new Error(`Unknown built-in function '${name}'`);
      }
    }
  }

  /**
   * Validates an argument as a number.
   * @param {string} funcName The name of the function.
   * @param {number | string} arg The argument to validate.
   * @returns {number} The validated number.
   */
  numArg = (funcName: string, arg: number | string): number => {
    if (typeof arg === "string") {
      throw new Error(`Function '${funcName}' expected a numeric argument but got a string: ${arg}`);
    }
    return arg;
  }

  strArg = (funcName: string, arg: number | string): string => {
    if (typeof arg === "number") {
      throw new Error(`Function '${funcName}' expected a string argument but got a number: ${arg}`);
    }
    return arg;
  }

  parseFunctionDefinition = (): void => {
    debug("parseFunctionDefinition", this.str)
    // Remove line continuations (backslash-newline)
    const cleanDef = this.str.replace(/\\\s*\n/g, "");
    // Regex: function <name>([param1, param2, ...]) = <expression>
    // eslint-disable-next-line security/detect-unsafe-regex
    const regex = /^function\s+(\w+)(?:\(([\s\w,]*)\))?\s*=\s*(.+)$/;
    const match = cleanDef.match(regex);
    if (!match || !match[1] || !match[3]) {
      throw new Error("Invalid function definition syntax.");
    }
    const name = match[1];
    const paramsStr = match[2] || "";
    const content = match[3].trim();
    // Split parameters by comma and trim spaces.
    const params = paramsStr
      ? paramsStr.split(",").map(p => p.trim()).filter(p => p.length > 0)
      : [];
    // Remove the function definition from this.str
    this.str = this.str.substring(match[0].length).trim();

    // Store the user-defined function, overwriting any existing function of the same name
    this.userFunctions.set(name, { args: params, content });
    debug("parseFunctionDefinition =", { args: params, content });
  }

  private getHost(): ExpressionHost {
    if (!this.host) {
      throw new Error("ExpressionHost not set.");
    }
    return this.host;
  }
}
