import type { ExpressionHost, MathValue } from "./architecture-types.js";
import type { BinaryOperator, ExpressionNode, ReferenceExpressionNode, UnaryOperator } from "./ir/expression-node.js";
import { type FunctionTemplate } from "./ir/function-template.js";
import { type LinkExpressionContext } from "./ir/link-expression.js";
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
type OperatorTable = {
    readonly [K in BinaryOperator]: BinaryOperatorSpec;
};
export declare class MathCore {
    /** Object assembly supplies pure name binding; numeric layout/preprocessing reads must remain constant. */
    linkContext?: () => LinkExpressionContext;
    /** Definition identity owns cached syntax; replacing a function releases its previous template. */
    private readonly functionTemplates;
    /** Parsed syntax is reused only within an assembly snapshot; state-dependent values are never cached. */
    readonly parsedStringExpressions: Map<string, ExpressionNode>;
    readonly pureStringExpressionCache: Map<string, number>;
    readonly roundedPureStringExpressionCache: Map<string, number>;
    readonly pureStringClassification: Map<string, boolean>;
    readonly instrumentedExpressionStrings: Set<string>;
    readonly instrumentedPureExpressionStrings: Set<string>;
    instrumentedExpressionNodes: WeakSet<object>;
    instrumentedPureExpressionNodes: WeakSet<object>;
    host?: ExpressionHost;
    math_round: boolean;
    readonly userFunctions: Map<string, UserFunction>;
    readonly expressionFunctions: Map<string, RegisteredExpressionFunction>;
    readonly operators: OperatorTable;
    /**
     * Initialize the math core.
     */
    reset(): void;
    /**
     * Installs a target-provided expression function for this session.
     * @param {string | readonly string[]} names The canonical name and aliases.
     * @param {RegisteredExpressionFunction} expressionFunction The function descriptor and evaluator.
     */
    registerExpressionFunction(names: string | readonly string[], expressionFunction: RegisteredExpressionFunction): void;
    /**
     * Starts a new expression-cache snapshot for an assembly.
     */
    beginAssemblySnapshot(): void;
    /**
     * Releases expression values retained for a completed assembly.
     */
    endAssemblySnapshot(): void;
    /**
     * Clears expression caches retained for the current assembly.
     */
    clearExpressionCaches(): void;
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
    evaluateMathInput(expression: string | ExpressionNode): number;
    /**
     * Reuses successful results only for strings proven to contain literal operators.
     * @param {string} expression The legacy expression source.
     * @returns {number} The expression result.
     */
    evaluateCachedStringExpression(expression: string): number;
    /**
     * Records the shape and reuse of a top-level expression evaluation.
     * @param {string | ExpressionNode} expression The evaluated expression.
     */
    recordExpressionEvaluation(expression: string | ExpressionNode): void;
    /**
     * Determines whether an expression depends only on literal operators.
     * @param {ExpressionNode} expression The expression to classify.
     * @returns {boolean} Whether the result is independent of assembler state.
     */
    isPureExpressionNode(expression: ExpressionNode): boolean;
    /** Public string entry point; source and IR callers share the same evaluator. */
    evaluateStringExpression(expression: string): number;
    /**
     * Evaluates syntax directly; parser diagnostics are raised only when their occurrence is selected.
     * @param {ExpressionNode} expression The expression node to evaluate.
     * @returns {number} The numeric result.
     */
    evaluateExpressionNode(expression: ExpressionNode, round?: boolean): number;
    /** Typed dispatch is shared by parsed strings and IR callers; unparsed nodes cannot execute. */
    private evaluateNodeValue;
    evaluateCallArgument(functionName: string, argumentIndex: number, argument: ExpressionNode): number | string;
    evaluateUnaryExpressionNode(operator: UnaryOperator, argument: ExpressionNode): number;
    evaluateBinaryExpressionNode(operator: BinaryOperator, left: ExpressionNode, right: ExpressionNode): number;
    /** Numeric argument lookup preserves unresolved identifier arguments as source strings. */
    resolveNumericIdentifierArgument(identifier: string): number | string;
    /** Resolve typed paths without converting indexes or member access back to source. */
    evaluateReferenceExpressionNode(expression: ReferenceExpressionNode): number;
    isStringArgument(functionName: string, argumentIndex: number): boolean;
    /** Interpret externally constructed literals; parsed literals already retain this value. */
    parseLiteralNode(value: string): number;
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
    /** Bind scalar function parameters structurally so unresolved addresses never become source text. */
    bindLinkFunction(name: string, arguments_: readonly ExpressionNode[]): ExpressionNode | undefined;
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
    /**
     * Validates an argument as a string.
     * @param {string} funcName The name of the function.
     * @param {number | string} arg The argument to validate.
     * @returns {string} The validated string.
     */
    strArg: (funcName: string, arg: number | string) => string;
    /** Parse a public declaration through the same grammar used by source commands. */
    parseFunctionDefinition(source: string): void;
    /** Install immutable declaration syntax; replacing a name releases its previous template cache. */
    installFunctionTemplate(name: string, template: FunctionTemplate): void;
    getHost(): ExpressionHost;
}
export {};
//# sourceMappingURL=mathcore.d.ts.map