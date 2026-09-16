const MAX_EXPRESSION_CHARACTERS = 256;
const MAX_EXPRESSION_DEPTH = 32;
const MAX_SHIFT = 255n;
const MAX_EXPONENT = 255n;
const MAX_MAGNITUDE = (1n << 256n) - 1n;
const binaryPrecedence = Object.freeze({
    "||": 0,
    "&&": 1,
    "=": 2,
    "==": 2,
    "!=": 2,
    "<": 2,
    ">": 2,
    "<=": 2,
    ">=": 2,
    "<<": 3,
    ">>": 3,
    "&": 3,
    "|": 3,
    "^": 3,
    "+": 4,
    "-": 4,
    "*": 5,
    "/": 5,
    "%": 5,
    "**": 6,
});
const checked = (value) => {
    if (value > MAX_MAGNITUDE || value < -MAX_MAGNITUDE)
        throw new Error("Debugger expression result exceeds 256 bits.");
    return value;
};
const parseDigits = (digits, radix) => {
    if (digits.length === 0)
        throw new Error("Debugger expression contains an empty number.");
    if (radix === 16)
        return BigInt(`0x${digits}`);
    if (radix === 2)
        return BigInt(`0b${digits}`);
    return BigInt(digits);
};
const digitPattern = (radix) => {
    if (radix === 16)
        return /[\dA-Fa-f]/;
    if (radix === 2)
        return /[01]/;
    return /\d/;
};
const tokenize = (expression) => {
    if (expression.length === 0)
        throw new Error("Debugger expression cannot be empty.");
    if (expression.length > MAX_EXPRESSION_CHARACTERS)
        throw new Error(`Debugger expression exceeds ${MAX_EXPRESSION_CHARACTERS} characters.`);
    const tokens = [];
    let index = 0;
    let expectsOperand = true;
    while (index < expression.length) {
        const character = expression[index];
        if (/\s/.test(character)) {
            index++;
            continue;
        }
        if (character === "(") {
            tokens.push({ type: "left" });
            expectsOperand = true;
            index++;
            continue;
        }
        if (character === ")") {
            tokens.push({ type: "right" });
            expectsOperand = false;
            index++;
            continue;
        }
        if (character === "$" || (expectsOperand && character === "%")) {
            const radix = character === "$" ? 16 : 2;
            const pattern = digitPattern(radix);
            let end = index + 1;
            while (end < expression.length && pattern.test(expression[end]))
                end++;
            tokens.push({ type: "number", value: parseDigits(expression.slice(index + 1, end), radix) });
            expectsOperand = false;
            index = end;
            continue;
        }
        if (/\d/.test(character)) {
            const prefix = expression.slice(index, index + 2).toLowerCase();
            let radix = 10;
            if (prefix === "0x")
                radix = 16;
            if (prefix === "0b")
                radix = 2;
            let end = index + (radix === 10 ? 0 : 2);
            const pattern = digitPattern(radix);
            while (end < expression.length && pattern.test(expression[end]))
                end++;
            const start = index + (radix === 10 ? 0 : 2);
            tokens.push({ type: "number", value: parseDigits(expression.slice(start, end), radix) });
            expectsOperand = false;
            index = end;
            continue;
        }
        if (/[A-Z_a-z]/.test(character)) {
            let end = index + 1;
            while (end < expression.length && /\w/.test(expression[end]))
                end++;
            tokens.push({ type: "identifier", value: expression.slice(index, end) });
            expectsOperand = false;
            index = end;
            continue;
        }
        const operator = ["**", "<<", ">>", "<=", ">=", "==", "!=", "&&", "||"].find((candidate) => expression.startsWith(candidate, index));
        const single = "+-*/%&|^~<>=!".includes(character) ? character : undefined;
        const value = operator ?? single;
        if (!value)
            throw new Error(`Unsupported debugger expression character '${character}'.`);
        tokens.push({ type: "operator", value });
        expectsOperand = true;
        index += value.length;
    }
    tokens.push({ type: "end" });
    return tokens;
};
class DebugExpressionParser {
    #tokens;
    #registers;
    #index = 0;
    constructor(tokens, registers) {
        this.#tokens = tokens;
        this.#registers = registers;
    }
    parse() {
        const result = this.#expression(0, 0);
        if (this.#peek().type !== "end")
            throw new Error("Unexpected debugger expression token.");
        return result;
    }
    #expression(minimumPrecedence, depth) {
        if (depth > MAX_EXPRESSION_DEPTH)
            throw new Error(`Debugger expression exceeds ${MAX_EXPRESSION_DEPTH} nested operations.`);
        let left = this.#prefix(depth);
        while (true) {
            const token = this.#peek();
            if (token.type !== "operator")
                break;
            const precedence = binaryPrecedence[token.value];
            if (precedence === undefined || precedence < minimumPrecedence)
                break;
            this.#index++;
            const rightAssociative = token.value === "**";
            const right = this.#expression(precedence + (rightAssociative ? 0 : 1), depth + 1);
            left = { value: this.#binary(token.value, left.value, right.value) };
        }
        return left;
    }
    #prefix(depth) {
        const token = this.#tokens[this.#index++] ?? { type: "end" };
        if (token.type === "number")
            return { value: token.value };
        if (token.type === "identifier")
            return this.#register(token.value);
        if (token.type === "left") {
            const value = this.#expression(0, depth + 1);
            if (this.#peek().type !== "right")
                throw new Error("Debugger expression is missing ')'.");
            this.#index++;
            return value;
        }
        if (token.type === "operator" && ["+", "-", "~", "<", ">", "^"].includes(token.value)) {
            const value = this.#prefix(depth + 1).value;
            return { value: checked(this.#unary(token.value, value)) };
        }
        throw new Error("Debugger expression requires a number, register, or parenthesized value.");
    }
    #unary(operator, value) {
        switch (operator) {
            case "+":
                return value;
            case "-":
                return -value;
            case "~":
                return ~value;
            case "<":
                return value & 0xffn;
            case ">":
                return (value >> 8n) & 0xffn;
            case "^":
                return (value >> 16n) & 0xffn;
            default:
                throw new Error(`Unsupported debugger expression unary operator '${operator}'.`);
        }
    }
    #register(name) {
        const exact = this.#registers.find((register) => register.name === name);
        const insensitive = this.#registers.filter((register) => register.name.toLowerCase() === name.toLowerCase());
        const register = exact ?? (insensitive.length === 1 ? insensitive[0] : undefined);
        if (!register) {
            if (insensitive.length > 1)
                throw new Error(`Register '${name}' is ambiguous.`);
            throw new Error(`Unknown register '${name}'.`);
        }
        if (!/^[\dA-Fa-f]+$/.test(register.value))
            throw new Error(`Register '${register.name}' has an invalid hexadecimal value.`);
        return { value: BigInt(`0x${register.value}`), bits: register.bits };
    }
    #binary(operator, left, right) {
        if ((operator === "/" || operator === "%") && right === 0n)
            throw new Error("Debugger expression divides by zero.");
        if ((operator === "<<" || operator === ">>") && (right < 0n || right > MAX_SHIFT))
            throw new Error(`Debugger expression shift must be between 0 and ${MAX_SHIFT}.`);
        if (operator === "**" && (right < 0n || right > MAX_EXPONENT))
            throw new Error(`Debugger expression exponent must be between 0 and ${MAX_EXPONENT}.`);
        const value = (() => {
            switch (operator) {
                case "||":
                    return left !== 0n || right !== 0n ? 1n : 0n;
                case "&&":
                    return left !== 0n && right !== 0n ? 1n : 0n;
                case "=":
                case "==":
                    return left === right ? 1n : 0n;
                case "!=":
                    return left !== right ? 1n : 0n;
                case "<":
                    return left < right ? 1n : 0n;
                case ">":
                    return left > right ? 1n : 0n;
                case "<=":
                    return left <= right ? 1n : 0n;
                case ">=":
                    return left >= right ? 1n : 0n;
                case "<<":
                    return left << right;
                case ">>":
                    return left >> right;
                case "&":
                    return left & right;
                case "|":
                    return left | right;
                case "^":
                    return left ^ right;
                case "+":
                    return left + right;
                case "-":
                    return left - right;
                case "*":
                    return left * right;
                case "/":
                    return left / right;
                case "%":
                    return left % right;
                case "**":
                    return left ** right;
                default:
                    throw new Error(`Unsupported debugger expression operator '${operator}'.`);
            }
        })();
        return checked(value);
    }
    #peek() {
        return this.#tokens[this.#index] ?? { type: "end" };
    }
}
/**
 * Evaluates a bounded, side-effect-free native integer expression against stopped registers.
 * @param {string} expression Native expression using register names and integer operators.
 * @param {readonly DebugRegister[]} registers Registers from the selected stopped frame.
 * @returns {DebugExpressionResult} Exact integer result and direct-register width, when applicable.
 */
export const evaluateDebugExpression = (expression, registers) => new DebugExpressionParser(tokenize(expression.trim()), registers).parse();
/**
 * Formats a debugger integer without losing values above JavaScript's safe-number range.
 * @param {bigint} value Evaluated integer.
 * @returns {string} Signed hexadecimal display string.
 */
export const formatDebugExpressionValue = (value) => value < 0n ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`;
//# sourceMappingURL=debug-expression.js.map