/**
 * Reclaim interrupted attempts before another write, preserving the actual current pair.
 * Unrecognized current pointers defer cleanup until a successful publication establishes ownership.
 */
export declare function prunePriorSourceBuilds(directory: string, incoming: string, fileName: string): string[];
/**
 * Prune only owned build artifacts while the caller holds the publication lease. The current
 * complete pair is the sole cached generation; failed publications retain a pending identity.
 * Unknown files, symlinks and malformed ownership records are left alone and reported, never swept.
 */
export declare function pruneSourceBuilds(directory: string, current: string, fileName: string): string[];
//# sourceMappingURL=build-cache.d.ts.map