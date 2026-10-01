/** SHA-256 for a bounded source identity, independent of the repository's Git hash algorithm. */
export declare const sourceContentHash: (value: string | Uint8Array) => string;
/** Portable project-relative paths cannot escape their root or enter Git's own administrative data. */
export declare function assertSourcePath(relative: string): void;
//# sourceMappingURL=source-inputs.d.ts.map