/**
 * Prune only owned build artifacts while the caller holds the publication lease. Three successful
 * generations include the current receipt; failed publications have a recoverable pending receipt.
 * Unknown files, symlinks and malformed ownership records are left alone and reported, never swept.
 */
export declare function pruneSnesSourceBuilds(directory: string, current: string): string[];
//# sourceMappingURL=source-build-cache.d.ts.map