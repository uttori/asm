import type { DebugRegister } from "./contracts.js";
/** Result of evaluating one stopped-frame debugger expression. */
export interface DebugExpressionResult {
    /** Evaluated integer magnitude. */
    readonly value: bigint;
    /** Preserved only when the complete expression is a register reference. */
    readonly bits?: number;
}
/**
 * Evaluates a bounded, side-effect-free native integer expression against stopped registers.
 * @param expression Native expression using register names and integer operators.
 * @param registers Registers from the selected stopped frame.
 * @returns Exact integer result and direct-register width, when applicable.
 */
export declare const evaluateDebugExpression: (expression: string, registers: readonly DebugRegister[]) => DebugExpressionResult;
/**
 * Formats a debugger integer without losing values above JavaScript's safe-number range.
 * @param value Evaluated integer.
 * @returns Signed hexadecimal display string.
 */
export declare const formatDebugExpressionValue: (value: bigint) => string;
//# sourceMappingURL=debug-expression.d.ts.map