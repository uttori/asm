import { type ExpressionNode, type ReferenceExpressionNode } from "./ir/expression-node.js";
import type { ReferenceResolution } from "./ir/reference-path.js";
/** Borrowed session bindings; parsed syntax never stores resolved addresses or pass-local values. */
export type OperandResolverDependencies = {
    /** Resolves chained references without mutating parsed syntax nodes. */
    resolveReference(input: ReferenceExpressionNode): ReferenceResolution;
    /** Evaluates non-reference expressions to numeric values for operand lowering. */
    evaluateMath(input: ExpressionNode): number;
    /** Defers evaluation when forward references require a later pass. */
    shouldDeferExpressionEvaluation(): boolean;
    /** Supplies the program counter used by PC-relative operand forms. */
    getCurrentAddress(): number;
};
/** Numeric operand evaluation. Target grammars own addressing forms and lexical width intent. */
export declare class OperandResolver {
    readonly deps: OperandResolverDependencies;
    private readonly parsedInputs;
    constructor(deps: OperandResolverDependencies);
    /** Release public-entry syntax when an assembly snapshot ends. */
    clearParsedOperands(): void;
    /** Public string callers enter the same grammar used by numeric source directives. */
    getnum(input: string | ExpressionNode): number;
    /** Resolve the current occurrence, preserving deferred failures during definition/layout stages. */
    getnumFromNode(operand: ExpressionNode): number;
    /** Current logical byte address, without target-specific mapping. */
    getCurrentAddress(): number;
}
//# sourceMappingURL=operand-resolver.d.ts.map