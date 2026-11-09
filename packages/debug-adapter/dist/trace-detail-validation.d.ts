import type { DebugTraceInstructionDetail } from "./contracts.js";
/**
 * Validate details before they reach a debugger client.
 * @param value Untrusted detail array.
 * @param count Expected instruction count.
 * @returns Validated details.
 */
export declare function validateDebugTraceDetails(value: unknown, count: number): readonly DebugTraceInstructionDetail[];
//# sourceMappingURL=trace-detail-validation.d.ts.map