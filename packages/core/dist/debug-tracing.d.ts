import type { AssemblyStageName } from "./plugin/contracts.js";
/**
 * Per-byte write emitted after the logical address has been mapped to output.
 */
export type AssemblerTraceWriteEvent = {
    type: "write";
    stage: AssemblyStageName;
    arch: string;
    file: string;
    line: number;
    raw: string;
    normalized: string;
    logicalAddress: number;
    /** Active target address width. Older callers default to 24-bit formatting. */
    addressWidth?: number;
    outputOffset: number;
    value: number;
};
/**
 * High-level command lifecycle emitted around `processNormalizedCommand()`.
 * `command-start` captures the entry address, while `command-end` records the
 * final address span and total bytes written.
 */
export type AssemblerTraceCommandEvent = {
    type: "command-start" | "command-end";
    stage: AssemblyStageName;
    arch: string;
    file: string;
    line: number;
    raw: string;
    normalized: string;
    logicalAddress: number;
    /** Active target address width. Older callers default to 24-bit formatting. */
    addressWidth?: number;
    outputOffset: number;
    endLogicalAddress?: number;
    endOutputOffset?: number;
    bytesWritten?: number;
};
export type AssemblerTraceEvent = AssemblerTraceWriteEvent | AssemblerTraceCommandEvent;
export type AssemblerTraceListener = (event: AssemblerTraceEvent) => void;
export type TraceCollectorOptions = {
    /** Inclusive logical address range filter. */
    startAddress?: number;
    endAddress?: number;
    /** Substring match against the source file path. */
    fileIncludes?: string[];
    /** Restrict to a subset of event kinds. */
    eventTypes?: AssemblerTraceEvent["type"][];
    /** Restrict to a specific assembler stage. */
    stage?: AssemblyStageName;
    /** Restrict to a specific architecture contribution ID or alias. */
    arch?: string;
};
/**
 * Creates an in-memory listener that can be attached with
 * `assembler.setTraceListener(...)` during debugging scripts or tests.
 * @param {TraceCollectorOptions} options - The options for the trace collector.
 * @returns {{ events: AssemblerTraceEvent[]; listener: AssemblerTraceListener; clear(): void }} The trace collector.
 * @example
 * const collector = createTraceCollector({
 *   startAddress: 0x808000,
 *   endAddress: 0x808000,
 *   eventTypes: ["write", "command-start", "command-end"],
 * });
 * assembler.setTraceListener(collector.listener);
 */
export declare function createTraceCollector(options?: TraceCollectorOptions): {
    events: AssemblerTraceEvent[];
    listener: AssemblerTraceListener;
    clear(): void;
};
/**
 * Formats a trace event as a single log-friendly line for ad-hoc debugging.
 * @param {AssemblerTraceEvent} event - The trace event to format.
 * @returns {string} The formatted trace event.
 */
export declare function formatTraceEvent(event: AssemblerTraceEvent): string;
//# sourceMappingURL=debug-tracing.d.ts.map