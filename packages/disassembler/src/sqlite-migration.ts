import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setImmediate } from "node:timers/promises";

import { canonicalJson } from "./canonical-json.js";
import { parseAnalysisProjectManifest } from "./project-store.js";
import type { AnalysisProjectManifest, AnalysisProjectShards, ShardKind } from "./project-types.js";
import { createRuntimeRecordValidator, validateLoadedShards } from "./project-validation.js";
import {
  SQLITE_MIGRATION_BACKUP,
  SQLITE_MIGRATION_DIRECTORY,
  sqliteFileIdentity,
  syncSqlitePath,
} from "./sqlite-maintenance.js";
import { decodeSqlitePayload } from "./sqlite-payload.js";
import { runtimeFromRow } from "./sqlite-records.js";
import {
  ANALYSIS_PROJECT_SQLITE_FILE,
  ANALYSIS_SQLITE_STORAGE_VERSION,
  SqliteAnalysisStore,
} from "./sqlite-store.js";

const TABLES: readonly ShardKind[] = [
  "evidence",
  "labels",
  "comments",
  "regions",
  "annotations",
  "analysis",
  "imports",
  "runtime",
];
const RESERVE_BYTES = 256 * 1024 * 1024;

/** Migration stages are cancellable until publication; reported record counts are per table. */
export interface SqliteMigrationProgress {
  readonly phase: "copy" | "verify" | "indexes" | "publish";
  readonly table?: ShardKind;
  readonly records?: number;
}

/** The original stays at backupFile until explicitly removed or archived after operational checks. */
export interface SqliteMigrationResult {
  readonly changed: boolean;
  readonly recovered: boolean;
  readonly storageVersion: number;
  readonly beforeBytes: number;
  readonly afterBytes: number;
  readonly backupFile?: string;
  readonly tables: Readonly<Record<string, { readonly records: number; readonly sha256: string }>>;
  readonly warnings: readonly string[];
}

/** Callbacks report progress only; cancellation is observed between bounded copy/verification batches. */
export interface SqliteMigrationOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: SqliteMigrationProgress) => void;
}

/** Persisted before publication so a crashed process can distinguish an incomplete copy from success. */
interface MigrationJournal {
  readonly pid: number;
  readonly sourceIdentity: string;
  readonly beforeBytes: number;
  readonly manifestSha256: string;
  readonly targetIdentity?: string;
  readonly result?: SqliteMigrationResult;
  /** A completed attempt may leave cleanup work even while its hosting process remains alive. */
  readonly released?: boolean;
}

/**
 * Publish a small recovery record only after its file contents and directory entry are durable.
 * @param {string} stage Owned staging directory.
 * @param {MigrationJournal} journal Source/destination identities and completed validation results.
 */
const writeJournal = (stage: string, journal: MigrationJournal): void => {
  const temporary = path.join(stage, "journal.tmp");
  fs.writeFileSync(temporary, JSON.stringify(journal), { mode: 0o600 });
  syncSqlitePath(temporary);
  fs.renameSync(temporary, path.join(stage, "journal.json"));
  syncSqlitePath(stage);
};

/**
 * Treat inaccessible processes as live; only ESRCH permits automatic crash recovery.
 * @param {number} pid Recorded owner process.
 * @returns {boolean} Whether ownership may still be active.
 */
const processAlive = (pid: number): boolean => {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("Invalid SQLite migration owner.");
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
};

/**
 * Read the authoritative header while the source connection owns its exclusive snapshot.
 * @param {DatabaseSync} database Existing project database.
 * @returns {AnalysisProjectManifest} Validated manifest with the actual publication counter.
 */
const sourceManifest = (database: DatabaseSync): AnalysisProjectManifest => {
  const manifest = JSON.parse(
    String(database.prepare("SELECT v FROM meta WHERE k='manifest'").get()?.v),
  ) as AnalysisProjectManifest;
  const revision = Number(database.prepare("SELECT v FROM meta WHERE k='revision'").get()?.v);
  return parseAnalysisProjectManifest({ ...manifest, revision });
};

