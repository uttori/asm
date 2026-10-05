import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { acquireFileLease, durableReplace, syncDirectory } from "../internal/durable-files.js";
import { sourceContentHash, assertSourcePath } from "../internal/source-inputs.js";
import type { SourceRepository } from "./git.js";

/** One ordinary source replacement. Paths are project-relative and before/after buffers are borrowed until staging finishes. */
export interface SourceFileReplacement {
  readonly path: string;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
}

/** Durable states survive termination between individual file renames; external readers are not globally atomic. */
export interface SourceFileTransaction {
  readonly format: "uttori-source-file-transaction";
  readonly version: 1;
  readonly id: string;
  readonly state: "staged" | "publishing" | "completed" | "recovery";
  readonly direction: "after" | "before";
  readonly files: readonly {
    readonly path: string;
    readonly before: string;
    readonly after: string;
  }[];
}

const JOURNAL = "file-publication.json";
const MAX_BYTES = 512 * 1024 * 1024;

/** Component checks protect ordinary replacements from symlink/traversal redirection. */
function sourceFile(repository: SourceRepository, name: string): string {
  assertSourcePath(name);
  let file = repository.root;
  const parts = name.split("/");
  for (let i = 0; i < parts.length; i++) {
    file = path.join(file, parts[i]);
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || (i === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) {
      throw new Error(`Source transaction requires regular in-project paths: ${name}.`);
    }
  }
  return file;
}

/** Recovery lives in the existing private Git worktree state directory, separate from source history. */
function journalFile(repository: SourceRepository): string {
  storageDirectories(repository);
  return path.join(repository.stateDirectory, JOURNAL);
}
function stageDirectory(repository: SourceRepository, id: string): string {
  storageDirectories(repository, ["file-transactions", id]);
  return path.join(repository.stateDirectory, "file-transactions", id);
}

/** Private recovery paths must not be redirected by symlinks placed beneath Git's resolved worktree directory. */
function storageDirectories(repository: SourceRepository, suffix: readonly string[] = []): void {
  const relative = path.relative(repository.gitDirectory, repository.stateDirectory);
  if (relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error("Invalid source publication state directory.");
  }
  let current = repository.gitDirectory;
  for (const part of ["", ...relative.split(path.sep), ...suffix]) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) {
      return;
    }
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("Invalid source publication staging directory.");
    }
  }
}

/** Treat a corrupt private journal as a recovery issue, never unchecked trusted JSON. */
export function readSourceFileTransaction(
  repository: SourceRepository,
): SourceFileTransaction | undefined {
  const file = journalFile(repository);
  if (!fs.existsSync(file)) {
    return undefined;
  }
  if (fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size > 4 * 1024 * 1024) {
    throw new Error("Invalid source publication journal.");
  }
  const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid source publication journal.");
  }
  if (
    !("format" in value) ||
    value.format !== "uttori-source-file-transaction" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !/^[\da-f-]{36}$/.test(value.id) ||
    !("state" in value) ||
    (value.state !== "staged" &&
      value.state !== "publishing" &&
      value.state !== "completed" &&
      value.state !== "recovery") ||
    !("direction" in value) ||
    (value.direction !== "before" && value.direction !== "after") ||
    !("files" in value) ||
    !Array.isArray(value.files) ||
    value.files.length > 65536
  ) {
    throw new Error("Unsupported or corrupt source publication journal.");
  }
  const files: SourceFileTransaction["files"][number][] = [],
    seen = new Set<string>();
  const entries: readonly unknown[] = value.files;
  for (const item of entries) {
    if (
      !item ||
      typeof item !== "object" ||
      !("path" in item) ||
      typeof item.path !== "string" ||
      !("before" in item) ||
      typeof item.before !== "string" ||
      !/^[\da-f]{64}$/.test(item.before) ||
      !("after" in item) ||
      typeof item.after !== "string" ||
      !/^[\da-f]{64}$/.test(item.after) ||
      seen.has(item.path)
    ) {
      throw new Error("Invalid source publication entry.");
    }
    assertSourcePath(item.path);
    seen.add(item.path);
    files.push({ path: item.path, before: item.before, after: item.after });
  }
  return {
    format: value.format,
    version: value.version,
    id: value.id,
    state: value.state,
    direction: value.direction,
    files,
  };
}

