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
 * Clear-all loses every useful entry; FIFO/LRU repeatedly evicts the next needed
 * key in a rotating 4,097-key trace. Single random victims break that pattern
 * without growing the cache or updating recency on every hit. All-unique scans
 * still miss and pay replacement overhead; this policy favors repeated traces.
 * This is a performance cache, never an identity source; callers persist evicted deltas.
 */
export class TraceCache<T> {
  readonly #entries = new Map<string, T>();
  /** Dense victim slots avoid scanning the Map; hits never reorder either structure. */
  readonly #keys: string[] = [];
  readonly #metrics?: TraceCacheMetrics;
  #random = 0x9e3779b9;

  constructor(metrics?: TraceCacheMetrics) {
    this.#metrics = metrics;
  }

  /** Look up a value; undefined is reserved for misses.
   * @param {string} key Complete semantic key, never a lossy coordinate projection.
   * @returns {T | undefined} Retained value, or a cache miss.
   */
  get(key: string): T | undefined {
    const value = this.#entries.get(key);
    if (this.#metrics) {
      if (value === undefined) {
        this.#metrics.misses++;
      } else {
        this.#metrics.hits++;
      }
    }
    return value;
  }

  /** Insert a missing key, returning the displaced entry so its owner can flush it.
   * Existing keys must be updated through their caller-owned mutable value instead.
   * @param {string} key Previously missing semantic key.
   * @param {T} value Defined value whose ownership stays with the caller.
   * @returns {object | undefined} Displaced key/value, or undefined while filling unused capacity.
   */
  insert(key: string, value: T): { key: string; value: T } | undefined {
    let displaced: { key: string; value: T } | undefined;
    if (this.#keys.length === 4096) {
      // Xorshift uses no RNG allocation or global state. The fixed nonzero seed
      // makes eviction reproducible; randomness affects cost, never correctness.
      let random = this.#random;
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      this.#random = random;
      // The mask relies on the power-of-two capacity above; change both together.
      const slot = random & 4095;
      const victim = this.#keys[slot];
      displaced = { key: victim, value: this.#entries.get(victim)! };
      this.#entries.delete(victim);
      this.#keys[slot] = key;
      if (this.#metrics) {
        this.#metrics.evictions++;
      }
    } else {
      this.#keys.push(key);
      if (this.#metrics) {
        this.#metrics.peakEntries = Math.max(this.#metrics.peakEntries, this.#keys.length);
      }
    }
    this.#entries.set(key, value);
    return displaced;
  }

  /** Iterate the retained working set, for a final durable delta flush.
   * @returns {MapIterator} Live entries; do not insert while iterating.
   */
  entries(): MapIterator<[string, T]> {
    return this.#entries.entries();
  }

  /** Drop retained values after a flush or failed import; diagnostics remain cumulative. */
  clear(): void {
    this.#entries.clear();
    this.#keys.length = 0;
    this.#random = 0x9e3779b9;
  }
}