/**
 * Stream the sole supported old SQLite layout. No legacy JSON container or old write path is retained.
 * @param {DatabaseSync} database Format-zero source under an exclusive SQLite lock.
 * @param {ShardKind} kind Table selected from the fixed semantic table inventory.
 * @returns {IterableIterator} Stable-ID-ordered semantic records.
 * @yields {object} One decoded record with its original external identity.
 */
function* legacyRecords<K extends ShardKind>(
  database: DatabaseSync,
  kind: K,
): IterableIterator<AnalysisProjectShards[K][number]> {
  for (const row of database.prepare(`SELECT * FROM ${kind} ORDER BY id`).iterate()) {
    if (kind === "runtime") {
      yield runtimeFromRow(row);
    } else {
      const record = JSON.parse(
        decodeSqlitePayload(row.payload),
      ) as AnalysisProjectShards[K][number];
      if (record.id !== row.id) throw new Error(`Stored ${kind} ID differs from its payload.`);
      yield record;
    }
  }
}

/**
 * Recover only staging paths whose persisted inode identities prove they belong to this migration.
 * @param {string} directory Project root.
 * @returns {SqliteMigrationResult | undefined} A completed publication, or undefined after discarding an interrupted copy.
 */
const recoverMigration = (directory: string): SqliteMigrationResult | undefined => {
  const stage = path.join(directory, SQLITE_MIGRATION_DIRECTORY);
  const file = path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE);
  const backup = path.join(directory, SQLITE_MIGRATION_BACKUP);
  const journal = JSON.parse(
    fs.readFileSync(path.join(stage, "journal.json"), "utf8"),
  ) as MigrationJournal;
  if (!journal.released && processAlive(journal.pid))
    throw new Error("Another process owns the analysis storage migration.");
  const identity = sqliteFileIdentity(file);
  if (identity === journal.targetIdentity && journal.result) {
    const database = new DatabaseSync(file, { readOnly: true });
    try {
      if (
        createHash("sha256")
          .update(canonicalJson(sourceManifest(database)))
          .digest("hex") !== journal.manifestSha256
      )
        throw new Error("Published migration identity differs from its recovery journal.");
    } finally {
      database.close();
    }
    if (sqliteFileIdentity(backup) !== journal.sourceIdentity)
      throw new Error("Migration backup identity differs from its recovery journal.");
    fs.rmSync(stage, { recursive: true });
    syncSqlitePath(directory);
    return { ...journal.result, recovered: true };
  }
  if (identity !== journal.sourceIdentity)
    throw new Error(
      "Analysis database identity changed outside the recorded migration; preserving recovery files.",
    );
  // A crash after linking the backup but before the atomic replacement leaves two names for the
  // unchanged source. Remove only that proven duplicate link, never an unrelated backup file.
  if (fs.existsSync(backup)) {
    if (sqliteFileIdentity(backup) !== identity)
      throw new Error("An unrelated migration backup already exists; preserving both databases.");
    fs.unlinkSync(backup);
  }
  fs.rmSync(stage, { recursive: true });
  syncSqlitePath(directory);
  return undefined;
};

/**
 * Convert a format-zero SQLite project into the compact format with exact per-table content digests.
 * The process gate blocks new clients; switching WAL to DELETE under exclusive locking also requires
 * existing SQLite readers to release the source. No source row or logical revision is changed.
 * @param {string} directory Existing project root, on a filesystem supporting same-directory hard links.
 * @param {SqliteMigrationOptions} [options] Cancellation and progress reporting.
 * @returns {Promise<SqliteMigrationResult>} Published sizes, content digests, and retained original path.
 */
