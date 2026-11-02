/** Frozen B11 comparison oracle. Test-only: never import this scanner from runtime packages. */
import type { ExpressionHost, MathValue } from "../../src/architecture-types.js";
import { AssemblyError } from "../../src/diagnostics.js";
import {
  incrementInternalCounter,
  recordSyntaxBoundary,
  isInternalInstrumentationActive,
  measureInternalPhase,
  recordExpressionFallback,
} from "../../src/internal-instrumentation.js";
import { isSourceTextArgument } from "../../src/ir/expression-call-contracts.js";
import type {
  BinaryOperator,
  ExpressionNode,
  ReferenceExpressionNode,
  UnaryOperator,
} from "../../src/ir/expression-node.js";
import {
  isReferenceExpressionNode,
  parseExpressionAtSite,
  parseLiteralValue,
  parseLeadingReferenceExpression,
  renderExpressionNode,
  renderReferenceExpressionNode,
} from "../../src/ir/expression-node.js";
import { binaryPrecedence } from "../../src/ir/expression-operators.js";
import {
  getRawExpressionOutcome,
  type ExpressionFallbackSite,
} from "../../src/ir/expression-parse-state.js";
import {
  compileFunctionTemplate,
  bindFunctionTemplate,
  type FunctionTemplate,
} from "../../src/ir/function-template.js";

/** Older third-party hosts predate typed reference resolution and only provide `resolveLabel`. */
type OracleExpressionHost = Omit<ExpressionHost, "resolveReference"> &
  Partial<Pick<ExpressionHost, "resolveReference">>;

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
 * Throws a math evaluation error.
 * @param message The message to throw.
 * @returns Never returns.
 */
function throwMathError(message: string): never {
  throw new AssemblyError("MATH_EVALUATION_ERROR", message);
}

/**
 * Looks up a binary operator spec without falling through to a prefix token.
 * @param operators The operator table.
 * @param token The candidate operator token.
 * @returns The matching spec, if any.
 */
function isBinaryOperatorToken(value: string): value is BinaryOperator {
  switch (value) {
    case "**":
    case "*":
    case "/":
    case "%":
    case "+":
    case "-":
    case "<<":
    case ">>":
    case "&":
    case "|":
    case "^":
    case "<":
    case ">":
    case "<=":
    case ">=":
    case "==":
    case "=":
    case "!=":
    case "&&":
    case "||":
      return true;
    default:
      return false;
  }
}

function getOperator(
  operators: OperatorTable,
  token: string,
): { readonly operator: BinaryOperator; readonly spec: BinaryOperatorSpec } | undefined {
  // `Object.hasOwn` avoids treating a two-char prefix as present when it isn't a key.
  if (!isBinaryOperatorToken(token) || !Object.hasOwn(operators, token)) {
    return undefined;
  }
  return { operator: token, spec: operators[token] };
}

