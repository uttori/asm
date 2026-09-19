import fs from "node:fs";
import path from "node:path";
/**
 * Default Node.js-backed file provider used by the assembler runtime.
 */
export class NodeAssemblyFileProvider {
    /**
     * Find the first existing path: macro directory, current source directory, include paths, then cwd.
     * @param {string} filename The filename.
     * @param {AssemblyFileResolutionOptions} [options] The options.
     * @returns {string | undefined} The result.
     */
    resolvePath(filename, options = {}) {
        if (!filename) {
            return undefined;
        }
        const normalized = stripWrappingQuotes(filename);
        if (path.isAbsolute(normalized)) {
            return fs.existsSync(normalized) ? normalized : undefined;
        }
        const candidates = new Set();
        const baseDirectories = [
            options.macroSourceFile ? path.dirname(options.macroSourceFile) : undefined,
            options.currentFile ? path.dirname(options.currentFile) : undefined,
            ...(options.includePaths ?? []),
            process.cwd(),
        ].filter((entry) => Boolean(entry));
        for (const baseDirectory of baseDirectories) {
            candidates.add(path.resolve(baseDirectory, normalized));
        }
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        return undefined;
    }
    /**
     * Reads metadata for the value.
     * @param {string} filePath The file path.
     * @returns {AssemblyFileStat} The result.
     */
    stat(filePath) {
        let st;
        try {
            st = fs.statSync(filePath);
        }
        catch {
            return { exists: false, readable: false };
        }
        try {
            fs.accessSync(filePath, fs.constants.R_OK);
            return { exists: true, readable: true, size: st.size, mtimeMs: st.mtimeMs };
        }
        catch {
            return { exists: true, readable: false, mtimeMs: st.mtimeMs };
        }
    }
    /**
     * Reads file.
     * @param {string} filePath The file path.
     * @returns {Uint8Array} The result.
     */
    readFile(filePath) {
        return new Uint8Array(fs.readFileSync(filePath));
    }
    /**
     * Reads text file.
     * @param {string} filePath The file path.
     * @param {BufferEncoding} [encoding] The encoding.
     * @returns {string} The result.
     */
    readTextFile(filePath, encoding = "utf8") {
        return fs.readFileSync(filePath, encoding);
    }
}
/**
 * In-memory file provider intended for editor workflows and virtual documents.
 */
export class MemoryAssemblyFileProvider {
    options;
    /** Mutable document map; construction copies keys/entries but retains supplied byte-array values. */
    files;
    constructor(files = new Map(), options = {}) {
        this.options = options;
        this.files = files instanceof Map ? new Map(files) : new Map(Object.entries(files));
    }
    /**
     * Match an exact virtual key, then search macro/source/include directories and workingDirectory.
     * @param {string} filename The filename.
     * @param {AssemblyFileResolutionOptions} [options] The options.
     * @returns {string | undefined} The result.
     */
    resolvePath(filename, options = {}) {
        if (!filename) {
            return undefined;
        }
        const normalized = stripWrappingQuotes(filename);
        if (this.files.has(normalized)) {
            return normalized;
        }
        if (path.isAbsolute(normalized)) {
            return undefined;
        }
        const baseDirectories = [
            options.macroSourceFile ? path.dirname(options.macroSourceFile) : undefined,
            options.currentFile ? path.dirname(options.currentFile) : undefined,
            ...(options.includePaths ?? []),
            this.options.workingDirectory,
        ].filter((entry) => Boolean(entry));
        for (const baseDirectory of baseDirectories) {
            const candidate = path.resolve(baseDirectory, normalized);
            if (this.files.has(candidate)) {
                return candidate;
            }
        }
        return undefined;
    }
    /**
     * Reads metadata for the value.
     * @param {string} filePath The file path.
     * @returns {AssemblyFileStat} The result.
     */
    stat(filePath) {
        const entry = this.files.get(filePath);
        if (entry === undefined) {
            return {
                exists: false,
                readable: false,
            };
        }
        return {
            exists: true,
            readable: true,
            size: typeof entry === "string" ? Buffer.byteLength(entry, "utf8") : entry.length,
        };
    }
    /**
     * Reads file.
     * @param {string} filePath The file path.
     * @returns {Uint8Array} The result.
     */
    readFile(filePath) {
        const entry = this.files.get(filePath);
        if (entry === undefined) {
            throw new Error(`Virtual file not found: ${filePath}`);
        }
        return typeof entry === "string"
            ? new Uint8Array(Buffer.from(entry, "utf8"))
            : new Uint8Array(entry);
    }
    /**
     * Reads text file.
     * @param {string} filePath The file path.
     * @param {BufferEncoding} [encoding] The encoding.
     * @returns {string} The result.
     */
    readTextFile(filePath, encoding = "utf8") {
        const entry = this.files.get(filePath);
        if (entry === undefined) {
            throw new Error(`Virtual file not found: ${filePath}`);
        }
        return typeof entry === "string" ? entry : Buffer.from(entry).toString(encoding);
    }
}
/**
 * Removes matching wrapping quotes from a user-supplied file path token.
 * @param {string} filename The raw path token.
 * @returns {string} The unwrapped path.
 */
export function stripWrappingQuotes(filename) {
    if ((filename.startsWith('"') && filename.endsWith('"')) ||
        (filename.startsWith("'") && filename.endsWith("'")) ||
        (filename.startsWith("`") && filename.endsWith("`"))) {
        return filename.slice(1, -1);
    }
    return filename;
}
//# sourceMappingURL=file-provider.js.map