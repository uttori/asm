/** Search context supplied by includes and file-reading expressions. */
export type AssemblyFileResolutionOptions = {
    /** Active source file used as a relative include anchor. */
    currentFile?: string;
    /** Additional directories searched after macro and current file locations. */
    includePaths?: string[];
    /** Macro expansion site used ahead of the current file in search order. */
    macroSourceFile?: string;
};
/** Provider metadata used for existence checks and source-cache invalidation. */
export type AssemblyFileStat = {
    /** Whether the path resolves to a stored or on-disk object. */
    exists: boolean;
    /** Whether the provider can read bytes for an existing path. */
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
    /** Returns existence, readability, and optional size or mtime metadata. */
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
     * @param filename Include path token, optionally quoted.
     * @param [options] Source and include directories in search order.
     * @returns First existing file identity, or undefined.
     */
    resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
    /** Probes disk metadata without recording the path as a consumed dependency. */
    stat(filePath: string): AssemblyFileStat;
    /** Reads disk bytes and records the path in the build dependency set. */
    readFile(filePath: string): Uint8Array;
    /** Reads disk text and records the path in the build dependency set. */
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
    /** Applies overlays and retained snapshots before falling back to disk stat. */
    stat(file: string): AssemblyFileStat;
    /** Returns immutable snapshot bytes, honoring overlays and the build byte budget. */
    readFile(file: string): Uint8Array;
    /** Decodes snapshot bytes using the same copy-on-read path as binary reads. */
    readTextFile(file: string, encoding?: BufferEncoding): string;
    /** Reject changed or removed saved inputs; copied overlays remain independent of the host disk. */
    assertUnchanged(): void;
}
/** Virtual lookup base. No host cwd fallback or filesystem access is used. */
export type MemoryAssemblyFileProviderOptions = {
    /** Default relative lookup root when no macro or current file anchor applies. */
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
     * @param filename Include path token, optionally quoted.
     * @param [options] Source and include directories in search order.
     * @returns First existing file identity, or undefined.
     */
    resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
    /** Reports virtual document presence and encoded byte length. */
    stat(filePath: string): AssemblyFileStat;
    /** Returns a copy of virtual file bytes, encoding strings as UTF-8. */
    readFile(filePath: string): Uint8Array;
    /** Returns stored string content or decodes binary virtual entries. */
    readTextFile(filePath: string, encoding?: BufferEncoding): string;
}
/**
 * Removes matching wrapping quotes from a user-supplied file path token.
 * @param filename The raw path token.
 * @returns The unwrapped path.
 */
export declare function stripWrappingQuotes(filename: string): string;
//# sourceMappingURL=file-provider.d.ts.map