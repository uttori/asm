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
 * @returns Node's synchronous filesystem API.
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
     * @param filename Include path token, optionally quoted.
     * @param [options] Source and include directories in search order.
     * @returns First existing file identity, or undefined.
     */
    resolvePath(filename, options = {}) {
        requireNodeFs();
        if (!filename) {
            return undefined;
        }
        const normalized = stripWrappingQuotes(filename);
        if (path.isAbsolute(normalized)) {
            return this.stat(normalized).exists ? normalized : undefined;
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
            // Resolve through the provider's view so snapshot overlays can create or hide candidates.
            if (this.stat(candidate).exists) {
                return candidate;
            }
        }
        return undefined;
    }
    /** Probes disk metadata without recording the path as a consumed dependency. */
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
    /** Reads disk bytes and records the path in the build dependency set. */
    readFile(filePath) {
        const fs = requireNodeFs();
        this.readFiles.add(filePath);
        return new Uint8Array(fs.readFileSync(filePath));
    }
    /** Reads disk text and records the path in the build dependency set. */
    readTextFile(filePath, encoding = "utf8") {
        const fs = requireNodeFs();
        this.readFiles.add(filePath);
        return fs.readFileSync(filePath, encoding);
    }
}
/**
 * One Node build's owned input view. All passes see the first bytes read, including after disk
 * changes; call assertUnchanged before accepting the result. Create a new provider for each build.
 * Node path/filesystem policy stays here; assemblers consume the portable AssemblyFileProvider contract.
 */
export class NodeAssemblySnapshotProvider extends NodeAssemblyFileProvider {
    #overlays = new Map();
    #snapshots = new Map();
    #maxBytes;
    #bytes = 0;
    /** Exact consumed bytes keyed by absolute path. Entries and buffers are borrowed read-only. */
    snapshots = this.#snapshots;
    constructor(options = {}) {
        super();
        requireNodeFs();
        this.#maxBytes = options.maxBytes ?? 256 * 1024 * 1024;
        if (!Number.isSafeInteger(this.#maxBytes) || this.#maxBytes < 1) {
            throw new Error("Source snapshot byte limit must be a positive safe integer.");
        }
        let bytes = 0;
        for (const [file, value] of options.overlays ?? []) {
            if (!path.isAbsolute(file)) {
                throw new Error(`Source overlay requires an absolute path: ${file}`);
            }
            bytes += value?.length ?? 0;
            if (bytes > this.#maxBytes) {
                throw new Error(`Source overlays exceed ${this.#maxBytes} bytes.`);
            }
            this.#overlays.set(path.resolve(file), value === null ? null : Uint8Array.from(value));
        }
    }
    /** Applies overlays and retained snapshots before falling back to disk stat. */
    stat(file) {
        const name = path.resolve(file);
        if (this.#overlays.has(name)) {
            const bytes = this.#overlays.get(name);
            return { exists: bytes !== null, readable: bytes !== null, size: bytes?.length };
        }
        const snapshot = this.#snapshots.get(name);
        if (snapshot) {
            // Resolution and length checks must keep seeing the consumed input until freshness validation.
            return { exists: true, readable: true, size: snapshot.length };
        }
        return super.stat(name);
    }
    /** Returns immutable snapshot bytes, honoring overlays and the build byte budget. */
    readFile(file) {
        const name = path.resolve(file);
        let bytes = this.#snapshots.get(name);
        if (!bytes) {
            const overlay = this.#overlays.get(name);
            if (overlay === null) {
                throw new Error(`Candidate source removed '${name}'.`);
            }
            const size = overlay?.length ?? super.stat(name).size ?? 0;
            if (size > this.#maxBytes - this.#bytes) {
                throw new Error(`Source build input snapshot exceeds ${this.#maxBytes} bytes.`);
            }
            bytes = overlay ?? super.readFile(name);
            // Recheck actual bytes because a disk file may grow between stat and read.
            if (bytes.length > this.#maxBytes - this.#bytes) {
                throw new Error(`Source build input snapshot exceeds ${this.#maxBytes} bytes.`);
            }
            this.#bytes += bytes.length;
            this.#snapshots.set(name, bytes);
            this.readFiles.add(name);
        }
        // Encoders and converters cannot mutate the input observed by later passes or receipts.
        return bytes.slice();
    }
    /** Decodes snapshot bytes using the same copy-on-read path as binary reads. */
    readTextFile(file, encoding = "utf8") {
        return Buffer.from(this.readFile(file)).toString(encoding);
    }
    /** Reject changed or removed saved inputs; copied overlays remain independent of the host disk. */
    assertUnchanged() {
        const fs = requireNodeFs();
        for (const [file, bytes] of this.#snapshots) {
            if (this.#overlays.has(file)) {
                continue;
            }
            try {
                if (fs.statSync(file).size === bytes.length && fs.readFileSync(file).equals(bytes)) {
                    continue;
                }
            }
            catch (cause) {
                throw new Error(`Source dependency changed during assembly: ${file}`, { cause });
            }
            throw new Error(`Source dependency changed during assembly: ${file}`);
        }
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
     * @param filename Include path token, optionally quoted.
     * @param [options] Source and include directories in search order.
     * @returns First existing file identity, or undefined.
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
    /** Reports virtual document presence and encoded byte length. */
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
    /** Returns a copy of virtual file bytes, encoding strings as UTF-8. */
    readFile(filePath) {
        const entry = this.files.get(filePath);
        if (entry === undefined) {
            throw new Error(`Virtual file not found: ${filePath}`);
        }
        return typeof entry === "string" ? new TextEncoder().encode(entry) : new Uint8Array(entry);
    }
    /** Returns stored string content or decodes binary virtual entries. */
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
 * @param filename The raw path token.
 * @returns The unwrapped path.
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