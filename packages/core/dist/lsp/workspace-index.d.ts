import type { AssemblyDiagnostic, AssemblyIncludeEdge, AssemblySymbolDefinition, AssemblySymbolReference } from "../diagnostics.js";
import type { ToolingCatalog } from "../plugin/contracts.js";
import type { AssemblerEnvironment } from "../plugin/environment.js";
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
    /** Analyze module-authored roots using section-relative symbols and import declarations. */
    module?: import("../relocatable.js").AssemblyModuleOptions;
    /** Absolute source-root paths select independent module identities; other roots retain the fallback module/absolute mode. */
    moduleRoots?: Readonly<Record<string, import("../relocatable.js").AssemblyModuleOptions>>;
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
/** Workspace index settings that can be reconfigured without replacing the environment handle. */
export type WorkspaceIndexConfiguration = Omit<WorkspaceIndexOptions, "environment" | "target">;
/** Cached complete analysis artifact for one configured root file. */
export type RootAnalysis = CachedRootAnalysis;
/** Shared by worker producers, transport validation and snapshot hydration. */
export declare const WORKSPACE_ANALYSIS_SNAPSHOT_VERSION: 5;
/** Structured-clone payload from an isolated analyzer. It contains no plugin instances or file handles. */
export interface WorkspaceAnalysisSnapshot {
    /** Module options active when the snapshot was produced. */
    readonly module?: import("../relocatable.js").AssemblyModuleOptions;
    /** Per-root module selections bound into the snapshot identity. */
    readonly moduleRoots?: WorkspaceIndexOptions["moduleRoots"];
    /** Revision 5 also binds source adapters so cached absolute/native interpretations cannot leak across selections. */
    readonly version: typeof WORKSPACE_ANALYSIS_SNAPSHOT_VERSION;
    /** Target contribution identifier used for analysis. */
    readonly target: string;
    /** Architecture contribution identifier used for analysis. */
    readonly architecture: string;
    /** Root path to cached root analysis pairs merged in the index. */
    readonly roots: readonly (readonly [string, RootAnalysis])[];
    /** Per-file analysis buckets keyed by absolute path. */
    readonly files: readonly (readonly [string, FileAnalysis])[];
    /** Include graph edges merged across analyzed roots. */
    readonly includeEdges: readonly AssemblyIncludeEdge[];
    /** Flattened symbol definitions across the workspace. */
    readonly symbols: readonly AssemblySymbolDefinition[];
    /** Flattened symbol references across the workspace. */
    readonly references: readonly AssemblySymbolReference[];
    /** Aggregate counts and timing metadata for UI surfaces. */
    readonly status: WorkspaceIndexStatus;
}
/**
 * Snapshot of workspace analysis used by the project panel and status bar.
 */
