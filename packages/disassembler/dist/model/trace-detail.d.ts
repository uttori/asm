import type { RuntimeStateValue } from "./project-types.js";
/** An actual bus operation, captured by the producer without extra debugger reads. */
export interface RuntimeTraceMemoryAccess {
    /** Non-empty bus address space name. */
    readonly addressSpace: string;
    /** Non-negative address within addressSpace. */
    readonly address: number;
    /** Bus operation kind; fetch is an opcode or operand read. */
    readonly access: "read" | "write" | "fetch";
    /** Operation width in bytes (1-8). */
    readonly width: number;
    /** Transferred value when the producer recorded it. */
    readonly value?: number;
    /** DMA observations are contemporaneous with a CPU instruction, not performed by it. */
    readonly actor?: "cpu" | "dma" | "hdma";
    /** DMA/HDMA channel (0-7); only valid with a dma or hdma actor. */
    readonly channel?: number;
}
/** Bytes fetched during execution and registers immediately before that instruction. */
export interface RuntimeInstructionDetail {
    /** Instruction bytes in fetch order (1-16 values, 0-255). */
    readonly bytes: readonly number[];
    /** Register values keyed by producer register name, in sorted key order. */
    readonly state: Readonly<Record<string, RuntimeStateValue>>;
    /** Bus operations attributed to the instruction, at most 256; undefined when not captured. */
    readonly memoryAccesses?: readonly RuntimeTraceMemoryAccess[];
    /** Operations omitted by a bounded per-instruction producer buffer. */
    readonly droppedMemoryAccesses?: number;
}
/**
 * Validate execution details for persistence.
 * @param value Untrusted detail array.
 * @param count Expected instruction count.
 * @returns Owned details with recursively canonical key order.
 */
export declare const validateRuntimeInstructionDetails: (value: unknown, count: number) => readonly RuntimeInstructionDetail[];
//# sourceMappingURL=trace-detail.d.ts.map