/** Ordinary source readers refuse mixed publication; the epoch also detects a publication completed during a read. */
export function sourceFilePublicationEpoch(repository: SourceRepository): string {
  const journal = readSourceFileTransaction(repository);
  if (journal && journal.state !== "completed") {
    throw new Error(
      `Source publication ${journal.id} requires recovery before another source operation.`,
    );
  }
  return journal ? sourceContentHash(JSON.stringify(journal)) : "none";
}

/** Publish a durable state after its staging files already exist and have been flushed. */
function save(repository: SourceRepository, journal: SourceFileTransaction): void {
  const bytes = JSON.stringify(journal);
  if (Buffer.byteLength(bytes) > 4 * 1024 * 1024 - 64) {
    throw new Error("Source publication journal exceeds metadata budget.");
  }
  durableReplace(journalFile(repository), bytes, 0o600);
}

/** Preflight every target before a recovery writes anything; a third party's new bytes always win. */
function currentFiles(repository: SourceRepository, journal: SourceFileTransaction): string[] {
  return journal.files.map((item) => {
    const file = sourceFile(repository, item.path),
      hash = sourceContentHash(fs.readFileSync(file));
    if (hash !== item.before && hash !== item.after) {
      throw new Error(`Source publication recovery found third-party bytes: ${item.path}.`);
    }
    return file;
  });
}

/** Verify staged bytes independently of the journal before selecting a replacement. */
function stagedBytes(
  repository: SourceRepository,
  journal: SourceFileTransaction,
  index: number,
  direction: "before" | "after",
): Uint8Array {
  const file = path.join(stageDirectory(repository, journal.id), `${index}-${direction}`),
    stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) {
    throw new Error("Invalid source publication staging file.");
  }
  const bytes = fs.readFileSync(file);
  if (sourceContentHash(bytes) !== journal.files[index][direction]) {
    throw new Error("Source publication staging hash mismatch.");
  }
  return bytes;
}

/** Replace files one at a time under the operation lease. Each rename is durable; the journal coordinates readers. */
function publish(
  repository: SourceRepository,
  journal: SourceFileTransaction,
  signal?: AbortSignal,
  onStage?: (stage: string) => void,
): SourceFileTransaction {
  const files = currentFiles(repository, journal);
  // Verify all recovery payloads before the first replacement so local corruption cannot cause partial recovery.
  for (let i = 0; i < files.length; i++) {
    stagedBytes(repository, journal, i, journal.direction);
  }
  let current: SourceFileTransaction = { ...journal, state: "publishing" };
  save(repository, current);
  onStage?.("publishing");
  try {
    for (let i = 0; i < files.length; i++) {
      signal?.throwIfAborted();
      const item = journal.files[i],
        file = sourceFile(repository, item.path),
        hash = sourceContentHash(fs.readFileSync(file));
      if (hash !== item.before && hash !== item.after) {
        throw new Error(`Source changed during publication: ${item.path}.`);
      }
      if (hash !== item[journal.direction]) {
        durableReplace(
          file,
          stagedBytes(repository, journal, i, journal.direction),
          fs.statSync(file).mode & 0o777,
        );
      }
      onStage?.(`published:${i}`);
    }
    current = { ...current, state: "completed" };
    save(repository, current);
  } catch (cause) {
    save(repository, { ...current, state: "recovery" });
    throw new Error(
      `Source publication ${journal.id} interrupted; recover before reading source.`,
      { cause },
    );
  }
  // Notification failures after the completion receipt cannot turn published files back into unresolved recovery.
  onStage?.("completed");
  return current;
}

/**
 * Stage complete before/after files, then publish with the same lease used by native Git
 * integration. No-op calls create no files. Cancellation before staging visibility removes
 * only this invocation's private staging directory; later interruption leaves recovery data.
 */
