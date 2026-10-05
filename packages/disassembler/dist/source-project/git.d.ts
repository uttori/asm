import { type FileLease } from "../internal/durable-files.js";
export { assertSourcePath } from "../internal/source-inputs.js";
/** Repository and per-worktree state directories, resolved by Git rather than assuming .git is a directory. */
export interface SourceRepository {
    readonly root: string;
    readonly gitDirectory: string;
    readonly stateDirectory: string;
}
/** Coordinate ordinary source publication with existing native regeneration/merge operations.
 * The caller owns the lease and must release it in finally; a live process's lease is never stolen.
 */
export declare function acquireSourceOperationLease(repository: SourceRepository): FileLease;
/** Raw Git output retains NUL delimiters and arbitrary binary blobs. */
export interface SourceGitResult {
    readonly code: number;
    readonly stdout: Buffer;
    readonly stderr: Buffer;
}
/** A Git command failure carries diagnostics without treating a merge conflict as an exception. */
export declare class SourceGitError extends Error {
    readonly args: readonly string[];
    readonly result: SourceGitResult;
    constructor(args: readonly string[], result: SourceGitResult);
}
/**
 * Execute Git without a shell or inherited repository overrides. Expected nonzero exits must be
 * listed explicitly; cancellation kills the subprocess and never attempts destructive recovery.
 */
export declare function sourceGit(root: string, args: readonly string[], options?: {
    readonly input?: string | Uint8Array;
    readonly indexFile?: string;
    readonly signal?: AbortSignal;
    readonly acceptedCodes?: readonly number[];
    readonly maxOutputBytes?: number;
}): Promise<SourceGitResult>;
/** Resolve a non-bare repository, including linked worktrees and nested project repositories. */
export declare function sourceRepository(directory: string): Promise<SourceRepository>;
/** NUL-delimited porcelain preserves filenames with spaces, tabs, and embedded newlines. */
export declare function sourceStatus(repository: SourceRepository): Promise<Buffer>;
/** Reject concurrent Git operations before touching the index or worktree. */
export declare function assertNoSourceOperation(repository: SourceRepository): void;
/** A checkpoint protects native merge abort semantics. Ignored private evidence remains outside Git. */
export declare function assertSourceCheckpoint(repository: SourceRepository): Promise<string>;
/** Constrain object selectors supplied by receipts so they cannot become Git options or path expressions. */
export declare function assertSourceObjectId(value: string): void;
//# sourceMappingURL=git.d.ts.map