export type WorkspaceIndexStatus = {
    /** Number of distinct files with analysis buckets. */
    fileCount: number;
    /** Total symbol definitions indexed across the workspace. */
    symbolCount: number;
    /** Total symbol references indexed across the workspace. */
    referenceCount: number;
    /** Count of error-severity diagnostics in the latest index. */
    errorCount: number;
    /** Configured analysis entry point paths. */
    entryPoints: string[];
    /** Include search paths handed to the assembler during analysis. */
    includePaths: string[];
    /** Duration of the most recent reindex in milliseconds when recorded. */
    lastReindexDurationMs?: number;
    /** Roots considered during the most recent reindex. */
    lastReindexRootCount: number;
    /** Roots served from cache during the most recent reindex. */
    lastReindexCachedRoots: number;
    /** Roots analyzed fresh during the most recent reindex. */
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
    /** Configured analysis entry points for root-anchored indexing. */
    entryPoints: string[];
    /** Include search paths forwarded to analysis sessions. */
    includePaths: string[];
    /** Selected architecture contribution identifier. */
    architecture: string;
    /** Validated target options bound into analysis identity. */
    readonly targetOptions: Readonly<Record<string, unknown>>;
    /** Default module options when roots do not override them. */
    module?: import("../relocatable.js").AssemblyModuleOptions;
    /** Owned per-root selections also participate in persistent cache and worker-snapshot identity. */
    moduleRoots: NonNullable<WorkspaceIndexOptions["moduleRoots"]>;
    /** Frozen plugin environment shared by every analysis session. */
    readonly environment: AssemblerEnvironment;
    /** Target contribution identifier for analysis and catalog lookup. */
    readonly target: string;
    /** Tooling catalog derived from the active environment. */
    readonly toolingCatalog: ToolingCatalog;
    /** Directive metadata exposed to completion and hover providers. */
    readonly directiveCatalog: readonly DirectiveDescriptor[];
    /** Recognized directive prefix strings for incremental parsing helpers. */
    readonly directivePrefixes: readonly string[];
    /** Optional timing logger for reindex diagnostics. */
    readonly logger?: {
        info(message: string): void;
    };
    /** Optional on-disk cache for full root analysis artifacts. */
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
     * @param [options] Initial index configuration.
     */
    constructor(options: WorkspaceIndexOptions);
    /** Capture an owned complete generation; later producer edits cannot mutate a published snapshot. */
    snapshot(): WorkspaceAnalysisSnapshot;
    /**
     * Hydrate a new, unpublished index with a worker-owned snapshot. Hosts swap the resulting index
     * as one unit, keeping readers on the previous coherent generation while analysis is running.
     * The environment stays local and must match the worker's target and architecture.
     */
    static fromSnapshot(options: WorkspaceIndexOptions, snapshot: WorkspaceAnalysisSnapshot, overlays: ReadonlyMap<string, string>): WorkspaceIndex;
    /**
     * Updates index configuration and re-analyses the workspace.
     * @param options The configuration to apply.
     */
    configure(options: WorkspaceIndexConfiguration): void;
    /**
     * Adds or replaces an open editor buffer and re-analyses the workspace.
     * @param file The absolute path of the document.
     * @param content The current document text.
     */
    openDocument(file: string, content: string): void;
    /**
     * Updates the content of an already-open document without re-analysing.
     * Callers can debounce multiple edits before invoking {@link reindex}.
     * @param file The absolute path of the document.
     * @param content The new document text.
     */
    updateDocument(file: string, content: string): void;
    /**
     * Removes an open editor buffer (reverting to disk) and re-analyses.
     * @param file The absolute path of the document.
     */
    closeDocument(file: string): void;
    /**
     * Marks a disk-backed file as changed for the next debounced reindex.
     * @param file The changed absolute path.
     */
    invalidateFile(file: string): void;
    /**
     * Returns the current text for a file, preferring the open buffer.
     * @param file The absolute path of the file.
     * @returns The file text, or undefined when unavailable.
     */
    getText(file: string): string | undefined;
    /**
     * Returns the text for a file from the open buffer, falling back to disk.
     * Used by features that must compute precise ranges in files that may not be
     * open in the editor (for example, cross-file rename targets).
     * @param file The absolute path of the file.
     * @returns The file text, or undefined when unreadable.
     */
    getFileText(file: string): string | undefined;
    /**
     * Returns the analysis bucket for a file, if it has been analysed.
     * @param file The absolute path of the file.
     * @returns The per-file analysis, or undefined.
     */
    getFileAnalysis(file: string): FileAnalysis | undefined;
    /**
     * Returns diagnostics for a file.
     * @param file The absolute path of the file.
     * @returns The diagnostics for the file.
     */
    getDiagnostics(file: string): AssemblyDiagnostic[];
    /**
     * Returns symbol definitions declared in a file.
     * @param file The absolute path of the file.
     * @returns The symbols defined in the file.
     */
    getSymbols(file: string): AssemblySymbolDefinition[];
    /**
     * Returns symbol references that occur in a file.
     * @param file The absolute path of the file.
     * @returns The references in the file.
     */
    getReferences(file: string): AssemblySymbolReference[];
    /**
     * Returns every symbol definition known across the workspace.
     * @returns All workspace symbol definitions.
     */
    getAllSymbols(): AssemblySymbolDefinition[];
    /**
     * Returns every symbol reference known across the workspace.
     * @returns All workspace symbol references.
     */
    getAllReferences(): AssemblySymbolReference[];
    /**
     * Returns the merged include-graph edges.
     * @returns The include edges across all roots.
     */
    getIncludeEdges(): AssemblyIncludeEdge[];
    /**
     * Returns the absolute paths of every file with analysis artifacts.
     * @returns The analysed file paths.
     */
    getAnalyzedFiles(): string[];
    /**
     * Returns whether a file still needs a full-pass reindex.
     * True when the file is dirty, a full rebuild is pending, or no covering
     * full-pass analysis exists yet.
     * @param file The absolute path of the file.
     * @returns Whether callers should schedule {@link reindex}.
     */
    isFileDirtyOrUncovered(file: string): boolean;
    /**
     * Returns a snapshot of index size and last-reindex timing for the project panel.
     * @returns The current status snapshot.
     */
    getStatus(): WorkspaceIndexStatus;
    /**
     * True when a followIncludes analysis already owns this file as a root or include.
     * O(1) — uses the pre-computed {@link #coveredByFullPass} set.
     * @param file The absolute path of the file.
     * @returns Whether a covering full-pass analysis exists.
     */
    isCoveredByFullPass(file: string): boolean;
    /**
     * True when a different full-pass root already includes this file.
     * Used to avoid analysing included files as standalone roots.
     * O(1) — uses the per-root coverage sets in {@link #coverageByRoot}.
     * @param file The absolute path of the file.
     * @returns Whether another covering full-pass root exists.
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
     * @param root The root source file.
     * @param file The changed source file.
     * @returns Whether the root must be re-analysed.
     */
    rootDependsOnFile(root: string, file: string): boolean;
    /**
     * Analyses one root using the current overlay snapshot.
     * @param root The root source file.
     * @param [options] Analysis options.
     * @returns The completed artifacts, or undefined when unavailable.
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
     * @param roots The active roots in deterministic order.
     */
    rebuildMergedIndex(roots: string[]): void;
    /**
     * Buckets flat analysis artifacts into their owning files.
     * @param root The root file that produced these artifacts.
     * @param diagnostics The diagnostics to bucket.
     * @param symbols The symbols to bucket.
     * @param references The references to bucket.
     */
    ingestArtifacts(root: string, diagnostics: AssemblyDiagnostic[], symbols: AssemblySymbolDefinition[], references: AssemblySymbolReference[]): void;
    /**
     * Returns (creating if needed) the analysis bucket for a file.
     * @param file The absolute path of the file.
     * @returns The mutable analysis bucket.
     */
    bucketFor(file: string): FileAnalysis;
    /**
     * Determines the set of root files to analyse.
     * @returns The absolute root paths.
     */
    resolveRoots(): string[];
    /**
     * Reads a root file from disk when it is not open in the editor.
     * @param root The absolute root path.
     * @returns The file text, or undefined when unreadable.
     */
    readDiskRoot(root: string): string | undefined;
    /**
     * Derives the include search paths for a root, always including its directory.
     * @param root The absolute root path.
     * @returns The include paths to hand to the assembler.
     */
    deriveIncludePaths(root: string): string[];
    /**
     * Assembler identity stored alongside cached analysis so a target or include-path
     * change cannot reuse stale artifacts.
     * @returns The identity.
     */
    cacheIdentity(): {
        target: string;
        architecture: string;
        includePaths: readonly string[];
        converterIdentity: string;
        targetOptionsIdentity: string;
    };
    /**
     * Hashes overlay or disk bytes for cache invalidation. Works for text and binary includes.
     * @param file Absolute path to hash.
     * @returns Hex digest, or undefined when unreadable.
     */
    hashFile(file: string): string | undefined;
    /**
     * Collects content hashes and mtimes for a root and every file in its include graph.
     * @param root Absolute root path.
     * @param includeEdges Include edges from the analysis.
     * @param assetDependencies Resolved asset inputs.
     * @returns Path-to-hash and path-to-mtime maps, or undefined when incomplete.
     */
    collectFileHashes(root: string, includeEdges: AssemblyIncludeEdge[], assetDependencies?: Readonly<Record<string, "binary" | "resource">>): {
        fileHashes: Record<string, string>;
        fileMtimes: Record<string, number>;
    } | undefined;
}
//# sourceMappingURL=workspace-index.d.ts.map