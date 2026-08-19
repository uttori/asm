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
    constructor(host: IncludeSourceHost);
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
    private get resolutionOptions();
}
//# sourceMappingURL=include-source-service.d.ts.map