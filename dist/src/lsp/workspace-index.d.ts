import type { AssemblyDiagnostic, AssemblyIncludeEdge, AssemblySymbolDefinition, AssemblySymbolReference } from "../diagnostics.js";
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
/**
 * Indexes one or more SNES assembly projects for editor tooling.
 *
 * Analysis is root-anchored: each entry point (or open document when no entry
 * points are configured) is analysed with the assembler's recovery-friendly
 * `analyzeSource`, which descends into includes. The resulting flat artifacts
 * are bucketed by file so language features can be served per document, and
 * the include graph is preserved for cross-file navigation.
 */
export declare class WorkspaceIndex {
    /** Open editor buffers keyed by absolute path. */
    private readonly overlay;
    /** Per-file analysis buckets keyed by absolute path. */
    private readonly fileAnalysis;
    /** Merged include-graph edges across all analysed roots. */
    private includeEdges;
    /** All symbol definitions across the workspace (for cross-file resolution). */
    private allSymbols;
    /** All symbol references across the workspace (for find-references). */
    private allReferences;
    private entryPoints;
    private includePaths;
    private architecture;
    /**
     * Creates a workspace index.
     * @param {WorkspaceIndexOptions} [options] Initial index configuration.
     */
    constructor(options?: WorkspaceIndexOptions);
    /**
     * Updates index configuration and re-analyses the workspace.
     * @param {WorkspaceIndexOptions} options The configuration to apply.
     */
    configure(options: WorkspaceIndexOptions): void;
    /**
     * Adds or replaces an open editor buffer and re-analyses the workspace.
     * @param {string} file The absolute path of the document.
     * @param {string} content The current document text.
     */
    openDocument(file: string, content: string): void;
    /**
     * Updates the content of an already-open document and re-analyses.
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
     * Re-runs analysis for every root and rebuilds all per-file buckets.
     * Roots are the configured entry points, or every open document when no
     * entry points are configured.
     */
    reindex(): void;
    /**
     * Buckets flat analysis artifacts into their owning files.
     * @param {string} root The root file that produced these artifacts.
     * @param {AssemblyDiagnostic[]} diagnostics The diagnostics to bucket.
     * @param {AssemblySymbolDefinition[]} symbols The symbols to bucket.
     * @param {AssemblySymbolReference[]} references The references to bucket.
     */
    private ingestArtifacts;
    /**
     * Returns (creating if needed) the analysis bucket for a file.
     * @param {string} file The absolute path of the file.
     * @returns {FileAnalysis} The mutable analysis bucket.
     */
    private bucketFor;
    /**
     * Determines the set of root files to analyse.
     * @returns {string[]} The absolute root paths.
     */
    private resolveRoots;
    /**
     * Reads a root file from disk when it is not open in the editor.
     * @param {string} root The absolute root path.
     * @returns {string | undefined} The file text, or undefined when unreadable.
     */
    private readDiskRoot;
    /**
     * Derives the include search paths for a root, always including its directory.
     * @param {string} root The absolute root path.
     * @returns {string[]} The include paths to hand to the assembler.
     */
    private deriveIncludePaths;
}
//# sourceMappingURL=workspace-index.d.ts.map