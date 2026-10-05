import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { acquireFileLease } from "../internal/durable-files.js";
import { sourceFilePublicationEpoch } from "./file-transaction.js";
export { assertSourcePath } from "../internal/source-inputs.js";
/** Coordinate ordinary source publication with existing native regeneration/merge operations.
 * The caller owns the lease and must release it in finally; a live process's lease is never stolen.
 */
export function acquireSourceOperationLease(repository) {
    return acquireFileLease(path.join(repository.stateDirectory, "operation.lock"));
}
/** A Git command failure carries diagnostics without treating a merge conflict as an exception. */
export class SourceGitError extends Error {
    args;
    result;
    constructor(args, result) {
        super(`git ${args[0]} failed (${result.code}): ${result.stderr.toString("utf8").trim()}`);
        this.args = args;
        this.result = result;
        this.name = "SourceGitError";
    }
}
/**
 * Execute Git without a shell or inherited repository overrides. Expected nonzero exits must be
 * listed explicitly; cancellation kills the subprocess and never attempts destructive recovery.
 */
export function sourceGit(root, args, options = {}) {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
    for (const key of [
        "GIT_DIR",
        "GIT_COMMON_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    ]) {
        delete env[key];
    }
    if (options.indexFile) {
        env.GIT_INDEX_FILE = options.indexFile;
    }
    return new Promise((resolve, reject) => {
        const child = spawn("git", [...args], {
            cwd: root,
            env,
            signal: options.signal,
            stdio: "pipe",
        });
        const stdout = [];
        const stderr = [];
        let bytes = 0;
        let failure;
        const collect = (chunks, chunk) => {
            bytes += chunk.length;
            if (bytes > (options.maxOutputBytes ?? 64 * 1024 * 1024)) {
                failure = new Error("Git output exceeded the operation's bounded output budget.");
                child.kill();
            }
            else {
                chunks.push(chunk);
            }
        };
        child.stdout.on("data", (chunk) => collect(stdout, chunk));
        child.stderr.on("data", (chunk) => collect(stderr, chunk));
        child.on("error", (error) => {
            failure = error;
        });
        // Git can reject arguments before reading stdin. Preserve its diagnostic instead of an EPIPE.
        child.stdin.on("error", (error) => {
            if (error.code !== "EPIPE") {
                failure = error;
            }
        });
        child.on("close", (code) => {
            if (failure) {
                reject(failure);
                return;
            }
            const result = {
                code: code ?? -1,
                stdout: Buffer.concat(stdout),
                stderr: Buffer.concat(stderr),
            };
            if (!(options.acceptedCodes ?? [0]).includes(result.code)) {
                reject(new SourceGitError(args, result));
            }
            else {
                resolve(result);
            }
        });
        child.stdin.end(options.input);
    });
}
/** Resolve a non-bare repository, including linked worktrees and nested project repositories. */
export async function sourceRepository(directory) {
    const results = await Promise.all([
        sourceGit(directory, ["rev-parse", "--show-toplevel"]),
        sourceGit(directory, ["rev-parse", "--absolute-git-dir"]),
    ]);
    // Separate responses preserve embedded newlines and trailing spaces in a legal repository path.
    const [root, gitDirectory] = results.map((result) => result.stdout.toString("utf8").replace(/\n$/, ""));
    if (!root || !gitDirectory || !path.isAbsolute(root) || !path.isAbsolute(gitDirectory)) {
        throw new Error("Source editing requires a non-bare Git working tree.");
    }
    return { root, gitDirectory, stateDirectory: path.join(gitDirectory, "uttori-source") };
}
/** NUL-delimited porcelain preserves filenames with spaces, tabs, and embedded newlines. */
export async function sourceStatus(repository) {
    sourceFilePublicationEpoch(repository);
    return (await sourceGit(repository.root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"])).stdout;
}
/** Reject concurrent Git operations before touching the index or worktree. */
export function assertNoSourceOperation(repository) {
    sourceFilePublicationEpoch(repository);
    for (const name of [
        "MERGE_HEAD",
        "CHERRY_PICK_HEAD",
        "REVERT_HEAD",
        "rebase-merge",
        "rebase-apply",
        "sequencer",
    ]) {
        if (fs.existsSync(path.join(repository.gitDirectory, name))) {
            throw new Error(`Finish or abort the current Git operation (${name}) before regeneration.`);
        }
    }
}
/** A checkpoint protects native merge abort semantics. Ignored private evidence remains outside Git. */
export async function assertSourceCheckpoint(repository) {
    assertNoSourceOperation(repository);
    if ((await sourceStatus(repository)).length) {
        throw new Error("Commit or move the source changes and untracked files before applying regeneration. Preview remains available.");
    }
    return (await sourceGit(repository.root, ["rev-parse", "--verify", "HEAD"])).stdout
        .toString("utf8")
        .trim();
}
/** Constrain object selectors supplied by receipts so they cannot become Git options or path expressions. */
export function assertSourceObjectId(value) {
    if (!/^(?:[\da-f]{40}|[\da-f]{64})$/.test(value)) {
        throw new Error("Expected a complete Git object ID.");
    }
}
//# sourceMappingURL=git.js.map