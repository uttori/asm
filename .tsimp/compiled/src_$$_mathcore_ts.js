let debug = (..._) => { };
/* c8 ignore next 4 */
try {
    const { default: d } = await import("debug");
    debug = d("MathCore");
}
catch { }
export class MathCore {
    math_round = false;
    userFunctions = new Map();
    builtInFunctions = new Map([
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
    operators = {
        "**": { priority: 6, operation: (a, b) => Math.pow(a, b) },
        "*": { priority: 5, operation: (a, b) => a * b },
        "/": { priority: 5, operation: (a, b) => (b !== 0 ? a / b : this.throwMathError("Division by zero")) },
        "%": { priority: 5, operation: (a, b) => (b !== 0 ? a % b : this.throwMathError("Modulo by zero")) },
        "+": { priority: 4, operation: (a, b) => a + b },
        "-": { priority: 4, operation: (a, b) => a - b },
        "<<": { priority: 3, operation: (a, b) => a << b },
        ">>": { priority: 3, operation: (a, b) => a >> b },
        "&": { priority: 3, operation: (a, b) => a & b },
        "|": { priority: 3, operation: (a, b) => a | b },
        "^": { priority: 3, operation: (a, b) => a ^ b },
        "<": { priority: 2, operation: (a, b) => a < b ? 1 : 0 },
        ">": { priority: 2, operation: (a, b) => a > b ? 1 : 0 },
        "<=": { priority: 2, operation: (a, b) => a <= b ? 1 : 0 },
        ">=": { priority: 2, operation: (a, b) => a >= b ? 1 : 0 },
        "==": { priority: 2, operation: (a, b) => a === b ? 1 : 0 },
        "!=": { priority: 2, operation: (a, b) => a !== b ? 1 : 0 },
        "&&": { priority: 1, operation: (a, b) => (a && b) ? 1 : 0 },
        "||": { priority: 0, operation: (a, b) => (a || b) ? 1 : 0 },
    };
    str = "";
    constructor() { }
    /**
     * Initialize the math core.
     */
    reset() {
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
    math = (expression) => {
        debug("math", expression);
        this.str = expression.trim();
        const rval = this.evalMath(0);
        if (this.str.length > 0) {
            if (this.str.startsWith(",")) {
                throw new Error(`Invalid input: ${this.str}`);
            }
            else {
                throw new Error("Mismatched parentheses.");
            }
        }
        debug(`math: ${expression} = ${rval}`);
        return rval;
    };
    /**
     * Evaluates a mathematical expression.
     * This replaces the C++ `eval` function.
     * @param {number} depth The current depth of nested expressions.
     * @param {string} [stopChar] The character to stop the evaluation at.
     * @returns {number} The result of the evaluated expression.
     */
    evalMath(depth = 0, stopChar) {
        debug("evalMath", { depth, stopChar }, this.str);
        let left;
        // If there's a function definition inline, parse and skip it.
        if (this.str.startsWith("function")) {
            this.parseFunctionDefinition();
            left = this.evalMath(depth, stopChar);
        }
        else if (this.str.length > 0) {
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
            if (!op)
                break;
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
     * Helper function to peek ahead at the next 1-2 characters
     * and return a matching operator if found and depth-allowed.
     * @param {object} operators - The operators to check.
     * @param {number} depth - The current depth of nested expressions.
     * @returns {string | null} The matching operator or null if no match.
     */
    peekNextOperator(operators, depth) {
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
     * @param {RegExp} regex - The regular expression to test against the string.
     * @returns {string} The substring of the string that matches the regular expression.
     */
    consumeWhile(regex) {
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
    getnum = () => {
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
            }
            else if (this.str.startsWith("~")) {
                this.str = this.str.substring(1).trim();
                return ~this.getnum(); // Immediately compute bitwise NOT
            }
            else if (this.str.startsWith("-")) {
                this.str = this.str.substring(1).trim();
                sign *= -1;
            }
            else if (this.str.startsWith("+")) {
                this.str = this.str.substring(1).trim();
                // '+' is a no-op
            }
            else {
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
                }
                else {
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
            const args = [];
            // First character is '('
            if (this.str[0] === "(") {
                this.str = this.str.substring(1).trim(); // remove '('
                // parse arguments until ')'
                if (!this.str.startsWith(")")) {
                    while (true) {
                        debug("getnum this.str while 1 =", this.str);
                        // Check if next argument starts with double quote => string argument
                        if (this.str.startsWith('"')) {
                            // parse string literal
                            const strVal = this.parseStringLiteral();
                            args.push(strVal);
                        }
                        else {
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
                        }
                        else {
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
        let value;
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
        }
        else if (this.str.startsWith("$")) {
            this.str = this.str.substring(1);
            value = parseInt(this.consumeWhile(/[\dA-Fa-f]/), 16);
        }
        else if (this.str.startsWith("0x")) {
            this.str = this.str.substring(2);
            value = parseInt(this.consumeWhile(/[\dA-Fa-f]/), 16);
        }
        else if (this.str.startsWith("%")) {
            this.str = this.str.substring(1);
            value = parseInt(this.consumeWhile(/[01]/), 2);
        }
        else if (/\d/.test(this.str[0])) {
            value = parseFloat(this.consumeWhile(/[\d.]/));
        }
        else {
            // Fallback: try to resolve identifiers (e.g. label resolver).
            const idMatch = this.str.match(/^([A-Z_a-z]\w*)/);
            if (idMatch) {
                const id = idMatch[1];
                this.str = this.str.substring(id.length).trim();
                const resolved = this.delegate("resolveLabel", id);
                if (typeof resolved === "number") {
                    value = resolved;
                }
                else {
                    // If resolved is a string (e.g. a struct name) then return it as is
                    // so built-in functions like sizeof get the correct string.
                    return resolved;
                }
            }
            else {
                throw new Error(`Invalid number: ${this.str}`);
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
     * Safe wrapper to handle division by zero.
     * @param {string} message The message to throw.
     */
    throwMathError = (message) => {
        throw new Error(message);
    };
    /**
     * Parses a string literal from the current string with support for quotes.
     * @returns {string} The parsed string literal.
     */
    parseStringLiteral = () => {
        debug("parseStringLiteral");
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
    };
    /**
     * Calls either a built-in or user-defined function by name,
     * passing an array of arguments which can be strings or numbers.
     * @param {string} name - The name of the function to call.
     * @param {Array<number | string>} args - The arguments to pass to the function.
     * @returns {number} - The result of the function call.
     */
    callFunction = (name, args) => {
        debug("callFunction", { name, args });
        // 1) Check user-defined
        if (this.userFunctions.has(name)) {
            return this.callUserFunction(name, args);
        }
        // 2) If built-in, dispatch:
        return this.callBuiltInFunction(name, args);
    };
    /**
     * Calls a user-defined function by name, passing an array of arguments which can be strings or numbers.
     * @param {string} name - The name of the function to call.
     * @param {Array<number | string>} args - The arguments to pass to the function.
     * @returns {number} - The result of the function call.
     */
    callUserFunction = (name, args) => {
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
            // Check argument type
            if (typeof argValue === "string") {
                throw new Error(`User function '${name}' got string argument for param '${paramName}', expected number.`);
            }
            // Replace all occurrences of the parameter name with its value
            // Use word boundaries to avoid partial matches
            const regex = new RegExp(`\\b${paramName}\\b`, "g");
            content = content.replace(regex, argValue.toString());
        }
        debug("callUserFunction content =", content);
        // Parse the replaced content
        const result = this.math(content);
        debug("callUserFunction =", result);
        return result;
    };
    /**
     * Calls a built-in function by name, passing an array of arguments which can be strings or numbers.
     * @param {string} name - The name of the function to call.
     * @param {Array<number | string>} args - The arguments to pass to the function.
     * @returns {number} - The result of the function call.
     */
    callBuiltInFunction = (name, args) => {
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
                if (args.length !== 1)
                    throw new Error(`${name} expects exactly 1 numeric argument.`);
                // Check for aliases and map them to their standard functions
                if (name === "arcsin")
                    name = "asin";
                if (name === "arccos")
                    name = "acos";
                if (name === "arctan")
                    name = "atan";
                const val = this.numArg(name, args[0]);
                const mapping = {
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
                if (isNaN(result)) {
                    throw new Error(`${name} returned NaN for argument ${val}`);
                }
                return result;
            }
            // Min, Max, Clamp
            case "min": {
                if (args.length < 2)
                    throw new Error("min() expects at least 2 numeric arguments.");
                // Convert all arguments to numbers
                const numArgs = args.map(arg => this.numArg(name, arg));
                return Math.min(...numArgs);
            }
            case "max": {
                if (args.length < 2)
                    throw new Error("max() expects at least 2 numeric arguments.");
                // Convert all arguments to numbers
                const numArgs = args.map(arg => this.numArg(name, arg));
                return Math.max(...numArgs);
            }
            case "clamp": {
                if (args.length !== 3)
                    throw new Error("clamp() expects exactly 3 numeric arguments.");
                const value = this.numArg(name, args[0]);
                const minVal = this.numArg(name, args[1]);
                const maxVal = this.numArg(name, args[2]);
                return Math.max(minVal, Math.min(maxVal, value));
            }
            // --- Safe Division and Conditional Selection ---
            case "safediv": {
                if (args.length !== 3)
                    throw new Error("safediv() expects exactly 3 numeric arguments.");
                const dividend = this.numArg(name, args[0]);
                const divisor = this.numArg(name, args[1]);
                const defaultValue = this.numArg(name, args[2]);
                return divisor === 0 ? defaultValue : dividend / divisor;
            }
            case "select": {
                if (args.length !== 3)
                    throw new Error("select() expects exactly 3 numeric arguments.");
                const statement = this.numArg(name, args[0]);
                const trueVal = this.numArg(name, args[1]);
                const falseVal = this.numArg(name, args[2]);
                return statement !== 0 ? trueVal : falseVal;
            }
            // --- Logical Operations ---
            case "not": {
                if (args.length !== 1)
                    throw new Error("not() expects exactly 1 numeric argument.");
                const value = this.numArg(name, args[0]);
                return value === 0 ? 1 : 0;
            }
            case "bank": {
                if (args.length !== 1)
                    throw new Error("bank() expects exactly 1 numeric argument.");
                // Return the bank of the value by shifting 16 bits to the right and masking with 0xFF
                return (this.numArg(name, args[0]) >> 16) & 0xFF;
            }
            // --- Comparison Functions ---
            case "equal": {
                if (args.length !== 2)
                    throw new Error("equal() expects exactly 2 numeric arguments.");
                return this.numArg(name, args[0]) === this.numArg(name, args[1]) ? 1 : 0;
            }
            case "notequal": {
                if (args.length !== 2)
                    throw new Error("notequal() expects exactly 2 numeric arguments.");
                return this.numArg(name, args[0]) !== this.numArg(name, args[1]) ? 1 : 0;
            }
            case "less": {
                if (args.length !== 2)
                    throw new Error("less() expects exactly 2 numeric arguments.");
                return this.numArg(name, args[0]) < this.numArg(name, args[1]) ? 1 : 0;
            }
            case "lessequal": {
                if (args.length !== 2)
                    throw new Error("lessequal() expects exactly 2 numeric arguments.");
                return this.numArg(name, args[0]) <= this.numArg(name, args[1]) ? 1 : 0;
            }
            case "greater": {
                if (args.length !== 2)
                    throw new Error("greater() expects exactly 2 numeric arguments.");
                return this.numArg(name, args[0]) > this.numArg(name, args[1]) ? 1 : 0;
            }
            case "greaterequal": {
                if (args.length !== 2)
                    throw new Error("greaterequal() expects exactly 2 numeric arguments.");
                return this.numArg(name, args[0]) >= this.numArg(name, args[1]) ? 1 : 0;
            }
            // --- Logical Bitwise Operations ---
            case "and": {
                if (args.length !== 2)
                    throw new Error("and() expects exactly 2 numeric arguments.");
                return (this.numArg(name, args[0]) && this.numArg(name, args[1])) ? 1 : 0;
            }
            case "or": {
                if (args.length !== 2)
                    throw new Error("or() expects exactly 2 numeric arguments.");
                return (this.numArg(name, args[0]) || this.numArg(name, args[1])) ? 1 : 0;
            }
            case "nand": {
                if (args.length !== 2)
                    throw new Error("nand() expects exactly 2 numeric arguments.");
                return !(this.numArg(name, args[0]) && this.numArg(name, args[1])) ? 1 : 0;
            }
            case "nor": {
                if (args.length !== 2)
                    throw new Error("nor() expects exactly 2 numeric arguments.");
                return !(this.numArg(name, args[0]) || this.numArg(name, args[1])) ? 1 : 0;
            }
            case "xor": {
                if (args.length !== 2)
                    throw new Error("xor() expects exactly 2 numeric arguments.");
                const a = this.numArg(name, args[0]);
                const b = this.numArg(name, args[1]);
                return ((a ? 1 : 0) ^ (b ? 1 : 0)) ? 1 : 0;
            }
            // --- Rounding ---
            case "round": {
                if (args.length !== 2)
                    throw new Error("round() expects exactly 2 numeric arguments.");
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
            // --- SNES/PC Address Conversion ---
            case "snestopc":
            case "pctosnes":
            // --- Filesize & File Status ---
            case "filesize":
            case "getfilestatus":
            // --- Preprocessor/Struct & Data Size Functions ---
            case "defined":
            case "sizeof":
            case "objectsize":
            case "datasize": {
                if (args.length !== 1)
                    throw new Error(`${name}() expects exactly 1 argument.`);
                const value = this.strArg(name, args[0]);
                return this.delegate(name, value);
            }
            // --- File Can-Read functions ---
            case "canreadfile1":
            case "canreadfile2":
            case "canreadfile3":
            case "canreadfile4": {
                if (args.length !== 2)
                    throw new Error(`${name}() expects exactly 2 arguments.`);
                const filename = this.strArg(name, args[0]);
                const pos = this.numArg(name, args[1]);
                return this.delegate(name, filename, pos);
            }
            case "canreadfile": {
                if (args.length !== 3)
                    throw new Error("canreadfile expects exactly 3 arguments (filename, pos, num).");
                const filename = this.strArg(name, args[0]);
                const pos = this.numArg(name, args[1]);
                const num = this.numArg(name, args[2]);
                return this.delegate(name, filename, pos, num);
            }
            // --- ROM Can-Read functions ---
            case "canread1":
            case "canread2":
            case "canread3":
            case "canread4": {
                if (args.length !== 1)
                    throw new Error(`${name} expects exactly 1 numeric argument.`);
                const pos = this.numArg(name, args[0]);
                const size = parseInt(name.slice(-1), 10);
                return this.delegate(name, pos, size);
            }
            case "canread": {
                if (args.length !== 2)
                    throw new Error("canread expects exactly 2 numeric arguments (pos, num).");
                const pos = this.numArg(name, args[0]);
                const num = this.numArg(name, args[1]);
                return this.delegate(name, pos, num);
            }
            // --- ROM Reading functions ---
            case "read1":
            case "read2":
            case "read3":
            case "read4": {
                if (args.length < 1 || args.length > 2)
                    throw new Error(`${name} expects 1 or 2 numeric arguments.`);
                const pos = this.numArg(name, args[0]);
                if (args.length === 1) {
                    return this.delegate(name, pos);
                }
                else {
                    const defVal = this.numArg(name, args[1]);
                    return this.delegate(name, pos, defVal);
                }
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
                if (args.length === 3) {
                    const defVal = this.numArg(name, args[2]);
                    return this.delegate(name, filename, pos, defVal);
                }
                else {
                    return this.delegate(name, filename, pos);
                }
            }
            // --- PC/Realbase ---
            case "pc":
            case "realbase": {
                if (args.length !== 0)
                    throw new Error(`${name}() expects no arguments.`);
                return this.delegate(name);
            }
            default: {
                throw new Error(`Unknown built-in function '${name}'`);
            }
        }
    };
    /**
     * Validates an argument as a number.
     * @param {string} funcName - The name of the function.
     * @param {number | string} arg - The argument to validate.
     * @returns {number} - The validated number.
     */
    numArg = (funcName, arg) => {
        if (typeof arg === "string") {
            throw new Error(`Function '${funcName}' expected a numeric argument but got a string: ${arg}`);
        }
        return arg;
    };
    strArg = (funcName, arg) => {
        if (typeof arg === "number") {
            throw new Error(`Function '${funcName}' expected a string argument but got a number: ${arg}`);
        }
        return arg;
    };
    parseFunctionDefinition = () => {
        debug("parseFunctionDefinition", this.str);
        // Remove line continuations (backslash-newline)
        const cleanDef = this.str.replace(/\\\s*\n/g, "");
        // Regex: function <name>([param1, param2, ...]) = <expression>
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
    };
    /**
     * Delegate method for handling external operations.
     * @param {string} id The identifier for the operation.
     * @param {...(string | number)} args The arguments for the operation.
     */
    delegate = (id, ...args) => {
        throw new Error(`Delegate not set for ${id}, ${args.join(", ")}`);
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0aGNvcmUuanMiLCJzb3VyY2VSb290IjoiL1VzZXJzL21hdHRoZXcvdXR0b3JpL3NuZXMtYXNtLWpzLyIsInNvdXJjZXMiOlsic3JjL21hdGhjb3JlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLElBQUksS0FBSyxHQUFHLENBQUMsR0FBRyxDQUFZLEVBQUUsRUFBRSxHQUFFLENBQUMsQ0FBQztBQUNwQyxzQkFBc0I7QUFDdEIsSUFBSSxDQUFDO0lBQ0gsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUM3QyxLQUFLLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3hCLENBQUM7QUFBQyxNQUFNLENBQUMsQ0FBQSxDQUFDO0FBRVYsTUFBTSxPQUFPLFFBQVE7SUFDbkIsVUFBVSxHQUFZLEtBQUssQ0FBQztJQUU1QixhQUFhLEdBQXFELElBQUksR0FBRyxFQUFFLENBQUM7SUFDNUUsZ0JBQWdCLEdBQXlDLElBQUksR0FBRyxDQUFDO1FBQy9ELENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDbkIsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUNqQixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDO1FBQ2pCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUM7UUFDakIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNuQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ25CLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDbkIsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUNqQixDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQ3JCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDbkIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNuQixDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDO0tBQ3RCLENBQUMsQ0FBQztJQUNILFNBQVMsR0FBeUY7UUFDaEcsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtRQUMxRCxHQUFHLEVBQUcsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDakQsR0FBRyxFQUFHLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxFQUFFO1FBQ3ZHLEdBQUcsRUFBRyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDLENBQUMsRUFBRTtRQUNyRyxHQUFHLEVBQUcsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDakQsR0FBRyxFQUFHLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ2pELElBQUksRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUNsRCxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDbEQsR0FBRyxFQUFHLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ2pELEdBQUcsRUFBRyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUNqRCxHQUFHLEVBQUcsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDakQsR0FBRyxFQUFHLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUN6RCxHQUFHLEVBQUcsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ3pELElBQUksRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDMUQsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtRQUMxRCxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQzNELElBQUksRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDM0QsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7UUFDNUQsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7S0FDN0QsQ0FBQTtJQUVELEdBQUcsR0FBVyxFQUFFLENB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