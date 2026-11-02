import type { HalfOpenInterval } from "../internal/interval-index.js";

/** Merge overlapping half-open intervals after sorting by start offset. */
const union = (ranges: readonly HalfOpenInterval[]): HalfOpenInterval[] => {
  const merged: HalfOpenInterval[] = [];
  for (const range of ranges.toSorted((left, right) => left.start - right.start)) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) {
      merged[merged.length - 1] = {
        start: previous.start,
        end: Math.max(previous.end, range.end),
      };
    } else {
      merged.push(range);
    }
  }
  return merged;
};

/**
 * Finds previously decoded ROM bytes missing from a replacement analysis or export.
 * Compares interval coverage, so gains elsewhere cannot hide losses or mirrored CFG variants
 * inflate their size. Adjacent instructions may change boundaries without losing coverage.
 * @param previous Previously accepted ROM code intervals.
 * @param next Candidate ROM code intervals.
 * @returns Disjoint lost code ranges in ROM offset order.
 */
export const lostCodeRanges = (
  previous: readonly HalfOpenInterval[],
  next: readonly HalfOpenInterval[],
): readonly HalfOpenInterval[] => {
  const retained = union(next);
  const lost: HalfOpenInterval[] = [];
  let index = 0;
  for (const range of union(previous)) {
    let cursor = range.start;
    while (index < retained.length && retained[index].end <= cursor) {
      index++;
    }
    for (let candidate = index; candidate < retained.length; candidate++) {
      const covered = retained[candidate];
      if (covered.start >= range.end) {
        break;
      }
      if (covered.start > cursor) {
        lost.push({ start: cursor, end: covered.start });
      }
      cursor = Math.max(cursor, Math.min(range.end, covered.end));
      if (cursor === range.end) {
        break;
      }
    }
    if (cursor < range.end) {
      lost.push({ start: cursor, end: range.end });
    }
  }
  return lost;
};
