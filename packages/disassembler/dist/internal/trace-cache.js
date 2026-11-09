/**
 * A fixed 4,096-entry working set with deterministic pseudo-random replacement.
 * Clear-all loses every useful entry. FIFO/LRU repeatedly evicts the next needed
 * key in a rotating 4,097-key trace. Single random victims break that pattern
 * without growing the cache or updating recency on every hit. All-unique scans
 * still miss and pay replacement overhead. This policy favors repeated traces.
 * This is a performance cache, never an identity source. Callers persist evicted deltas.
 */
export class TraceCache {
    #entries = new Map();
    /** Dense victim slots avoid scanning the Map. Hits never reorder either structure. */
    #keys = [];
    #metrics;
    #random = 0x9e3779b9;
    constructor(metrics) {
        this.#metrics = metrics;
    }
    /**
     * Look up a value. Undefined is reserved for misses.
     * @param key Complete semantic key, never a lossy coordinate projection.
     * @returns Retained value, or a cache miss.
     */
    get(key) {
        const value = this.#entries.get(key);
        if (this.#metrics) {
            if (value === undefined) {
                this.#metrics.misses++;
            }
            else {
                this.#metrics.hits++;
            }
        }
        return value;
    }
    /**
     * Insert a missing key, returning the displaced entry so its owner can flush it.
     * Existing keys must be updated through their caller-owned mutable value instead.
     * @param key Previously missing semantic key.
     * @param value Defined value whose ownership stays with the caller.
     * @returns Displaced key/value, or undefined while filling unused capacity.
     */
    insert(key, value) {
        let displaced;
        if (this.#keys.length === 4096) {
            // Xorshift uses no RNG allocation or global state. The fixed nonzero seed
            // makes eviction reproducible. Randomness affects cost, never correctness.
            let random = this.#random;
            random ^= random << 13;
            random ^= random >>> 17;
            random ^= random << 5;
            this.#random = random;
            // The mask relies on the power-of-two capacity above. Change both together.
            const slot = random & 4095;
            const victim = this.#keys[slot];
            displaced = { key: victim, value: this.#entries.get(victim) };
            this.#entries.delete(victim);
            this.#keys[slot] = key;
            if (this.#metrics) {
                this.#metrics.evictions++;
            }
        }
        else {
            this.#keys.push(key);
            if (this.#metrics) {
                this.#metrics.peakEntries = Math.max(this.#metrics.peakEntries, this.#keys.length);
            }
        }
        this.#entries.set(key, value);
        return displaced;
    }
    /**
     * Iterate the retained working set, for a final durable delta flush.
     * @returns Live entries. Do not insert while iterating.
     */
    entries() {
        return this.#entries.entries();
    }
    /** Drop retained values after a flush or failed import. Diagnostics remain cumulative. */
    clear() {
        this.#entries.clear();
        this.#keys.length = 0;
        this.#random = 0x9e3779b9;
    }
}
//# sourceMappingURL=trace-cache.js.map