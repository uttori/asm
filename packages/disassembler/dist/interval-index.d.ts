/** Minimal validated `[start, end)` interval accepted by the target-neutral index. */
export interface HalfOpenInterval {
    readonly start: number;
    readonly end: number;
}
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
export declare class HalfOpenIntervalIndex<Value extends HalfOpenInterval> {
    #private;
    /**
     * Builds an immutable search index from already-owned interval values.
     * @param {readonly Value[]} values Non-negative safe half-open intervals in semantic input order.
     * @throws {Error} When an interval is empty, reversed, negative, or outside safe integers.
     */
    constructor(values: readonly Value[]);
    /**
     * Returns every interval containing one safe non-negative point, in input order.
     * @param {number} point Safe non-negative point to query.
     * @returns {readonly Value[]} Matching intervals in their original input order.
     */
    at(point: number): readonly Value[];
    /**
     * Returns every interval intersecting a valid half-open query, in input order.
     * @param {number} start Inclusive safe non-negative query start.
     * @param {number} end Exclusive safe query end greater than `start`.
     * @returns {readonly Value[]} Matching intervals in their original input order.
     */
    overlapping(start: number, end: number): readonly Value[];
}
//# sourceMappingURL=interval-index.d.ts.map