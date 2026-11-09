import type { HalfOpenInterval } from "../internal/interval-index.js";
/**
 * Finds previously decoded ROM bytes missing from a replacement analysis or export.
 * Compares interval coverage, so gains elsewhere cannot hide losses or mirrored CFG variants
 * inflate their size. Adjacent instructions may change boundaries without losing coverage.
 * @param previous Previously accepted ROM code intervals.
 * @param next Candidate ROM code intervals.
 * @returns Disjoint lost code ranges in ROM offset order.
 */
export declare const lostCodeRanges: (previous: readonly HalfOpenInterval[], next: readonly HalfOpenInterval[]) => readonly HalfOpenInterval[];
//# sourceMappingURL=code-preservation.d.ts.map