const OPERATORS: OperatorTable = {
  // Higher priority binds tighter. Same-level ops are left-associative via priority+1.
  "**": { priority: binaryPrecedence["**"], operation: (left, right) => Math.pow(left, right) },
  "*": { priority: binaryPrecedence["*"], operation: (left, right) => left * right },
  "/": {
    priority: binaryPrecedence["/"],
    operation: (left, right) => (right !== 0 ? left / right : throwMathError("Division by zero")),
  },
  "%": {
    priority: binaryPrecedence["%"],
    operation: (left, right) => (right !== 0 ? left % right : throwMathError("Modulo by zero")),
  },
  "+": { priority: binaryPrecedence["+"], operation: (left, right) => left + right },
  "-": { priority: binaryPrecedence["-"], operation: (left, right) => left - right },
  "<<": { priority: binaryPrecedence["<<"], operation: (left, right) => left << right },
  ">>": { priority: binaryPrecedence[">>"], operation: (left, right) => left >> right },
  "&": { priority: binaryPrecedence["&"], operation: (left, right) => left & right },
  "|": { priority: binaryPrecedence["|"], operation: (left, right) => left | right },
  "^": { priority: binaryPrecedence["^"], operation: (left, right) => left ^ right },
  "<": { priority: binaryPrecedence["<"], operation: (left, right) => (left < right ? 1 : 0) },
  ">": { priority: binaryPrecedence[">"], operation: (left, right) => (left > right ? 1 : 0) },
  "<=": { priority: binaryPrecedence["<="], operation: (left, right) => (left <= right ? 1 : 0) },
  ">=": { priority: binaryPrecedence[">="], operation: (left, right) => (left >= right ? 1 : 0) },
  "==": { priority: binaryPrecedence["=="], operation: (left, right) => (left === right ? 1 : 0) },
  "=": { priority: binaryPrecedence["="], operation: (left, right) => (left === right ? 1 : 0) },
  "!=": { priority: binaryPrecedence["!="], operation: (left, right) => (left !== right ? 1 : 0) },
  "&&": { priority: binaryPrecedence["&&"], operation: (left, right) => (left && right ? 1 : 0) },
  "||": { priority: binaryPrecedence["||"], operation: (left, right) => (left || right ? 1 : 0) },
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

/**
 * Returns whether a character code is whitespace matching String#trim.
 * @param code The character code.
 * @returns Whether the character is trim whitespace.
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
 * @param code The character code.
 * @returns Whether the character is a word character.
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

export class B11MathOracle {
  /** Definition identity owns cached syntax; replacing a function releases its previous template. */
  private readonly functionTemplates = new WeakMap<UserFunction, FunctionTemplate>();
  /** Parsed syntax is reused only within an assembly snapshot; state-dependent values are never cached. */
  readonly parsedStringExpressions = new Map<string, ExpressionNode>();

  readonly pureStringExpressionCache = new Map<string, number>();
  readonly roundedPureStringExpressionCache = new Map<string, number>();
  readonly pureStringClassification = new Map<string, boolean>();
  readonly instrumentedExpressionStrings = new Set<string>();
  readonly instrumentedPureExpressionStrings = new Set<string>();
  instrumentedExpressionNodes = new WeakSet();
  instrumentedPureExpressionNodes = new WeakSet();

  host?: OracleExpressionHost;
  math_round = false;

  readonly userFunctions = new Map<string, UserFunction>();
  readonly expressionFunctions = new Map<string, RegisteredExpressionFunction>();
  readonly operators = OPERATORS;

  /** Full expression currently being scanned. */
  scanSource = "";
  /** Byte offset into `scanSource`. `str` is the slice from here to the end. */
  scanIndex = 0;

  /**
   * Remaining unconsumed expression text.
   * @returns The unconsumed source from the scan cursor.
   */
  get str(): string {
    return this.scanSource.slice(this.scanIndex);
  }

  /**
   * Replaces the expression being scanned.
   * @param value The new expression source.
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
   * @param text The literal to match.
   * @returns Whether the literal is present at the cursor.
   */
  remainingStartsWith(text: string): boolean {
    return this.scanSource.startsWith(text, this.scanIndex);
  }

  /**
   * Consumes a fixed number of characters from the scan cursor.
   * @param count The number of characters to consume.
   */
  advance(count: number): void {
    this.scanIndex += count;
  }

  /**
   * Initialize the math core.
   */
  reset(): void {
    this.math_round = false;
    this.userFunctions.clear();
    this.clearExpressionCaches();
  }

  /**
   * Installs a target-provided expression function for this session.
   * @param names The canonical name and aliases.
   * @param expressionFunction The function descriptor and evaluator.
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
    this.parsedStringExpressions.clear();
    this.pureStringExpressionCache.clear();
    this.roundedPureStringExpressionCache.clear();
    this.pureStringClassification.clear();
    this.instrumentedExpressionStrings.clear();
    this.instrumentedPureExpressionStrings.clear();
    // WeakSet has no clear(). Drop the previous generation by replacing the set.
    this.instrumentedExpressionNodes = new WeakSet();
    this.instrumentedPureExpressionNodes = new WeakSet();
  }

  /**
   * Evaluates an expression.
   * This is a direct conversion of `math` in `asar_math.cpp`.
   * @param expression The expression to evaluate.
   * @returns The result of the expression.
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
   * @param expression The expression to evaluate.
   * @returns The expression result.
   */
  evaluateMathInput(expression: string | ExpressionNode): number {
    if (typeof expression !== "string") {
      return this.evaluateExpressionNode(expression);
    }
    return this.evaluateCachedStringExpression(expression);
  }

  /**
   * Reuses successful results only for strings proven to contain literal operators.
   * @param expression The legacy expression source.
   * @returns The expression result.
   */
  evaluateCachedStringExpression(expression: string): number {
    let parsed = this.parsedStringExpressions.get(expression);
    if (!parsed) {
      incrementInternalCounter("expressionParses");
      parsed = parseExpressionAtSite(expression, "math-cache");
      this.parsedStringExpressions.set(expression, parsed);
    } else {
      incrementInternalCounter("expressionParseCacheHits");
    }
    let isPure = this.pureStringClassification.get(expression);
    if (isPure === undefined) {
      isPure = this.isPureExpressionNode(parsed);
      this.pureStringClassification.set(expression, isPure);
    }
    if (!isPure) {
      return this.evaluateExpressionNode(parsed);
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
    const result = this.evaluateExpressionNode(parsed);
    cache.set(expression, result);
    return result;
  }

  /**
   * Records the shape and reuse of a top-level expression evaluation.
   * @param expression The evaluated expression.
   */
  recordExpressionEvaluation(expression: string | ExpressionNode): void {
    incrementInternalCounter("expressionEvaluations");
    if (typeof expression === "string") {
      incrementInternalCounter("expressionStringEvaluations");
      if (!this.instrumentedExpressionStrings.has(expression)) {
        this.instrumentedExpressionStrings.add(expression);
        incrementInternalCounter("expressionUniqueStringEvaluations");
        if (this.isPureExpressionNode(parseExpressionAtSite(expression, "instrumentation"))) {
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
   * @param expression The expression to classify.
   * @returns Whether the result is independent of assembler state.
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
      case "call":
      case "defineReference":
      case "identifier":
      case "index":
      case "member":
      case "range":
      case "error":
      case "relativeReference":
      case "sourceText":
      case "template":
      case "raw":
      case "string":
        break;
    }
    return false;
  }

  /**
   * Evaluates a string expression using the legacy parser.
   * @param expression The expression to evaluate.
   * @returns The result of the expression.
   */
  evaluateStringExpression(expression: string): number {
    recordSyntaxBoundary("legacy-evaluation");
    incrementInternalCounter("expressionLegacyEvaluations");
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

    return rval;
  }

  /**
   * Evaluates syntax directly; parser diagnostics are raised only when their occurrence is selected.
   * @param expression The expression node to evaluate.
   * @returns The numeric result.
   */
  evaluateExpressionNode(expression: ExpressionNode, round = true): number {
    const result = this.evaluateNodeValue(expression);
    if (Number.isNaN(result)) {
      throw new Error(`Invalid number: ${result}`);
    }
    // Native rounding occurs on recursive right operands and explicit groups, not after every
    // left-associative operation. Keeping the boundary on the node preserves decimal semantics.
    return this.math_round && (round || expression.parenthesized) ? Math.trunc(result) : result;
  }

  /** Typed dispatch is shared by parsed strings and IR callers; public raw adapters re-enter the same parser. */
  private evaluateNodeValue(expression: ExpressionNode): number {
    if (isReferenceExpressionNode(expression)) {
      return this.evaluateReferenceExpressionNode(expression);
    }

    switch (expression.type) {
      case "literal":
        return expression.numericValue ?? this.parseLiteralNode(expression.value);
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
      case "sourceText":
        throw new AssemblyError(
          "MATH_STRING_NOT_NUMERIC",
          `String expression is not directly numeric: ${expression.value}`,
        );
      case "template": {
        const host = this.host;
        if (expression.form === "source" && host?.bindExpressionTemplate) {
          return this.evaluateExpressionNode(host.bindExpressionTemplate(expression));
        }
        throw new Error(`Unbound expression template: ${expression.text}`);
      }
      case "error":
        if (expression.code) {
          throw new AssemblyError(expression.code, expression.message);
        }
        throw new Error(expression.message);
      case "raw":
        return this.evaluateLegacyNodeInput(expression, "numeric");
    }
    throw new Error("Unsupported expression node.");
  }

  /** Record explicit public raw adapters before parsing them with the shared grammar. */
  private evaluateLegacyNodeInput(
    expression: Extract<ExpressionNode, { type: "raw" }>,
    site: ExpressionFallbackSite,
  ): number {
    recordExpressionFallback(site, getRawExpressionOutcome(expression));
    // Hand-constructed legacy nodes are a public input adapter, never a request for another evaluator.
    return this.math(parseExpressionAtSite(expression.value, "public"));
  }

  evaluateCallArgument(
    functionName: string,
    argumentIndex: number,
    argument: ExpressionNode,
  ): number | string {
    if (argument.type === "sourceText") {
      return argument.value;
    }
    if (this.isStringArgument(functionName, argumentIndex)) {
      // String slots (defined, sizeof, filesize, ...) keep the source text, not a label value.
      switch (argument.type) {
        case "identifier":
          return argument.name;
        case "string":
          return argument.value;
        case "raw":
          return argument.value.replace(/^["']|["']$/g, "");
        case "binary":
        case "call":
        case "defineReference":
        case "index":
        case "literal":
        case "member":
        case "range":
        case "error":
        case "relativeReference":
        case "template":
        case "unary":
          break;
      }
      return renderExpressionNode(argument);
    }

    switch (argument.type) {
      case "string":
        return argument.value;
      case "range":
        return renderExpressionNode(argument);
      case "raw":
        return this.evaluateLegacyNodeInput(argument, "call-argument");
      case "binary":
      case "call":
      case "defineReference":
      case "identifier":
      case "index":
      case "literal":
      case "member":
      case "error":
      case "relativeReference":
      case "template":
      case "unary":
        break;
    }
    if (isReferenceExpressionNode(argument)) {
      if (argument.type === "defineReference") {
        // Old numeric argument slots expose an unbound define as source data; expansion owns activation.
        return argument.braced ? `!{${argument.content ?? ""}}` : `!${argument.name ?? ""}`;
      }
      try {
        return this.evaluateReferenceExpressionNode(argument);
      } catch (error) {
        // Numeric identifier arguments historically remain strings on lookup failure.
        if (argument.type === "identifier") {
          return argument.name;
        }
        throw error;
      }
    }
    return this.evaluateExpressionNode(argument);
  }

  evaluateUnaryExpressionNode(operator: UnaryOperator, argument: ExpressionNode): number {
    const value = this.evaluateExpressionNode(argument, false);
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

  evaluateBinaryExpressionNode(
    operator: BinaryOperator,
    left: ExpressionNode,
    right: ExpressionNode,
  ): number {
    const spec = this.operators[operator];
    return spec.operation(
      this.evaluateExpressionNode(left, false),
      this.evaluateExpressionNode(right),
    );
  }

  resolveNumericIdentifierArgument(identifier: string): number | string {
    try {
      const resolved = this.getHost().resolveLabel(identifier);
      return typeof resolved === "number" ? resolved : identifier;
    } catch {
      return identifier;
    }
  }

  evaluateReferenceExpressionNode(expression: ReferenceExpressionNode): number {
    const host = this.getHost();
    if (host.resolveReference) {
      const result = host.resolveReference(expression);
      if (result.kind === "resolved") {
        return result.value;
      }
      if (result.kind === "error") {
        throw result.error;
      }
      if (result.deferred) {
        return 0;
      }
      throw new Error(`Error: Label '${result.name}' not found.`);
    }
    // Older third-party hosts retain the string contract until the public API cutover.
    recordSyntaxBoundary("reference-to-text");
    const reference = renderReferenceExpressionNode(expression, {
      renderIndex: (node) => this.evaluateExpressionNode(node).toString(),
    });
    const resolved = host.resolveLabel(reference);
    if (typeof resolved === "number") {
      return resolved;
    }
    throw new Error(`Reference '${reference}' did not resolve to a numeric value.`);
  }

  resolveLeadingLocalLabelReference(input: string): { label: string; length: number } | undefined {
    const match = input.match(/^(\.+\w+)/);
    if (!match) {
      return undefined;
    }
    return { label: match[1], length: match[1].length };
  }

  isStringArgument(functionName: string, argumentIndex: number): boolean {
    return isSourceTextArgument(functionName, argumentIndex);
  }

  /** Interpret externally constructed literals; parsed literals already retain this value. */
  parseLiteralNode(value: string): number {
    return parseLiteralValue(value);
  }

  /**
   * Evaluates a mathematical expression.
   * This replaces the C++ `eval` function.
   * @param depth The current depth of nested expressions.
   * @param [stopChar] The character to stop the evaluation at.
   * @returns The result of the evaluated expression, or
   * `undefined` when an inline function definition consumes the expression.
   */
  evalMath(depth: number = 0, stopChar?: string): number | undefined {
    recordSyntaxBoundary("legacy-scanner");
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

      // No valid operator at this level => done with this level
      if (!op) {
        break;
      }

      // Consume the operator from the source
      this.advance(op.length);
      this.skipWhitespace();

      // Evaluate the right side at a higher depth
      const right = this.evalMath(this.operators[op].priority + 1, stopChar);
      if (right === undefined) {
        throw new Error(`Missing right operand for operator '${op}'.`);
      }

      // Apply the operation
      left = this.operators[op].operation(left, right);
    }

    if (this.math_round) {
      left = Math.trunc(left);
    }

    if (Number.isNaN(left)) {
      throw new Error(`Invalid number: ${left}`);
    }
    return left;
  }

  /**
   * Helper function to peek ahead at the next 1-2 characters and return a matching operator if found and depth-allowed.
   * @param operators The operators to check.
   * @param depth The current depth of nested expressions.
   * @returns The matching operator or null if no match.
   */
  peekNextOperator(operators: OperatorTable, depth: number): BinaryOperator | null {
    // Skip whitespace so operator matching is not confused by padding.
    this.skipWhitespace();
    if (this.scanIndex >= this.scanSource.length) {
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
        if (twoOp.spec.priority >= depth) {
          return twoOp.operator;
        }
        return null;
      }
    }

    // Otherwise, check a single-character operator against the current depth.
    // The cursor is already inside the source, so this index is a character.
    const oneChar = this.scanSource[this.scanIndex];
    const oneOp = getOperator(operators, oneChar);
    if (oneOp && oneOp.spec.priority >= depth) {
      return oneOp.operator;
    }

    // No operator matched
    return null;
  }

  /**
   * Parses numbers from a string while consuming valid characters.
   * @param regex The regular expression to test against the string.
   * @returns The substring of the string that matches the regular expression.
   */
  consumeWhile(regex: RegExp): string {
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
   * @returns The number from the string.
   */
  getnum = (): number => {
    recordSyntaxBoundary("legacy-scanner");
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
        const afterIndex = this.scanIndex + 1;
        const after =
          afterIndex >= 0 && afterIndex < this.scanSource.length
            ? this.scanSource[afterIndex]
            : undefined;
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

        // Restore everything AFTER the function call
        this.scanSource = outerSource;
        this.scanIndex = afterCall;
        this.skipWhitespace();

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
   * @returns The function name, if a call starts here.
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
   * @returns The parsed string literal.
   */
  parseStringLiteral = (): string => {
    // We know the cursor is on a double-quote. No escape sequences.
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
   * @param functionName The function being called.
   * @returns The raw argument text.
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
   * @param name The name of the function to call.
   * @param args The arguments to pass to the function.
   * @returns The result of the function call.
   */
  callFunction = (name: string, args: (number | string)[]): number => {
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
   * @param name The name of the function to call.
   * @param args The arguments to pass to the function.
   * @returns The result of the function call.
   */
  callUserFunction = (name: string, args: (number | string)[]): number => {
    // Get the function definition
    const func = this.userFunctions.get(name);
    if (!func) {
      throw new Error(`User function '${name}' not found.`);
    }

    // Check arguments
    if (args.length < func.args.length) {
      throw new Error(`Function '${name}' expects at least ${func.args.length} argument(s).`);
    }

    let template = this.functionTemplates.get(func);
    if (!template) {
      template = compileFunctionTemplate(func.content, func.args);
      this.functionTemplates.set(func, template);
    }
    return this.math(bindFunctionTemplate(template, args));
  };

  /**
   * Calls a built-in function by name, passing an array of arguments which can be strings or numbers.
   * @param name The name of the function to call.
   * @param args The arguments to pass to the function.
   * @returns The result of the function call.
   */
  callBuiltInFunction = (name: string, args: (number | string)[]): number => {
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
        if (args.length < 2) {
          throw new Error("min() expects at least 2 numeric arguments.");
        }
        // Binary Math.min calls retain NaN/signed-zero semantics without V8's argument-count limit.
        const numArgs = args.map((arg) => this.numArg(name, arg));
        return numArgs.reduce((minimum, value) => Math.min(minimum, value), Infinity);
      }
      case "max": {
        if (args.length < 2) {
          throw new Error("max() expects at least 2 numeric arguments.");
        }
        // Keep the same numeric conversion and special-value behavior for arbitrarily long lists.
        const numArgs = args.map((arg) => this.numArg(name, arg));
        return numArgs.reduce((maximum, value) => Math.max(maximum, value), -Infinity);
      }
      case "clamp": {
        if (args.length !== 3) {
          throw new Error("clamp() expects exactly 3 numeric arguments.");
        }
        const value = this.numArg(name, args[0]);
        const minVal = this.numArg(name, args[1]);
        const maxVal = this.numArg(name, args[2]);
        return Math.max(minVal, Math.min(maxVal, value));
      }
      // --- Safe Division and Conditional Selection ---
      case "safediv": {
        if (args.length !== 3) {
          throw new Error("safediv() expects exactly 3 numeric arguments.");
        }
        const dividend = this.numArg(name, args[0]);
        const divisor = this.numArg(name, args[1]);
        const defaultValue = this.numArg(name, args[2]);
        return divisor === 0 ? defaultValue : dividend / divisor;
      }
      case "select": {
        if (args.length !== 3) {
          throw new Error("select() expects exactly 3 numeric arguments.");
        }
        const statement = this.numArg(name, args[0]);
        const trueVal = this.numArg(name, args[1]);
        const falseVal = this.numArg(name, args[2]);
        return statement !== 0 ? trueVal : falseVal;
      }
      // --- Logical Operations ---
      case "not": {
        if (args.length !== 1) {
          throw new Error("not() expects exactly 1 numeric argument.");
        }
        const value = this.numArg(name, args[0]);
        return value === 0 ? 1 : 0;
      }
      case "bank": {
        if (args.length !== 1) {
          throw new Error("bank() expects exactly 1 numeric argument.");
        }
        // Return the bank of the value by shifting 16 bits to the right and masking with 0xFF
        return (this.numArg(name, args[0]) >> 16) & 0xff;
      }
      case "offset": {
        if (args.length !== 2) {
          throw new Error("offset() expects exactly 2 numeric arguments.");
        }
        return this.numArg(name, args[1]) - this.numArg(name, args[0]);
      }
      // --- Comparison Functions ---
      case "equal": {
        if (args.length !== 2) {
          throw new Error("equal() expects exactly 2 numeric arguments.");
        }
        return this.numArg(name, args[0]) === this.numArg(name, args[1]) ? 1 : 0;
      }
      case "notequal": {
        if (args.length !== 2) {
          throw new Error("notequal() expects exactly 2 numeric arguments.");
        }
        return this.numArg(name, args[0]) !== this.numArg(name, args[1]) ? 1 : 0;
      }
      case "less": {
        if (args.length !== 2) {
          throw new Error("less() expects exactly 2 numeric arguments.");
        }
        return this.numArg(name, args[0]) < this.numArg(name, args[1]) ? 1 : 0;
      }
      case "lessequal": {
        if (args.length !== 2) {
          throw new Error("lessequal() expects exactly 2 numeric arguments.");
        }
        return this.numArg(name, args[0]) <= this.numArg(name, args[1]) ? 1 : 0;
      }
      case "greater": {
        if (args.length !== 2) {
          throw new Error("greater() expects exactly 2 numeric arguments.");
        }
        return this.numArg(name, args[0]) > this.numArg(name, args[1]) ? 1 : 0;
      }
      case "greaterequal": {
        if (args.length !== 2) {
          throw new Error("greaterequal() expects exactly 2 numeric arguments.");
        }
        return this.numArg(name, args[0]) >= this.numArg(name, args[1]) ? 1 : 0;
      }
      // --- Logical Bitwise Operations ---
      case "and": {
        if (args.length !== 2) {
          throw new Error("and() expects exactly 2 numeric arguments.");
        }
        return this.numArg(name, args[0]) && this.numArg(name, args[1]) ? 1 : 0;
      }
      case "or": {
        if (args.length !== 2) {
          throw new Error("or() expects exactly 2 numeric arguments.");
        }
        return this.numArg(name, args[0]) || this.numArg(name, args[1]) ? 1 : 0;
      }
      case "nand": {
        if (args.length !== 2) {
          throw new Error("nand() expects exactly 2 numeric arguments.");
        }
        return !(this.numArg(name, args[0]) && this.numArg(name, args[1])) ? 1 : 0;
      }
      case "nor": {
        if (args.length !== 2) {
          throw new Error("nor() expects exactly 2 numeric arguments.");
        }
        return !(this.numArg(name, args[0]) || this.numArg(name, args[1])) ? 1 : 0;
      }
      case "xor": {
        if (args.length !== 2) {
          throw new Error("xor() expects exactly 2 numeric arguments.");
        }
        const a = this.numArg(name, args[0]);
        const b = this.numArg(name, args[1]);
        return (a ? 1 : 0) ^ (b ? 1 : 0) ? 1 : 0;
      }
      // --- Rounding ---
      case "round": {
        if (args.length !== 2) {
          throw new Error("round() expects exactly 2 numeric arguments.");
        }
        const number = this.numArg(name, args[0]);
        const precision = this.numArg(name, args[1]);
        return parseFloat(number.toFixed(precision));
      }
      // --- String Comparisons ---
      case "stringsequal": {
        if (args.length !== 2) {
          throw new Error("stringsequal() expects exactly 2 string arguments.");
        }
        const str1 = this.strArg(name, args[0]);
        const str2 = this.strArg(name, args[1]);
        return str1 === str2 ? 1 : 0;
      }
      case "stringsequalnocase": {
        if (args.length !== 2) {
          throw new Error("stringsequalnocase() expects exactly 2 string arguments.");
        }
        const str1 = this.strArg(name, args[0]);
        const str2 = this.strArg(name, args[1]);
        return str1.toLowerCase() === str2.toLowerCase() ? 1 : 0;
      }
      // --- Filesize & File Status ---
      case "filesize":
      case "getfilestatus": {
        if (args.length !== 1) {
          throw new Error(`${name}() expects exactly 1 argument.`);
        }
        const value = this.strArg(name, args[0]);
        return name === "filesize"
          ? this.getHost().getFileSize(value)
          : this.getHost().getFileStatus(value);
      }
      // --- Preprocessor/Struct & Data Size Functions ---
      case "countof":
      case "bytesof":
      case "startof":
      case "endof": {
        if (args.length !== 1) {
          throw new Error(`${name}() expects exactly 1 argument.`);
        }
        const host = this.getHost();
        if (!host.getExpressionStructMetadata) {
          throw new Error(`${name}() requires a struct metadata host.`);
        }
        return host.getExpressionStructMetadata(this.strArg(name, args[0]), name);
      }
      case "defined":
      case "sizeof":
      case "objectsize":
      case "datasize": {
        if (args.length !== 1) {
          throw new Error(`${name}() expects exactly 1 argument.`);
        }
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
        if (args.length !== 2) {
          throw new Error(`${name}() expects exactly 2 arguments.`);
        }
        const filename = this.strArg(name, args[0]);
        const pos = this.numArg(name, args[1]);
        return this.getHost().canReadFile(filename, pos, parseInt(name.slice(-1), 10));
      }
      case "canreadfile": {
        if (args.length !== 3) {
          throw new Error("canreadfile expects exactly 3 arguments (filename, pos, num).");
        }
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
        if (args.length < 2 || args.length > 3) {
          throw new Error(`${name} expects 2 or 3 arguments (filename, pos, [default]).`);
        }
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
        if (args.length !== 0) {
          throw new Error(`${name}() expects no arguments.`);
        }
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
   * @param funcName The name of the function.
   * @param arg The argument to validate.
   * @returns The validated number.
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
   * @param funcName The name of the function.
   * @param arg The argument to validate.
   * @returns The validated string.
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
    // Remove line continuations (backslash-newline)
    const cleanDef = this.str.replace(/\\\s*\n/g, "");
    // Regex: function <name>([param1, param2, ...]) = <expression>
    // oxlint-disable-next-line security/detect-unsafe-regex
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
    const definition = { args: params, content };
    this.userFunctions.set(name, definition);
    this.functionTemplates.set(definition, compileFunctionTemplate(content, params));
  };

  /** Install immutable declaration syntax; replacing a name releases its previous template cache. */
  installFunctionTemplate(name: string, template: FunctionTemplate): void {
    const definition = { args: [...template.parameters], content: template.text };
    this.userFunctions.set(name, definition);
    this.functionTemplates.set(definition, template);
  }

  getHost(): OracleExpressionHost {
    if (!this.host) {
      throw new Error("ExpressionHost not set.");
    }
    return this.host;
  }
}
