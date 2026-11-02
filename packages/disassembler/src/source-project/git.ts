import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { acquireFileLease, type FileLease } from "../internal/durable-files.js";
import { sourceFilePublicationEpoch } from "./file-transaction.js";

export { assertSourcePath } from "../internal/source-inputs.js";

/** Repository and per-worktree state directories, resolved by Git rather than assuming .git is a directory. */
export interface SourceRepository {
  /** Git worktree root containing editable source files. */
  readonly root: string;
  /** Resolved `.git` directory for this worktree, including linked worktrees. */
  readonly gitDirectory: string;
  /** Private per-worktree state directory for leases, journals, and scratch data. */
  readonly stateDirectory: string;
}

/**
 * Coordinate ordinary source publication with existing native regeneration/merge operations.
 * The caller owns the lease and must release it in finally; a live process's lease is never stolen.
 */
export function acquireSourceOperationLease(repository: SourceRepository): FileLease {
  return acquireFileLease(path.join(repository.stateDirectory, "operation.lock"));
}

/** Raw Git output retains NUL delimiters and arbitrary binary blobs. */
export interface SourceGitResult {
  /** Process exit code after applying accepted-code filtering. */
  readonly code: number;
  /** Raw standard output bytes, including embedded NUL delimiters when requested. */
  readonly stdout: Buffer;
  /** Raw standard error bytes from the Git subprocess. */
  readonly stderr: Buffer;
}

/** A Git command failure carries diagnostics without treating a merge conflict as an exception. */
export class SourceGitError extends Error {
  constructor(
    readonly args: readonly string[],
    readonly result: SourceGitResult,
  ) {
    super(`git ${args[0]} failed (${result.code}): ${result.stderr.toString("utf8").trim()}`);
    this.name = "SourceGitError";
  }
}

/**
 * Execute Git without a shell or inherited repository overrides. Expected nonzero exits must be
 * listed explicitly; cancellation kills the subprocess and never attempts destructive recovery.
 */
export function sourceGit(
  root: string,
  args: readonly string[],
  options: {
    readonly input?: string | Uint8Array;
    readonly indexFile?: string;
    readonly signal?: AbortSignal;
    readonly acceptedCodes?: readonly number[];
    readonly maxOutputBytes?: number;
  } = {},
): Promise<SourceGitResult> {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" };
  for (const key of [
    "GIT_DIR",
    "GIT_COMMON_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  ]) {
    delete (env as NodeJS.ProcessEnv)[key];
  }
  if (options.indexFile) {
    (env as NodeJS.ProcessEnv).GIT_INDEX_FILE = options.indexFile;
  }
  return new Promise((resolve, reject) => {
    const child = spawn("git", [...args], {
      cwd: root,
      env,
      signal: options.signal,
      stdio: "pipe",
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let failure: Error | undefined;
    const collect = (chunks: Buffer[], chunk: Buffer): void => {
      bytes += chunk.length;
      if (bytes > (options.maxOutputBytes ?? 64 * 1024 * 1024)) {
        failure = new Error("Git output exceeded the operation's bounded output budget.");
        child.kill();
      } else {
        chunks.push(chunk);
      }
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.on("error", (error) => {
      failure = error;
    });
    // Git can reject arguments before reading stdin. Preserve its diagnostic instead of an EPIPE.
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
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
      } else {
        resolve(result);
      }
    });
    child.stdin.end(options.input);
  });
}

/** Resolve a non-bare repository, including linked worktrees and nested project repositories. */
export async function sourceRepository(directory: string): Promise<SourceRepository> {
  const results = await Promise.all([
    sourceGit(directory, ["rev-parse", "--show-toplevel"]),
    sourceGit(directory, ["rev-parse", "--absolute-git-dir"]),
  ]);
  // Separate responses preserve embedded newlines and trailing spaces in a legal repository path.
  const [root, gitDirectory] = results.map((result) =>
    result.stdout.toString("utf8").replace(/\n$/, ""),
  );
  if (!root || !gitDirectory || !path.isAbsolute(root) || !path.isAbsolute(gitDirectory)) {
    throw new Error("Source editing requires a non-bare Git working tree.");
  }
  return { root, gitDirectory, stateDirectory: path.join(gitDirectory, "uttori-source") };
}

/** NUL-delimited porcelain preserves filenames with spaces, tabs, and embedded newlines. */
export async function sourceStatus(repository: SourceRepository): Promise<Buffer> {
  sourceFilePublicationEpoch(repository);
  return (
    await sourceGit(repository.root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"])
  ).stdout;
}

/** Decode porcelain-v1 -z paths, including both sides of a rename/copy and all untracked files. */
export function sourceStatusPaths(status: Buffer): string[] {
  const entries = status.toString("utf8").split("\0");
  const files: string[] = [];
  for (let index = 0; index < entries.length && entries[index]; index += 1) {
    const entry = entries[index];
    files.push(entry.slice(3));
    // Porcelain -z places a rename/copy's original path in a separate record without status.
    if (/[CR]/.test(entry.slice(0, 2))) {
      files.push(entries[++index]);
    }
  }
  return files;
}

/** Reject concurrent Git operations before touching the index or worktree. */
export function assertNoSourceOperation(repository: SourceRepository): void {
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

/** Reuse clean HEAD as the abort point; only existing local edits require preservation before a merge. */
export async function assertSourceCheckpoint(repository: SourceRepository): Promise<string> {
  assertNoSourceOperation(repository);
  const status = await sourceStatus(repository);
  if (status.length) {
    const files = sourceStatusPaths(status);
    throw new Error(
      `Commit or move these existing source changes and untracked files before applying regeneration: ${files.map((file) => JSON.stringify(file)).join(", ")}. Preview remains available; a clean checkout uses its existing commit.`,
    );
  }
  return (await sourceGit(repository.root, ["rev-parse", "--verify", "HEAD"])).stdout
    .toString("utf8")
    .trim();
}

/** Constrain object selectors supplied by receipts so they cannot become Git options or path expressions. */
export function assertSourceObjectId(value: string): void {
  if (!/^(?:[\da-f]{40}|[\da-f]{64})$/.test(value)) {
    throw new Error("Expected a complete Git object ID.");
  }
}
