import path from "node:path";
import { Assembler } from "../assembler.js";
import type { AssemblerEnvironment } from "../plugin/environment.js";
import type { ToolingCatalog } from "../plugin/contracts.js";
import { ASAR_SYNTAX_PROFILE } from "../syntax-profile.js";
import type {
  AssemblyDiagnostic,
  AssemblyIncludeEdge,
  AssemblySymbolDefinition,
  AssemblySymbolReference,
} from "../diagnostics.js";
import { OverlayFileProvider } from "./overlay-file-provider.js";
import type { DirectiveDescriptor } from "./directive-catalog.js";
import { hashBytes, RootAnalysisCache, type CachedRootAnalysis } from "./root-analysis-cache.js";

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
  logger?: { info(message: string): void };
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
export class WorkspaceIndex {
  /** Open editor buffers keyed by absolute path. */
  readonly overlay = new Map<string, string>();

  /** Per-file analysis buckets keyed by absolute path. */
  readonly fileAnalysis = new Map<string, FileAnalysis>();

  /** Merged include-graph edges across all analysed roots. */
  includeEdges: AssemblyIncludeEdge[] = [];

  /** All symbol definitions across the workspace (for cross-file resolution). */
  allSymbols: AssemblySymbolDefinition[] = [];

  /** All symbol references across the workspace (for find-references). */
  allReferences: AssemblySymbolReference[] = [];

  /** Cached complete analysis artifacts for each configured root. */
  readonly rootAnalyses = new Map<string, RootAnalysis>();

  /** Files whose content changed since the last analysis. */
  readonly dirtyFiles = new Set<string>();

  /** Whether configuration changes require every root to be rebuilt. */
  fullReindexRequired = true;

  entryPoints: string[];
  includePaths: string[];
  architecture: string;
  readonly targetOptions: Readonly<Record<string, unknown>>;
  readonly environment: AssemblerEnvironment;
  readonly target: string;
  readonly toolingCatalog: ToolingCatalog;
  readonly directiveCatalog: readonly DirectiveDescriptor[];
  readonly directivePrefixes: readonly string[];
  readonly logger?: { info(message: string): void };
  readonly cache?: RootAnalysisCache;

  /** Duration of the most recent {@link reindex} call in milliseconds. */
  lastReindexDurationMs?: number;

  /** How many roots were served from disk cache during the last reindex. */
  lastReindexCachedRoots = 0;

  /** How many roots were freshly analysed during the last reindex. */
  lastReindexAnalyzedRoots = 0;

  /** Whether the most recent {@link analyzeRoot} call was a disk-cache hit. */
  lastRootServedFromCache = false;

  /**
   * Creates a workspace index.
   * @param {WorkspaceIndexOptions} [options] Initial index configuration.
   */
  constructor(options: WorkspaceIndexOptions) {
    this.environment = options.environment;
    this.target = options.target;
    this.toolingCatalog = this.environment.getToolingCatalog(this.target);
    this.entryPoints = (options.entryPoints ?? []).map((entry) => path.resolve(entry));
    this.includePaths = options.includePaths ?? ["./"];
    this.architecture =
      options.architecture ?? this.environment.getTarget(this.target)?.defaultArchitecture ?? "";
    this.targetOptions = Object.freeze({ ...(options.targetOptions ?? {}) });
    this.directiveCatalog = this.toolingCatalog.getDirectives();
    this.directivePrefixes =
      this.environment.getTarget(this.target)?.syntaxProfile?.directivePrefixes ??
      ASAR_SYNTAX_PROFILE.directivePrefixes;
    this.logger = options.logger;
    this.cache = options.cacheDir ? new RootAnalysisCache(options.cacheDir) : undefined;
  }

