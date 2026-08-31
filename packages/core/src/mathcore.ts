import type { ExpressionHost, MathValue } from "./architecture-types.js";
import { AssemblyError } from "./diagnostics.js";
import type {
  BinaryOperator,
  ExpressionNode,
  ReferenceExpressionNode,
  UnaryOperator,
} from "./ir/expression-node.js";
import {
  isReferenceExpressionNode,
  parseExpressionNode,
  parseLeadingReferenceExpression,
  renderExpressionNode,
  renderReferenceExpressionNode,
} from "./ir/expression-node.js";
import {
  incrementInternalCounter,
  isInternalInstrumentationActive,
  measureInternalPhase,
} from "./internal-instrumentation.js";

let debug = (..._: unknown[]) => {};
/* c8 ignore next 4 */
try {
  const { default: d } = await import("debug");
  debug = d("MathCore");
} catch {}

type UserFunction = {
  readonly args: readonly string[];
  readonly content: string;
};

export type RegisteredExpressionFunction = {
  readonly minimumArguments: number;
  readonly maximumArguments: number;
  readonly evaluate: (args: readonly MathValue[]) => MathValue;
};

type BinaryOperatorSpec = {
  readonly priority: number;
  readonly operation: (left: number, right: number) => number;
};

type OperatorTable = { readonly [K in BinaryOperator]: BinaryOperatorSpec };

/**
 * Escapes a string for safe use inside a regular expression pattern.
 * @param {string} value The raw string value.
 * @returns {string} The escaped regular-expression fragment.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
}

/**
 * Throws a math evaluation error.
 * @param {string} message The message to throw.
 * @returns {never} Never returns.
 */
function throwMathError(message: string): never {
  throw new AssemblyError("MATH_EVALUATION_ERROR", message);
}

/**
 * Looks up a binary operator spec without falling through to a prefix token.
 * @param {OperatorTable} operators The operator table.
 * @param {string} token The candidate operator token.
 * @returns {BinaryOperatorSpec | undefined} The matching spec, if any.
 */
function getOperator(operators: OperatorTable, token: string): BinaryOperatorSpec | undefined {
  // `Object.hasOwn` avoids treating a two-char prefix as present when it isn't a key.
  if (!Object.hasOwn(operators, token)) {
    return undefined;
  }
  return operators[token as BinaryOperator];
}

const OPERATORS: OperatorTable = {
  // Higher priority binds tighter. Same-level ops are left-associative via priority+1.
  "**": { priority: 6, operation: (left, right) => Math.pow(left, right) },
  "*": { priority: 5, operation: (left, right) => left * right },
  "/": {
    priority: 5,
    operation: (left, right) => (right !== 0 ? left / right : throwMathError("Division by zero")),
  },
  "%": {
    priority: 5,
    operation: (left, right) => (right !== 0 ? left % right : throwMathError("Modulo by zero")),
  },
  "+": { priority: 4, operation: (left, right) => left + right },
  "-": { priority: 4, operation: (left, right) => left - right },
  "<<": { priority: 3, operation: (left, right) => left << right },
  ">>": { priority: 3, operation: (left, right) => left >> right },
  "&": { priority: 3, operation: (left, right) => left & right },
  "|": { priority: 3, operation: (left, right) => left | right },
  "^": { priority: 3, operation: (left, right) => left ^ right },
  "<": { priority: 2, operation: (left, right) => (left < right ? 1 : 0) },
  ">": { priority: 2, operation: (left, right) => (left > right ? 1 : 0) },
  "<=": { priority: 2, operation: (left, right) => (left <= right ? 1 : 0) },
  ">=": { priority: 2, operation: (left, right) => (left >= right ? 1 : 0) },
  "==": { priority: 2, operation: (left, right) => (left === right ? 1 : 0) },
  "=": { priority: 2, operation: (left, right) => (left === right ? 1 : 0) },
  "!=": { priority: 2, operation: (left, right) => (left !== right ? 1 : 0) },
  "&&": { priority: 1, operation: (left, right) => (left && right ? 1 : 0) },
  "||": { priority: 0, operation: (left, right) => (left || right ? 1 : 0) },
};

