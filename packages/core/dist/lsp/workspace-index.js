import path from "node:path";
import { Assembler } from "../assembler.js";
import { measureInternalPhase } from "../internal-instrumentation.js";
import { ASAR_SYNTAX_PROFILE } from "../syntax-profile.js";
import { OverlayFileProvider } from "./overlay-file-provider.js";
import { hashBytes, RootAnalysisCache } from "./root-analysis-cache.js";
/** Shared by worker producers, transport validation and snapshot hydration. */
export const WORKSPACE_ANALYSIS_SNAPSHOT_VERSION = 5;
/**
 * Indexes one or more assembly projects for editor tooling.
 *
 * Analysis is root-anchored: each entry point (or open document when no entry
 * points are configured) is analysed with the assembler's recovery-friendly
 * `analyzeSource`, which descends into includes. The resulting flat artifacts
 * are bucketed by file so language features can be served per document, and
 * the include graph is preserved for cross-file navigation.
 */
export class WorkspaceIndex {
    /** Open editor buffers keyed by absolute path. */
    overlay = new Map();
    /** Per-file analysis buckets keyed by absolute path. */
    fileAnalysis = new Map();
    /** Merged include-graph edges across all analysed roots. */
    includeEdges = [];
    /** All symbol definitions across the workspace (for cross-file resolution). */
    allSymbols = [];
    /** All symbol references across the workspace (for find-references). */
    allReferences = [];
    /** Cached complete analysis artifacts for each configured root. */
    rootAnalyses = new Map();
    /**
     * Per-root set of all files involved in its include graph (both fromFile and
     * toFile edges, plus the root itself). Maintained in sync with
     * {@link rootAnalyses} so {@link rootDependsOnFile} is O(1) instead of the
     * former O(edges) linear scan.
     */
    #rootFileSets = new Map();
    /** Files whose content changed since the last analysis. */
    dirtyFiles = new Set();
    /** Whether configuration changes require every root to be rebuilt. */
    fullReindexRequired = true;
    /** Configured analysis entry points for root-anchored indexing. */
    entryPoints;
    /** Include search paths forwarded to analysis sessions. */
    includePaths;
    /** Selected architecture contribution identifier. */
    architecture;
    /** Validated target options bound into analysis identity. */
    targetOptions;
    /** Default module options when roots do not override them. */
    module;
    /** Owned per-root selections also participate in persistent cache and worker-snapshot identity. */
    moduleRoots;
    /** Frozen plugin environment shared by every analysis session. */
    environment;
    /** Target contribution identifier for analysis and catalog lookup. */
    target;
    /** Tooling catalog derived from the active environment. */
    toolingCatalog;
    /** Directive metadata exposed to completion and hover providers. */
    directiveCatalog;
    /** Recognized directive prefix strings for incremental parsing helpers. */
    directivePrefixes;
    /** Optional timing logger for reindex diagnostics. */
    logger;
    /** Optional on-disk cache for full root analysis artifacts. */
    cache;
    /** Duration of the most recent {@link reindex} call in milliseconds. */
    lastReindexDurationMs;
    /** How many roots were considered during the last reindex. */
    lastReindexRootCount = 0;
    /** How many roots were served from disk or in-memory cache during the last reindex. */
    lastReindexCachedRoots = 0;
    /** How many roots were freshly analysed during the last reindex. */
    lastReindexAnalyzedRoots = 0;
    /** Whether the most recent {@link analyzeRoot} call was a disk-cache hit. */
    lastRootServedFromCache = false;
    /**
     * Shared file-provider wrapping the overlay map. Created once and reused
     * across all calls that need overlay-aware file access (stat, read, hash).
     * Since {@link overlay} is mutated in place the provider always sees the
     * current document state without needing to be recreated.
     */
    #provider = new OverlayFileProvider(this.overlay);
    /**
     * Files that appear as fromFile or toFile in any full-pass root's include
     * edges, plus the roots themselves. Used by {@link isCoveredByFullPass} so
     * it can answer in O(1) instead of O(roots × edges).
     */
    #coveredByFullPass = new Set();
    /**
     * Files that appear as `toFile` in any full-pass root's include edges.
     * Used by {@link rebuildMergedIndex} to skip ingesting a file's standalone
     * artifacts when a covering full-pass root already produced them in the
     * correct assembly context. Excludes fromFile entries so roots' own
     * artifacts are never accidentally skipped.
     */
    #includeTargets = new Set();
    /**
     * For each full-pass root, the set of files that appear in its include
     * edges (both fromFile and toFile). Rebuilt alongside the other coverage
     * sets so {@link isCoveredByOtherFullPassRoot} is also O(1).
     */
    #coverageByRoot = new Map();
    /**
     * Creates a workspace index.
     * @param [options] Initial index configuration.
     */
    constructor(options) {
        this.environment = options.environment;
        this.target = options.target;
        this.toolingCatalog = this.environment.getToolingCatalog(this.target);
        this.entryPoints = (options.entryPoints ?? []).map((entry) => path.resolve(entry));
        this.includePaths = options.includePaths ?? ["./"];
        this.architecture =
            options.architecture ?? this.environment.getTarget(this.target)?.defaultArchitecture ?? "";
        this.targetOptions = Object.freeze({ ...options.targetOptions });
        this.module = options.module ? Object.freeze({ ...options.module }) : undefined;
        this.moduleRoots = normalizeModuleRoots(options.moduleRoots);
        this.directiveCatalog = this.toolingCatalog.getDirectives();
        const target = this.environment.getTarget(this.target);
        const normalizedOptions = target?.createOptions?.(this.targetOptions) ?? this.targetOptions;
        this.directivePrefixes =
            (target?.createSyntaxProfile?.(normalizedOptions) ?? target?.syntaxProfile)
                ?.directivePrefixes ?? ASAR_SYNTAX_PROFILE.directivePrefixes;
        this.logger = options.logger;
        this.cache = options.cacheDir ? new RootAnalysisCache(options.cacheDir) : undefined;
    }
    /** Capture an owned complete generation; later producer edits cannot mutate a published snapshot. */
    snapshot() {
        return structuredClone({
            version: WORKSPACE_ANALYSIS_SNAPSHOT_VERSION,
            ...(this.module ? { module: this.module } : {}),
            ...(Object.keys(this.moduleRoots).length ? { moduleRoots: this.moduleRoots } : {}),
            target: this.target,
            architecture: this.architecture,
            roots: [...this.rootAnalyses],
            files: [...this.fileAnalysis],
            includeEdges: this.includeEdges,
            symbols: this.allSymbols,
            references: this.allReferences,
            status: this.getStatus(),
        });
    }
    /**
     * Hydrate a new, unpublished index with a worker-owned snapshot. Hosts swap the resulting index
     * as one unit, keeping readers on the previous coherent generation while analysis is running.
     * The environment stays local and must match the worker's target and architecture.
     */
    static fromSnapshot(options, snapshot, overlays) {
        const index = new WorkspaceIndex(options);
        if (
        // oxlint-disable-next-line typescript/no-unnecessary-condition -- Snapshots arrive serialized from index workers and may come from another build.
        snapshot.version !== WORKSPACE_ANALYSIS_SNAPSHOT_VERSION ||
            JSON.stringify(snapshot.module ?? null) !== JSON.stringify(options.module ?? null) ||
            JSON.stringify(normalizeModuleRoots(snapshot.moduleRoots)) !==
                JSON.stringify(index.moduleRoots) ||
            snapshot.target !== index.target ||
            snapshot.architecture !== index.architecture) {
            throw new Error("Analysis snapshot belongs to a different environment.");
        }
        // A library caller may retain the input; publication never borrows its mutable arrays or records.
        snapshot = structuredClone(snapshot);
        for (const [file, text] of overlays) {
            index.overlay.set(file, text);
        }
        for (const [file, analysis] of snapshot.files) {
            index.fileAnalysis.set(file, analysis);
        }
        for (const [root, analysis] of snapshot.roots) {
            index.rootAnalyses.set(root, analysis);
            index.#rootFileSets.set(root, new Set([root, ...analysis.includeEdges.flatMap((edge) => [edge.fromFile, edge.toFile])]));
        }
        index.includeEdges = [...snapshot.includeEdges];
        index.allSymbols = [...snapshot.symbols];
        index.allReferences = [...snapshot.references];
        index.lastReindexDurationMs = snapshot.status.lastReindexDurationMs;
        index.lastReindexRootCount = snapshot.status.lastReindexRootCount;
        index.lastReindexCachedRoots = snapshot.status.lastReindexCachedRoots;
        index.lastReindexAnalyzedRoots = snapshot.status.lastReindexAnalyzedRoots;
        index.fullReindexRequired = false;
        index.#rebuildCoverageIndex();
        return index;
    }
    /**
     * Updates index configuration and re-analyses the workspace.
     * @param options The configuration to apply.
     */
    configure(options) {
        if (Object.hasOwn(options, "module")) {
            this.module = options.module ? Object.freeze({ ...options.module }) : undefined;
        }
        if (Object.hasOwn(options, "moduleRoots")) {
            this.moduleRoots = normalizeModuleRoots(options.moduleRoots);
        }
        if (options.entryPoints) {
            this.entryPoints = options.entryPoints.map((entry) => path.resolve(entry));
        }
        if (options.includePaths) {
            this.includePaths = options.includePaths;
        }
        if (options.architecture) {
            this.architecture = options.architecture;
        }
        this.fullReindexRequired = true;
        this.reindex();
    }
    /**
     * Adds or replaces an open editor buffer and re-analyses the workspace.
     * @param file The absolute path of the document.
     * @param content The current document text.
     */
    openDocument(file, content) {
        const resolved = path.resolve(file);
        this.overlay.set(resolved, content);
        const diskContent = this.readDiskRoot(resolved);
        if (content !== diskContent) {
            this.dirtyFiles.add(resolved);
        }
        // Keep a completed full-pass analysis. Overwriting it with a local pass
        // would drop covering artifacts (and hover/outline) until the next reindex.
        if (!this.isCoveredByFullPass(resolved)) {
            const result = this.analyzeRoot(resolved, { followIncludes: false });
            if (result) {
                this.rootAnalyses.set(resolved, { ...result, diagnostics: [], followedIncludes: false });
                this.#rebuildCoverageIndex();
            }
        }
        const roots = this.resolveRoots();
        this.rebuildMergedIndex(roots.includes(resolved) ? roots : [...roots, resolved]);
    }
    /**
     * Updates the content of an already-open document without re-analysing.
     * Callers can debounce multiple edits before invoking {@link reindex}.
     * @param file The absolute path of the document.
     * @param content The new document text.
     */
    updateDocument(file, content) {
        const resolved = path.resolve(file);
        this.overlay.set(resolved, content);
        this.dirtyFiles.add(resolved);
    }
    /**
     * Removes an open editor buffer (reverting to disk) and re-analyses.
     * @param file The absolute path of the document.
     */
    closeDocument(file) {
        const resolved = path.resolve(file);
        this.overlay.delete(resolved);
        this.dirtyFiles.add(resolved);
        this.reindex();
    }
    /**
     * Marks a disk-backed file as changed for the next debounced reindex.
     * @param file The changed absolute path.
     */
    invalidateFile(file) {
        this.dirtyFiles.add(path.resolve(file));
    }
    /**
     * Returns the current text for a file, preferring the open buffer.
     * @param file The absolute path of the file.
     * @returns The file text, or undefined when unavailable.
     */
    getText(file) {
        return this.overlay.get(path.resolve(file));
    }
    /**
     * Returns the text for a file from the open buffer, falling back to disk.
     * Used by features that must compute precise ranges in files that may not be
     * open in the editor (for example, cross-file rename targets).
     * @param file The absolute path of the file.
     * @returns The file text, or undefined when unreadable.
     */
    getFileText(file) {
        const resolved = path.resolve(file);
        const open = this.overlay.get(resolved);
        if (open !== undefined) {
            return open;
        }
        try {
            const stat = this.#provider.stat(resolved);
            if (!stat.exists || !stat.readable) {
                return undefined;
            }
            return this.#provider.readTextFile(resolved);
        }
        catch {
            return undefined;
        }
    }
    /**
     * Returns the analysis bucket for a file, if it has been analysed.
     * @param file The absolute path of the file.
     * @returns The per-file analysis, or undefined.
     */
    getFileAnalysis(file) {
        return this.fileAnalysis.get(path.resolve(file));
    }
    /**
     * Returns diagnostics for a file.
     * @param file The absolute path of the file.
     * @returns The diagnostics for the file.
     */
    getDiagnostics(file) {
        return this.getFileAnalysis(file)?.diagnostics ?? [];
    }
    /**
     * Returns symbol definitions declared in a file.
     * @param file The absolute path of the file.
     * @returns The symbols defined in the file.
     */
    getSymbols(file) {
        return this.getFileAnalysis(file)?.symbols ?? [];
    }
    /**
     * Returns symbol references that occur in a file.
     * @param file The absolute path of the file.
     * @returns The references in the file.
     */
    getReferences(file) {
        return this.getFileAnalysis(file)?.references ?? [];
    }
    /**
     * Returns every symbol definition known across the workspace.
     * @returns All workspace symbol definitions.
     */
    getAllSymbols() {
        return this.allSymbols;
    }
    /**
     * Returns every symbol reference known across the workspace.
     * @returns All workspace symbol references.
     */
    getAllReferences() {
        return this.allReferences;
    }
    /**
     * Returns the merged include-graph edges.
     * @returns The include edges across all roots.
     */
    getIncludeEdges() {
        return this.includeEdges;
    }
    /**
     * Returns the absolute paths of every file with analysis artifacts.
     * @returns The analysed file paths.
     */
    getAnalyzedFiles() {
        return [...this.fileAnalysis.keys()];
    }
    /**
     * Returns whether a file still needs a full-pass reindex.
     * True when the file is dirty, a full rebuild is pending, or no covering
     * full-pass analysis exists yet.
     * @param file The absolute path of the file.
     * @returns Whether callers should schedule {@link reindex}.
     */
    isFileDirtyOrUncovered(file) {
        const resolved = path.resolve(file);
        if (this.dirtyFiles.has(resolved) || this.fullReindexRequired) {
            return true;
        }
        return !this.isCoveredByFullPass(resolved);
    }
    /**
     * Returns a snapshot of index size and last-reindex timing for the project panel.
     * @returns The current status snapshot.
     */
    getStatus() {
        let errorCount = 0;
        for (const bucket of this.fileAnalysis.values()) {
            errorCount += bucket.diagnostics.filter((entry) => entry.severity === "error").length;
        }
        return {
            fileCount: this.fileAnalysis.size,
            symbolCount: this.allSymbols.length,
            referenceCount: this.allReferences.length,
            errorCount,
            entryPoints: [...this.entryPoints],
            includePaths: [...this.includePaths],
            ...(this.lastReindexDurationMs === undefined
                ? {}
                : { lastReindexDurationMs: this.lastReindexDurationMs }),
            lastReindexRootCount: this.lastReindexRootCount,
            lastReindexCachedRoots: this.lastReindexCachedRoots,
            lastReindexAnalyzedRoots: this.lastReindexAnalyzedRoots,
        };
    }
    /**
     * True when a followIncludes analysis already owns this file as a root or include.
     * O(1) — uses the pre-computed {@link #coveredByFullPass} set.
     * @param file The absolute path of the file.
     * @returns Whether a covering full-pass analysis exists.
     */
    isCoveredByFullPass(file) {
        return this.#coveredByFullPass.has(path.resolve(file));
    }
    /**
     * True when a different full-pass root already includes this file.
     * Used to avoid analysing included files as standalone roots.
     * O(1) — uses the per-root coverage sets in {@link #coverageByRoot}.
     * @param file The absolute path of the file.
     * @returns Whether another covering full-pass root exists.
     */
    isCoveredByOtherFullPassRoot(file) {
        const resolved = path.resolve(file);
        for (const [root, covered] of this.#coverageByRoot) {
            if (root !== resolved && covered.has(resolved)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Re-runs analysis for every root and rebuilds all per-file buckets.
     * Roots are the configured entry points, or every open document when no
     * entry points are configured.
     */
    reindex() {
        const started = Date.now();
        const roots = this.resolveRoots();
        const activeRoots = new Set(roots);
        for (const cachedRoot of this.rootAnalyses.keys()) {
            if (!activeRoots.has(cachedRoot)) {
                this.rootAnalyses.delete(cachedRoot);
                this.#rootFileSets.delete(cachedRoot);
            }
        }
        const analyzeAll = this.fullReindexRequired;
        const dirtyFiles = [...this.dirtyFiles];
        const hasUnknownDependency = dirtyFiles.some((file) => !roots.some((root) => this.rootDependsOnFile(root, file)));
        const rootsToAnalyze = analyzeAll || hasUnknownDependency
            ? roots
            : roots.filter((root) => !this.rootAnalyses.has(root) ||
                dirtyFiles.some((file) => this.rootDependsOnFile(root, file)));
        const rootsToAnalyzeSet = new Set(rootsToAnalyze);
        let cachedRoots = 0;
        let analyzedRoots = 0;
        for (const root of roots) {
            if (!rootsToAnalyzeSet.has(root)) {
                if (this.rootAnalyses.has(root)) {
                    cachedRoots += 1;
                }
                continue;
            }
            if (this.isCoveredByOtherFullPassRoot(root)) {
                cachedRoots += 1;
                continue;
            }
            const result = this.analyzeRoot(root, { followIncludes: true });
            if (result) {
                this.rootAnalyses.set(root, result);
                const fileSet = new Set([root]);
                for (const edge of result.includeEdges) {
                    fileSet.add(edge.fromFile);
                    fileSet.add(edge.toFile);
                }
                for (const assetFile of Object.keys(result.assetDependencies)) {
                    fileSet.add(assetFile);
                }
                this.#rootFileSets.set(root, fileSet);
                if (this.lastRootServedFromCache) {
                    cachedRoots += 1;
                }
                else {
                    analyzedRoots += 1;
                }
            }
            else {
                this.rootAnalyses.delete(root);
                this.#rootFileSets.delete(root);
            }
        }
        this.dirtyFiles.clear();
        this.fullReindexRequired = false;
        this.lastReindexDurationMs = Date.now() - started;
        this.lastReindexRootCount = roots.length;
        this.lastReindexCachedRoots = cachedRoots;
        this.lastReindexAnalyzedRoots = analyzedRoots;
        this.#rebuildCoverageIndex();
        this.rebuildMergedIndex(roots);
    }
    /**
     * Determines whether a cached root analysis contains a changed file.
     * @param root The root source file.
     * @param file The changed source file.
     * @returns Whether the root must be re-analysed.
     */
    rootDependsOnFile(root, file) {
        const fileSet = this.#rootFileSets.get(root);
        if (!fileSet) {
            // No cached analysis for this root yet — treat as dependent so it gets re-analysed.
            return true;
        }
        return fileSet.has(file);
    }
    /**
     * Analyses one root using the current overlay snapshot.
     * @param root The root source file.
     * @param [options] Analysis options.
     * @returns The completed artifacts, or undefined when unavailable.
     */
    analyzeRoot(root, options = {}) {
        const content = this.overlay.get(root) ?? this.readDiskRoot(root);
        if (content === undefined) {
            return undefined;
        }
        const followIncludes = options.followIncludes ?? true;
        this.lastRootServedFromCache = false;
        this.logger?.info(`Analyzing ${path.basename(root)} (followIncludes=${followIncludes}, ${content.length} chars)...`);
        if (followIncludes && this.cache) {
            const cached = this.cache.read(root, this.cacheIdentity(), (file) => this.hashFile(file), (file) => !this.overlay.has(file));
            if (cached) {
                this.lastRootServedFromCache = true;
                this.logger?.info(`Using cached analysis for ${path.basename(root)} ` +
                    `(followIncludes=true, symbols=${cached.symbols.length}, ` +
                    `refs=${cached.references.length}, edges=${cached.includeEdges.length}, ` +
                    `errors=${cached.diagnostics.length})`);
                return cached;
            }
        }
        const started = Date.now();
        let assembler;
        try {
            assembler = measureInternalPhase("lspAssemblerConstruct", () => new Assembler({
                environment: this.environment,
                module: this.moduleRoots[path.resolve(root)] ?? this.module,
                target: this.target,
                architecture: this.architecture,
                targetOptions: this.targetOptions,
                fileProvider: this.#provider,
            }));
            assembler.includePaths = this.deriveIncludePaths(root);
            assembler.followIncludes = followIncludes;
            const result = measureInternalPhase("lspAnalyzeSource", () => assembler.analyzeSource(content, root, 0, { followIncludes, deferAssetConversion: true }));
            const analysis = {
                followedIncludes: followIncludes,
                diagnostics: result.diagnostics,
                symbols: result.symbols,
                references: result.references,
                includeEdges: result.includeEdges,
                assetDependencies: result.assetDependencies ?? {},
            };
            this.logger?.info(`Analyzed ${path.basename(root)} in ${Date.now() - started}ms ` +
                `(followIncludes=${followIncludes}, symbols=${result.symbols.length}, ` +
                `refs=${result.references.length}, edges=${result.includeEdges.length}, ` +
                `errors=${result.diagnostics.length})`);
            if (followIncludes && this.cache) {
                const collected = measureInternalPhase("lspCollectFileHashes", () => this.collectFileHashes(root, result.includeEdges, analysis.assetDependencies));
                const { fileHashes, fileMtimes } = collected ?? {};
                if (fileHashes && fileMtimes) {
                    measureInternalPhase("lspCacheWrite", () => this.cache.write(root, this.cacheIdentity(), fileHashes, fileMtimes, analysis));
                }
            }
            return analysis;
        }
        catch (error) {
            this.logger?.info(`Analysis failed for ${path.basename(root)} after ${Date.now() - started}ms: ` +
                (error instanceof Error ? error.message : String(error)));
            // analyzeSource recovers internally. Guard against unexpected throws so
            // one broken root never blanks out the whole workspace index.
            return undefined;
        }
        finally {
            assembler?.dispose();
        }
    }
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
    rebuildMergedIndex(roots) {
        this.fileAnalysis.clear();
        this.includeEdges = [];
        this.allSymbols = [];
        this.allReferences = [];
        const seenEdges = new Set();
        // Use the pre-computed include-targets set for O(1) lookup per root.
        // Only toFile entries qualify — roots' own artifacts must always be ingested.
        const coveredByFullPass = this.#includeTargets;
        for (const root of roots) {
            const result = this.rootAnalyses.get(root);
            if (!result) {
                continue;
            }
            // Always collect include edges for cross-file navigation.
            for (const edge of result.includeEdges) {
                const key = `${edge.fromFile}\u0000${edge.toFile}`;
                if (seenEdges.has(key)) {
                    continue;
                }
                seenEdges.add(key);
                this.includeEdges.push(edge);
            }
            // If this root is already covered by a full-pass analysis of another root,
            // skip ingesting its own artifacts — the covering root produced them in the
            // correct assembly context (with parent defines, correct conditional branches,
            // etc.), so the standalone view is redundant and may be wrong.
            if (coveredByFullPass.has(root)) {
                continue;
            }
            this.ingestArtifacts(root, result.diagnostics, result.symbols, result.references);
        }
    }
    /**
     * Buckets flat analysis artifacts into their owning files.
     * @param root The root file that produced these artifacts.
     * @param diagnostics The diagnostics to bucket.
     * @param symbols The symbols to bucket.
     * @param references The references to bucket.
     */
    ingestArtifacts(root, diagnostics, symbols, references) {
        for (const diagnostic of diagnostics) {
            this.bucketFor(diagnostic.location.file || root).diagnostics.push(diagnostic);
        }
        for (const symbol of symbols) {
            this.bucketFor(symbol.location.file || root).symbols.push(symbol);
            this.allSymbols.push(symbol);
        }
        for (const reference of references) {
            this.bucketFor(reference.location.file || root).references.push(reference);
            this.allReferences.push(reference);
        }
    }
    /**
     * Returns (creating if needed) the analysis bucket for a file.
     * @param file The absolute path of the file.
     * @returns The mutable analysis bucket.
     */
    bucketFor(file) {
        const resolved = path.resolve(file);
        let bucket = this.fileAnalysis.get(resolved);
        if (!bucket) {
            bucket = { file: resolved, diagnostics: [], symbols: [], references: [] };
            this.fileAnalysis.set(resolved, bucket);
        }
        return bucket;
    }
    /**
     * Determines the set of root files to analyse.
     * @returns The absolute root paths.
     */
    resolveRoots() {
        if (this.entryPoints.length > 0) {
            return [...new Set(this.entryPoints)];
        }
        return [...this.overlay.keys()];
    }
    /**
     * Reads a root file from disk when it is not open in the editor.
     * @param root The absolute root path.
     * @returns The file text, or undefined when unreadable.
     */
    readDiskRoot(root) {
        try {
            const stat = this.#provider.stat(root);
            if (!stat.exists || !stat.readable) {
                return undefined;
            }
            return this.#provider.readTextFile(root);
        }
        catch {
            return undefined;
        }
    }
    /**
     * Derives the include search paths for a root, always including its directory.
     * @param root The absolute root path.
     * @returns The include paths to hand to the assembler.
     */
    deriveIncludePaths(root) {
        const directory = path.dirname(root);
        return [...new Set([directory, ...this.includePaths])];
    }
    /**
     * Assembler identity stored alongside cached analysis so a target or include-path
     * change cannot reuse stale artifacts.
     * @returns The identity.
     */
    cacheIdentity() {
        const formats = this.environment
            .getAssetFormats(this.target)
            .map((item) => `${item.id}@${item.version}`)
            .toSorted();
        const transforms = this.environment
            .getAssetTransforms(this.target)
            .map((item) => `${item.id}@${item.version}`)
            .toSorted();
        return {
            target: this.target,
            architecture: this.architecture,
            includePaths: this.includePaths,
            converterIdentity: JSON.stringify([formats, transforms]),
            targetOptionsIdentity: JSON.stringify({
                targetOptions: this.targetOptions,
                module: this.module ?? null,
                moduleRoots: this.moduleRoots,
            }),
        };
    }
    /**
     * Hashes overlay or disk bytes for cache invalidation. Works for text and binary includes.
     * @param file Absolute path to hash.
     * @returns Hex digest, or undefined when unreadable.
     */
    hashFile(file) {
        try {
            const overlay = this.overlay.get(file);
            if (overlay !== undefined) {
                return hashBytes(new Uint8Array(Buffer.from(overlay, "utf8")));
            }
            const stat = this.#provider.stat(file);
            if (!stat.exists || !stat.readable) {
                return undefined;
            }
            return hashBytes(this.#provider.readFile(file));
        }
        catch {
            return undefined;
        }
    }
    /**
     * Collects content hashes and mtimes for a root and every file in its include graph.
     * @param root Absolute root path.
     * @param includeEdges Include edges from the analysis.
     * @param assetDependencies Resolved asset inputs.
     * @returns Path-to-hash and path-to-mtime maps, or undefined when incomplete.
     */
    collectFileHashes(root, includeEdges, assetDependencies = {}) {
        const files = new Set([root]);
        for (const edge of includeEdges) {
            files.add(edge.fromFile);
            files.add(edge.toFile);
        }
        for (const file of Object.keys(assetDependencies)) {
            files.add(file);
        }
        const fileHashes = {};
        const fileMtimes = {};
        for (const file of [...files].toSorted()) {
            // For overlay (in-memory) files there is no mtime. Record hash only.
            const overlayContent = this.overlay.get(file);
            if (overlayContent !== undefined) {
                fileHashes[file] = hashBytes(new Uint8Array(Buffer.from(overlayContent, "utf8")));
                continue;
            }
            const stat = this.#provider.stat(file);
            if (!stat.exists || !stat.readable) {
                return undefined;
            }
            fileHashes[file] = hashBytes(this.#provider.readFile(file));
            if (stat.mtimeMs !== undefined) {
                fileMtimes[file] = stat.mtimeMs;
            }
        }
        return { fileHashes, fileMtimes };
    }
    /**
     * Rebuilds the three coverage indexes from the current {@link rootAnalyses} snapshot.
     * Must be called after any modification to {@link rootAnalyses}.
     *
     * Three distinct sets are maintained because each consumer has different needs:
     * - {@link #coveredByFullPass}: fromFile + toFile + roots themselves →
     *   {@link isCoveredByFullPass} (does this file have full-pass coverage?)
     * - {@link #includeTargets}: toFile only →
     *   {@link rebuildMergedIndex} skip guard (never skip a root's own artifacts)
     * - {@link #coverageByRoot}: fromFile + toFile per root →
     *   {@link isCoveredByOtherFullPassRoot} (is this root already reached by another root?)
     */
    #rebuildCoverageIndex() {
        const coveredByFullPass = new Set();
        const includeTargets = new Set();
        const coverageByRoot = new Map();
        for (const [root, analysis] of this.rootAnalyses) {
            if (!analysis.followedIncludes) {
                continue;
            }
            // The root itself is covered by its own full-pass analysis.
            coveredByFullPass.add(root);
            const edgeTouched = new Set();
            for (const edge of analysis.includeEdges) {
                edgeTouched.add(edge.fromFile);
                edgeTouched.add(edge.toFile);
                coveredByFullPass.add(edge.fromFile);
                coveredByFullPass.add(edge.toFile);
                // Only toFile qualifies as an "include target" for the rebuild skip guard.
                includeTargets.add(edge.toFile);
            }
            coverageByRoot.set(root, edgeTouched);
        }
        this.#coveredByFullPass = coveredByFullPass;
        this.#includeTargets = includeTargets;
        this.#coverageByRoot = coverageByRoot;
    }
}
/** Normalize once so insertion order and path spelling cannot change an otherwise identical module selection. */
function normalizeModuleRoots(value) {
    return Object.freeze(Object.fromEntries(Object.entries(value ?? {})
        .map(([file, module]) => [
        path.resolve(file),
        Object.freeze({ ...module }),
    ])
        .toSorted(([a], [b]) => (a < b ? -1 : Number(a > b)))));
}
//# sourceMappingURL=workspace-index.js.map