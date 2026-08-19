export type AssemblyFileResolutionOptions = {
    currentFile?: string;
    includePaths?: string[];
    macroSourceFile?: string;
};
export type AssemblyFileStat = {
    exists: boolean;
    readable: boolean;
    size?: number;
};
/**
 * Abstracts file resolution and reads so tooling callers can provide in-memory
 * documents instead of depending on the host filesystem directly.
 */
export interface AssemblyFileProvider {
    resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
    stat(filePath: string): AssemblyFileStat;
    readFile(filePath: string): Uint8Array;
    readTextFile(filePath: string, encoding?: BufferEncoding): string;
}
/**
 * Default Node.js-backed file provider used by the assembler runtime.
 */
export declare class NodeAssemblyFileProvider implements AssemblyFileProvider {
    /**
     * Resolves path.
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
export type MemoryAssemblyFileProviderOptions = {
    workingDirectory?: string;
};
/**
 * In-memory file provider intended for editor workflows and virtual documents.
 */
export declare class MemoryAssemblyFileProvider implements AssemblyFileProvider {
    readonly options: MemoryAssemblyFileProviderOptions;
    readonly files: Map<string, string | Uint8Array>;
    constructor(files?: Map<string, string | Uint8Array> | Record<string, string | Uint8Array>, options?: MemoryAssemblyFileProviderOptions);
    /**
     * Resolves path.
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
 * Creates the default filesystem-backed provider.
 * @returns {AssemblyFileProvider} The Node.js provider instance.
 */
export declare function createNodeAssemblyFileProvider(): AssemblyFileProvider;
/**
 * Creates a memory-backed provider for virtual / unsaved editor documents.
 * @param {Map<string, string | Uint8Array> | Record<string, string | Uint8Array>} files The virtual file contents.
 * @param {MemoryAssemblyFileProviderOptions} [options] Resolution options for relative paths.
 * @returns {AssemblyFileProvider} The memory-backed provider instance.
 */
export declare function createMemoryAssemblyFileProvider(files: Map<string, string | Uint8Array> | Record<string, string | Uint8Array>, options?: MemoryAssemblyFileProviderOptions): AssemblyFileProvider;
//# sourceMappingURL=file-provider.d.ts.map