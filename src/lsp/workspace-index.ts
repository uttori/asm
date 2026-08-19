import path from "node:path";
import { Assembler } from "../assembler.js";
import type {
  AssemblyAnalysisResult,
  AssemblyDiagnostic,
  AssemblyIncludeEdge,
  AssemblySymbolDefinition,
  AssemblySymbolReference,
} from "../diagnostics.js";
import { OverlayFileProvider } from "./overlay-file-provider.js";

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
  /** Explicit project entry points (absolute paths). When empty, open documents are treated as roots. */
  entryPoints?: string[];
  /** Additional include search paths handed to the assembler. */
  includePaths?: string[];
  /** Target architecture name (e.g. "65816", "spc700", "superfx"). */
  architecture?: string;
};

type RootAnalysis = Pick<
  AssemblyAnalysisResult,
  "diagnostics" | "symbols" | "references" | "includeEdges"
>;

/**
 * Indexes one or more SNES assembly projects for editor tooling.
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

  /**
   * Creates a workspace index.
   * @param {WorkspaceIndexOptions} [options] Initial index configuration.
   */
  constructor(options: WorkspaceIndexOptions = {}) {
    this.entryPoints = (options.entryPoints ?? []).map((entry) => path.resolve(entry));
    this.includePaths = options.includePaths ?? ["./"];
    this.architecture = options.architecture ?? "65816";
  }

  /**
   * Updates index configuration and re-analyses the workspace.
   * @param {WorkspaceIndexOptions} options The configuration to apply.
   */
  configure(options: WorkspaceIndexOptions): void {
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
    this.dirtyFiles.add(resolved);
    this.reindex();
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
   * Re-runs analysis for every root and rebuilds all per-file buckets.
   * Roots are the configured entry points, or every open document when no
   * entry points are configured.
   */
  reindex(): void {
    const roots = this.resolveRoots();
    const activeRoots = new Set(roots);
    for (const cachedRoot of this.rootAnalyses.keys()) {
      if (!activeRoots.has(cachedRoot)) {
        this.rootAnalyses.delete(cachedRoot);
      }
    }

    const analyzeAll = this.fullReindexRequired || this.dirtyFiles.size === 0;
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

    for (const root of rootsToAnalyze) {
      const result = this.analyzeRoot(root);
      if (result) {
        this.rootAnalyses.set(root, result);
      } else {
        this.rootAnalyses.delete(root);
      }
    }

    this.dirtyFiles.clear();
    this.fullReindexRequired = false;
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
   * @returns {RootAnalysis | undefined} The completed artifacts, or undefined when unavailable.
   */
  analyzeRoot(root: string): RootAnalysis | undefined {
    const content = this.overlay.get(root) ?? this.readDiskRoot(root);
    if (content === undefined) {
      return undefined;
    }

    const provider = new OverlayFileProvider(this.overlay);
    const assembler = new Assembler(undefined, { fileProvider: provider });
    assembler.includePaths = this.deriveIncludePaths(root);
    assembler.arch = this.architecture;

    try {
      const result = assembler.analyzeSource(content, root, 0);
      return {
        diagnostics: result.diagnostics,
        symbols: result.symbols,
        references: result.references,
        includeEdges: result.includeEdges,
      };
    } catch {
      // analyzeSource recovers internally; guard against unexpected throws so
      // one broken root never blanks out the whole workspace index.
      return undefined;
    }
  }

  /**
   * Rebuilds workspace-wide buckets from cached per-root artifacts.
   * @param {string[]} roots The active roots in deterministic order.
   */
  rebuildMergedIndex(roots: string[]): void {
    this.fileAnalysis.clear();
    this.includeEdges = [];
    this.allSymbols = [];
    this.allReferences = [];
    const seenEdges = new Set<string>();

    for (const root of roots) {
      const result = this.rootAnalyses.get(root);
      if (!result) {
        continue;
      }
      this.ingestArtifacts(root, result.diagnostics, result.symbols, result.references);
      for (const edge of result.includeEdges) {
        const key = `${edge.fromFile}\u0000${edge.toFile}`;
        if (seenEdges.has(key)) {
          continue;
        }
        seenEdges.add(key);
        this.includeEdges.push(edge);
      }
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
}
