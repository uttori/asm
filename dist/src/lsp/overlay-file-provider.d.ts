import { type AssemblyFileProvider, type AssemblyFileResolutionOptions, type AssemblyFileStat } from "../file-provider.js";
/**
 * A file provider that layers unsaved editor buffers on top of a backing
 * provider (the real filesystem by default). Open documents win over disk so
 * the language server analyses the in-editor content, while includes that only
 * exist on disk still resolve normally.
 */
export declare class OverlayFileProvider implements AssemblyFileProvider {
    /** Open document contents keyed by absolute, normalized path. */
    readonly overlay: Map<string, string>;
    /** The backing provider used when a path is not in the overlay. */
    readonly base: AssemblyFileProvider;
    /**
     * Creates an overlay provider.
     * @param {Map<string, string>} [overlay] Initial overlay contents keyed by absolute path.
     * @param {AssemblyFileProvider} [base] Backing provider for disk reads.
     */
    constructor(overlay?: Map<string, string>, base?: AssemblyFileProvider);
    /**
     * Resolves a filename to an absolute path, preferring overlay entries.
     * @param {string} filename The filename or relative path to resolve.
     * @param {AssemblyFileResolutionOptions} [options] Resolution context (current file, include paths).
     * @returns {string | undefined} The resolved absolute path, or undefined when not found.
     */
    resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
    /**
     * Returns stat information, treating overlay entries as readable files.
     * @param {string} filePath The absolute path to stat.
     * @returns {AssemblyFileStat} The stat result.
     */
    stat(filePath: string): AssemblyFileStat;
    /**
     * Reads a file as bytes, using overlay content when present.
     * @param {string} filePath The absolute path to read.
     * @returns {Uint8Array} The file bytes.
     */
    readFile(filePath: string): Uint8Array;
    /**
     * Reads a file as text, using overlay content when present.
     * @param {string} filePath The absolute path to read.
     * @param {string} [encoding] The text encoding for disk reads.
     * @returns {string} The file text.
     */
    readTextFile(filePath: string, encoding?: BufferEncoding): string;
    /**
     * Builds the candidate absolute paths for a relative filename, mirroring the
     * Node provider's resolution order.
     * @param {string} normalized The unquoted filename.
     * @param {AssemblyFileResolutionOptions} options Resolution context.
     * @returns {string[]} The candidate absolute paths to probe in the overlay.
     */
    private candidatePaths;
}
//# sourceMappingURL=overlay-file-provider.d.ts.map