export const migrateAnalysisProjectStorage = async (
  directory: string,
  options: SqliteMigrationOptions = {},
): Promise<SqliteMigrationResult> => {
  directory = path.resolve(directory);
  const file = path.join(directory, ANALYSIS_PROJECT_SQLITE_FILE);
  const stage = path.join(directory, SQLITE_MIGRATION_DIRECTORY);
  const backup = path.join(directory, SQLITE_MIGRATION_BACKUP);
  if (fs.existsSync(stage)) {
    const recovered = recoverMigration(directory);
    if (recovered) return recovered;
  }
  options.signal?.throwIfAborted();
  if (fs.lstatSync(file).isSymbolicLink())
    throw new Error("Migrate a regular analysis database file, not a symbolic link.");
  // Checking the header is read-only; opening the normal store would correctly reject this old format.
  const probe = new DatabaseSync(file, { readOnly: true });
  let version: number;
  let manifest: AnalysisProjectManifest;
  try {
    version = Number(probe.prepare("PRAGMA user_version").get()?.user_version);
    if (version !== 0 && version !== ANALYSIS_SQLITE_STORAGE_VERSION)
      throw new Error(`Cannot migrate unsupported analysis storage format ${version}.`);
    manifest = sourceManifest(probe);
  } finally {
    probe.close();
  }
  let beforeBytes = fs.statSync(file).size;
  if (version === ANALYSIS_SQLITE_STORAGE_VERSION)
    return {
      changed: false,
      recovered: false,
      storageVersion: version,
      beforeBytes,
      afterBytes: beforeBytes,
      tables: {},
      warnings: [],
    };
  if (fs.existsSync(backup)) throw new Error(`Migration backup already exists: ${backup}`);
  const disk = fs.statfsSync(directory);
  // The sample-based format budget reserves half the source for the destination, another quarter
  // for index construction, plus a fixed safety margin. Runtime checks handle estimation error.
  const required = Math.ceil(beforeBytes * 0.75) + RESERVE_BYTES;
  if (disk.bavail * disk.bsize < required)
    throw new Error(
      `Insufficient migration workspace: need an estimated ${Math.ceil(required / 1024 / 1024)} MiB free.`,
    );
  fs.mkdirSync(stage, { mode: 0o700 });
  let journal: MigrationJournal = {
    pid: process.pid,
    sourceIdentity: sqliteFileIdentity(file),
    beforeBytes,
    manifestSha256: createHash("sha256").update(canonicalJson(manifest)).digest("hex"),
  };
  let source: DatabaseSync | undefined;
  let destination: SqliteAnalysisStore | undefined;
  let linked = false;
  let published = false;
  let failed = false;
  const warnings: string[] = [];
  try {
    writeJournal(stage, journal);
    syncSqlitePath(directory);
    source = new DatabaseSync(file);
    try {
      source.exec(
        "PRAGMA busy_timeout=1000; PRAGMA locking_mode=EXCLUSIVE; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; BEGIN EXCLUSIVE;",
      );
    } catch (cause) {
      throw new Error(
        `Cannot acquire exclusive migration access; close clients using this analysis database and retry. ${String(cause)}`,
        { cause },
      );
    }
    manifest = sourceManifest(source);
    beforeBytes = fs.statSync(file).size;
    // Recheck after acquiring SQLite's lock: a writer may have committed between the read-only probe
    // and creation of the migration gate. That commit belongs in the migrated snapshot.
    journal = {
      ...journal,
      beforeBytes,
      manifestSha256: createHash("sha256").update(canonicalJson(manifest)).digest("hex"),
    };
    writeJournal(stage, journal);
    const stagedFile = path.join(stage, ANALYSIS_PROJECT_SQLITE_FILE);
    destination = new SqliteAnalysisStore(stagedFile, true, true);
    const tables: Record<string, { records: number; sha256: string }> = {};
    for (const kind of TABLES) {
      const hash = createHash("sha256");
      let count = 0;
      let bytes = 0;
      let batch: AnalysisProjectShards[ShardKind][number][] = [];
      const flush = async (): Promise<void> => {
        if (batch.length === 0) return;
        options.signal?.throwIfAborted();
        const available = fs.statfsSync(directory);
        if (available.bavail * available.bsize < RESERVE_BYTES)
          throw new Error("Migration stopped before exhausting free disk space.");
        destination!.transaction(() => destination!.appendRecords(kind, batch));
        batch = [];
        bytes = 0;
        options.onProgress?.({ phase: "copy", table: kind, records: count });
        await setImmediate();
      };
      for (const record of legacyRecords(source, kind)) {
        const json = canonicalJson(record);
        hash.update(json);
        bytes += Buffer.byteLength(json);
        batch.push(record);
        count++;
        if (batch.length >= 2000 || bytes >= 4 * 1024 * 1024) await flush();
      }
      await flush();
      tables[kind] = { records: count, sha256: hash.digest("hex") };
    }
    destination.transaction(() => destination!.initializeMigratedManifest(manifest));
    // Only provenance and region ancestry need cross-record context. Large CFG/annotation tables
    // use the existing validator in bounded batches; runtime retains no complete record collection.
    const context: AnalysisProjectShards = {
      evidence: destination.loadTable("evidence"),
      regions: destination.loadTable("regions"),
      labels: [],
      comments: [],
      annotations: [],
      analysis: [],
      imports: [],
      runtime: [],
    };
    validateLoadedShards(context, manifest);
    const validateRuntime = createRuntimeRecordValidator(manifest, context.evidence, false);
    for (const kind of TABLES) {
      const hash = createHash("sha256");
      let records = 0;
      let batch: AnalysisProjectShards[ShardKind][number][] = [];
      let batchBytes = 0;
      const validateBatch = (): void => {
        if (batch.length !== 0) validateLoadedShards({ ...context, [kind]: batch }, manifest);
        batch = [];
        batchBytes = 0;
      };
      for (const record of destination.records(kind)) {
        const json = canonicalJson(record);
        hash.update(json);
        if (kind === "runtime") validateRuntime(record as AnalysisProjectShards["runtime"][number]);
        else if (kind !== "evidence" && kind !== "regions") {
          batch.push(record);
          batchBytes += Buffer.byteLength(json);
        }
        records++;
        if (records % 2000 === 0 || batchBytes >= 4 * 1024 * 1024) {
          validateBatch();
          options.signal?.throwIfAborted();
          options.onProgress?.({ phase: "verify", table: kind, records });
          await setImmediate();
        }
      }
      validateBatch();
      if (records !== tables[kind].records || hash.digest("hex") !== tables[kind].sha256)
        throw new Error(`Migrated ${kind} records differ from the original database.`);
    }
    validateRuntime.close();
    options.signal?.throwIfAborted();
    options.onProgress?.({ phase: "indexes" });
    options.signal?.throwIfAborted();
    destination.finishMigration();
    // Index construction is synchronous native work. Yield once before publication so a queued
    // cancellation from the host can be delivered, then discard the staged file if it was requested.
    await setImmediate();
    options.signal?.throwIfAborted();
    destination.close();
    destination = undefined;
    syncSqlitePath(stagedFile);
    const result: SqliteMigrationResult = {
      changed: true,
      recovered: false,
      storageVersion: ANALYSIS_SQLITE_STORAGE_VERSION,
      beforeBytes,
      afterBytes: fs.statSync(stagedFile).size,
      backupFile: backup,
      tables,
      warnings,
    };
    journal = { ...journal, targetIdentity: sqliteFileIdentity(stagedFile), result };
    writeJournal(stage, journal);
    options.signal?.throwIfAborted();
    options.onProgress?.({ phase: "publish" });
    options.signal?.throwIfAborted();
    // COMMIT leaves the exclusive connection lock held. The old database is now journal-free;
    // linking it retains a backup without copying 10 GiB or leaving a gap at the live pathname.
    source.exec("COMMIT");
    fs.linkSync(file, backup);
    linked = true;
    syncSqlitePath(directory);
    fs.renameSync(stagedFile, file);
    published = true;
    syncSqlitePath(directory);
    return result;
  } catch (error) {
    if (published && journal.result) {
      warnings.push(`Storage was published, but final housekeeping failed: ${String(error)}`);
      return { ...journal.result, warnings };
    }
    failed = true;
    throw error;
  } finally {
    try {
      try {
        destination?.close();
      } finally {
        // A staging close failure must not keep the original database exclusively locked.
        source?.close();
      }
      // Release logical ownership before removing the directory so a cleanup failure is retryable
      // even in a long-lived host. A killed process instead leaves its live-owner journal intact.
      writeJournal(stage, { ...journal, released: true });
      if (linked && !published && sqliteFileIdentity(file) === journal.sourceIdentity)
        fs.unlinkSync(backup);
      fs.rmSync(stage, { recursive: true, force: true });
      syncSqlitePath(directory);
    } catch (error) {
      const message = `SQLite migration cleanup needs recovery via project-migrate: ${String(error)}`;
      // As with transaction rollback, housekeeping must not hide the original disk/publication error.
      if (failed) process.emitWarning(message);
      else warnings.push(message);
    }
  }
};
