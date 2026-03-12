import type { ExpressionHost } from "./architecture-types.js";
export declare class MathCore {
    host?: ExpressionHost;
    math_round: boolean;
    userFunctions: Map<string, {
        args: string[];
        content: string;
    }>;
    builtInFunctions: Map<string, (arg: number) => number>;
    operators: {
        [key: string]: {
            priority: number;
            operation: (a: number, b: number) => number;
        };
    };
    str: string;
    constructor();
    /**
     * Initialize the math core.
     */
    reset(): void;
    /**
     * Evaluates an expression.
     * This is a direct conversion of `math` in `asar_math.cpp`.
     * @param {string} expression The expression to evaluate.
     * @returns {number} The result of the expression.
     */
    math: (expression: string) => number;
    /**
     * Evaluates a mathematical expression.
     * This replaces the C++ `eval` function.
     * @param {number} depth The current depth of nested expressions.
     * @param {string} [stopChar] The character to stop the evaluation at.
     * @returns {number} The result of the evaluated expression.
     */
    evalMath(depth?: number, stopChar?: string): number;
    /**
     * Helper function to peek ahead at the next 1-2 characters and return a matching operator if found and depth-allowed.
     * @param {object} operators The operators to check.
     * @param {number} depth The current depth of nested expressions.
     * @returns {string | null} The matching operator or null if no match.
     */
    peekNextOperator(operators: {
        [key: string]: {
            priority: number;
        };
    }, depth: number): string | null;
    /**
     * Parses numbers from a string while consuming valid characters.
     * @param {RegExp} regex The regular expression to test against the string.
     * @returns {string} The substring of the string that matches the regular expression.
     */
    consumeWhile(regex: RegExp): string;
    /**
     * Retrieves a number from the string.
     * This implements `getnumcore` and `getnum`.
     * @returns {number} The number from the string.
     */
    getnum: () => number;
    /**
     * Safe wrapper to handle division by zero.
     * @param {string} message The message to throw.
     */
    throwMathError: (message: string) => number;
    /**
     * Parses a string literal from the current string with support for quotes.
     * @returns {string} The parsed string literal.
     */
    parseStringLiteral: () => string;
    /**
     * Calls either a built-in or user-defined function by name, passing an array of arguments which can be strings or numbers.
     * @param {string} name The name of the function to call.
     * @param {Array<number | string>} args The arguments to pass to the function.
     * @returns {number} The result of the function call.
     */
    callFunction: (name: string, args: (number | string)[]) => number;
    /**
     * Calls a user-defined function by name, passing an array of arguments which can be strings or numbers.
     * @param {string} name The name of the function to call.
     * @param {Array<number | string>} args The arguments to pass to the function.
     * @returns {number} The result of the function call.
     */
    callUserFunction: (name: string, args: (number | string)[]) => number;
    /**
     * Calls a built-in function by name, passing an array of arguments which can be strings or numbers.
     * @param {string} name The name of the function to call.
     * @param {Array<number | string>} args The arguments to pass to the function.
     * @returns {number} The result of the function call.
     */
    callBuiltInFunction: (name: string, args: (number | string)[]) => number;
    /**
     * Validates an argument as a number.
     * @param {string} funcName The name of the function.
     * @param {number | string} arg The argument to validate.
     * @returns {number} The validated number.
     */
    numArg: (funcName: string, arg: number | string) => number;
    strArg: (funcName: string, arg: number | string) => string;
    parseFunctionDefinition: () => void;
    private getHost;
}
//# sourceMappingURL=mathcore.d.ts.map