export function applySourceFileTransaction(
  repository: SourceRepository,
  replacements: readonly SourceFileReplacement[],
  options: {
    readonly signal?: AbortSignal;
    readonly onStage?: (stage: string) => void;
    /** Recheck dependencies and editor versions while holding the project operation lease. */
    readonly validate?: () => void;
  } = {},
): SourceFileTransaction | undefined {
  options.signal?.throwIfAborted();
  sourceFilePublicationEpoch(repository);
  if (replacements.length > 65536) {
    throw new Error("Too many source replacements.");
  }
  const changes = replacements.filter(
    (item) => sourceContentHash(item.before) !== sourceContentHash(item.after),
  );
  // A no-op still checks freshness, but must not create a lease directory or alter source mtimes.
  if (!changes.length) {
    options.validate?.();
    const seen = new Set<string>();
    for (const item of replacements) {
      if (
        seen.has(item.path) ||
        sourceContentHash(fs.readFileSync(sourceFile(repository, item.path))) !==
          sourceContentHash(item.before)
      ) {
        throw new Error(`Stale or duplicate source replacement: ${item.path}.`);
      }
      seen.add(item.path);
    }
    return undefined;
  }
  const lease = acquireFileLease(path.join(repository.stateDirectory, "operation.lock"));
  const id = randomUUID(),
    directory = stageDirectory(repository, id);
  let visible = false;
  try {
    sourceFilePublicationEpoch(repository);
    options.validate?.();
    const seen = new Set<string>();
    let bytes = 0;
    for (const item of replacements) {
      bytes += item.before.length + item.after.length;
      if (bytes > MAX_BYTES || seen.has(item.path)) {
        throw new Error("Source transaction payload or identity limit.");
      }
      seen.add(item.path);
      if (
        sourceContentHash(fs.readFileSync(sourceFile(repository, item.path))) !==
        sourceContentHash(item.before)
      ) {
        throw new Error(`Stale source replacement: ${item.path}.`);
      }
    }
    fs.mkdirSync(directory, { recursive: true });
    changes.forEach((item, index) => {
      options.signal?.throwIfAborted();
      durableReplace(path.join(directory, `${index}-before`), item.before, 0o600);
      durableReplace(path.join(directory, `${index}-after`), item.after, 0o600);
    });
    syncDirectory(path.dirname(directory));
    options.signal?.throwIfAborted();
    const journal: SourceFileTransaction = {
      format: "uttori-source-file-transaction",
      version: 1,
      id,
      state: "staged",
      direction: "after",
      files: changes.map((item) => ({
        path: item.path,
        before: sourceContentHash(item.before),
        after: sourceContentHash(item.after),
      })),
    };
    save(repository, journal);
    visible = true;
    options.onStage?.("staged");
    return publish(repository, journal, options.signal, options.onStage);
  } finally {
    if (!visible) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
    lease.release();
  }
}

/** Explicit recovery completes or rolls back known bytes. It never overwrites an unknown external replacement. */
export function recoverSourceFileTransaction(
  repository: SourceRepository,
  direction: "before" | "after",
  options: {
    readonly signal?: AbortSignal;
    readonly onStage?: (stage: string) => void;
    /** Revalidate a host's journal snapshot under the operation lock, after asynchronous editor checks. */
    readonly validate?: (journal: SourceFileTransaction) => void;
  } = {},
): SourceFileTransaction | undefined {
  if (direction !== "before" && direction !== "after") {
    throw new Error("Invalid source recovery direction.");
  }
  const lease = acquireFileLease(path.join(repository.stateDirectory, "operation.lock"));
  try {
    const journal = readSourceFileTransaction(repository);
    if (!journal || journal.state === "completed") {
      return journal;
    }
    options.signal?.throwIfAborted();
    options.validate?.(journal);
    return publish(repository, { ...journal, direction }, options.signal, options.onStage);
  } finally {
    lease.release();
  }
}
