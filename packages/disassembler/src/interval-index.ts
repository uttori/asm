/** Minimal validated `[start, end)` interval accepted by the target-neutral index. */
export interface HalfOpenInterval {
  readonly start: number;
  readonly end: number;
}

type IndexedInterval<Value extends HalfOpenInterval> = {
  readonly value: Value;
  /** Original position used to restore observable input order after an indexed lookup. */
  readonly inputIndex: number;
};

/**
 * Immutable point/range lookup for validated half-open intervals.
 *
 * Entries are sorted once by start offset and paired with a prefix-maximum end array. A query first
 * finds the last possible start with binary search, then scans backward only while an earlier
 * interval can still overlap. This replaces repeated full annotation scans in analysis and source
 * export without changing their observable ordering: matches are restored to original input order
 * before being returned. Keep the prefix maxima and input indices together if this representation
 * changes. Dropping either silently turns lookups back into O(n) scans or changes deterministic
 * first-match behavior.
 */
export class HalfOpenIntervalIndex<Value extends HalfOpenInterval> {
  readonly #entries: readonly IndexedInterval<Value>[];
  readonly #prefixMaximumEnd: readonly number[];

  /**
   * Builds an immutable search index from already-owned interval values.
   * @param {readonly Value[]} values Non-negative safe half-open intervals in semantic input order.
   * @throws {Error} When an interval is empty, reversed, negative, or outside safe integers.
   */
  constructor(values: readonly Value[]) {
    for (const value of values) {
      if (
        !Number.isSafeInteger(value.start) ||
        !Number.isSafeInteger(value.end) ||
        value.start < 0 ||
        value.end <= value.start
      ) {
        throw new Error("Interval index entries must be non-negative safe half-open ranges.");
      }
    }
    // Search order is deliberately separate from semantic order. InputIndex restores the latter.
    this.#entries = values
      .map((value, inputIndex): IndexedInterval<Value> => ({ value, inputIndex }))
      .sort(
        (left, right) =>
          left.value.start - right.value.start ||
          left.value.end - right.value.end ||
          left.inputIndex - right.inputIndex,
      );
    // prefixMaximumEnd[i] is the furthest end among entries 0..i. During a backward scan, a value
    // at or before i cannot overlap once this maximum is <= the query start.
    const prefixMaximumEnd: number[] = [];
    let maximumEnd = -1;
    for (const [index, entry] of this.#entries.entries()) {
      maximumEnd = Math.max(maximumEnd, entry.value.end);
      prefixMaximumEnd[index] = maximumEnd;
    }
    this.#prefixMaximumEnd = prefixMaximumEnd;
  }

  /**
   * Returns every interval containing one safe non-negative point, in input order.
   * @param {number} point Safe non-negative point to query.
   * @returns {readonly Value[]} Matching intervals in their original input order.
   */
  at(point: number): readonly Value[] {
    if (!Number.isSafeInteger(point) || point < 0) {
      throw new Error("Interval index points must be non-negative safe integers.");
    }
    return this.#matching(point, point + 1);
  }

  /**
   * Returns every interval intersecting a valid half-open query, in input order.
   * @param {number} start Inclusive safe non-negative query start.
   * @param {number} end Exclusive safe query end greater than `start`.
   * @returns {readonly Value[]} Matching intervals in their original input order.
   */
  overlapping(start: number, end: number): readonly Value[] {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) {
      throw new Error("Interval index queries must be non-negative safe half-open ranges.");
    }
    return this.#matching(start, end);
  }

  #matching(start: number, end: number): readonly Value[] {
    // Find the first entry whose start is not before the exclusive query end. No entry at or after
    // this position can overlap a half-open query.
    let low = 0;
    let high = this.#entries.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (this.#entries[middle].value.start < end) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    const matches: IndexedInterval<Value>[] = [];
    // Prefix maxima provide the early-stop condition that a simple start-sorted array lacks.
    for (let index = low - 1; index >= 0 && this.#prefixMaximumEnd[index] > start; index--) {
      const entry = this.#entries[index];
      if (entry.value.end > start) {
        matches.push(entry);
      }
    }
    // Consumers historically observed project input order from Array.filter/find. Preserve it even
    // though the index scans in reverse start order.
    return matches
      .sort((left, right) => left.inputIndex - right.inputIndex)
      .map(({ value }) => value);
  }
}
