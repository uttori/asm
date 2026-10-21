import { type ExpressionNode, type ReferenceExpressionNode } from "./ir/expression-node.js";
import type { ReferenceResolution } from "./ir/reference-path.js";
/** Borrowed session bindings; parsed syntax never stores resolved addresses or pass-local values. */
export type OperandResolverDependencies = {
    resolveReference(input: ReferenceExpressionNode): ReferenceResolution;
    evaluateMath(input: ExpressionNode): number;
    shouldDeferExpressionEvaluation(): boolean;
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