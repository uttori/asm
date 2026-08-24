import type { AssemblyFileProvider } from "../file-provider.js";
import type { ExecutableNode } from "../ir/assembly-tree.js";
import type { ProgramModelBuilder } from "./program-model-builder.js";
export interface IncludedFileInfo {
    /** Whether the file has been included. */
    included: boolean;
    /** Whether the file has been guarded with `includeonce`. */
    guarded: boolean;
}
export interface IncludeSourceHost {
    currentFile: string;
    readonly currentMacroSourceFile: string | undefined;
    includePaths: string[];
    includeStack: string[];
    includedFiles: Map<string, IncludedFileInfo>;
    fileProvider: AssemblyFileProvider;
    readonly programModelBuilder: ProgramModelBuilder;
    lowerAndExecuteRuntimeNodes(nodes: ExecutableNode[]): void;
    recordIncludeEdge(fromFile: string, toFile: string): void;
}
/**
 * Owns source and binary include resolution and source execution orchestration.
 */
export declare class IncludeSourceService {
    readonly host: IncludeSourceHost;
    readonly resolvedPathCache: Map<string, string>;
    readonly textCache: Map<string, string>;
    constructor(host: IncludeSourceHost);
    /**
     * Starts a new assembly file snapshot and drops content retained by an older build.
     */
    beginAssemblySnapshot(): void;
    /**
     * Releases source text retained for the completed assembly.
     */
    endAssemblySnapshot(): void;
    /**
     * Reads a source-relative binary or text file.
     * @param {string} filePath The path to read.
     * @param {BufferEncoding} [encoding] Optional text encoding.
     * @returns {Uint8Array | string} The file contents.
     */
    readFile(filePath: string, encoding?: BufferEncoding): Uint8Array | string;
    /**
     * Resolves a source include target.
     * @param {string} filename The target filename.
     * @returns {string} The resolved provider path.
     */
    resolveIncludePath(filename: string): string;
    /**
     * Marks and assembles an `include` target.
     * @param {string} filename The target filename.
     */
    includeFile(filename: string): void;
    /**
     * Guards the active source file against later includes in this pass.
     */
    guardCurrentFile(): void;
    /**
     * Clears pass-local include guards.
     */
    resetGuards(): void;
    /**
     * Resolves, parses, lowers, and executes one source file.
     * @param {string} filename The target filename.
     */
    assembleFile(filename: string): void;
    get resolutionOptions(): {
        currentFile: string;
        includePaths: string[];
        macroSourceFile: string | undefined;
    };
    /**
     * Resolves a path once for the active source and include-path context.
     * @param {string} filePath The source-relative path to resolve.
     * @returns {string | undefined} The resolved provider path.
     */
    resolvePath(filePath: string): string | undefined;
    /**
     * Reads source text once per assembly snapshot.
     * @param {string} resolvedPath The resolved provider path.
     * @param {BufferEncoding} encoding The requested text encoding.
     * @returns {string} The cached or newly read text.
     */
    readTextFile(resolvedPath: string, encoding: BufferEncoding): string;
}
//# sourceMappingURL=include-source-service.d.ts.map