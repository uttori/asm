import type { DebugTraceBatch } from "@uttori/asm-debug-adapter";
/**
 * Parse bounded native execution observations.
 * @param response Native RSP reply.
 * @param maximum Requested event count.
 * @returns Decoded execution observations.
 */
export declare const parseAresTraceDetails: (response: string, maximum: number) => DebugTraceBatch;
//# sourceMappingURL=trace-details.d.ts.map