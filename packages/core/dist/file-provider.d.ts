/** Search context supplied by includes and file-reading expressions. */
export type AssemblyFileResolutionOptions = {
    currentFile?: string;
    includePaths?: string[];
    macroSourceFile?: string;
};
/** Provider metadata used for existence checks and source-cache invalidation. */
export type AssemblyFileStat = {
    exists: boolean;
    readable: boolean;
    /** Byte length when known. */
    size?: number;
    /** Modification time in milliseconds since epoch (disk files only). */
    mtimeMs?: number;
};
/**
 * Abstracts file resolution and reads so tooling callers can provide in-memory
 * documents instead of depending on the host filesystem directly.
 */
export interface AssemblyFileProvider {
    /** Return a stable file identity, or undefined if no candidate exists. */
    resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
    stat(filePath: string): AssemblyFileStat;
    /** Read synchronously, throwing on failure. Callers must treat returned bytes as read-only. */
    readFile(filePath: string): Uint8Array;
    /** Read synchronously; built-in providers default to UTF-8 and throw on missing files. */
    readTextFile(filePath: string, encoding?: BufferEncoding): string;
}
/**
 * Default Node.js-backed file provider used by the assembler runtime.
 */
export declare class NodeAssemblyFileProvider implements AssemblyFileProvider {
    /**
     * Find the first existing path: macro directory, current source directory, include paths, then cwd.
     * @param {string} filename The filename.
     * @param {AssemblyFileResolutionOptions} [options] The options.
     * @returns {string | undefined} The result.
     */
    resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
    /**
     * Reads metadata for the value.
     * @param {string} filePath The file path.
     * @returns {AssemblyFileStat} The result.
     */
    stat(filePath: string): AssemblyFileStat;
    /**
     * Reads file.
     * @param {string} filePath The file path.
     * @returns {Uint8Array} The result.
     */
    readFile(filePath: string): Uint8Array;
    /**
     * Reads text file.
     * @param {string} filePath The file path.
     * @param {BufferEncoding} [encoding] The encoding.
     * @returns {string} The result.
     */
    readTextFile(filePath: string, encoding?: BufferEncoding): string;
}
/** Virtual lookup base; no host cwd fallback or filesystem access is used. */
export type MemoryAssemblyFileProviderOptions = {
    workingDirectory?: string;
};
/**
 * In-memory file provider intended for editor workflows and virtual documents.
 */
export declare class MemoryAssemblyFileProvider implements AssemblyFileProvider {
    readonly options: MemoryAssemblyFileProviderOptions;
    /** Mutable document map; construction copies keys/entries but retains supplied byte-array values. */
    readonly files: Map<string, string | Uint8Array>;
    constructor(files?: Map<string, string | Uint8Array> | Record<string, string | Uint8Array>, options?: MemoryAssemblyFileProviderOptions);
    /**
     * Match an exact virtual key, then search macro/source/include directories and workingDirectory.
     * @param {string} filename The filename.
     * @param {AssemblyFileResolutionOptions} [options] The options.
     * @returns {string | undefined} The result.
     */
    resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
    /**
     * Reads metadata for the value.
     * @param {string} filePath The file path.
     * @returns {AssemblyFileStat} The result.
     */
    stat(filePath: string): AssemblyFileStat;
    /**
     * Reads file.
     * @param {string} filePath The file path.
     * @returns {Uint8Array} The result.
     */
    readFile(filePath: string): Uint8Array;
    /**
     * Reads text file.
     * @param {string} filePath The file path.
     * @param {BufferEncoding} [encoding] The encoding.
     * @returns {string} The result.
     */
    readTextFile(filePath: string, encoding?: BufferEncoding): string;
}
/**
 * Removes matching wrapping quotes from a user-supplied file path token.
 * @param {string} filename The raw path token.
 * @returns {string} The unwrapped path.
 */
export declare function stripWrappingQuotes(filename: string): string;
//# sourceMappingURL=file-provider.d.ts.map