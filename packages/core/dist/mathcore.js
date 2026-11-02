import { AssemblyError } from "./diagnostics.js";
import { incrementInternalCounter, isInternalInstrumentationActive, measureInternalPhase, } from "./internal-instrumentation.js";
import { checkedDeclaration, parseDeclarationNode } from "./ir/declaration-node.js";
import { isSourceTextArgument } from "./ir/expression-call-contracts.js";
import { isReferenceExpressionNode, parseExpressionAtSite, parseLiteralValue, renderExpressionNode, } from "./ir/expression-node.js";
import { binaryPrecedence } from "./ir/expression-operators.js";
import { compileFunctionTemplate, bindFunctionTemplate, } from "./ir/function-template.js";
import { compileLinkExpression, requireLinkConstant, } from "./ir/link-expression.js";
/**
 * Throws a math evaluation error.
 * @param {string} message The message to throw.
 * @returns {never} Never returns.
 */
function throwMathError(message) {
    throw new AssemblyError("MATH_EVALUATION_ERROR", message);
}
const OPERATORS = {
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
const BUILTIN_NUMERIC_UNARY = {
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
const NUMERIC_UNARY_ALIASES = {
    arcsin: "asin",
    arccos: "acos",
    arctan: "atan",
};
export class MathCore {
    /** Object assembly supplies pure name binding; numeric layout/preprocessing reads must remain constant. */
    linkContext;
    /** Definition identity owns cached syntax; replacing a function releases its previous template. */
    functionTemplates = new WeakMap();
    /** Parsed syntax is reused only within an assembly snapshot; state-dependent values are never cached. */
    parsedStringExpressions = new Map();
    pureStringExpressionCache = new Map();
    roundedPureStringExpressionCache = new Map();
    pureStringClassification = new Map();
    instrumentedExpressionStrings = new Set();
    instrumentedPureExpressionStrings = new Set();
    instrumentedExpressionNodes = new WeakSet();
    instrumentedPureExpressionNodes = new WeakSet();
    host;
    math_round = false;
    userFunctions = new Map();
    expressionFunctions = new Map();
    operators = OPERATORS;
    /**
     * Initialize the math core.
     */
    reset() {
        this.math_round = false;
        this.userFunctions.clear();
        this.clearExpressionCaches();
    }
    /**
     * Installs a target-provided expression function for this session.
     * @param {string | readonly string[]} names The canonical name and aliases.
     * @param {RegisteredExpressionFunction} expressionFunction The function descriptor and evaluator.
     */
    registerExpressionFunction(names, expressionFunction) {
        for (const name of typeof names === "string" ? [names] : names) {
            this.expressionFunctions.set(name.toLowerCase(), expressionFunction);
        }
    }
    /**
     * Starts a new expression-cache snapshot for an assembly.
     */
    beginAssemblySnapshot() {
        this.clearExpressionCaches();
    }
    /**
     * Releases expression values retained for a completed assembly.
     */
    endAssemblySnapshot() {
        this.clearExpressionCaches();
    }
    /**
     * Clears expression caches retained for the current assembly.
     */
    clearExpressionCaches() {
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
     * @param {string} expression The expression to evaluate.
     * @returns {number} The result of the expression.
     */
    math = (expression) => {
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
    evaluateMathInput(expression) {
        if (this.linkContext) {
            const node = typeof expression === "string"
                ? parseExpressionAtSite(expression, "math-cache")
                : expression;
            return requireLinkConstant(compileLinkExpression(node, this.linkContext()), "Numeric assembly expression");
        }
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
    evaluateCachedStringExpression(expression) {
        let parsed = this.parsedStringExpressions.get(expression);
        if (!parsed) {
            incrementInternalCounter("expressionParses");
            parsed = parseExpressionAtSite(expression, "math-cache");
            this.parsedStringExpressions.set(expression, parsed);
        }
        else {
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
     * @param {string | ExpressionNode} expression The evaluated expression.
     */
    recordExpressionEvaluation(expression) {
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
     * @param {ExpressionNode} expression The expression to classify.
     * @returns {boolean} Whether the result is independent of assembler state.
     */
    isPureExpressionNode(expression) {
        switch (expression.type) {
            case "literal":
                return true;
            case "unary":
                return this.isPureExpressionNode(expression.argument);
            case "binary":
                return (this.isPureExpressionNode(expression.left) && this.isPureExpressionNode(expression.right));
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
    /** Public string entry point; source and IR callers share the same evaluator. */
    evaluateStringExpression(expression) {
        return this.math(expression);
    }
    /**
     * Evaluates syntax directly; parser diagnostics are raised only when their occurrence is selected.
     * @param {ExpressionNode} expression The expression node to evaluate.
     * @returns {number} The numeric result.
     */
    evaluateExpressionNode(expression, round = true) {
        const result = this.evaluateNodeValue(expression);
        if (Number.isNaN(result)) {
            throw new Error(`Invalid number: ${result}`);
        }
        // Native rounding occurs on recursive right operands and explicit groups, not after every
        // left-associative operation. Keeping the boundary on the node preserves decimal semantics.
        return this.math_round && (round || expression.parenthesized) ? Math.trunc(result) : result;
    }
    /** Typed dispatch is shared by parsed strings and IR callers; unparsed nodes cannot execute. */
    evaluateNodeValue(expression) {
        if (isReferenceExpressionNode(expression)) {
            return this.evaluateReferenceExpressionNode(expression);
        }
        switch (expression.type) {
            case "literal":
                return expression.numericValue ?? this.parseLiteralNode(expression.value);
            case "string":
                throw new AssemblyError("MATH_STRING_NOT_NUMERIC", `String expression is not directly numeric: ${expression.value}`);
            case "call":
                return this.callFunction(expression.callee.name, expression.arguments.map((argument, index) => this.evaluateCallArgument(expression.callee.name, index, argument)));
            case "unary":
                return this.evaluateUnaryExpressionNode(expression.operator, expression.argument);
            case "binary":
                return this.evaluateBinaryExpressionNode(expression.operator, expression.left, expression.right);
            case "range":
                throw new AssemblyError("MATH_RANGE_NOT_NUMERIC", `Range expression is not directly numeric: ${renderExpressionNode(expression)}`);
            case "sourceText":
                throw new AssemblyError("MATH_STRING_NOT_NUMERIC", `String expression is not directly numeric: ${expression.value}`);
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
                throw new Error("Raw expression nodes are not executable; parse source before evaluation.");
        }
        throw new Error("Unsupported expression node.");
    }
    evaluateCallArgument(functionName, argumentIndex, argument) {
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
                    throw new Error("Raw expression nodes are not executable; parse source before evaluation.");
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
                throw new Error("Raw expression nodes are not executable; parse source before evaluation.");
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
            }
            catch (error) {
                // Numeric identifier arguments historically remain strings on lookup failure.
                if (argument.type === "identifier") {
                    return argument.name;
                }
                throw error;
            }
        }
        return this.evaluateExpressionNode(argument);
    }
    evaluateUnaryExpressionNode(operator, argument) {
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
    evaluateBinaryExpressionNode(operator, left, right) {
        const spec = this.operators[operator];
        return spec.operation(this.evaluateExpressionNode(left, false), this.evaluateExpressionNode(right));
    }
    /** Numeric argument lookup preserves unresolved identifier arguments as source strings. */
    resolveNumericIdentifierArgument(identifier) {
        try {
            const result = this.getHost().resolveReference({ type: "identifier", name: identifier });
            return result.kind === "resolved" ? result.value : identifier;
        }
        catch {
            return identifier;
        }
    }
    /** Resolve typed paths without converting indexes or member access back to source. */
    evaluateReferenceExpressionNode(expression) {
        const result = this.getHost().resolveReference(expression);
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
    isStringArgument(functionName, argumentIndex) {
        return isSourceTextArgument(functionName, argumentIndex);
    }
    /** Interpret externally constructed literals; parsed literals already retain this value. */
    parseLiteralNode(value) {
        return parseLiteralValue(value);
    }
    /**
     * Calls either a built-in or user-defined function by name, passing an array of arguments which can be strings or numbers.
     * @param {string} name The name of the function to call.
     * @param {Array<number | string>} args The arguments to pass to the function.
     * @returns {number} The result of the function call.
     */
    callFunction = (name, args) => {
        // 1) Check user-defined
        if (this.userFunctions.has(name)) {
            return this.callUserFunction(name, args);
        }
        // 2) Target/plugin contributions are active only when installed for this session.
        const expressionFunction = this.expressionFunctions.get(name.toLowerCase());
        if (expressionFunction) {
            if (args.length < expressionFunction.minimumArguments ||
                args.length > expressionFunction.maximumArguments) {
                const expected = expressionFunction.minimumArguments === expressionFunction.maximumArguments
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
    callUserFunction = (name, args) => {
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
    /** Bind scalar function parameters structurally so unresolved addresses never become source text. */
    bindLinkFunction(name, arguments_) {
        const definition = this.userFunctions.get(name);
        if (!definition) {
            return undefined;
        }
        if (arguments_.length !== definition.args.length) {
            throw new Error(`Function '${name}' requires ${definition.args.length} arguments in module assembly.`);
        }
        let template = this.functionTemplates.get(definition);
        if (!template) {
            template = compileFunctionTemplate(definition.content, definition.args);
            this.functionTemplates.set(definition, template);
        }
        const substitute = (node) => {
            if (node.type === "identifier") {
                const index = definition.args.indexOf(node.name);
                return index < 0 ? node : arguments_[index];
            }
            if (node.type === "binary") {
                return { ...node, left: substitute(node.left), right: substitute(node.right) };
            }
            if (node.type === "unary") {
                return { ...node, argument: substitute(node.argument) };
            }
            if (node.type === "call") {
                return { ...node, arguments: node.arguments.map(substitute) };
            }
            if (node.type === "member" || node.type === "index") {
                const object = substitute(node.object);
                if (!isReferenceExpressionNode(object)) {
                    throw new Error("A symbolic function reference root must remain a reference.");
                }
                if (node.type === "member") {
                    return { ...node, object };
                }
                return { ...node, object, index: substitute(node.index) };
            }
            return node;
        };
        return substitute(template.syntax);
    }
    /**
     * Calls a built-in function by name, passing an array of arguments which can be strings or numbers.
     * @param {string} name The name of the function to call.
     * @param {Array<number | string>} args The arguments to pass to the function.
     * @returns {number} The result of the function call.
     */
    callBuiltInFunction = (name, args) => {
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
                }
                else {
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
     * @param {string} funcName The name of the function.
     * @param {number | string} arg The argument to validate.
     * @returns {number} The validated number.
     */
    numArg = (funcName, arg) => {
        if (typeof arg === "string") {
            throw new Error(`Function '${funcName}' expected a numeric argument but got a string: ${arg}`);
        }
        return arg;
    };
    /**
     * Validates an argument as a string.
     * @param {string} funcName The name of the function.
     * @param {number | string} arg The argument to validate.
     * @returns {string} The validated string.
     */
    strArg = (funcName, arg) => {
        if (typeof arg === "number") {
            throw new Error(`Function '${funcName}' expected a string argument but got a number: ${arg}`);
        }
        return arg;
    };
    /** Parse a public declaration through the same grammar used by source commands. */
    parseFunctionDefinition(source) {
        const text = source.replace(/\\\s*\n/g, "");
        const declaration = checkedDeclaration(parseDeclarationNode(text, text.trim().split(/\s+/)));
        if (declaration?.kind !== "function") {
            throw new Error("Invalid function definition syntax.");
        }
        this.installFunctionTemplate(declaration.name, declaration.template);
    }
    /** Install immutable declaration syntax; replacing a name releases its previous template cache. */
    installFunctionTemplate(name, template) {
        const definition = { args: [...template.parameters], content: template.text };
        this.userFunctions.set(name, definition);
        this.functionTemplates.set(definition, template);
    }
    getHost() {
        if (!this.host) {
            throw new Error("ExpressionHost not set.");
        }
        return this.host;
    }
}
//# sourceMappingURL=mathcore.js.map