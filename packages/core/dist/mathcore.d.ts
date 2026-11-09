import type { ExpressionHost, MathValue } from "./architecture-types.js";
import type { BinaryOperator, ExpressionNode, ReferenceExpressionNode, UnaryOperator } from "./ir/expression-node.js";
import { type FunctionTemplate } from "./ir/function-template.js";
import { type LinkExpressionContext } from "./ir/link-expression.js";
/** User-defined expression function body captured from source declarations. */
type UserFunction = {
    /** Formal parameter names accepted by the function. */
    readonly args: readonly string[];
    /** Unexpanded function body text evaluated on invocation. */
    readonly content: string;
};
/** Target-registered callable exposed to expression evaluation. */
export type RegisteredExpressionFunction = {
    /** Minimum arity accepted by the evaluator. */
    readonly minimumArguments: number;
    /** Maximum arity accepted by the evaluator. */
    readonly maximumArguments: number;
    /** Evaluator invoked with already-coerced math values. */
    readonly evaluate: (args: readonly MathValue[]) => MathValue;
};
/** Precedence and implementation for one binary math operator. */
type BinaryOperatorSpec = {
    /** Relative binding priority; larger numbers bind tighter. */
    readonly priority: number;
    /** Numeric kernel implementing the operator semantics. */
    readonly operation: (left: number, right: number) => number;
};
/** Complete binary operator table keyed by token spelling. */
type OperatorTable = {
    readonly [K in BinaryOperator]: BinaryOperatorSpec;
};
/** Expression parser and evaluator shared by directives, macros, and encoders. */
export declare class MathCore {
    /** Object assembly supplies pure name binding; numeric layout/preprocessing reads must remain constant. */
    linkContext?: () => LinkExpressionContext;
    /** Definition identity owns cached syntax; replacing a function releases its previous template. */
    private readonly functionTemplates;
    /** Parsed syntax is reused only within an assembly snapshot; state-dependent values are never cached. */
    readonly parsedStringExpressions: Map<string, ExpressionNode>;
    /** Memoized numeric results for pure string expressions. */
    readonly pureStringExpressionCache: Map<string, number>;
    /** Memoized rounded results for pure string expressions when math_round is enabled. */
    readonly roundedPureStringExpressionCache: Map<string, number>;
    /** Records whether a source string expression is independent of assembly state. */
    readonly pureStringClassification: Map<string, boolean>;
    /** Source strings already traced by internal instrumentation. */
    readonly instrumentedExpressionStrings: Set<string>;
    /** Pure source strings already traced by internal instrumentation. */
    readonly instrumentedPureExpressionStrings: Set<string>;
    /** Parsed expression nodes already traced by internal instrumentation. */
    instrumentedExpressionNodes: WeakSet<object>;
    /** Pure parsed expression nodes already traced by internal instrumentation. */
    instrumentedPureExpressionNodes: WeakSet<object>;
    /** Optional expression host supplying reference resolution and side effects. */
    host?: ExpressionHost;
    /** When true, numeric results round toward nearest integer where applicable. */
    math_round: boolean;
    /** User-defined functions parsed from assembly source. */
    readonly userFunctions: Map<string, UserFunction>;
    /** Target-provided expression functions registered for this session. */
    readonly expressionFunctions: Map<string, RegisteredExpressionFunction>;
    /** Binary operator table used for precedence parsing and evaluation. */
    readonly operators: OperatorTable;
    /**
     * Initialize the math core.
     */
    reset(): void;
    /**
     * Installs a target-provided expression function for this session.
     * @param names The canonical name and aliases.
     * @param expressionFunction The function descriptor and evaluator.
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
     * @param expression The expression to evaluate.
     * @returns The result of the expression.
     */
    math: (expression: string | ExpressionNode) => number;
    /**
     * Evaluates a string or typed expression without instrumentation dispatch.
     * @param expression The expression to evaluate.
     * @returns The expression result.
     */
    evaluateMathInput(expression: string | ExpressionNode): number;
    /**
     * Reuses successful results only for strings proven to contain literal operators.
     * @param expression The legacy expression source.
     * @returns The expression result.
     */
    evaluateCachedStringExpression(expression: string): number;
    /**
     * Records the shape and reuse of a top-level expression evaluation.
     * @param expression The evaluated expression.
     */
    recordExpressionEvaluation(expression: string | ExpressionNode): void;
    /**
     * Determines whether an expression depends only on literal operators.
     * @param expression The expression to classify.
     * @returns Whether the result is independent of assembler state.
     */
    isPureExpressionNode(expression: ExpressionNode): boolean;
    /** Public string entry point; source and IR callers share the same evaluator. */
    evaluateStringExpression(expression: string): number;
    /**
     * Evaluates syntax directly; parser diagnostics are raised only when their occurrence is selected.
     * @param expression The expression node to evaluate.
     * @returns The numeric result.
     */
    evaluateExpressionNode(expression: ExpressionNode, round?: boolean): number;
    /** Typed dispatch is shared by parsed strings and IR callers; unparsed nodes cannot execute. */
    private evaluateNodeValue;
    /** Evaluates one call argument, preserving string slots and deferring failed identifier lookups. */
    evaluateCallArgument(functionName: string, argumentIndex: number, argument: ExpressionNode): number | string;
    /** Applies a unary operator to an evaluated operand node. */
    evaluateUnaryExpressionNode(operator: UnaryOperator, argument: ExpressionNode): number;
    /** Applies a binary operator to two evaluated operand nodes. */
    evaluateBinaryExpressionNode(operator: BinaryOperator, left: ExpressionNode, right: ExpressionNode): number;
    /** Numeric argument lookup preserves unresolved identifier arguments as source strings. */
    resolveNumericIdentifierArgument(identifier: string): number | string;
    /** Resolve typed paths without converting indexes or member access back to source. */
    evaluateReferenceExpressionNode(expression: ReferenceExpressionNode): number;
    /** Reports whether a builtin call slot expects source text instead of a numeric value. */
    isStringArgument(functionName: string, argumentIndex: number): boolean;
    /** Interpret externally constructed literals; parsed literals already retain this value. */
    parseLiteralNode(value: string): number;
    /**
     * Calls either a built-in or user-defined function by name, passing an array of arguments which can be strings or numbers.
     * @param name The name of the function to call.
     * @param args The arguments to pass to the function.
     * @returns The result of the function call.
     */
    callFunction: (name: string, args: (number | string)[]) => number;
    /**
     * Calls a user-defined function by name, passing an array of arguments which can be strings or numbers.
     * @param name The name of the function to call.
     * @param args The arguments to pass to the function.
     * @returns The result of the function call.
     */
    callUserFunction: (name: string, args: (number | string)[]) => number;
    /** Bind scalar function parameters structurally so unresolved addresses never become source text. */
    bindLinkFunction(name: string, arguments_: readonly ExpressionNode[]): ExpressionNode | undefined;
    /**
     * Calls a built-in function by name, passing an array of arguments which can be strings or numbers.
     * @param name The name of the function to call.
     * @param args The arguments to pass to the function.
     * @returns The result of the function call.
     */
    callBuiltInFunction: (name: string, args: (number | string)[]) => number;
    /**
     * Validates an argument as a number.
     * @param funcName The name of the function.
     * @param arg The argument to validate.
     * @returns The validated number.
     */
    numArg: (funcName: string, arg: number | string) => number;
    /**
     * Validates an argument as a string.
     * @param funcName The name of the function.
     * @param arg The argument to validate.
     * @returns The validated string.
     */
    strArg: (funcName: string, arg: number | string) => string;
    /** Parse a public declaration through the same grammar used by source commands. */
    parseFunctionDefinition(source: string): void;
    /** Install immutable declaration syntax; replacing a name releases its previous template cache. */
    installFunctionTemplate(name: string, template: FunctionTemplate): void;
    /** Returns the configured expression host or throws when evaluation is attempted too early. */
    getHost(): ExpressionHost;
}
export {};
//# sourceMappingURL=mathcore.d.ts.map