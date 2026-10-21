import type { AssemblyStageName } from "./plugin/contracts.js";
import type { SourceOrigin } from "./source-provenance.js";
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
    /** Source expansion chain for this emitted occurrence. */
    origin?: SourceOrigin;
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
    /** Source expansion chain for this emitted occurrence. */
    origin?: SourceOrigin;
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
//# sourceMappingURL=debug-tracing.d.ts.map