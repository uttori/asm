import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";
import { validateObjectArrayFile } from "./json-array-file.js";

import {
  ANALYSIS_PROJECT_MANIFEST,
  type AnalysisProject,
  type AnalysisProjectManifest,
  type ProjectShardDescriptor,
  type ShardKind,
} from "./project-types.js";
import {
  canonicalJson,
  loadAnalysisProject,
  migrateManifest,
  type LoadedAnalysisProject,
  validateAnalysisProjectManifest,
  writeAnalysisProject,
} from "./project-store.js";

/** Format marker for optimistic project revisions passed between readers and writers. */
export const ANALYSIS_PROJECT_REVISION_FORMAT = "uttori-asm-analysis-revision";
/** Current optimistic revision contract. */
export const ANALYSIS_PROJECT_REVISION_VERSION = 1;
/** Cooperative lock directory used by project-editing processes. */
export const ANALYSIS_PROJECT_LOCK_DIRECTORY = ".uttori-asm-analysis.lock";
/** Default age after which a lock owned by a dead process may be recovered. */
export const DEFAULT_ANALYSIS_PROJECT_LOCK_STALE_MS = 5 * 60 * 1_000;

const TRANSACTIONS_DIRECTORY = "analysis/.transactions";
const GENERATIONS_DIRECTORY = "analysis/generations";
const LOCK_OWNER_FILE = "owner.json";
const MAX_SNAPSHOT_ATTEMPTS = 3;
const REQUIRED_SHARD_KINDS: readonly ShardKind[] = [
  "analysis",
  "annotations",
  "labels",
  "comments",
  "regions",
  "runtime",
  "evidence",
  "imports",
];

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

/**
 * Hashes a file through a fixed-size reusable buffer.
 *
 * Transaction revision checks need the persisted identity, not the shard's parsed records. Reading
 * a multi-megabyte shard as UTF-8 solely to hash it creates another project-sized string. Streaming
 * keeps additional memory bounded while producing the same SHA-256 used by the manifest.
 * @param {string} filePath File whose exact bytes are hashed.
 * @returns {string} Lowercase SHA-256 of the complete file.
 */
