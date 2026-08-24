import type { ExpandedOperand, LoweredOperand } from "./architecture-types.js";
import type { ExpressionNode } from "./ir/expression-node.js";
export type OperandResolverDependencies = {
    resolveDefines(input: string): string;
    isStructReference(input: string): boolean;
    resolveStructLabel(input: string): number;
    tryResolveLabel(input: string, requireStatic: boolean): number | undefined;
    resolveLabel(input: string, requireStatic: boolean): number;
    evaluateMath(input: string | ExpressionNode): number;
    shouldDeferExpressionEvaluation(): boolean;
    getCurrentAddress(): number;
    requireStaticLabelLookup(): boolean;
};
export declare class OperandResolver {
    readonly deps: OperandResolverDependencies;
    constructor(deps: OperandResolverDependencies);
    /**
     * Normalizes numeric base member.
     * @param {string} operand The operand.
     * @returns {string} The result.
     */
    normalizeNumericBaseMember(operand: string): string;
    /**
     * Splits math operand suffix.
     * @param {string} operand The operand.
     * @returns {{ expression: string; suffix: string }} The result.
     */
    splitMathOperandSuffix(operand: string): {
        expression: string;
        suffix: string;
    };
    /**
     * Checks whether numeric token.
     * @param {string} token The token.
     * @returns {boolean} The result.
     */
    isNumericToken(token: string): boolean;
    /**
     * Checks whether same bank address.
     * @param {string} expanded The expanded.
     * @returns {boolean} The result.
     */
    isSameBankAddress(expanded: string): boolean;
    /**
     * True when the source wrote a label (or label math) indexed by X, not a hex
     * or define spelling. Bank 0 labels stringify to 4 hex digits, so numeric
     * magnitude cannot distinguish abs,x from long,x.
     * @param {string} operand The raw source operand.
     * @returns {boolean} True if the operand is a `label,x` form.
     */
    isIndexedXLabelOperand(operand: string): boolean;
    /**
     * Sizes `label,x` by logical bank: same bank is abs,x (2), any other bank —
     * including `$00xxxx` — is long,x (3).
     * @param {string} operand The raw source operand.
     * @param {string} expanded The resolved operand text.
     * @param {number} expectedLength The length selected from numeric spelling.
     * @returns {number} Operand width in bytes (2 for abs,x, 3 for long,x).
     */
    applyIndexedXLabelBankWidth(operand: string, expanded: string, expectedLength: number): number;
    /**
     * Resolves arithmetic token.
     * @param {string} token The token.
     * @returns {number} The result.
     */
    resolveArithmeticToken(token: string): number;
    /**
     * Attempts to resolve simple arithmetic.
     * @param {string} operand The operand.
     * @returns {number | null} The result.
     */
    tryResolveSimpleArithmetic(operand: string): number | null;
    /**
     * Determines value length.
     * @param {string | number} value The value.
     * @param {boolean} [forceTwoBytes] The force two bytes.
     * @returns {number} The result.
     */
    determineValueLength(value: string | number, forceTwoBytes?: boolean): number;
    /**
     * Checks whether math expression.
     * @param {string} expression The expression.
     * @returns {boolean} The result.
     */
    isMathExpression(expression: string): boolean;
    /**
     * Attempts to resolve label in operand.
     * @param {string} operand The operand.
     * @returns {string} The result.
     */
    tryResolveLabelInOperand(operand: string): string;
    /**
     * Gets num.
     * @param {string | ExpressionNode} operand The operand.
     * @returns {number} The result.
     */
    getnum(operand: string | ExpressionNode): number;
    /**
     * Gets num from node.
     * @param {ExpressionNode} operand The operand.
     * @returns {number} The result.
     */
    getnumFromNode(operand: ExpressionNode): number;
    /**
     * Resolves reference value.
     * @param {string} reference The reference.
     * @returns {number} The result.
     */
    resolveReferenceValue(reference: string): number;
    /**
     * Expands operand.
     * @param {string} operand The operand.
     * @returns {ExpandedOperand} The result.
     */
    expandOperand(operand: string): ExpandedOperand;
    /**
     * Lowers operand.
     * @param {string} operand The operand.
     * @returns {LoweredOperand} The result.
     */
    lowerOperand(operand: string): LoweredOperand;
}
//# sourceMappingURL=operand-resolver.d.ts.map