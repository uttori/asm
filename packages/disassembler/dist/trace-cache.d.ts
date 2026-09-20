/** Caller-owned cumulative counters, initialized to zero for an import. Timing runs
 * omit them so diagnostic writes do not become part of the measured hot path.
 */
export interface TraceCacheMetrics {
    hits: number;
    misses: number;
    evictions: number;
    peakEntries: number;
}
/** Disk-index diagnostics extend cache counters with SQL attempts and new payloads. */
export interface TraceIndexMetrics extends TraceCacheMetrics {
    /** Executed UPDATE/INSERT statements, including an UPDATE that finds no row. */
    sqlStatements: number;
    /** Lazy payload factories invoked for newly inserted facts, not cache refills. */
    payloads: number;
}
/** A fixed 4,096-entry working set with deterministic pseudo-random replacement.
 * Clear-all loses every useful entry. FIFO/LRU repeatedly evicts the next needed
 * key in a rotating 4,097-key trace. Single random victims break that pattern
 * without growing the cache or updating recency on every hit. All-unique scans
 * still miss and pay replacement overhead. This policy favors repeated traces.
 * This is a performance cache, never an identity source. Callers persist evicted deltas.
 */
export declare class TraceCache<T> {
    #private;
    constructor(metrics?: TraceCacheMetrics);
    /** Look up a value. Undefined is reserved for misses.
     * @param {string} key Complete semantic key, never a lossy coordinate projection.
     * @returns {T | undefined} Retained value, or a cache miss.
     */
    get(key: string): T | undefined;
    /** Insert a missing key, returning the displaced entry so its owner can flush it.
     * Existing keys must be updated through their caller-owned mutable value instead.
     * @param {string} key Previously missing semantic key.
     * @param {T} value Defined value whose ownership stays with the caller.
     * @returns {object | undefined} Displaced key/value, or undefined while filling unused capacity.
     */
    insert(key: string, value: T): {
        key: string;
        value: T;
    } | undefined;
    /** Iterate the retained working set, for a final durable delta flush.
     * @returns {MapIterator} Live entries. Do not insert while iterating.
     */
    entries(): MapIterator<[string, T]>;
    /** Drop retained values after a flush or failed import. Diagnostics remain cumulative. */
    clear(): void;
}
//# sourceMappingURL=trace-cache.d.ts.map