const BUILTIN_NUMERIC_UNARY: Readonly<Record<string, (value: number) => number>> = {
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

const NUMERIC_UNARY_ALIASES: Readonly<Record<string, string>> = {
  arcsin: "asin",
  arccos: "acos",
  arctan: "atan",
};

const STRING_FIRST_ARG_FUNCTIONS = new Set([
  "defined",
  "sizeof",
  "objectsize",
  "datasize",
  "filesize",
  "getfilestatus",
]);

const STRING_TWO_ARG_FUNCTIONS = new Set(["stringsequal", "stringsequalnocase"]);

const FILE_STRING_FUNCTION = /^(?:canreadfile|readfile)\d?$/;

/**
 * Returns whether a character code is whitespace matching String#trim.
 * @param {number} code The character code.
 * @returns {boolean} Whether the character is trim whitespace.
 */
function isScanWhitespace(code: number): boolean {
  // Space, tab, LF, CR - the common ASCII trim set.
  if (code === 32 || code === 9 || code === 10 || code === 13) {
    return true;
  }
  // VT, FF, NBSP, BOM - also stripped by String#trim.
  if (code === 11 || code === 12 || code === 0xa0 || code === 0xfeff) {
    return true;
  }
  return false;
}

/**
 * Returns whether a character code matches `\w`.
 * @param {number} code The character code.
 * @returns {boolean} Whether the character is a word character.
 */
function isWordChar(code: number): boolean {
  if (code >= 48 && code <= 57) {
    return true;
  }
  if (code >= 65 && code <= 90) {
    return true;
  }
  if (code >= 97 && code <= 122) {
    return true;
  }
  return code === 95;
}

export class MathCore {
  readonly pureStringExpressionCache = new Map<string, number>();
  readonly roundedPureStringExpressionCache = new Map<string, number>();
  readonly pureStringClassification = new Map<string, boolean>();
  readonly instrumentedExpressionStrings = new Set<string>();
  readonly instrumentedPureExpressionStrings = new Set<string>();
  instrumentedExpressionNodes = new WeakSet<object>();
  instrumentedPureExpressionNodes = new WeakSet<object>();

  host?: ExpressionHost;
  math_round = false;

  readonly userFunctions = new Map<string, UserFunction>();
  readonly expressionFunctions = new Map<string, RegisteredExpressionFunction>();
  readonly operators = OPERATORS;

  /** Full expression currently being scanned. */
  scanSource = "";
  /** Byte offset into `scanSource`; `str` is the slice from here to the end. */
  scanIndex = 0;

  /**
   * Remaining unconsumed expression text.
   * @returns {string} The unconsumed source from the scan cursor.
   */
  get str(): string {
    return this.scanSource.slice(this.scanIndex);
  }

  /**
   * Replaces the expression being scanned.
   * @param {string} value The new expression source.
   */
  set str(value: string) {
    this.scanSource = value;
    this.scanIndex = 0;
  }

  /**
   * Advances the scan cursor past ASCII / trim whitespace.
   */
  skipWhitespace(): void {
    const source = this.scanSource;
    let index = this.scanIndex;
    while (index < source.length && isScanWhitespace(source.charCodeAt(index))) {
      index++;
    }
    this.scanIndex = index;
  }

  /**
   * Returns whether the remaining source starts with a literal.
   * @param {string} text The literal to match.
   * @returns {boolean} Whether the literal is present at the cursor.
   */
  remainingStartsWith(text: string): boolean {
    return this.scanSource.startsWith(text, this.scanIndex);
  }

  /**
   * Consumes a fixed number of characters from the scan cursor.
   * @param {number} count The number of characters to consume.
   */
  advance(count: number): void {
    this.scanIndex += count;
  }

  /**
   * Initialize the math core.
   */
  reset(): void {
    debug("reset");
    this.math_round = false;
    this.userFunctions.clear();
    this.clearExpressionCaches();
  }

  /**
   * Installs a target-provided expression function for this session.
   * @param {string | readonly string[]} names The canonical name and aliases.
   * @param {RegisteredExpressionFunction} expressionFunction The function descriptor and evaluator.
   */
  registerExpressionFunction(
    names: string | readonly string[],
    expressionFunction: RegisteredExpressionFunction,
  ): void {
    for (const name of typeof names === "string" ? [names] : names) {
      this.expressionFunctions.set(name.toLowerCase(), expressionFunction);
    }
  }

  /**
   * Starts a new expression-cache snapshot for an assembly.
   */
  beginAssemblySnapshot(): void {
    this.clearExpressionCaches();
  }

  /**
   * Releases expression values retained for a completed assembly.
   */
  endAssemblySnapshot(): void {
    this.clearExpressionCaches();
  }

  /**
   * Clears expression caches retained for the current assembly.
   */
  clearExpressionCaches(): void {
    this.pureStringExpressionCache.clear();
    this.roundedPureStringExpressionCache.clear();
    this.pureStringClassification.clear();
    this.instrumentedExpressionStrings.clear();
    this.instrumentedPureExpressionStrings.clear();
    // WeakSet has no clear(); drop the previous generation by replacing the set.
    this.instrumentedExpressionNodes = new WeakSet<object>();
    this.instrumentedPureExpressionNodes = new WeakSet<object>();
  }

  /**
   * Evaluates an expression.
   * This is a direct conversion of `math` in `asar_math.cpp`.
   * @param {string} expression The expression to evaluate.
   * @returns {number} The result of the expression.
   */
  math = (expression: string | ExpressionNode): number => {
    if (isInternalInstrumentationActive()) {
      return measureInternalPhase("expressionEvaluation", () => {
        this.recordExpressionEvaluation(expression);
        return this.evaluateMathInput(expression);
      });
    }
    return this.evaluateMathInput(expression);
  };

  /**
   * Evaluates a string or typed expression without instrumentation dispatch.
   * @param {string | ExpressionNode} expression The expression to evaluate.
   * @returns {number} The expression result.
   */
  evaluateMathInput(expression: string | ExpressionNode): number {
    if (typeof expression !== "string") {
      return this.evaluateExpressionNode(expression);
    }
    return this.evaluateCachedStringExpression(expression);
  }

  /**
   * Reuses successful results only for strings proven to contain literal operators.
   * @param {string} expression The legacy expression source.
   * @returns {number} The expression result.
   */
  evaluateCachedStringExpression(expression: string): number {
    let isPure = this.pureStringClassification.get(expression);
    if (isPure === undefined) {
      isPure = this.isPureExpressionNode(parseExpressionNode(expression));
      this.pureStringClassification.set(expression, isPure);
    }
    if (!isPure) {
      return this.evaluateStringExpression(expression);
    }

    // Truncation changes results, so rounded and unrounded evals keep separate caches.
    const cache = this.math_round
      ? this.roundedPureStringExpressionCache
      : this.pureStringExpressionCache;
    const cached = cache.get(expression);
    if (cached !== undefined) {
      incrementInternalCounter("pureStringExpressionCacheHits");
      return cached;
    }

    incrementInternalCounter("pureStringExpressionCacheMisses");
    const result = this.evaluateStringExpression(expression);
    cache.set(expression, result);
    return result;
  }

  /**
   * Records the shape and reuse of a top-level expression evaluation.
   * @param {string | ExpressionNode} expression The evaluated expression.
   */
  recordExpressionEvaluation(expression: string | ExpressionNode): void {
    incrementInternalCounter("expressionEvaluations");
    if (typeof expression === "string") {
      incrementInternalCounter("expressionStringEvaluations");
      if (!this.instrumentedExpressionStrings.has(expression)) {
        this.instrumentedExpressionStrings.add(expression);
        incrementInternalCounter("expressionUniqueStringEvaluations");
        if (this.isPureExpressionNode(parseExpressionNode(expression))) {
          this.instrumentedPureExpressionStrings.add(expression);
          incrementInternalCounter("pureStringExpressionUniqueValues");
        }
      }
      if (this.instrumentedPureExpressionStrings.has(expression)) {
        incrementInternalCounter("pureStringExpressionEvaluations");
      }
      return;
    }

    incrementInternalCounter("expressionNodeEvaluations");
    if (!this.instrumentedExpressionNodes.has(expression)) {
      this.instrumentedExpressionNodes.add(expression);
      incrementInternalCounter("expressionUniqueNodeEvaluations");
    }
    if (!this.isPureExpressionNode(expression)) {
      return;
    }
    incrementInternalCounter("pureExpressionEvaluations");
    if (!this.instrumentedPureExpressionNodes.has(expression)) {
      this.instrumentedPureExpressionNodes.add(expression);
      incrementInternalCounter("pureExpressionUniqueNodes");
    }
  }

  /**
   * Determines whether an expression depends only on literal operators.
   * @param {ExpressionNode} expression The expression to classify.
   * @returns {boolean} Whether the result is independent of assembler state.
   */
  isPureExpressionNode(expression: ExpressionNode): boolean {
    switch (expression.type) {
      case "literal":
        return true;
      case "unary":
        return this.isPureExpressionNode(expression.argument);
      case "binary":
        return (
          this.isPureExpressionNode(expression.left) && this.isPureExpressionNode(expression.right)
        );
      default:
        return false;
    }
  }

  /**
   * Evaluates a string expression using the legacy parser.
   * @param {string} expression The expression to evaluate.
   * @returns {number} The result of the expression.
   */
  evaluateStringExpression(expression: string): number {
    debug("math", expression);
    this.str = expression.trim();

    const rval = this.evalMath(0);
    if (rval === undefined) {
      throw new AssemblyError("MATH_INVALID_INPUT", "Invalid input: empty expression.");
    }

    this.skipWhitespace();
    if (this.scanIndex < this.scanSource.length) {
      if (this.remainingStartsWith(",")) {
        throw new AssemblyError("MATH_INVALID_INPUT", `Invalid input: ${this.str}`);
      }
      // Leftover tokens that are not a comma are treated as mismatched parentheses,
      // matching the original Asar leftover check.
      throw new AssemblyError("MATH_MISMATCHED_PARENTHESES", "Mismatched parentheses.");
    }

    debug(`math: ${expression} = ${rval}`);
    return rval;
  }

  /**
   * Evaluates an expression node using typed dispatch before falling back to string parsing.
   * @param {ExpressionNode} expression The expression node to evaluate.
   * @returns {number} The numeric result.
   */
  evaluateExpressionNode(expression: ExpressionNode): number {
    if (isReferenceExpressionNode(expression)) {
      return this.evaluateReferenceExpressionNode(expression);
    }

    switch (expression.type) {
      case "literal":
        return this.parseLiteralNode(expression.value);
      case "string":
        throw new AssemblyError(
          "MATH_STRING_NOT_NUMERIC",
          `String expression is not directly numeric: ${expression.value}`,
        );
      case "call":
        return this.callFunction(
          expression.callee.name,
          expression.arguments.map((argument, index) =>
            this.evaluateCallArgument(expression.callee.name, index, argument),
          ),
        );
      case "unary":
        return this.evaluateUnaryExpressionNode(expression.operator, expression.argument);
      case "binary":
        return this.evaluateBinaryExpressionNode(
          expression.operator,
          expression.left,
          expression.right,
        );
      case "range":
        throw new AssemblyError(
          "MATH_RANGE_NOT_NUMERIC",
          `Range expression is not directly numeric: ${renderExpressionNode(expression)}`,
        );
      case "raw":
      default:
        return this.evaluateStringExpression(expression.value);
    }
  }

  /**
   * Evaluates call argument.
   * @param {string} functionName The function name.
   * @param {number} argumentIndex The argument index.
   * @param {ExpressionNode} argument The argument.
   * @returns {number | string} The result.
   */
  evaluateCallArgument(
    functionName: string,
    argumentIndex: number,
    argument: ExpressionNode,
  ): number | string {
    if (this.isStringArgument(functionName, argumentIndex)) {
      // String slots (defined, sizeof, filesize, ...) keep the source text, not a label value.
      switch (argument.type) {
        case "identifier":
          return argument.name;
        case "string":
          return argument.value;
        case "raw":
          return argument.value.replace(/^["']|["']$/g, "");
        default:
          return renderExpressionNode(argument);
      }
    }

    switch (argument.type) {
      case "string":
        return argument.value;
      case "range":
        return renderExpressionNode(argument);
      case "raw":
        return this.evaluateStringExpression(argument.value);
      default:
        if (isReferenceExpressionNode(argument)) {
          return argument.type === "defineReference"
            ? renderReferenceExpressionNode(argument)
            : this.resolveNumericIdentifierArgument(
                renderReferenceExpressionNode(argument, {
                  renderIndex: (node) => this.evaluateExpressionNode(node).toString(),
                }),
              );
        }
        return this.evaluateExpressionNode(argument);
    }
  }

  /**
   * Evaluates unary expression node.
   * @param {UnaryOperator} operator The operator.
   * @param {ExpressionNode} argument The argument.
   * @returns {number} The result.
   */
  evaluateUnaryExpressionNode(operator: UnaryOperator, argument: ExpressionNode): number {
    const value = this.evaluateExpressionNode(argument);
    switch (operator) {
      case "<:":
        return value >>> 16;
      case "<":
        return value & 0xff;
      case ">":
        return (value >> 8) & 0xff;
      case "^":
        return (value >> 16) & 0xff;
      case "~":
        return ~value;
      case "-":
        return -value;
      case "+":
      default:
        return value;
    }
  }

  /**
   * Evaluates binary expression node.
   * @param {BinaryOperator} operator The operator.
   * @param {ExpressionNode} left The left.
   * @param {ExpressionNode} right The right.
   * @returns {number} The result.
   */
  evaluateBinaryExpressionNode(
    operator: BinaryOperator,
    left: ExpressionNode,
    right: ExpressionNode,
  ): number {
    const spec = this.operators[operator];
    return spec.operation(this.evaluateExpressionNode(left), this.evaluateExpressionNode(right));
  }

  /**
   * Resolves numeric identifier argument.
   * @param {string} identifier The identifier.
   * @returns {number | string} The result.
   */
  resolveNumericIdentifierArgument(identifier: string): number | string {
    try {
      const resolved = this.getHost().resolveLabel(identifier);
      return typeof resolved === "number" ? resolved : identifier;
    } catch {
      return identifier;
    }
  }

  /**
   * Evaluates reference expression node.
   * @param {ReferenceExpressionNode} expression The expression.
   * @returns {number} The result.
   */
  evaluateReferenceExpressionNode(expression: ReferenceExpressionNode): number {
    if (expression.type === "defineReference") {
      throw new Error(`Unresolved define reference: ${renderReferenceExpressionNode(expression)}`);
    }

    const reference = renderReferenceExpressionNode(expression, {
      renderIndex: (node) => this.evaluateExpressionNode(node).toString(),
    });
    const resolved = this.getHost().resolveLabel(reference);
    if (typeof resolved === "number") {
      return resolved;
    }
    throw new Error(`Reference '${reference}' did not resolve to a numeric value.`);
  }

  /**
   * Resolves leading local label reference.
   * @param {string} input The input.
   * @returns {{ label: string; length: number } | undefined} The result.
   */
  resolveLeadingLocalLabelReference(input: string): { label: string; length: number } | undefined {
    const match = input.match(/^(\.+\w+)/);
    if (!match) {
      return undefined;
    }
    return { label: match[1], length: match[1].length };
  }

  /**
   * Checks whether string argument.
   * @param {string} functionName The function name.
   * @param {number} argumentIndex The argument index.
   * @returns {boolean} The result.
   */
  isStringArgument(functionName: string, argumentIndex: number): boolean {
    if (STRING_FIRST_ARG_FUNCTIONS.has(functionName)) {
      return argumentIndex === 0;
    }
    if (STRING_TWO_ARG_FUNCTIONS.has(functionName)) {
      return argumentIndex < 2;
    }
    if (FILE_STRING_FUNCTION.test(functionName)) {
      return argumentIndex === 0;
    }
    return false;
  }

  /**
   * Parses literal node.
   * @param {string} value The value.
   * @returns {number} The result.
   */
  parseLiteralNode(value: string): number {
    if (/^-?\d+$/.test(value)) {
      return Number.parseInt(value, 10);
    }
    if (/^\$[\dA-Fa-f]+$/.test(value)) {
      return Number.parseInt(value.slice(1), 16);
    }
    if (/^0x[\da-f]+$/i.test(value)) {
      return Number.parseInt(value.slice(2), 16);
    }
    if (/^%[01]+$/.test(value)) {
      return Number.parseInt(value.slice(1), 2);
    }
    throw new Error(`Unsupported literal expression: ${value}`);
  }

  /**
   * Evaluates a mathematical expression.
   * This replaces the C++ `eval` function.
   * @param {number} depth The current depth of nested expressions.
   * @param {string} [stopChar] The character to stop the evaluation at.
   * @returns {number | undefined} The result of the evaluated expression, or
   * `undefined` when an inline function definition consumes the expression.
   */
  evalMath(depth: number = 0, stopChar?: string): number | undefined {
    debug("evalMath", { depth, stopChar, scanIndex: this.scanIndex });

    let left: number | undefined;

    // If there's a function definition inline, parse and skip it.
    if (this.remainingStartsWith("function")) {
      this.parseFunctionDefinition();
      left = this.evalMath(depth, stopChar);
    } else if (this.scanIndex < this.scanSource.length) {
      left = this.getnum();
    }

    if (left === undefined) {
      return undefined;
    }

    if (Number.isNaN(left)) {
      throw new Error(`Invalid number: ${left}`);
    }
    debug("evalMath after getnum", left);

    // Skip whitespace after getnum instead of reallocating a trimmed remainder.
    this.skipWhitespace();

    // After getnum, we might still have leftover operators to process.
    // Keep processing them until we're done or hit the stopChar.
    while (this.scanIndex < this.scanSource.length) {
      this.skipWhitespace();

      // Break if we hit our stopping character (for a nested call)
      if (stopChar && this.remainingStartsWith(stopChar)) {
        break;
      }

      // Break if we hit a closing bracket or comma outside of their context
      const nextChar = this.scanSource[this.scanIndex];
      if (nextChar === "," || nextChar === ")" || nextChar === "]") {
        break;
      }

      // Peek for the next operator allowed at this precedence depth
      const op = this.peekNextOperator(this.operators, depth);
      debug("evalMath peekNextOperator =", op);

      // No valid operator at this level => done with this level
      if (!op) break;

      // Consume the operator from the source
      this.advance(op.length);
      this.skipWhitespace();

      // Evaluate the right side at a higher depth
      const right = this.evalMath(this.operators[op].priority + 1, stopChar);
      if (right === undefined) {
        throw new Error(`Missing right operand for operator '${op}'.`);
      }
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
   * @param {OperatorTable} operators The operators to check.
   * @param {number} depth The current depth of nested expressions.
   * @returns {BinaryOperator | null} The matching operator or null if no match.
   */
  peekNextOperator(operators: OperatorTable, depth: number): BinaryOperator | null {
    // Skip whitespace so operator matching is not confused by padding.
    this.skipWhitespace();
    if (this.scanIndex >= this.scanSource.length) {
      debug("peekNextOperator = null");
      return null;
    }

    // Try matching the next two characters first. If they form a known operator
    // (`&&`, `||`, `==`, `**`, ...), do not fall through to a one-character prefix
    // (`&` vs `&&`). When the two-character operator exists but is too weak for
    // this depth, return null rather than consuming `&` / `|` / `=`.
    const remaining = this.scanSource.length - this.scanIndex;
    if (remaining >= 2) {
      const twoChars = this.scanSource.slice(this.scanIndex, this.scanIndex + 2);
      const twoOp = getOperator(operators, twoChars);
      if (twoOp) {
        if (twoOp.priority >= depth) {
          debug("peekNextOperator twoChars", twoChars);
          return twoChars as BinaryOperator;
        }
        debug("peekNextOperator = null");
        return null;
      }
    }

    // Otherwise, check a single-character operator against the current depth.
    const oneChar = this.scanSource[this.scanIndex];
    const oneOp = getOperator(operators, oneChar);
    if (oneOp && oneOp.priority >= depth) {
      debug("peekNextOperator oneChar", oneChar);
      return oneChar as BinaryOperator;
    }

    // No operator matched
    debug("peekNextOperator = null");
    return null;
  }

  /**
   * Parses numbers from a string while consuming valid characters.
   * @param {RegExp} regex The regular expression to test against the string.
   * @returns {string} The substring of the string that matches the regular expression.
   */
  consumeWhile(regex: RegExp): string {
    debug("consumeWhile", regex);
    const source = this.scanSource;
    const start = this.scanIndex;
    let index = start;
    while (index < source.length && regex.test(source[index])) {
      index++;
    }
    const result = source.slice(start, index);
    this.scanIndex = index;
    return result;
  }

  /**
   * Retrieves a number from the string.
   * This implements `getnumcore` and `getnum`.
   * @returns {number} The number from the string.
   */
  getnum = (): number => {
    debug("getnum:", this.scanIndex);
    this.skipWhitespace();

    // Process prefix operators FIRST - before any function call processing
    let applyBitshift = false;
    let sign = 1;

    // Check for prefix operators in a loop
    while (true) {
      if (this.remainingStartsWith("<:")) {
        this.advance(2);
        this.skipWhitespace();
        applyBitshift = true;
      } else if (
        this.remainingStartsWith("<") &&
        !this.remainingStartsWith("<<") &&
        !this.remainingStartsWith("<=")
      ) {
        this.advance(1);
        this.skipWhitespace();
        return (sign * (this.getnum() & 0xff)) | 0;
      } else if (
        this.remainingStartsWith(">") &&
        !this.remainingStartsWith(">>") &&
        !this.remainingStartsWith(">=")
      ) {
        this.advance(1);
        this.skipWhitespace();
        return (sign * ((this.getnum() >> 8) & 0xff)) | 0;
      } else if (this.remainingStartsWith("^")) {
        this.advance(1);
        this.skipWhitespace();
        return (sign * ((this.getnum() >> 16) & 0xff)) | 0;
      } else if (this.remainingStartsWith("~")) {
        this.advance(1);
        this.skipWhitespace();
        return ~this.getnum(); // Immediately compute bitwise NOT
      } else if (this.remainingStartsWith("!") && !this.remainingStartsWith("!=")) {
        // Asar `!` is bitwise NOT only when the next char cannot start a define
        // (`!$00`, `!10`, `!(expr)`). `!ROMType_...` / `!{name}` stay as define
        // prefixes so FileType-style identifiers are not `~label`. `!=` is
        // inequality. Break after a define-like `!` so this prefix loop does
        // not spin forever on the same character.
        const after = this.scanSource[this.scanIndex + 1];
        let isDefineLike = after === "{";
        if (after !== undefined) {
          const code = after.charCodeAt(0);
          if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95) {
            isDefineLike = true;
          }
        }
        if (!isDefineLike) {
          this.advance(1);
          this.skipWhitespace();
          return ~this.getnum();
        }
        break;
      } else if (this.remainingStartsWith("-")) {
        this.advance(1);
        this.skipWhitespace();
        sign *= -1;
      } else if (this.remainingStartsWith("+")) {
        this.advance(1);
        this.skipWhitespace();
        // '+' is a no-op
      } else {
        break;
      }
    }

    // If the next token is a function call: e.g. myFunc(1234)
    const fnName = this.scanFunctionCallName();
    if (fnName !== undefined) {
      debug("getnum function:", fnName);
      const args: (number | string)[] = [];
      // scanFunctionCallName leaves the cursor on '('
      if (this.scanSource[this.scanIndex] === "(") {
        this.advance(1); // remove '('
        this.skipWhitespace();
        // Parse arguments until ')'
        if (!this.remainingStartsWith(")")) {
          while (true) {
            this.skipWhitespace();
            // Consume leading comma so next argument is parsed without it (e.g. after string literal)
            if (this.remainingStartsWith(",")) {
              this.advance(1);
              this.skipWhitespace();
            }
            debug("getnum while 1", this.scanIndex);
            if (this.remainingStartsWith(")")) {
              break;
            }
            // Quoted string argument
            if (this.remainingStartsWith('"')) {
              args.push(this.parseStringLiteral());
            } else if (this.isStringArgument(fnName, args.length)) {
              // Unquoted identifier / path for defined(), sizeof(), filesize(), etc.
              args.push(this.parseUnquotedStringArgument(fnName));
            } else {
              // Parse numeric expression
              const val = this.evalMath(0, ")");
              if (val === undefined) {
                throw new Error(`Missing function argument for '${fnName}'.`);
              }
              args.push(val);
            }

            this.skipWhitespace();
            debug("getnum while 2", this.scanIndex);
            if (this.remainingStartsWith(")")) {
              break;
            }
            if (this.remainingStartsWith(",")) {
              this.advance(1);
              this.skipWhitespace();
              continue;
            }
            throw new Error(`Expected ',' or ')' in function call arguments: ${this.str}`);
          }
        }

        // User functions re-enter math() and overwrite the scan cursor, so snapshot
        // the outer source and the index just past this call's closing ')'.
        const outerSource = this.scanSource;
        const afterCall = this.scanIndex + 1;

        // Now calculate the function result
        const result = this.callFunction(fnName, args);
        debug("getnum result =", result);

        // Restore everything AFTER the function call
        this.scanSource = outerSource;
        this.scanIndex = afterCall;
        this.skipWhitespace();
        debug("getnum leftover index =", this.scanIndex);

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
    if (this.remainingStartsWith("(")) {
      this.advance(1);
      this.skipWhitespace();
      // Use evalMath(0, ")") to parse until the matching ')'
      const nestedValue = this.evalMath(0, ")");
      if (nestedValue === undefined) {
        throw new Error("Empty parenthesized expression.");
      }
      value = nestedValue;
      debug("getnum after paren", this.scanIndex);
      if (!this.remainingStartsWith(")")) {
        throw new Error("Mismatched parentheses.");
      }
      // Remove the closing parenthesis
      this.advance(1);
      this.skipWhitespace();
    } else if (this.remainingStartsWith("$")) {
      this.advance(1);
      value = parseInt(this.consumeWhile(/[\dA-Fa-f]/), 16);
    } else if (this.remainingStartsWith("0x")) {
      this.advance(2);
      value = parseInt(this.consumeWhile(/[\dA-Fa-f]/), 16);
    } else if (this.remainingStartsWith("%")) {
      this.advance(1);
      value = parseInt(this.consumeWhile(/[01]/), 2);
    } else if (/\d/.test(this.scanSource[this.scanIndex] ?? "")) {
      value = parseFloat(this.consumeWhile(/[\d.]/));
    } else {
      // Fallback: try to resolve identifiers (e.g. label resolver).
      const remaining = this.str;
      const unnamedMatch = remaining.match(/^(:(\++|-+))/);
      if (unnamedMatch) {
        this.advance(unnamedMatch[1].length);
        this.skipWhitespace();
        const resolved = this.getHost().resolveLabel(unnamedMatch[1]);
        if (typeof resolved !== "number") {
          throw new Error(`Reference '${unnamedMatch[1]}' did not resolve to a numeric value.`);
        }
        value = resolved;
      } else {
        const reference = parseLeadingReferenceExpression(remaining);
        if (reference) {
          this.advance(reference.length);
          this.skipWhitespace();
          const renderedReference = renderReferenceExpressionNode(reference.node, {
            renderIndex: (node) => this.evaluateExpressionNode(node).toString(),
          });
          const resolved = this.getHost().resolveLabel(renderedReference);
          if (typeof resolved !== "number") {
            throw new Error(`Reference '${renderedReference}' did not resolve to a numeric value.`);
          }
          value = resolved;
        } else {
          const localReference = this.resolveLeadingLocalLabelReference(remaining);
          if (localReference) {
            this.advance(localReference.length);
            this.skipWhitespace();
            const resolved = this.getHost().resolveLabel(localReference.label);
            if (typeof resolved !== "number") {
              throw new Error(
                `Reference '${localReference.label}' did not resolve to a numeric value.`,
              );
            }
            value = resolved;
          } else {
            const rootMatch = remaining.match(/^([A-Z_a-z]\w*)/);
            if (rootMatch && remaining.substring(rootMatch[1].length).trimStart().startsWith("[")) {
              throw new Error("Mismatched brackets in struct index");
            }
            throw new Error(`Invalid number: ${remaining}`);
          }
        }
      }
    }

    // Finally, apply sign and optional <:
    value = sign * value;
    if (applyBitshift) {
      value = value >>> 16;
    }
    return value;
  };

  /**
   * Scans a function-call name if the next token is `name(`.
   * Leaves the cursor on `(`.
   * @returns {string | undefined} The function name, if a call starts here.
   */
  scanFunctionCallName(): string | undefined {
    const source = this.scanSource;
    let index = this.scanIndex;
    if (index >= source.length || !isWordChar(source.charCodeAt(index))) {
      return undefined;
    }
    // Consume `\w+`
    index++;
    while (index < source.length && isWordChar(source.charCodeAt(index))) {
      index++;
    }
    const name = source.slice(this.scanIndex, index);
    // Allow whitespace between the name and '(' (`sqrt (16)`)
    while (index < source.length && isScanWhitespace(source.charCodeAt(index))) {
      index++;
    }
    if (source[index] !== "(") {
      return undefined;
    }
    // Leave the cursor on '(' so getnum can share the argument parser.
    this.scanIndex = index;
    return name;
  }

  /**
   * Parses a string literal from the current string with support for quotes.
   * @returns {string} The parsed string literal.
   */
  parseStringLiteral = (): string => {
    debug("parseStringLiteral");
    // We know the cursor is on a double-quote; no escape sequences.
    const source = this.scanSource;
    const start = this.scanIndex + 1; // skip leading "
    let index = start;
    while (index < source.length && source[index] !== '"') {
      index++;
    }
    if (index >= source.length) {
      throw new Error("Unterminated string literal in function call.");
    }
    const result = source.slice(start, index);
    this.scanIndex = index + 1; // skip the closing quote
    this.skipWhitespace();
    return result;
  };

  /**
   * Parses an unquoted string function argument up to a top-level comma or closing parenthesis.
   * Depth tracks nested `()` / `[]` so `Foo[1].bar` and `data/64kb.bin` stay one argument.
   * @param {string} functionName The function being called.
   * @returns {string} The raw argument text.
   */
  parseUnquotedStringArgument(functionName: string): string {
    this.skipWhitespace();
    const source = this.scanSource;
    const start = this.scanIndex;
    let depth = 0;
    let index = start;
    while (index < source.length) {
      const character = source[index];
      if (character === "(" || character === "[") {
        depth++;
      } else if (character === ")" || character === "]") {
        if (depth === 0) {
          break;
        }
        depth--;
      } else if (character === "," && depth === 0) {
        break;
      }
      index++;
    }
    const argument = source.slice(start, index).trim();
    this.scanIndex = index;
    if (!argument) {
      throw new Error(`Missing function argument for '${functionName}'.`);
    }
    return argument;
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
    // 2) Target/plugin contributions are active only when installed for this session.
    const expressionFunction = this.expressionFunctions.get(name.toLowerCase());
    if (expressionFunction) {
      if (
        args.length < expressionFunction.minimumArguments ||
        args.length > expressionFunction.maximumArguments
      ) {
        const expected =
          expressionFunction.minimumArguments === expressionFunction.maximumArguments
            ? `exactly ${expressionFunction.minimumArguments}`
            : `between ${expressionFunction.minimumArguments} and ${expressionFunction.maximumArguments}`;
        throw new Error(`${name}() expects ${expected} argument(s).`);
      }
      const result = expressionFunction.evaluate(args);
      if (typeof result !== "number") {
        throw new Error(`${name}() returned a non-numeric value.`);
      }
      return result;
    }
    // 3) Core built-ins dispatch locally.
    return this.callBuiltInFunction(name, args);
  };

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
      throw new Error(`Function '${name}' expects at least ${func.args.length} argument(s).`);
    }

    // Get the function body
    let content = func.content;

    // Replace parameters with their values
    for (let i = 0; i < func.args.length; i++) {
      const paramName = func.args[i];
      const argValue = args[i];

      // Replace all occurrences of the parameter name with its value
      // Use word boundaries to avoid partial matches
      // eslint-disable-next-line security/detect-non-literal-regexp
      const regex = new RegExp(`\\b${escapeRegExp(paramName)}\\b`, "g");
      const replacement =
        typeof argValue === "string" ? JSON.stringify(argValue) : argValue.toString();
      content = content.replace(regex, replacement);
    }

    debug("callUserFunction content =", content);

    // Parse the replaced content
    const result = this.math(content);

    debug("callUserFunction =", result);
    return result;
  };

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
        if (args.length !== 1) {
          throw new Error(`${name} expects exactly 1 numeric argument.`);
        }
        const builtinName = NUMERIC_UNARY_ALIASES[name] ?? name;
        const mathFunction = BUILTIN_NUMERIC_UNARY[builtinName];
        const val = this.numArg(name, args[0]);
        const result = mathFunction(val);
        if (Number.isNaN(result)) {
          throw new Error(`${name} returned NaN for argument ${val}`);
        }
        return result;
      }
      // Min, Max, Clamp
      case "min": {
        if (args.length < 2) throw new Error("min() expects at least 2 numeric arguments.");
        // Convert all arguments to numbers
        const numArgs = args.map((arg) => this.numArg(name, arg));
        return Math.min(...numArgs);
      }
      case "max": {
        if (args.length < 2) throw new Error("max() expects at least 2 numeric arguments.");
        // Convert all arguments to numbers
        const numArgs = args.map((arg) => this.numArg(name, arg));
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
        return (this.numArg(name, args[0]) >> 16) & 0xff;
      }
      case "offset": {
        if (args.length !== 2) throw new Error("offset() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[1]) - this.numArg(name, args[0]);
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
        if (args.length !== 2)
          throw new Error("greaterequal() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) >= this.numArg(name, args[1]) ? 1 : 0;
      }
      // --- Logical Bitwise Operations ---
      case "and": {
        if (args.length !== 2) throw new Error("and() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) && this.numArg(name, args[1]) ? 1 : 0;
      }
      case "or": {
        if (args.length !== 2) throw new Error("or() expects exactly 2 numeric arguments.");
        return this.numArg(name, args[0]) || this.numArg(name, args[1]) ? 1 : 0;
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
        return (a ? 1 : 0) ^ (b ? 1 : 0) ? 1 : 0;
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
        if (args.length !== 2)
          throw new Error("stringsequal() expects exactly 2 string arguments.");
        const str1 = this.strArg(name, args[0]);
        const str2 = this.strArg(name, args[1]);
        return str1 === str2 ? 1 : 0;
      }
      case "stringsequalnocase": {
        if (args.length !== 2)
          throw new Error("stringsequalnocase() expects exactly 2 string arguments.");
        const str1 = this.strArg(name, args[0]);
        const str2 = this.strArg(name, args[1]);
        return str1.toLowerCase() === str2.toLowerCase() ? 1 : 0;
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
        return this.getHost().getExpressionObjectSize(value, name === "sizeof");
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
        if (args.length !== 3)
          throw new Error("canreadfile expects exactly 3 arguments (filename, pos, num).");
        const filename = this.strArg(name, args[0]);
        const pos = this.numArg(name, args[1]);
        const num = this.numArg(name, args[2]);
        return this.getHost().canReadFile(filename, pos, num);
      }
      // --- File Reading functions ---
      case "readfile1":
      case "readfile2":
      case "readfile3":
      case "readfile4": {
        if (args.length < 2 || args.length > 3)
          throw new Error(`${name} expects 2 or 3 arguments (filename, pos, [default]).`);
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
  };

  /**
   * Validates an argument as a number.
   * @param {string} funcName The name of the function.
   * @param {number | string} arg The argument to validate.
   * @returns {number} The validated number.
   */
  numArg = (funcName: string, arg: number | string): number => {
    if (typeof arg === "string") {
      throw new Error(
        `Function '${funcName}' expected a numeric argument but got a string: ${arg}`,
      );
    }
    return arg;
  };

  /**
   * Validates an argument as a string.
   * @param {string} funcName The name of the function.
   * @param {number | string} arg The argument to validate.
   * @returns {string} The validated string.
   */
  strArg = (funcName: string, arg: number | string): string => {
    if (typeof arg === "number") {
      throw new Error(`Function '${funcName}' expected a string argument but got a number: ${arg}`);
    }
    return arg;
  };

  /**
   * Parses a function definition.
   */
  parseFunctionDefinition = (): void => {
    debug("parseFunctionDefinition", this.str);
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
      ? paramsStr
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      : [];
    // Remove the function definition from this.str
    this.str = this.str.substring(match[0].length).trim();

    // Store the user-defined function, overwriting any existing function of the same name
    this.userFunctions.set(name, { args: params, content });
    debug("parseFunctionDefinition =", { args: params, content });
  };

  /**
   * Gets host.
   * @returns {ExpressionHost} The result.
   */
  getHost(): ExpressionHost {
    if (!this.host) {
      throw new Error("ExpressionHost not set.");
    }
    return this.host;
  }
}
