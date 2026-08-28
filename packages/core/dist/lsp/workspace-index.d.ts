import type { AssemblerEnvironment } from "../plugin/environment.js";
import type { ToolingCatalog } from "../plugin/contracts.js";
import type { AssemblyDiagnostic, AssemblyIncludeEdge, AssemblySymbolDefinition, AssemblySymbolReference } from "../diagnostics.js";
import type { DirectiveDescriptor } from "./directive-catalog.js";
import { RootAnalysisCache, type CachedRootAnalysis } from "./root-analysis-cache.js";
/**
 * The per-file slice of analysis artifacts produced for a single source file.
 */
export type FileAnalysis = {
    /** Absolute path of the analysed file. */
    file: string;
    /** Diagnostics whose location resolves to this file. */
    diagnostics: AssemblyDiagnostic[];
    /** Symbol definitions declared in this file. */
    symbols: AssemblySymbolDefinition[];
    /** Symbol references that occur in this file. */
    references: AssemblySymbolReference[];
};
/**
 * Configuration for a workspace index.
 */
export type WorkspaceIndexOptions = {
    /** Frozen plugin environment used by every analysis session. */
    environment: AssemblerEnvironment;
    /** Target contribution ID or alias. */
    target: string;
    /** Explicit project entry points (absolute paths). When empty, open documents are treated as roots. */
    entryPoints?: string[];
    /** Additional include search paths handed to the assembler. */
    includePaths?: string[];
    /** Target architecture contribution ID or alias. */
    architecture?: string;
    /** Validated options for the selected target contribution. */
    targetOptions?: Readonly<Record<string, unknown>>;
    /** Optional logger for analysis timing. */
    logger?: {
        info(message: string): void;
    };
    /** Directory for persisted full-pass analysis artifacts. When omitted, caching is disabled. */
    cacheDir?: string;
};
export type WorkspaceIndexConfiguration = Omit<WorkspaceIndexOptions, "environment" | "target">;
export type RootAnalysis = CachedRootAnalysis;
/**
 * Snapshot of workspace analysis used by the project panel and status bar.
 */
export type WorkspaceIndexStatus = {
    fileCount: number;
    symbolCount: number;
    referenceCount: number;
    errorCount: number;
    entryPoints: string[];
    includePaths: string[];
    lastReindexDurationMs?: number;
    lastReindexRootCount: number;
    lastReindexCachedRoots: number;
    lastReindexAnalyzedRoots: number;
};
/**
 * Indexes one or more assembly projects for editor tooling.
 *
 * Analysis is root-anchored: each entry point (or open document when no entry
 * points are configured) is analysed with the assembler's recovery-friendly
 * `analyzeSource`, which descends into includes. The resulting flat artifacts
 * are bucketed by file so language features can be served per document, and
 * the include graph is preserved for cross-file navigation.
 */
