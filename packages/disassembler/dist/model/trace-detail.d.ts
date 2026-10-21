import type { RuntimeStateValue } from "./project-types.js";
/** An actual bus operation, captured by the producer without extra debugger reads. */
export interface RuntimeTraceMemoryAccess {
    readonly addressSpace: string;
    readonly address: number;
    readonly access: "read" | "write" | "fetch";
    readonly width: number;
    readonly value?: number;
    /** DMA observations are contemporaneous with a CPU instruction, not performed by it. */
    readonly actor?: "cpu" | "dma" | "hdma";
    readonly channel?: number;
}
/** Bytes fetched during execution and registers immediately before that instruction. */
export interface RuntimeInstructionDetail {
    readonly bytes: readonly number[];
    readonly state: Readonly<Record<string, RuntimeStateValue>>;
    readonly memoryAccesses?: readonly RuntimeTraceMemoryAccess[];
    /** Operations omitted by a bounded per-instruction producer buffer. */
    readonly droppedMemoryAccesses?: number;
}
/**
 * Validate execution details for persistence.
 * @param {unknown} value Untrusted detail array.
 * @param {number} count Expected instruction count.
 * @returns {readonly RuntimeInstructionDetail[]} Owned details with recursively canonical key order.
 */
export declare const validateRuntimeInstructionDetails: (value: unknown, count: number) => readonly RuntimeInstructionDetail[];
//# sourceMappingURL=trace-detail.d.ts.map