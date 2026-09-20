import path from "node:path";
import { NodeAssemblyFileProvider, stripWrappingQuotes, } from "../file-provider.js";
/**
 * A file provider that layers unsaved editor buffers on top of a backing
 * provider (the real filesystem by default). Open documents win over disk so
 * the language server analyses the in-editor content, while includes that only
 * exist on disk still resolve normally.
 */
export class OverlayFileProvider {
    /** Open document contents keyed by absolute, normalized path. */
    overlay;
    /** The backing provider used when a path is not in the overlay. */
    base;
    /**
     * Creates an overlay provider.
     * @param {Map<string, string>} [overlay] Initial overlay contents keyed by absolute path.
     * @param {AssemblyFileProvider} [base] Backing provider for disk reads.
     */
    constructor(overlay = new Map(), base = new NodeAssemblyFileProvider()) {
        this.overlay = overlay;
        this.base = base;
    }
    /**
     * Resolves a filename to an absolute path, preferring overlay entries.
     * @param {string} filename The filename or relative path to resolve.
     * @param {AssemblyFileResolutionOptions} [options] Resolution context (current file, include paths).
     * @returns {string | undefined} The resolved absolute path, or undefined when not found.
     */
    resolvePath(filename, options = {}) {
        if (!filename) {
            return undefined;
        }
        const normalized = stripWrappingQuotes(filename);
        // Let the backing provider resolve real files first. The overlay only
        // changes the bytes we return at read time, not where files live on disk.
        const baseResolved = this.base.resolvePath(filename, options);
        if (baseResolved) {
            return baseResolved;
        }
        // Overlay-only fallback for buffers that have never been written to disk.
        if (path.isAbsolute(normalized) && this.overlay.has(normalized)) {
            return normalized;
        }
        for (const candidate of this.candidatePaths(normalized, options)) {
            if (this.overlay.has(candidate)) {
                return candidate;
            }
        }
        return undefined;
    }
    /**
     * Returns stat information, treating overlay entries as readable files.
     * @param {string} filePath The absolute path to stat.
     * @returns {AssemblyFileStat} The stat result.
     */
    stat(filePath) {
        const entry = this.overlay.get(filePath);
        if (entry !== undefined) {
            return {
                exists: true,
                readable: true,
                size: Buffer.byteLength(entry, "utf8"),
            };
        }
        return this.base.stat(filePath);
    }
    /**
     * Reads a file as bytes, using overlay content when present.
     * @param {string} filePath The absolute path to read.
     * @returns {Uint8Array} The file bytes.
     */
    readFile(filePath) {
        const entry = this.overlay.get(filePath);
        if (entry !== undefined) {
            return new Uint8Array(Buffer.from(entry, "utf8"));
        }
        return this.base.readFile(filePath);
    }
    /**
     * Reads a file as text, using overlay content when present.
     * @param {string} filePath The absolute path to read.
     * @param {string} [encoding] The text encoding for disk reads.
     * @returns {string} The file text.
     */
    readTextFile(filePath, encoding = "utf8") {
        const entry = this.overlay.get(filePath);
        if (entry !== undefined) {
            return entry;
        }
        return this.base.readTextFile(filePath, encoding);
    }
    /**
     * Builds the candidate absolute paths for a relative filename, mirroring the
     * Node provider's resolution order.
     * @param {string} normalized The unquoted filename.
     * @param {AssemblyFileResolutionOptions} options Resolution context.
     * @returns {string[]} The candidate absolute paths to probe in the overlay.
     */
    candidatePaths(normalized, options) {
        if (path.isAbsolute(normalized)) {
            return [normalized];
        }
        const baseDirectories = [
            options.macroSourceFile ? path.dirname(options.macroSourceFile) : undefined,
            options.currentFile ? path.dirname(options.currentFile) : undefined,
            ...(options.includePaths ?? []),
            process.cwd(),
        ].filter((entry) => Boolean(entry));
        return baseDirectories.map((directory) => path.resolve(directory, normalized));
    }
}
//# sourceMappingURL=overlay-file-provider.js.map