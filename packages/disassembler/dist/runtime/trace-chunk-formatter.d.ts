import type { RuntimeInstructionTraceChunk } from "./runtime-trace.js";
/**
 * Historical canonical trace text at its four-space envelope indentation. Input must already
 * belong to createRuntimeTraceChunkValidator: every nested object's keys are canonical and no
 * producer-owned values may change during formatting. No fields or observations are omitted.
 */
export declare class TraceChunkFormatter {
    #private;
    /** Format one bounded validated chunk without recursively copying its register objects again. */
    format(chunk: RuntimeInstructionTraceChunk): string;
}
//# sourceMappingURL=trace-chunk-formatter.d.ts.map