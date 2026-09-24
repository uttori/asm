/**
 * Node built-ins are resolved only when the Node provider is used. Browser
 * sessions supply MemoryAssemblyFileProvider and never touch the host disk.
 */
const nodePath = typeof process === "undefined" ? undefined : process.getBuiltinModule("node:path");
const nodeFs = typeof process === "undefined" ? undefined : process.getBuiltinModule("node:fs");
const virtualPath = {
    isAbsolute: (value) => value.startsWith("/"),
    dirname: (value) => value.slice(0, value.lastIndexOf("/")) || ".",
    resolve: (...parts) => {
        const joined = parts.filter(Boolean).join("/");
        const stack = [];
        for (const part of joined.split("/")) {
            if (part === "..") {
                stack.pop();
            }
            else if (part && part !== ".") {
                stack.push(part);
            }
        }
        return `/${stack.join("/")}`;
    },
};
const path = nodePath ?? virtualPath;
/**
 * Fail explicitly if a host selects the Node provider in a browser runtime.
 * @returns {typeof import("node:fs")} Node's synchronous filesystem API.
 */
const requireNodeFs = () => {
    if (!nodeFs) {
        throw new Error("NodeAssemblyFileProvider requires Node.js.");
    }
    return nodeFs;
};
/**
 * Default Node.js-backed file provider used by the assembler runtime.
 */
export class NodeAssemblyFileProvider {
    /** Consumed paths for dependency snapshots; callers reusing a provider may clear this per build. */
    readFiles = new Set();
    /**
     * Find the first existing path: macro directory, current source directory, include paths, then cwd.
     * @param {string} filename Include path token, optionally quoted.
     * @param {AssemblyFileResolutionOptions} [options] Source and include directories in search order.
     * @returns {string | undefined} First existing file identity, or undefined.
     */
    resolvePath(filename, options = {}) {
        const fs = requireNodeFs();
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
    stat(filePath) {
        const fs = requireNodeFs();
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
    readFile(filePath) {
        const fs = requireNodeFs();
        this.readFiles.add(filePath);
        return new Uint8Array(fs.readFileSync(filePath));
    }
    readTextFile(filePath, encoding = "utf8") {
        const fs = requireNodeFs();
        this.readFiles.add(filePath);
        return fs.readFileSync(filePath, encoding);
    }
}
/**
 * In-memory file provider intended for editor workflows and virtual documents.
 */
export class MemoryAssemblyFileProvider {
    options;
    /** Mutable document map. Construction copies keys/entries but retains supplied byte-array values. */
    files;
    constructor(files = new Map(), options = {}) {
        this.options = options;
        this.files = files instanceof Map ? new Map(files) : new Map(Object.entries(files));
    }
    /**
     * Match an exact virtual key, then search macro/source/include directories and workingDirectory.
     * @param {string} filename Include path token, optionally quoted.
     * @param {AssemblyFileResolutionOptions} [options] Source and include directories in search order.
     * @returns {string | undefined} First existing file identity, or undefined.
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
            size: typeof entry === "string" ? new TextEncoder().encode(entry).length : entry.length,
        };
    }
    readFile(filePath) {
        const entry = this.files.get(filePath);
        if (entry === undefined) {
            throw new Error(`Virtual file not found: ${filePath}`);
        }
        return typeof entry === "string" ? new TextEncoder().encode(entry) : new Uint8Array(entry);
    }
    readTextFile(filePath, encoding = "utf8") {
        const entry = this.files.get(filePath);
        if (entry === undefined) {
            throw new Error(`Virtual file not found: ${filePath}`);
        }
        if (typeof entry === "string") {
            return entry;
        }
        if (typeof Buffer !== "undefined") {
            return Buffer.from(entry).toString(encoding);
        }
        return new TextDecoder(encoding).decode(entry);
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