  /**
   * Updates index configuration and re-analyses the workspace.
   * @param {WorkspaceIndexOptions} options The configuration to apply.
   */
  configure(options: WorkspaceIndexConfiguration): void {
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
   * @param {string} file The absolute path of the document.
   * @param {string} content The current document text.
   */
  openDocument(file: string, content: string): void {
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
      }
    }
    const roots = this.resolveRoots();
    this.rebuildMergedIndex(roots.includes(resolved) ? roots : [...roots, resolved]);
  }

  /**
   * Updates the content of an already-open document without re-analysing.
   * Callers can debounce multiple edits before invoking {@link reindex}.
   * @param {string} file The absolute path of the document.
   * @param {string} content The new document text.
   */
  updateDocument(file: string, content: string): void {
    const resolved = path.resolve(file);
    this.overlay.set(resolved, content);
    this.dirtyFiles.add(resolved);
  }

  /**
   * Removes an open editor buffer (reverting to disk) and re-analyses.
   * @param {string} file The absolute path of the document.
   */
  closeDocument(file: string): void {
    const resolved = path.resolve(file);
    this.overlay.delete(resolved);
    this.dirtyFiles.add(resolved);
    this.reindex();
  }

  /**
   * Marks a disk-backed file as changed for the next debounced reindex.
   * @param {string} file The changed absolute path.
   */
  invalidateFile(file: string): void {
    this.dirtyFiles.add(path.resolve(file));
  }

  /**
   * Returns the current text for a file, preferring the open buffer.
   * @param {string} file The absolute path of the file.
   * @returns {string | undefined} The file text, or undefined when unavailable.
   */
  getText(file: string): string | undefined {
    return this.overlay.get(path.resolve(file));
  }

  /**
   * Returns the text for a file from the open buffer, falling back to disk.
   * Used by features that must compute precise ranges in files that may not be
   * open in the editor (for example, cross-file rename targets).
   * @param {string} file The absolute path of the file.
   * @returns {string | undefined} The file text, or undefined when unreadable.
   */
  getFileText(file: string): string | undefined {
    const resolved = path.resolve(file);
    const open = this.overlay.get(resolved);
    if (open !== undefined) {
      return open;
    }
    try {
      const provider = new OverlayFileProvider(this.overlay);
      const stat = provider.stat(resolved);
      if (!stat.exists || !stat.readable) {
        return undefined;
      }
      return provider.readTextFile(resolved);
    } catch {
      return undefined;
    }
  }

  /**
   * Returns the analysis bucket for a file, if it has been analysed.
   * @param {string} file The absolute path of the file.
   * @returns {FileAnalysis | undefined} The per-file analysis, or undefined.
   */
  getFileAnalysis(file: string): FileAnalysis | undefined {
    return this.fileAnalysis.get(path.resolve(file));
  }

  /**
   * Returns diagnostics for a file.
   * @param {string} file The absolute path of the file.
   * @returns {AssemblyDiagnostic[]} The diagnostics for the file.
   */
  getDiagnostics(file: string): AssemblyDiagnostic[] {
    return this.getFileAnalysis(file)?.diagnostics ?? [];
  }

  /**
   * Returns symbol definitions declared in a file.
   * @param {string} file The absolute path of the file.
   * @returns {AssemblySymbolDefinition[]} The symbols defined in the file.
   */
  getSymbols(file: string): AssemblySymbolDefinition[] {
    return this.getFileAnalysis(file)?.symbols ?? [];
  }

  /**
   * Returns symbol references that occur in a file.
   * @param {string} file The absolute path of the file.
   * @returns {AssemblySymbolReference[]} The references in the file.
   */
  getReferences(file: string): AssemblySymbolReference[] {
    return this.getFileAnalysis(file)?.references ?? [];
  }

  /**
   * Returns every symbol definition known across the workspace.
   * @returns {AssemblySymbolDefinition[]} All workspace symbol definitions.
   */
  getAllSymbols(): AssemblySymbolDefinition[] {
    return this.allSymbols;
  }

  /**
   * Returns every symbol reference known across the workspace.
   * @returns {AssemblySymbolReference[]} All workspace symbol references.
   */
  getAllReferences(): AssemblySymbolReference[] {
    return this.allReferences;
  }

  /**
   * Returns the merged include-graph edges.
   * @returns {AssemblyIncludeEdge[]} The include edges across all roots.
   */
  getIncludeEdges(): AssemblyIncludeEdge[] {
    return this.includeEdges;
  }

  /**
   * Returns the absolute paths of every file with analysis artifacts.
   * @returns {string[]} The analysed file paths.
   */
  getAnalyzedFiles(): string[] {
    return [...this.fileAnalysis.keys()];
  }

  /**
   * Returns whether a file still needs a full-pass reindex.
   * True when the file is dirty, a full rebuild is pending, or no covering
   * full-pass analysis exists yet.
   * @param {string} file The absolute path of the file.
   * @returns {boolean} Whether callers should schedule {@link reindex}.
   */
  isFileDirtyOrUncovered(file: string): boolean {
    const resolved = path.resolve(file);
    if (this.dirtyFiles.has(resolved) || this.fullReindexRequired) {
      return true;
    }
    return !this.isCoveredByFullPass(resolved);
  }

  /**
   * Returns a snapshot of index size and last-reindex timing for the project panel.
   * @returns {WorkspaceIndexStatus} The current status snapshot.
   */
  getStatus(): WorkspaceIndexStatus {
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
      lastReindexCachedRoots: this.lastReindexCachedRoots,
      lastReindexAnalyzedRoots: this.lastReindexAnalyzedRoots,
    };
  }

  /**
   * True when a followIncludes analysis already owns this file as a root or include.
   * @param {string} file The absolute path of the file.
   * @returns {boolean} Whether a covering full-pass analysis exists.
   */
  isCoveredByFullPass(file: string): boolean {
    const resolved = path.resolve(file);
    for (const [root, analysis] of this.rootAnalyses) {
      if (!analysis.followedIncludes) {
        continue;
      }
      if (root === resolved) {
        return true;
      }
      if (
        analysis.includeEdges.some((edge) => edge.fromFile === resolved || edge.toFile === resolved)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * True when a different full-pass root already includes this file.
   * Used to avoid analysing included files as standalone roots.
   * @param {string} file The absolute path of the file.
   * @returns {boolean} Whether another covering full-pass root exists.
   */
  isCoveredByOtherFullPassRoot(file: string): boolean {
    const resolved = path.resolve(file);
    for (const [root, analysis] of this.rootAnalyses) {
      if (!analysis.followedIncludes || root === resolved) {
        continue;
      }
      if (
        analysis.includeEdges.some((edge) => edge.fromFile === resolved || edge.toFile === resolved)
      ) {
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
  reindex(): void {
    const started = Date.now();
    const roots = this.resolveRoots();
    const activeRoots = new Set(roots);
    for (const cachedRoot of this.rootAnalyses.keys()) {
      if (!activeRoots.has(cachedRoot)) {
        this.rootAnalyses.delete(cachedRoot);
      }
    }

    const analyzeAll = this.fullReindexRequired;
    const dirtyFiles = [...this.dirtyFiles];
    const hasUnknownDependency = dirtyFiles.some(
      (file) => !roots.some((root) => this.rootDependsOnFile(root, file)),
    );
    const rootsToAnalyze =
      analyzeAll || hasUnknownDependency
        ? roots
        : roots.filter(
            (root) =>
              !this.rootAnalyses.has(root) ||
              dirtyFiles.some((file) => this.rootDependsOnFile(root, file)),
          );

    let cachedRoots = 0;
    let analyzedRoots = 0;
    for (const root of rootsToAnalyze) {
      if (this.isCoveredByOtherFullPassRoot(root)) {
        continue;
      }
      const result = this.analyzeRoot(root, { followIncludes: true });
      if (result) {
        this.rootAnalyses.set(root, result);
        if (this.lastRootServedFromCache) {
          cachedRoots += 1;
        } else {
          analyzedRoots += 1;
        }
      } else {
        this.rootAnalyses.delete(root);
      }
    }

    this.dirtyFiles.clear();
    this.fullReindexRequired = false;
    this.lastReindexDurationMs = Date.now() - started;
    this.lastReindexCachedRoots = cachedRoots;
    this.lastReindexAnalyzedRoots = analyzedRoots;
    this.rebuildMergedIndex(roots);
  }

  /**
   * Determines whether a cached root analysis contains a changed file.
   * @param {string} root The root source file.
   * @param {string} file The changed source file.
   * @returns {boolean} Whether the root must be re-analysed.
   */
  rootDependsOnFile(root: string, file: string): boolean {
    if (root === file) {
      return true;
    }
    const analysis = this.rootAnalyses.get(root);
    if (!analysis) {
      return true;
    }
    return analysis.includeEdges.some((edge) => edge.fromFile === file || edge.toFile === file);
  }

  /**
   * Analyses one root using the current overlay snapshot.
   * @param {string} root The root source file.
   * @param {{ followIncludes?: boolean }} [options] Analysis options.
   * @returns {RootAnalysis | undefined} The completed artifacts, or undefined when unavailable.
   */
  analyzeRoot(root: string, options: { followIncludes?: boolean } = {}): RootAnalysis | undefined {
    const content = this.overlay.get(root) ?? this.readDiskRoot(root);
    if (content === undefined) {
      return undefined;
    }

    const followIncludes = options.followIncludes ?? true;
    this.lastRootServedFromCache = false;
    this.logger?.info(
      `Analyzing ${path.basename(root)} (followIncludes=${followIncludes}, ${content.length} chars)…`,
    );

    if (followIncludes && this.cache) {
      const cached = this.cache.read(root, this.cacheIdentity(), (file) => this.hashFile(file));
      if (cached) {
        this.lastRootServedFromCache = true;
        this.logger?.info(
          `Using cached analysis for ${path.basename(root)} ` +
            `(followIncludes=true, symbols=${cached.symbols.length}, ` +
            `refs=${cached.references.length}, edges=${cached.includeEdges.length}, ` +
            `errors=${cached.diagnostics.length})`,
        );
        return cached;
      }
    }

    const started = Date.now();
    const provider = new OverlayFileProvider(this.overlay);
    const assembler = new Assembler({
      environment: this.environment,
      target: this.target,
      architecture: this.architecture,
      targetOptions: this.targetOptions,
      fileProvider: provider,
    });
    assembler.includePaths = this.deriveIncludePaths(root);
    assembler.followIncludes = followIncludes;

    try {
      const result = assembler.analyzeSource(content, root, 0, { followIncludes });
      const analysis: RootAnalysis = {
        followedIncludes: followIncludes,
        diagnostics: result.diagnostics,
        symbols: result.symbols,
        references: result.references,
        includeEdges: result.includeEdges,
      };
      this.logger?.info(
        `Analyzed ${path.basename(root)} in ${Date.now() - started}ms ` +
          `(followIncludes=${followIncludes}, symbols=${result.symbols.length}, ` +
          `refs=${result.references.length}, edges=${result.includeEdges.length}, ` +
          `errors=${result.diagnostics.length})`,
      );
      if (followIncludes && this.cache) {
        const fileHashes = this.collectFileHashes(root, result.includeEdges);
        if (fileHashes) {
          this.cache.write(root, this.cacheIdentity(), fileHashes, analysis);
        }
      }
      return analysis;
    } catch (error) {
      this.logger?.info(
        `Analysis failed for ${path.basename(root)} after ${Date.now() - started}ms: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      // analyzeSource recovers internally; guard against unexpected throws so
      // one broken root never blanks out the whole workspace index.
      return undefined;
    } finally {
      assembler.dispose();
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
   * @param {string[]} roots The active roots in deterministic order.
   */
  rebuildMergedIndex(roots: string[]): void {
    this.fileAnalysis.clear();
    this.includeEdges = [];
    this.allSymbols = [];
    this.allReferences = [];
    const seenEdges = new Set<string>();

    // Build the set of files whose artifacts should come from a covering root
    // rather than from their own (potentially no-context) standalone analysis.
    // Only full-pass analyses (followedIncludes: true) qualify as covering roots
    // because a local pass does not descend into includes.
    const coveredByFullPass = new Set<string>();
    for (const root of roots) {
      const result = this.rootAnalyses.get(root);
      if (result?.followedIncludes) {
        for (const edge of result.includeEdges) {
          coveredByFullPass.add(edge.toFile);
        }
      }
    }

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
   * @param {string} root The root file that produced these artifacts.
   * @param {AssemblyDiagnostic[]} diagnostics The diagnostics to bucket.
   * @param {AssemblySymbolDefinition[]} symbols The symbols to bucket.
   * @param {AssemblySymbolReference[]} references The references to bucket.
   */
  ingestArtifacts(
    root: string,
    diagnostics: AssemblyDiagnostic[],
    symbols: AssemblySymbolDefinition[],
    references: AssemblySymbolReference[],
  ): void {
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
   * @param {string} file The absolute path of the file.
   * @returns {FileAnalysis} The mutable analysis bucket.
   */
  bucketFor(file: string): FileAnalysis {
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
   * @returns {string[]} The absolute root paths.
   */
  resolveRoots(): string[] {
    if (this.entryPoints.length > 0) {
      return [...new Set(this.entryPoints)];
    }
    return [...this.overlay.keys()];
  }

  /**
   * Reads a root file from disk when it is not open in the editor.
   * @param {string} root The absolute root path.
   * @returns {string | undefined} The file text, or undefined when unreadable.
   */
  readDiskRoot(root: string): string | undefined {
    try {
      const provider = new OverlayFileProvider(this.overlay);
      const stat = provider.stat(root);
      if (!stat.exists || !stat.readable) {
        return undefined;
      }
      return provider.readTextFile(root);
    } catch {
      return undefined;
    }
  }

  /**
   * Derives the include search paths for a root, always including its directory.
   * @param {string} root The absolute root path.
   * @returns {string[]} The include paths to hand to the assembler.
   */
  deriveIncludePaths(root: string): string[] {
    const directory = path.dirname(root);
    return [...new Set([directory, ...this.includePaths])];
  }

  /**
   * Assembler identity stored alongside cached analysis so a target or include-path
   * change cannot reuse stale artifacts.
   * @returns {import("./root-analysis-cache.js").RootAnalysisCacheIdentity} The identity.
   */
  cacheIdentity(): { target: string; architecture: string; includePaths: readonly string[] } {
    return {
      target: this.target,
      architecture: this.architecture,
      includePaths: this.includePaths,
    };
  }

  /**
   * Hashes overlay or disk bytes for cache invalidation. Works for text and binary includes.
   * @param {string} file Absolute path to hash.
   * @returns {string | undefined} Hex digest, or undefined when unreadable.
   */
  hashFile(file: string): string | undefined {
    try {
      const overlay = this.overlay.get(file);
      if (overlay !== undefined) {
        return hashBytes(new Uint8Array(Buffer.from(overlay, "utf8")));
      }
      const provider = new OverlayFileProvider(this.overlay);
      const stat = provider.stat(file);
      if (!stat.exists || !stat.readable) {
        return undefined;
      }
      return hashBytes(provider.readFile(file));
    } catch {
      return undefined;
    }
  }

  /**
   * Collects content hashes for a root and every file in its include graph.
   * @param {string} root Absolute root path.
   * @param {AssemblyIncludeEdge[]} includeEdges Include edges from the analysis.
   * @returns {Record<string, string> | undefined} Path-to-hash map, or undefined when incomplete.
   */
  collectFileHashes(
    root: string,
    includeEdges: AssemblyIncludeEdge[],
  ): Record<string, string> | undefined {
    const files = new Set<string>([root]);
    for (const edge of includeEdges) {
      files.add(edge.fromFile);
      files.add(edge.toFile);
    }
    const hashes: Record<string, string> = {};
    for (const file of [...files].sort()) {
      const hash = this.hashFile(file);
      if (typeof hash !== "string") {
        return undefined;
      }
      hashes[file] = hash;
    }
    return hashes;
  }
}
