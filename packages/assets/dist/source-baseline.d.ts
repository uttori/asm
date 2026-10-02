/** Portable file fingerprint; paths are relative to a caller-selected project root. */
export interface AssetSourceFingerprint {
    readonly path: string;
    /** Exact byte count, independent of text encoding or filesystem allocation. */
    readonly size: number;
    /** Lowercase hexadecimal digest of the complete file contents. */
    readonly sha256: string;
}
/** Persistent editing-session baseline. Identity includes the host's project/codec revision. */
export interface AssetSourceBaseline {
    readonly version: 1;
    readonly identity: string;
    readonly files: readonly AssetSourceFingerprint[];
}
/** Reject platform-dependent aliases and paths that escape a selected source root.
 * @param {unknown} name Portable project-relative path.
 * @returns {string} Validated path, unchanged.
 */
export declare function assetRelativePath(name: unknown): string;
/** Reject symlinks in every path component, including the selected root.
 * @param {string} root Existing source directory.
 * @param {string} name Project-relative path to an existing regular file.
 * @returns {string} Host absolute path whose components were checked.
 */
export declare function assetSourcePath(root: string, name: string): string;
/** Fingerprint supplied source bytes; no root or machine-specific path is persisted.
 * @param {string} identity Host-selected project and adapter revision identity.
 * @param {ReadonlyMap<string, Uint8Array>} sources Exact bytes captured at export time.
 * @returns {AssetSourceBaseline} JSON-serializable snapshot, independent of subsequent buffer edits.
 */
export declare function createAssetSourceBaseline(identity: string, sources: ReadonlyMap<string, Uint8Array>): AssetSourceBaseline;
/** Validate a persisted baseline before reading any of its paths.
 * @param {unknown} value Untrusted parsed JSON.
 * @returns {AssetSourceBaseline} Validated version-one baseline.
 */
export declare function parseAssetSourceBaseline(value: unknown): AssetSourceBaseline;
/** Detect edits made since export, not merely since the current import command started.
 * @param {string} root Current source directory or an unchanged relocated copy.
 * @param {AssetSourceBaseline} input Persisted baseline, revalidated before use.
 * @param {string} identity Expected project/adapter identity supplied independently by the host.
 * @returns {void} Throws with every stale or missing dependency before publication.
 */
export declare function assertAssetSourceBaseline(root: string, input: AssetSourceBaseline, identity: string): void;
//# sourceMappingURL=source-baseline.d.ts.map