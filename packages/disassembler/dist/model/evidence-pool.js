/**
 * Share immutable provenance lists within one load or analysis pass. Repeated captures commonly
 * attach the same long IDs to hundreds of thousands of records. The cache retains at most 8 Mi
 * string characters; reaching that limit stops interning new values without dropping evidence.
 */
export class EvidencePool {
    #strings = new Map();
    #lists = new Map();
    #characters = 0;
    /** Preserve exact membership and order, returning a shared readonly list when already seen. */
    intern(values) {
        const shared = values.map((value) => {
            const found = this.#strings.get(value);
            if (found !== undefined) {
                return found;
            }
            if (this.#characters + value.length <= 8 * 1024 * 1024) {
                this.#strings.set(value, value);
                this.#characters += value.length;
            }
            return value;
        });
        // JSON framing distinguishes arbitrary IDs containing delimiters or control characters.
        const key = JSON.stringify(shared);
        const found = this.#lists.get(key);
        if (found !== undefined) {
            return found;
        }
        Object.freeze(shared);
        if (this.#characters + key.length <= 8 * 1024 * 1024) {
            this.#lists.set(key, shared);
            this.#characters += key.length;
        }
        return shared;
    }
    /** Canonical union for analyzer output; preserves every distinct ID in lexical order. */
    sorted(values) {
        return this.intern([...new Set(values)].toSorted());
    }
}
//# sourceMappingURL=evidence-pool.js.map