const sha256File = (filePath: string): string => {
  const hash = createHash("sha256");
  // One buffer is reused for the complete file. The size balances syscall count against retained
  // memory and is intentionally independent of shard size.
  const buffer = Buffer.allocUnsafe(64 * 1_024);
  const descriptor = fs.openSync(filePath, "r");
  try {
    let bytesRead = 0;
    while ((bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
};

const isNodeError = (error: unknown, code: string): boolean =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;

const tokensEqual = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};

/** One shard identity included in an observed project revision. */
export interface AnalysisProjectShardRevision {
  readonly id: string;
  readonly kind: ShardKind;
  readonly path: string;
  readonly sha256: string;
  readonly records: number;
}

/**
 * Optimistic-concurrency token for one fully validated project snapshot.
 * The manifest hash detects every descriptor change; shard identities remain explicit for auditing.
 */
export interface AnalysisProjectRevision {
  readonly format: typeof ANALYSIS_PROJECT_REVISION_FORMAT;
  readonly version: typeof ANALYSIS_PROJECT_REVISION_VERSION;
  readonly manifestSha256: string;
  readonly shards: readonly AnalysisProjectShardRevision[];
}

/** A validated project and the exact manifest/shard revision observed while loading it. */
export interface AnalysisProjectSnapshot extends LoadedAnalysisProject {
  readonly revision: AnalysisProjectRevision;
}

/** Immutable shard generation prepared without changing the active project manifest. */
export interface PreparedAnalysisProjectTransaction {
  readonly format: "uttori-asm-analysis-transaction";
  readonly version: 1;
  readonly generation: string;
  readonly manifest: AnalysisProjectManifest;
}

/** Result of atomically publishing a prepared transaction. */
export interface CommittedAnalysisProjectTransaction {
  readonly manifest: AnalysisProjectManifest;
  readonly revision: AnalysisProjectRevision;
}

/** Lock tuning and deterministic seams used by hosts and crash-safety tests. */
export interface AnalysisProjectLockOptions {
  readonly staleLockMilliseconds?: number;
  readonly recoveryAttempts?: number;
  readonly now?: () => number;
  readonly processIsAlive?: (processId: number) => boolean;
}

/** A cooperative writer already owns the project lock. */
export class AnalysisProjectLockedError extends Error {
  readonly ownerProcessId?: number;

  constructor(directory: string, ownerProcessId?: number) {
    super(
      ownerProcessId === undefined
        ? `Analysis project '${directory}' is locked by another writer.`
        : `Analysis project '${directory}' is locked by process ${ownerProcessId}.`,
    );
    this.name = "AnalysisProjectLockedError";
    this.ownerProcessId = ownerProcessId;
  }
}

/** The active manifest changed after a caller loaded its project snapshot. */
export class AnalysisProjectStaleError extends Error {
  readonly expected: AnalysisProjectRevision;
  readonly actual: AnalysisProjectRevision;

  constructor(expected: AnalysisProjectRevision, actual: AnalysisProjectRevision) {
    super(
      `Analysis project changed since it was loaded (expected ${expected.manifestSha256}, found ${actual.manifestSha256}).`,
    );
    this.name = "AnalysisProjectStaleError";
    this.expected = expected;
    this.actual = actual;
  }
}

interface LockOwner {
  readonly format: "uttori-asm-analysis-lock";
  readonly version: 1;
  readonly token: string;
  readonly processId: number;
  readonly createdAtMilliseconds: number;
}

interface ProjectLock {
  readonly release: () => void;
}

const revisionFor = (
  manifestText: string,
  manifest: AnalysisProjectManifest,
): AnalysisProjectRevision => ({
  format: ANALYSIS_PROJECT_REVISION_FORMAT,
  version: ANALYSIS_PROJECT_REVISION_VERSION,
  manifestSha256: sha256(manifestText),
  shards: manifest.shards
    .map(({ id, kind, path: shardPath, sha256: shardHash, records }) => ({
      id,
      kind,
      path: shardPath,
      sha256: shardHash,
      records,
    }))
    .sort((left, right) => left.id.localeCompare(right.id)),
});

const revisionsEqual = (left: AnalysisProjectRevision, right: AnalysisProjectRevision): boolean =>
  canonicalJson(left) === canonicalJson(right);

const defaultProcessIsAlive = (processId: number): boolean => {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    if (isNodeError(error, "ESRCH")) return false;
    return true;
  }
};

const readLockOwner = (lockDirectory: string): LockOwner | undefined => {
  try {
    const text = fs.readFileSync(path.join(lockDirectory, LOCK_OWNER_FILE), "utf8");
    if (text.length > 4_096) return undefined;
    const value = JSON.parse(text) as Partial<LockOwner>;
    if (
      value.format !== "uttori-asm-analysis-lock" ||
      value.version !== 1 ||
      typeof value.token !== "string" ||
      value.token === "" ||
      !Number.isSafeInteger(value.processId) ||
      value.processId! <= 0 ||
      !Number.isSafeInteger(value.createdAtMilliseconds) ||
      value.createdAtMilliseconds! < 0
    ) {
      return undefined;
    }
    return value as LockOwner;
  } catch {
    return undefined;
  }
};

const syncPath = (filePath: string): void => {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(filePath, "r");
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (
      !isNodeError(error, "EINVAL") &&
      !isNodeError(error, "ENOTSUP") &&
      !isNodeError(error, "EISDIR") &&
      !isNodeError(error, "EPERM")
    ) {
      throw error;
    }
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
};

const acquireProjectLock = (
  directory: string,
  options: AnalysisProjectLockOptions,
): ProjectLock => {
  const staleLockMilliseconds =
    options.staleLockMilliseconds ?? DEFAULT_ANALYSIS_PROJECT_LOCK_STALE_MS;
  const recoveryAttempts = options.recoveryAttempts ?? 3;
  if (!Number.isSafeInteger(staleLockMilliseconds) || staleLockMilliseconds < 0) {
    throw new Error("staleLockMilliseconds must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(recoveryAttempts) || recoveryAttempts < 1 || recoveryAttempts > 16) {
    throw new Error("recoveryAttempts must be an integer from 1 through 16.");
  }
  const now = options.now ?? Date.now;
  const processIsAlive = options.processIsAlive ?? defaultProcessIsAlive;
  const lockDirectory = path.join(directory, ANALYSIS_PROJECT_LOCK_DIRECTORY);
  const token = randomUUID();
  fs.mkdirSync(directory, { recursive: true });

  for (let attempt = 0; attempt < recoveryAttempts; attempt++) {
    try {
      fs.mkdirSync(lockDirectory);
      const owner: LockOwner = {
        format: "uttori-asm-analysis-lock",
        version: 1,
        token,
        processId: process.pid,
        createdAtMilliseconds: now(),
      };
      try {
        const ownerPath = path.join(lockDirectory, LOCK_OWNER_FILE);
        fs.writeFileSync(ownerPath, canonicalJson(owner), { flag: "wx", mode: 0o600 });
        syncPath(ownerPath);
        syncPath(lockDirectory);
      } catch (error) {
        fs.rmSync(lockDirectory, { recursive: true, force: true });
        throw error;
      }
      return {
        release: () => {
          const activeOwner = readLockOwner(lockDirectory);
          if (activeOwner && tokensEqual(activeOwner.token, token)) {
            fs.rmSync(lockDirectory, { recursive: true, force: true });
          }
        },
      };
    } catch (error) {
      if (!isNodeError(error, "EEXIST")) throw error;
    }

    const owner = readLockOwner(lockDirectory);
    let createdAtMilliseconds = owner?.createdAtMilliseconds;
    if (createdAtMilliseconds === undefined) {
      try {
        createdAtMilliseconds = Math.floor(fs.statSync(lockDirectory).mtimeMs);
      } catch (error) {
        if (isNodeError(error, "ENOENT")) continue;
        throw error;
      }
    }
    const age = Math.max(0, now() - createdAtMilliseconds);
    if (age <= staleLockMilliseconds || (owner !== undefined && processIsAlive(owner.processId))) {
      throw new AnalysisProjectLockedError(directory, owner?.processId);
    }

    const quarantined = `${lockDirectory}.stale-${token}`;
    try {
      fs.renameSync(lockDirectory, quarantined);
      fs.rmSync(quarantined, { recursive: true, force: true });
    } catch (error) {
      if (isNodeError(error, "ENOENT") || isNodeError(error, "EEXIST")) continue;
      throw error;
    }
  }
  throw new AnalysisProjectLockedError(directory, readLockOwner(lockDirectory)?.processId);
};

/**
 * Fully validates prepared shard bytes before any writer lock is acquired.
 *
 * This parse and record-count check is intentionally retained even though it is expensive: callers
 * can construct a forged `PreparedAnalysisProjectTransaction` object without using `prepare...()`.
 * Later checks may stream hashes, but they must not replace this one semantic validation.
 * @param {string} directory Analysis-project root.
 * @param {readonly ProjectShardDescriptor[]} descriptors Prepared generation descriptors.
 * @returns {void}
 */
const verifyPreparedShards = (
  directory: string,
  descriptors: readonly ProjectShardDescriptor[],
): void => {
  for (const descriptor of descriptors) {
    const shardPath = path.join(directory, descriptor.path);
    // Keep the full syntax/hash/count gate without creating a shard-sized string or object array.
    // A successful earlier import can produce control-flow shards larger than V8's string limit.
    const records = validateObjectArrayFile(shardPath, descriptor.sha256);
    if (records !== descriptor.records) {
      throw new Error(`Prepared analysis shard '${descriptor.path}' has the wrong record count.`);
    }
  }
};

/**
 * Verifies persisted shard identities without parsing or retaining their JSON records.
 *
 * Use only when semantic validation has already happened (a project passed `writeAnalysisProject`
 * or prepared shards passed `verifyPreparedShards`). This helper exists to make pre-publication and
 * optimistic-revision rechecks allocation-bounded; it is not a substitute for the first parse of
 * untrusted records.
 * @param {string} directory Analysis-project root.
 * @param {readonly ProjectShardDescriptor[]} descriptors Expected on-disk shard identities.
 * @returns {void}
 */
const verifyPreparedShardHashes = (
  directory: string,
  descriptors: readonly ProjectShardDescriptor[],
): void => {
  for (const descriptor of descriptors) {
    if (sha256File(path.join(directory, descriptor.path)) !== descriptor.sha256) {
      throw new Error(`Prepared analysis shard '${descriptor.path}' does not match its SHA-256.`);
    }
  }
};

const validatePreparedTransaction = (prepared: PreparedAnalysisProjectTransaction): void => {
  if (
    prepared.format !== "uttori-asm-analysis-transaction" ||
    prepared.version !== 1 ||
    !/^[\da-f]{64}$/.test(prepared.generation)
  ) {
    throw new Error("Unsupported prepared analysis-project transaction.");
  }
  validateAnalysisProjectManifest(prepared.manifest);
  const kinds = [...prepared.manifest.shards.map(({ kind }) => kind)].sort();
  const requiredKinds = [...REQUIRED_SHARD_KINDS].sort();
  if (canonicalJson(kinds) !== canonicalJson(requiredKinds)) {
    throw new Error("Prepared analysis-project transaction does not contain every required shard.");
  }
  const generation = sha256(
    canonicalJson(
      prepared.manifest.shards
        .map(({ id, kind, sha256: shardHash, records }) => ({
          id,
          kind,
          sha256: shardHash,
          records,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    ),
  );
  if (!tokensEqual(generation, prepared.generation)) {
    throw new Error("Prepared analysis-project transaction has the wrong generation identity.");
  }
  const prefix = `${GENERATIONS_DIRECTORY}/${prepared.generation}/`;
  for (const descriptor of prepared.manifest.shards) {
    const basename = descriptor.path.slice(prefix.length);
    if (
      !descriptor.path.startsWith(prefix) ||
      basename === "" ||
      basename.includes("/") ||
      basename.includes("\\")
    ) {
      throw new Error(`Prepared analysis shard '${descriptor.id}' is outside its generation.`);
    }
  }
};

/**
 * Loads one stable project snapshot. A manifest changing during validation is retried rather than
 * pairing records from one generation with the revision of another.
 * @param {string} directory Native analysis-project directory.
 * @returns {AnalysisProjectSnapshot} Validated project plus its optimistic revision.
 */
export const loadAnalysisProjectSnapshot = (directory: string): AnalysisProjectSnapshot => {
  const manifestPath = path.join(directory, ANALYSIS_PROJECT_MANIFEST);
  for (let attempt = 0; attempt < MAX_SNAPSHOT_ATTEMPTS; attempt++) {
    const before = fs.readFileSync(manifestPath, "utf8");
    let project: LoadedAnalysisProject;
    try {
      project = loadAnalysisProject(directory);
    } catch (error) {
      const afterFailure = fs.readFileSync(manifestPath, "utf8");
      if (afterFailure !== before) continue;
      throw error;
    }
    const after = fs.readFileSync(manifestPath, "utf8");
    if (after === before) return { ...project, revision: revisionFor(before, project.manifest) };
  }
  throw new Error(`Analysis project '${directory}' changed repeatedly while it was loading.`);
};

/**
 * Reads a stable active revision without materializing a second complete project snapshot.
 *
 * Commit callers already hold a fully validated snapshot and compare this result with its revision.
 * The current manifest is migrated/validated and every shard hash is streamed; record JSON is not
 * parsed again under the writer lock. Reading the manifest before and after the hashes prevents a
 * mixed-generation revision, with bounded retries if another cooperative writer publishes.
 * @param {string} directory Native analysis-project directory.
 * @returns {AnalysisProjectRevision} Stable manifest and shard identity token.
 */
const loadAnalysisProjectRevision = (directory: string): AnalysisProjectRevision => {
  const manifestPath = path.join(directory, ANALYSIS_PROJECT_MANIFEST);
  for (let attempt = 0; attempt < MAX_SNAPSHOT_ATTEMPTS; attempt++) {
    const before = fs.readFileSync(manifestPath, "utf8");
    const manifest = migrateManifest(JSON.parse(before));
    verifyPreparedShardHashes(directory, manifest.shards);
    const after = fs.readFileSync(manifestPath, "utf8");
    if (after === before) return revisionFor(before, manifest);
  }
  throw new Error(`Analysis project '${directory}' changed repeatedly while it was loading.`);
};

/**
 * Writes and fsyncs a canonical content-addressed shard generation. The active manifest is not
 * touched, so an interruption after this step leaves the previously committed project loadable.
 * @param {string} directory Native analysis-project directory.
 * @param {AnalysisProject} project Complete replacement project to prepare.
 * @returns {PreparedAnalysisProjectTransaction} Immutable generation ready for publication.
 */
export const prepareAnalysisProjectTransaction = (
  directory: string,
  project: AnalysisProject,
): PreparedAnalysisProjectTransaction => {
  const token = randomUUID();
  const transactionRoot = path.join(directory, TRANSACTIONS_DIRECTORY);
  const stagingDirectory = path.join(transactionRoot, token);
  fs.mkdirSync(stagingDirectory, { recursive: true });
  try {
    const stagingManifest = writeAnalysisProject(stagingDirectory, project);
    const generation = sha256(
      canonicalJson(
        stagingManifest.shards.map(({ id, kind, sha256: shardHash, records }) => ({
          id,
          kind,
          sha256: shardHash,
          records,
        })),
      ),
    );
    const generationRelative = `${GENERATIONS_DIRECTORY}/${generation}`;
    const descriptors = stagingManifest.shards.map((descriptor) => ({
      ...descriptor,
      path: `${generationRelative}/${path.basename(descriptor.path)}`,
    }));
    const stagingAnalysis = path.join(stagingDirectory, "analysis");
    for (const descriptor of stagingManifest.shards) {
      syncPath(path.join(stagingDirectory, descriptor.path));
    }
    syncPath(stagingAnalysis);

    const generationDirectory = path.join(directory, generationRelative);
    fs.mkdirSync(path.dirname(generationDirectory), { recursive: true });
    if (!fs.existsSync(generationDirectory)) {
      try {
        fs.renameSync(stagingAnalysis, generationDirectory);
      } catch (error) {
        if (!isNodeError(error, "EEXIST") && !isNodeError(error, "ENOTEMPTY")) throw error;
      }
    }
    // The generation may have been concurrently installed by another preparer. Stream all hashes
    // from the final content-addressed location rather than trusting the staging files we wrote.
    verifyPreparedShardHashes(directory, descriptors);
    syncPath(generationDirectory);
    syncPath(path.dirname(generationDirectory));

    const manifest: AnalysisProjectManifest = {
      ...stagingManifest,
      shards: descriptors,
    };
    // Recheck the exact descriptor set handed to commit after the directory sync. This remains a
    // bounded hash pass; parsing here would duplicate writeAnalysisProject's semantic validation.
    verifyPreparedShardHashes(directory, manifest.shards);
    return {
      format: "uttori-asm-analysis-transaction",
      version: 1,
      generation,
      manifest,
    };
  } finally {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
  }
};

/**
 * Publishes a prepared generation under an exclusive cooperative lock. The observed revision is
 * checked only after acquiring the lock, and `analysis.json` is the sole atomic replacement.
 * @param {string} directory Native analysis-project directory.
 * @param {AnalysisProjectRevision} expected Revision observed by the editing client.
 * @param {PreparedAnalysisProjectTransaction} prepared Immutable generation to publish.
 * @param {AnalysisProjectLockOptions} [options] Lock recovery policy and host seams.
 * @returns {CommittedAnalysisProjectTransaction} Published manifest and new revision.
 */
export const commitPreparedAnalysisProjectTransaction = (
  directory: string,
  expected: AnalysisProjectRevision,
  prepared: PreparedAnalysisProjectTransaction,
  options: AnalysisProjectLockOptions = {},
): CommittedAnalysisProjectTransaction => {
  validatePreparedTransaction(prepared);
  // Security invariant: perform one complete parse/count check before taking the lock so a caller
  // cannot forge a prepared object that points at malformed but correctly hashed JSON.
  verifyPreparedShards(directory, prepared.manifest.shards);
  const lock = acquireProjectLock(directory, options);
  const token = randomUUID();
  const temporaryManifest = path.join(directory, `.analysis.json.${token}.tmp`);
  try {
    // Performance invariant: compare the active revision through its validated manifest and streamed
    // shard hashes. Loading all current records here would retain both old and prepared projects.
    const currentRevision = loadAnalysisProjectRevision(directory);
    if (!revisionsEqual(expected, currentRevision)) {
      throw new AnalysisProjectStaleError(expected, currentRevision);
    }
    // TOCTOU invariant: prepared bytes were fully parsed before locking, then are hash-checked again
    // under the lock immediately before the sole atomic publication point.
    verifyPreparedShardHashes(directory, prepared.manifest.shards);
    const manifestText = canonicalJson(prepared.manifest);
    fs.writeFileSync(temporaryManifest, manifestText, { flag: "wx" });
    syncPath(temporaryManifest);
    fs.renameSync(temporaryManifest, path.join(directory, ANALYSIS_PROJECT_MANIFEST));
    syncPath(directory);
    return {
      manifest: prepared.manifest,
      revision: revisionFor(manifestText, prepared.manifest),
    };
  } finally {
    try {
      fs.unlinkSync(temporaryManifest);
    } catch {
      // A successful rename removes the temporary path; abandoned temp files are never referenced.
    }
    lock.release();
  }
};

/**
 * Prepares and atomically commits a complete project replacement.
 * @param {string} directory Native analysis-project directory.
 * @param {AnalysisProjectRevision} expected Revision observed by the editing client.
 * @param {AnalysisProject} project Complete replacement project.
 * @param {AnalysisProjectLockOptions} [options] Lock recovery policy and host seams.
 * @returns {CommittedAnalysisProjectTransaction} Published manifest and new revision.
 */
export const commitAnalysisProjectTransaction = (
  directory: string,
  expected: AnalysisProjectRevision,
  project: AnalysisProject,
  options: AnalysisProjectLockOptions = {},
): CommittedAnalysisProjectTransaction =>
  commitPreparedAnalysisProjectTransaction(
    directory,
    expected,
    prepareAnalysisProjectTransaction(directory, project),
    options,
  );
