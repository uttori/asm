import type { DebugTraceBatch } from "@uttori/asm-debug-adapter";
/**
 * Parse bounded native execution observations.
 * @param {string} response Native RSP reply.
 * @param {number} maximum Requested event count.
 * @returns {DebugTraceBatch} Decoded execution observations.
 */
export declare const parseAresTraceDetails: (response: string, maximum: number) => DebugTraceBatch;
//# sourceMappingURL=trace-details.d.ts.map