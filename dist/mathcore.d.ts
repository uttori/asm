import type { ExpressionHost } from "./architecture-types.js";
import type { ExpressionNode, ReferenceExpressionNode } from "./ir/expression-node.js";
export declare class MathCore {
    private readonly pureStringExpressionCache;
    private readonly roundedPureStringExpressionCache;
    private readonly pureStringClassification;
    private instrumentedExpressionStrings;
    private instrumentedPureExpressionStrings;
    private instrumentedExpressionNodes;
    private instrumentedPureExpressionNodes;
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
     * Starts a new expression-cache snapshot for an assembly.
     */
    beginAssemblySnapshot(): void;
    /**
     * Releases expression values retained for a completed assembly.
     */
    endAssemblySnapshot(): void;
    /**
     * Evaluates an expression.
     * This is a direct conversion of `math` in `asar_math.cpp`.
     * @param {string} expression The expression to evaluate.
     * @returns {number} The result of the expression.
     */
    math: (expression: string | ExpressionNode) => number;
    /**
     * Evaluates a string or typed expression without instrumentation dispatch.
     * @param {string | ExpressionNode} expression The expression to evaluate.
     * @returns {number} The expression result.
     */
    private evaluateMathInput;
    /**
     * Reuses successful results only for strings proven to contain literal operators.
     * @param {string} expression The legacy expression source.
     * @returns {number} The expression result.
     */
    private evaluateCachedStringExpression;
    /**
     * Records the shape and reuse of a top-level expression evaluation.
     * @param {string | ExpressionNode} expression The evaluated expression.
     */
    private recordExpressionEvaluation;
    /**
     * Determines whether an expression depends only on literal operators.
     * @param {ExpressionNode} expression The expression to classify.
     * @returns {boolean} Whether the result is independent of assembler state.
     */
    private isPureExpressionNode;
    /**
     * Evaluates a string expression using the legacy parser.
     * @param {string} expression The expression to evaluate.
     * @returns {number} The result of the expression.
     */
    evaluateStringExpression(expression: string): number;
    /**
     * Evaluates an expression node using typed dispatch before falling back to string parsing.
     * @param {ExpressionNode} expression The expression node to evaluate.
     * @returns {number} The numeric result.
     */
    evaluateExpressionNode(expression: ExpressionNode): number;
    /**
     * Evaluates call argument.
     * @param {string} functionName The function name.
     * @param {number} argumentIndex The argument index.
     * @param {ExpressionNode} argument The argument.
     * @returns {number | string} The result.
     */
    evaluateCallArgument(functionName: string, argumentIndex: number, argument: ExpressionNode): number | string;
    /**
     * Evaluates unary expression node.
     * @param {"<:" | "~" | "-" | "+"} operator The operator.
     * @param {ExpressionNode} argument The argument.
     * @returns {number} The result.
     */
    evaluateUnaryExpressionNode(operator: "<:" | "~" | "-" | "+", argument: ExpressionNode): number;
    /**
     * Evaluates binary expression node.
     * @param {keyof MathCore["operators"]} operator The operator.
     * @param {ExpressionNode} left The left.
     * @param {ExpressionNode} right The right.
     * @returns {number} The result.
     */
    evaluateBinaryExpressionNode(operator: keyof MathCore["operators"], left: ExpressionNode, right: ExpressionNode): number;
    /**
     * Resolves numeric identifier argument.
     * @param {string} identifier The identifier.
     * @returns {number | string} The result.
     */
    resolveNumericIdentifierArgument(identifier: string): number | string;
    /**
     * Evaluates reference expression node.
     * @param {ReferenceExpressionNode} expression The expression.
     * @returns {number} The result.
     */
    evaluateReferenceExpressionNode(expression: ReferenceExpressionNode): number;
    /**
     * Resolves leading local label reference.
     * @param {string} input The input.
     * @returns {{ label: string; length: number } | undefined} The result.
     */
    resolveLeadingLocalLabelReference(input: string): {
        label: string;
        length: number;
    } | undefined;
    /**
     * Checks whether string argument.
     * @param {string} functionName The function name.
     * @param {number} argumentIndex The argument index.
     * @returns {boolean} The result.
     */
    isStringArgument(functionName: string, argumentIndex: number): boolean;
    /**
     * Parses literal node.
     * @param {string} value The value.
     * @returns {number} The result.
     */
    parseLiteralNode(value: string): number;
    /**
     * Evaluates a mathematical expression.
     * This replaces the C++ `eval` function.
     * @param {number} depth The current depth of nested expressions.
     * @param {string} [stopChar] The character to stop the evaluation at.
     * @returns {number | undefined} The result of the evaluated expression, or
     * `undefined` when an inline function definition consumes the expression.
     */
    evalMath(depth?: number, stopChar?: string): number | undefined;
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
    /**
     * Gets host.
     * @returns {ExpressionHost} The result.
     */
    getHost(): ExpressionHost;
}
//# sourceMappingURL=mathcore.d.ts.map