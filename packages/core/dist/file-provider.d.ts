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
    /** Read synchronously. Built-in providers default to UTF-8 and throw on missing files. */
    readTextFile(filePath: string, encoding?: BufferEncoding): string;
}
/**
 * Default Node.js-backed file provider used by the assembler runtime.
 */
export declare class NodeAssemblyFileProvider implements AssemblyFileProvider {
    /** Consumed paths for dependency snapshots; callers reusing a provider may clear this per build. */
    readonly readFiles: Set<string>;
    /**
     * Find the first existing path: macro directory, current source directory, include paths, then cwd.
     * @param {string} filename Include path token, optionally quoted.
     * @param {AssemblyFileResolutionOptions} [options] Source and include directories in search order.
     * @returns {string | undefined} First existing file identity, or undefined.
     */
    resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
    stat(filePath: string): AssemblyFileStat;
    readFile(filePath: string): Uint8Array;
    readTextFile(filePath: string, encoding?: BufferEncoding): string;
}
/** Bounds owned overlay bytes and consumed snapshots independently; defaults to 256 MiB each. */
export interface NodeAssemblySnapshotOptions {
    /** Absolute file identities. Null hides a saved file; supplied maps and bytes are copied. */
    readonly overlays?: ReadonlyMap<string, Uint8Array | null>;
    /** Positive safe-integer byte limit, including binary includes. */
    readonly maxBytes?: number;
}
/**
 * One Node build's owned input view. All passes see the first bytes read, including after disk
 * changes; call assertUnchanged before accepting the result. Create a new provider for each build.
 * Node path/filesystem policy stays here; assemblers consume the portable AssemblyFileProvider contract.
 */
export declare class NodeAssemblySnapshotProvider extends NodeAssemblyFileProvider {
    #private;
    /** Exact consumed bytes keyed by absolute path. Entries and buffers are borrowed read-only. */
    readonly snapshots: ReadonlyMap<string, Uint8Array>;
    constructor(options?: NodeAssemblySnapshotOptions);
    stat(file: string): AssemblyFileStat;
    readFile(file: string): Uint8Array;
    readTextFile(file: string, encoding?: BufferEncoding): string;
    /** Reject changed or removed saved inputs; copied overlays remain independent of the host disk. */
    assertUnchanged(): void;
}
/** Virtual lookup base. No host cwd fallback or filesystem access is used. */
export type MemoryAssemblyFileProviderOptions = {
    workingDirectory?: string;
};
/**
 * In-memory file provider intended for editor workflows and virtual documents.
 */
export declare class MemoryAssemblyFileProvider implements AssemblyFileProvider {
    readonly options: MemoryAssemblyFileProviderOptions;
    /** Mutable document map. Construction copies keys/entries but retains supplied byte-array values. */
    readonly files: Map<string, string | Uint8Array>;
    constructor(files?: Map<string, string | Uint8Array> | Record<string, string | Uint8Array>, options?: MemoryAssemblyFileProviderOptions);
    /**
     * Match an exact virtual key, then search macro/source/include directories and workingDirectory.
     * @param {string} filename Include path token, optionally quoted.
     * @param {AssemblyFileResolutionOptions} [options] Source and include directories in search order.
     * @returns {string | undefined} First existing file identity, or undefined.
     */
    resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
    stat(filePath: string): AssemblyFileStat;
    readFile(filePath: string): Uint8Array;
    readTextFile(filePath: string, encoding?: BufferEncoding): string;
}
/**
 * Removes matching wrapping quotes from a user-supplied file path token.
 * @param {string} filename The raw path token.
 * @returns {string} The unwrapped path.
 */
export declare function stripWrappingQuotes(filename: string): string;
//# sourceMappingURL=file-provider.d.ts.map