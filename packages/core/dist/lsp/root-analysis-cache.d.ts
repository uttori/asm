import type { AssemblyDiagnostic, AssemblyIncludeEdge, AssemblySymbolDefinition, AssemblySymbolReference } from "../diagnostics.js";
/** Serialized per-root analysis artifacts persisted between sessions. */
export type CachedRootAnalysis = {
    /** Whether include directives were expanded when this snapshot was produced. */
    followedIncludes: boolean;
    /** Diagnostics emitted during the cached full pass. */
    diagnostics: AssemblyDiagnostic[];
    /** Symbol definitions discovered in the cached graph. */
    symbols: AssemblySymbolDefinition[];
    /** Symbol references collected for navigation and rename. */
    references: AssemblySymbolReference[];
    /** Include edges linking roots to transitive assembly files. */
    includeEdges: AssemblyIncludeEdge[];
    /** Binary and resource inputs are dependencies, never assembly source files. */
    assetDependencies: Readonly<Record<string, "binary" | "resource">>;
};
/** Assembler settings that must match for a cache entry to be reused. */
export type RootAnalysisCacheIdentity = {
    /** Active assembly target identifier. */
    target: string;
    /** CPU architecture string paired with the target. */
    architecture: string;
    /** Include search paths that affect which files enter the graph. */
    includePaths: readonly string[];
    /** Converter IDs and versions invalidate cached analysis even when files are unchanged. */
    converterIdentity: string;
    /** Target settings can affect active conversion and symbol layout. */
    targetOptionsIdentity: string;
};
/**
 * Disk-backed cache of full-pass workspace analysis artifacts.
 *
 * Entries are keyed by root path. A hit requires the stored file-content
 * fingerprint and assembler identity (target/arch/include paths) to match.
 */
export declare class RootAnalysisCache {
    /** Resolved absolute directory holding one JSON file per cached root. */
    readonly cacheDir: string;
    /**
     * Creates a cache rooted at the given storage directory.
     * @param cacheDir Absolute directory used to store cache JSON files.
     */
    constructor(cacheDir: string);
    /**
     * Loads a cached analysis when every recorded file hash still matches.
     *
     * Uses a two-tier validation strategy:
     * 1. For assembly source, check mtime first (cheap `statSync`). Files whose
     *    mtime is unchanged reuse their stored hash.
     * 2. Hash binary resources on every read, even when mtime is unchanged;
     *    generated assets may be replaced while preserving timestamps.
     *
     * This avoids reading and hashing every include file on every startup when
     * the project has not changed — the common case for warm LSP restarts.
     *
     * @param root Absolute root source path.
     * @param identity Current assembler identity.
     * @param hashFile Content hasher.
     * @param allowMtime False for live overlays whose disk timestamp cannot establish freshness.
     * @returns The cached artifacts, or undefined on miss.
     */
    read(root: string, identity: RootAnalysisCacheIdentity, hashFile: (file: string) => string | undefined, allowMtime?: (file: string) => boolean): CachedRootAnalysis | undefined;
    /**
     * Persists a full-pass analysis. Failures are ignored so a cache write can
     * never block or break the language server.
     * @param root Absolute root source path.
     * @param identity Current assembler identity.
     * @param fileHashes Sorted path-to-hash map.
     * @param fileMtimes Sorted path-to-mtime map.
     * @param analysis Artifacts to store.
     */
    write(root: string, identity: RootAnalysisCacheIdentity, fileHashes: Record<string, string>, fileMtimes: Record<string, number>, analysis: CachedRootAnalysis): void;
    /**
     * Deletes the cache entry for a root, if present.
     * @param root Absolute root source path.
     */
    invalidate(root: string): void;
    /**
     * Derives the stable on-disk filename for a root path.
     * @param root Absolute root source path.
     * @returns Cache JSON path for the root.
     */
    entryPath(root: string): string;
}
/**
 * SHA-256 of the sorted `path:hash` pairs. Used as the cache-entry fingerprint.
 * @param fileHashes Path-to-content-hash map.
 * @returns Hex digest.
 */
export declare function fingerprintFor(fileHashes: Record<string, string>): string;
/**
 * SHA-256 of file bytes.
 * @param bytes File contents.
 * @returns Hex digest.
 */
export declare function hashBytes(bytes: Uint8Array): string;
//# sourceMappingURL=root-analysis-cache.d.ts.map