import type { HalfOpenInterval } from "@uttori/asm-disassembler";
/**
 * Finds previously decoded ROM bytes missing from a replacement analysis or export.
 * Compares interval coverage, so gains elsewhere cannot hide losses or mirrored CFG variants
 * inflate their size. Adjacent instructions may change boundaries without losing coverage.
 * @param {readonly HalfOpenInterval[]} previous Previously accepted ROM code intervals.
 * @param {readonly HalfOpenInterval[]} next Candidate ROM code intervals.
 * @returns {readonly HalfOpenInterval[]} Disjoint lost code ranges in ROM offset order.
 */
export declare const lostCodeRanges: (previous: readonly HalfOpenInterval[], next: readonly HalfOpenInterval[]) => readonly HalfOpenInterval[];
//# sourceMappingURL=code-preservation.d.ts.map