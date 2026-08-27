import type { AssemblyDiagnostic, AssemblyIncludeEdge, AssemblySymbolDefinition, AssemblySymbolReference } from "../diagnostics.js";
/** Serialized per-root analysis artifacts persisted between sessions. */
export type CachedRootAnalysis = {
    followedIncludes: boolean;
    diagnostics: AssemblyDiagnostic[];
    symbols: AssemblySymbolDefinition[];
    references: AssemblySymbolReference[];
    includeEdges: AssemblyIncludeEdge[];
};
/** Assembler settings that must match for a cache entry to be reused. */
export type RootAnalysisCacheIdentity = {
    target: string;
    architecture: string;
    includePaths: readonly string[];
};
/**
 * Disk-backed cache of full-pass workspace analysis artifacts.
 *
 * Entries are keyed by root path. A hit requires the stored file-content
 * fingerprint and assembler identity (target/arch/include paths) to match.
 */
export declare class RootAnalysisCache {
    readonly cacheDir: string;
    /**
     * @param {string} cacheDir Absolute directory used to store cache JSON files.
     */
    constructor(cacheDir: string);
    /**
     * Loads a cached analysis when every recorded file hash still matches.
     * @param {string} root Absolute root source path.
     * @param {RootAnalysisCacheIdentity} identity Current assembler identity.
     * @param {(file: string) => string | undefined} hashFile Content hasher.
     * @returns {CachedRootAnalysis | undefined} The cached artifacts, or undefined on miss.
     */
    read(root: string, identity: RootAnalysisCacheIdentity, hashFile: (file: string) => string | undefined): CachedRootAnalysis | undefined;
    /**
     * Persists a full-pass analysis. Failures are ignored so a cache write can
     * never block or break the language server.
     * @param {string} root Absolute root source path.
     * @param {RootAnalysisCacheIdentity} identity Current assembler identity.
     * @param {Record<string, string>} fileHashes Sorted path-to-hash map.
     * @param {CachedRootAnalysis} analysis Artifacts to store.
     */
    write(root: string, identity: RootAnalysisCacheIdentity, fileHashes: Record<string, string>, analysis: CachedRootAnalysis): void;
    /**
     * Deletes the cache entry for a root, if present.
     * @param {string} root Absolute root source path.
     */
    invalidate(root: string): void;
    /**
     * @param {string} root Absolute root source path.
     * @returns {string} Cache JSON path for the root.
     */
    entryPath(root: string): string;
}
/**
 * SHA-256 of the sorted `path:hash` pairs. Used as the cache-entry fingerprint.
 * @param {Record<string, string>} fileHashes Path-to-content-hash map.
 * @returns {string} Hex digest.
 */
export declare function fingerprintFor(fileHashes: Record<string, string>): string;
/**
 * SHA-256 of file bytes.
 * @param {Uint8Array} bytes File contents.
 * @returns {string} Hex digest.
 */
export declare function hashBytes(bytes: Uint8Array): string;
//# sourceMappingURL=root-analysis-cache.d.ts.map