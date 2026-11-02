/**
 * Share immutable provenance lists within one load or analysis pass. Repeated captures commonly
 * attach the same long IDs to hundreds of thousands of records. The cache retains at most 8 Mi
 * string characters; reaching that limit stops interning new values without dropping evidence.
 */
export declare class EvidencePool {
    #private;
    /** Preserve exact membership and order, returning a shared readonly list when already seen. */
    intern(values: readonly string[]): readonly string[];
    /** Canonical union for analyzer output; preserves every distinct ID in lexical order. */
    sorted(values: readonly string[]): readonly string[];
}
//# sourceMappingURL=evidence-pool.d.ts.map