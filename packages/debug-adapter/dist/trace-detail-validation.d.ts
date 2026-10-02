import type { DebugTraceInstructionDetail } from "./contracts.js";
/**
 * Validate details before they reach a debugger client.
 * @param {unknown} value Untrusted detail array.
 * @param {number} count Expected instruction count.
 * @returns {readonly DebugTraceInstructionDetail[]} Validated details.
 */
export declare function validateDebugTraceDetails(value: unknown, count: number): readonly DebugTraceInstructionDetail[];
//# sourceMappingURL=trace-detail-validation.d.ts.map