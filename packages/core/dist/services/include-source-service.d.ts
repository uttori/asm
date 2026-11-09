import type { AssemblyFileProvider } from "../file-provider.js";
import type { ExecutableNode } from "../ir/assembly-tree.js";
import type { ProgramModelBuilder } from "./program-model-builder.js";
/** Per-path include-once and guarded-include state tracked across the build. */
export interface IncludedFileInfo {
    /** Whether the file has been included. */
    included: boolean;
    /** Whether the file has been guarded with `includeonce`. */
    guarded: boolean;
}
/** Session services required to resolve, cache, and execute included sources. */
export interface IncludeSourceHost {
    /** Active file path while processing include directives. */
    currentFile: string;
    /** Macro expansion site used as an include search anchor when set. */
    readonly currentMacroSourceFile: string | undefined;
    /** Search paths consulted after macro and current file directories. */
    includePaths: string[];
    /** Stack of files entered through nested includes. */
    includeStack: string[];
    /** Include-once metadata keyed by resolved absolute paths. */
    includedFiles: Map<string, IncludedFileInfo>;
    /** File resolver and reader backing include path resolution. */
    fileProvider: AssemblyFileProvider;
    /** Builder producing executable nodes from included source text. */
    readonly programModelBuilder: ProgramModelBuilder;
    /** Lowers and executes nodes parsed from an included translation unit. */
    lowerAndExecuteRuntimeNodes(nodes: ExecutableNode[]): void;
    /** Records a directed include edge for dependency graphs. */
    recordIncludeEdge(fromFile: string, toFile: string): void;
    /** Scope include ownership without attaching caller state to cached file syntax. */
    withIncludeSource?(file: string, execute: () => void, fromFile: string): void;
    /** Final-pass hosts record which raw input bytes reach output for orphaned-edit validation. */
    recordBinarySlice?(file: string, start: number, end: number, bytes: Uint8Array): void;
    /** When false, include directives record an edge without parsing the target. */
    readonly followIncludes: boolean;
}
/**
 * Owns source and binary include resolution and source execution orchestration.
 */
export declare class IncludeSourceService {
    readonly host: IncludeSourceHost;
    /** Memoized include resolution keyed by active file, paths, and requested path. */
    readonly resolvedPathCache: Map<string, string>;
    /** Memoized text reads keyed by encoding and resolved path. */
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
     * @param filePath The path to read.
     * @param [encoding] Optional text encoding.
     * @returns The file contents.
     */
    readFile(filePath: string, encoding?: BufferEncoding): Uint8Array | string;
    /** Resolve the same include path used to read bytes, then attribute its exact consumed slice. */
    recordBinarySlice(filename: string, start: number, end: number, bytes: Uint8Array): void;
    /**
     * Resolves a source include target.
     * @param filename The target filename.
     * @returns The resolved provider path.
     */
    resolveIncludePath(filename: string | null | undefined): string;
    /**
     * Marks and assembles an `include` target.
     * @param filename The target filename.
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
     * @param filename The target filename.
     */
    assembleFile(filename: string): void;
    /** Snapshot of host path context used for include resolution cache keys. */
    get resolutionOptions(): {
        currentFile: string;
        includePaths: string[];
        macroSourceFile: string | undefined;
    };
    /**
     * Resolves a path once for the active source and include-path context.
     * @param filePath The source-relative path to resolve.
     * @returns The resolved provider path.
     */
    resolvePath(filePath: string): string | undefined;
    /**
     * Reads source text once per assembly snapshot.
     * @param resolvedPath The resolved provider path.
     * @param encoding The requested text encoding.
     * @returns The cached or newly read text.
     */
    readTextFile(resolvedPath: string, encoding: BufferEncoding): string;
}
//# sourceMappingURL=include-source-service.d.ts.map