export declare class WorkspaceIndex {
    #private;
    /** Open editor buffers keyed by absolute path. */
    readonly overlay: Map<string, string>;
    /** Per-file analysis buckets keyed by absolute path. */
    readonly fileAnalysis: Map<string, FileAnalysis>;
    /** Merged include-graph edges across all analysed roots. */
    includeEdges: AssemblyIncludeEdge[];
    /** All symbol definitions across the workspace (for cross-file resolution). */
    allSymbols: AssemblySymbolDefinition[];
    /** All symbol references across the workspace (for find-references). */
    allReferences: AssemblySymbolReference[];
    /** Cached complete analysis artifacts for each configured root. */
    readonly rootAnalyses: Map<string, CachedRootAnalysis>;
    /** Files whose content changed since the last analysis. */
    readonly dirtyFiles: Set<string>;
    /** Whether configuration changes require every root to be rebuilt. */
    fullReindexRequired: boolean;
    entryPoints: string[];
    includePaths: string[];
    architecture: string;
    readonly targetOptions: Readonly<Record<string, unknown>>;
    readonly environment: AssemblerEnvironment;
    readonly target: string;
    readonly toolingCatalog: ToolingCatalog;
    readonly directiveCatalog: readonly DirectiveDescriptor[];
    readonly directivePrefixes: readonly string[];
    readonly logger?: {
        info(message: string): void;
    };
    readonly cache?: RootAnalysisCache;
    /** Duration of the most recent {@link reindex} call in milliseconds. */
    lastReindexDurationMs?: number;
    /** How many roots were considered during the last reindex. */
    lastReindexRootCount: number;
    /** How many roots were served from disk or in-memory cache during the last reindex. */
    lastReindexCachedRoots: number;
    /** How many roots were freshly analysed during the last reindex. */
    lastReindexAnalyzedRoots: number;
    /** Whether the most recent {@link analyzeRoot} call was a disk-cache hit. */
    lastRootServedFromCache: boolean;
    /**
     * Creates a workspace index.
     * @param {WorkspaceIndexOptions} [options] Initial index configuration.
     */
    constructor(options: WorkspaceIndexOptions);
    /**
     * Updates index configuration and re-analyses the workspace.
     * @param {WorkspaceIndexOptions} options The configuration to apply.
     */
    configure(options: WorkspaceIndexConfiguration): void;
    /**
     * Adds or replaces an open editor buffer and re-analyses the workspace.
     * @param {string} file The absolute path of the document.
     * @param {string} content The current document text.
     */
    openDocument(file: string, content: string): void;
    /**
     * Updates the content of an already-open document without re-analysing.
     * Callers can debounce multiple edits before invoking {@link reindex}.
     * @param {string} file The absolute path of the document.
     * @param {string} content The new document text.
     */
    updateDocument(file: string, content: string): void;
    /**
     * Removes an open editor buffer (reverting to disk) and re-analyses.
     * @param {string} file The absolute path of the document.
     */
    closeDocument(file: string): void;
    /**
     * Marks a disk-backed file as changed for the next debounced reindex.
     * @param {string} file The changed absolute path.
     */
    invalidateFile(file: string): void;
    /**
     * Returns the current text for a file, preferring the open buffer.
     * @param {string} file The absolute path of the file.
     * @returns {string | undefined} The file text, or undefined when unavailable.
     */
    getText(file: string): string | undefined;
    /**
     * Returns the text for a file from the open buffer, falling back to disk.
     * Used by features that must compute precise ranges in files that may not be
     * open in the editor (for example, cross-file rename targets).
     * @param {string} file The absolute path of the file.
     * @returns {string | undefined} The file text, or undefined when unreadable.
     */
    getFileText(file: string): string | undefined;
    /**
     * Returns the analysis bucket for a file, if it has been analysed.
     * @param {string} file The absolute path of the file.
     * @returns {FileAnalysis | undefined} The per-file analysis, or undefined.
     */
    getFileAnalysis(file: string): FileAnalysis | undefined;
    /**
     * Returns diagnostics for a file.
     * @param {string} file The absolute path of the file.
     * @returns {AssemblyDiagnostic[]} The diagnostics for the file.
     */
    getDiagnostics(file: string): AssemblyDiagnostic[];
    /**
     * Returns symbol definitions declared in a file.
     * @param {string} file The absolute path of the file.
     * @returns {AssemblySymbolDefinition[]} The symbols defined in the file.
     */
    getSymbols(file: string): AssemblySymbolDefinition[];
    /**
     * Returns symbol references that occur in a file.
     * @param {string} file The absolute path of the file.
     * @returns {AssemblySymbolReference[]} The references in the file.
     */
    getReferences(file: string): AssemblySymbolReference[];
    /**
     * Returns every symbol definition known across the workspace.
     * @returns {AssemblySymbolDefinition[]} All workspace symbol definitions.
     */
    getAllSymbols(): AssemblySymbolDefinition[];
    /**
     * Returns every symbol reference known across the workspace.
     * @returns {AssemblySymbolReference[]} All workspace symbol references.
     */
    getAllReferences(): AssemblySymbolReference[];
    /**
     * Returns the merged include-graph edges.
     * @returns {AssemblyIncludeEdge[]} The include edges across all roots.
     */
    getIncludeEdges(): AssemblyIncludeEdge[];
    /**
     * Returns the absolute paths of every file with analysis artifacts.
     * @returns {string[]} The analysed file paths.
     */
    getAnalyzedFiles(): string[];
    /**
     * Returns whether a file still needs a full-pass reindex.
     * True when the file is dirty, a full rebuild is pending, or no covering
     * full-pass analysis exists yet.
     * @param {string} file The absolute path of the file.
     * @returns {boolean} Whether callers should schedule {@link reindex}.
     */
    isFileDirtyOrUncovered(file: string): boolean;
    /**
     * Returns a snapshot of index size and last-reindex timing for the project panel.
     * @returns {WorkspaceIndexStatus} The current status snapshot.
     */
    getStatus(): WorkspaceIndexStatus;
    /**
     * True when a followIncludes analysis already owns this file as a root or include.
     * O(1) — uses the pre-computed {@link #coveredByFullPass} set.
     * @param {string} file The absolute path of the file.
     * @returns {boolean} Whether a covering full-pass analysis exists.
     */
    isCoveredByFullPass(file: string): boolean;
    /**
     * True when a different full-pass root already includes this file.
     * Used to avoid analysing included files as standalone roots.
     * O(1) — uses the per-root coverage sets in {@link #coverageByRoot}.
     * @param {string} file The absolute path of the file.
     * @returns {boolean} Whether another covering full-pass root exists.
     */
    isCoveredByOtherFullPassRoot(file: string): boolean;
    /**
     * Re-runs analysis for every root and rebuilds all per-file buckets.
     * Roots are the configured entry points, or every open document when no
     * entry points are configured.
     */
    reindex(): void;
    /**
     * Determines whether a cached root analysis contains a changed file.
     * @param {string} root The root source file.
     * @param {string} file The changed source file.
     * @returns {boolean} Whether the root must be re-analysed.
     */
    rootDependsOnFile(root: string, file: string): boolean;
    /**
     * Analyses one root using the current overlay snapshot.
     * @param {string} root The root source file.
     * @param {{ followIncludes?: boolean }} [options] Analysis options.
     * @returns {RootAnalysis | undefined} The completed artifacts, or undefined when unavailable.
     */
    analyzeRoot(root: string, options?: {
        followIncludes?: boolean;
    }): RootAnalysis | undefined;
    /**
     * Rebuilds workspace-wide buckets from cached per-root artifacts.
     *
     * Files that appear as include targets of a full-pass root analysis are
     * considered "covered" — the covering root already has their correct
     * symbols and diagnostics (assembled in proper parent context). When such
     * a file also exists as a standalone root entry (e.g. because it was
     * opened directly), its standalone artifacts are skipped so they cannot
     * produce false "missing define" diagnostics or duplicate outline symbols.
     *
     * Include edges are always merged regardless of coverage (navigation must
     * work even before the full reindex completes).
     *
     * @param {string[]} roots The active roots in deterministic order.
     */
    rebuildMergedIndex(roots: string[]): void;
    /**
     * Buckets flat analysis artifacts into their owning files.
     * @param {string} root The root file that produced these artifacts.
     * @param {AssemblyDiagnostic[]} diagnostics The diagnostics to bucket.
     * @param {AssemblySymbolDefinition[]} symbols The symbols to bucket.
     * @param {AssemblySymbolReference[]} references The references to bucket.
     */
    ingestArtifacts(root: string, diagnostics: AssemblyDiagnostic[], symbols: AssemblySymbolDefinition[], references: AssemblySymbolReference[]): void;
    /**
     * Returns (creating if needed) the analysis bucket for a file.
     * @param {string} file The absolute path of the file.
     * @returns {FileAnalysis} The mutable analysis bucket.
     */
    bucketFor(file: string): FileAnalysis;
    /**
     * Determines the set of root files to analyse.
     * @returns {string[]} The absolute root paths.
     */
    resolveRoots(): string[];
    /**
     * Reads a root file from disk when it is not open in the editor.
     * @param {string} root The absolute root path.
     * @returns {string | undefined} The file text, or undefined when unreadable.
     */
    readDiskRoot(root: string): string | undefined;
    /**
     * Derives the include search paths for a root, always including its directory.
     * @param {string} root The absolute root path.
     * @returns {string[]} The include paths to hand to the assembler.
     */
    deriveIncludePaths(root: string): string[];
    /**
     * Assembler identity stored alongside cached analysis so a target or include-path
     * change cannot reuse stale artifacts.
     * @returns {import("./root-analysis-cache.js").RootAnalysisCacheIdentity} The identity.
     */
    cacheIdentity(): {
        target: string;
        architecture: string;
        includePaths: readonly string[];
    };
    /**
     * Hashes overlay or disk bytes for cache invalidation. Works for text and binary includes.
     * @param {string} file Absolute path to hash.
     * @returns {string | undefined} Hex digest, or undefined when unreadable.
     */
    hashFile(file: string): string | undefined;
    /**
     * Collects content hashes and mtimes for a root and every file in its include graph.
     * @param {string} root Absolute root path.
     * @param {AssemblyIncludeEdge[]} includeEdges Include edges from the analysis.
     * @returns {{ fileHashes: Record<string, string>; fileMtimes: Record<string, number> } | undefined}
     *   Path-to-hash and path-to-mtime maps, or undefined when incomplete.
     */
    collectFileHashes(root: string, includeEdges: AssemblyIncludeEdge[]): {
        fileHashes: Record<string, string>;
        fileMtimes: Record<string, number>;
    } | undefined;
}
//# sourceMappingURL=workspace-index.d.ts.map