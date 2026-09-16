import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { syncSqlitePath } from "./sqlite-maintenance.js";
import type { SqliteAnalysisStore } from "./sqlite-store.js";

/** File identity captured before parsing, checked again before/after archiving to reject changed input.
 * @param {string} file Capture path to stat before parsing.
 * @returns {string} Inode, size and nanosecond change timestamps.
 */
export const captureFileIdentity = (file: string): string => {
  const stat = fs.statSync(file, { bigint: true });
  if (!stat.isFile()) throw new Error("Capture archive input must be a regular file.");
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
};

/** Never traverse an archive-directory symlink or a catalog path outside the managed directory.
 * @param {SqliteAnalysisStore} store Owning project connection.
 * @returns {string} Validated managed archive directory.
 */
const archiveDirectory = (store: SqliteAnalysisStore): string => {
  const directory = path.join(path.dirname(store.file), "archives");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(directory).isSymbolicLink())
    throw new Error("Managed archive directory must not be a symbolic link.");
  return directory;
};

/** Archive operations follow the committed import. Their failures are reported separately from durable evidence. */
export interface CaptureArchiveResult {
  readonly archived: boolean;
  readonly expired: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Copy and hash a validated source into an owned content-addressed archive. Source files are never
 * deleted or moved. Oversized unpinned files remain external references instead of exceeding budget.
 * Pinning and cleanup serialize with other project writers; a partially copied file is never cataloged.
 * @param {SqliteAnalysisStore} store Project containing the committed receipt.
 * @param {string} sha256 Semantic capture identity from the validated importer.
 * @param {string} file Original capture path, read only.
 * @param {string} expectedIdentity File identity saved before parsing.
 * @returns {Promise<CaptureArchiveResult>} Archive/expiry outcomes; failures never imply the import rolled back.
 */
export const archiveImportedCapture = async (
  store: SqliteAnalysisStore,
  sha256: string,
  file: string,
  expectedIdentity: string,
): Promise<CaptureArchiveResult> => {
  const warnings: string[] = [];
  let temporary: string | undefined;
  let archived = false;
  try {
    if (captureFileIdentity(file) !== expectedIdentity)
      throw new Error("Capture changed since import; archive was not associated with its receipt.");
    const existing = store.captureReceipt(sha256);
    if (!existing) throw new Error("Cannot archive a capture without a committed import receipt.");
    if (existing.availability === "managed") {
      const managed = path.join(archiveDirectory(store), String(existing.archive_name));
      // The catalog describes the last verified copy. A missing copy must be repaired before reuse.
      if (
        /^[\da-f]{64}-[\da-f]{64}\.capture$/.test(String(existing.archive_name)) &&
        fs.existsSync(managed) &&
        fs.lstatSync(managed).isFile() &&
        fs.lstatSync(managed).size === existing.archive_bytes
      ) {
        const expiry = expireCaptureArchives(store);
        return { archived: !expiry.expired.includes(sha256), ...expiry };
      }
      store.transaction(() =>
        store.updateCaptureArchive(sha256, { bytes: 0, availability: "unavailable" }),
      );
    }
    const bytes = fs.statSync(file).size;
    if (!existing.pinned && bytes > store.storagePolicy().archiveMaxBytes) {
      store.transaction(() =>
        store.updateCaptureArchive(sha256, {
          originalPath: path.resolve(file),
          bytes: 0,
          availability: "external",
        }),
      );
      warnings.push(
        "Capture exceeds the unpinned archive budget; its original file remains an external reference.",
      );
    } else {
      const directory = archiveDirectory(store);
      temporary = path.join(directory, `.pending-${randomUUID()}`);
      const hash = createHash("sha256");
      const digest = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(
        fs.createReadStream(file),
        digest,
        fs.createWriteStream(temporary, { flags: "wx", mode: 0o600, flush: true }),
      );
      if (captureFileIdentity(file) !== expectedIdentity || fs.statSync(temporary).size !== bytes)
        throw new Error("Capture changed while copying; incomplete archive discarded.");
      const rawHash = hash.digest("hex");
      // Include the semantic capture identity: two catalog receipts cannot share a deletable archive file.
      const name = `${sha256}-${rawHash}.capture`;
      store.transaction(() => {
        fs.renameSync(temporary!, path.join(directory, name));
        syncSqlitePath(directory);
        store.updateCaptureArchive(sha256, {
          originalPath: path.resolve(file),
          name,
          hash: rawHash,
          bytes,
          availability: "managed",
        });
      });
      archived = true;
    }
  } catch (error) {
    warnings.push(`Trace import committed; optional archive unavailable: ${String(error)}`);
  } finally {
    if (temporary) fs.rmSync(temporary, { force: true });
  }
  let expiry: ReturnType<typeof expireCaptureArchives> = { expired: [], warnings: [] };
  try {
    expiry = expireCaptureArchives(store);
  } catch (error) {
    warnings.push(`Trace import committed; archive expiry deferred: ${String(error)}`);
  }
  return {
    archived: archived && !expiry.expired.includes(sha256),
    expired: expiry.expired,
    warnings: [...warnings, ...expiry.warnings],
  };
};

/** Expire oldest owned, unpinned archives by bytes, age and optional count. Facts and receipts survive.
 * A retained reference outside this directory is never an eligible deletion target.
 * @param {SqliteAnalysisStore} store Project whose writer lock serializes pinning and expiry.
 * @returns {object} Expired identities and any files preserved after an error.
 */
export const expireCaptureArchives = (
  store: SqliteAnalysisStore,
): Omit<CaptureArchiveResult, "archived"> => {
  const expired: string[] = [];
  const warnings: string[] = [];
  store.transaction(() => {
    const policy = store.storagePolicy();
    const rows = store
      .captureCatalog()
      .filter((row) => row.availability === "managed" && !row.pinned);
    let bytes = rows.reduce((n, row) => n + Number(row.archive_bytes), 0);
    let count = rows.length;
    for (const row of rows) {
      const tooOld =
        policy.archiveMaxAgeDays > 0 &&
        Number(row.imported_at) < Date.now() - policy.archiveMaxAgeDays * 86400000;
      if (
        !tooOld &&
        bytes <= policy.archiveMaxBytes &&
        (!policy.archiveMaxCaptures || count <= policy.archiveMaxCaptures)
      )
        continue;
      try {
        const name = String(row.archive_name);
        if (!/^[\da-f]{64}-[\da-f]{64}\.capture$/.test(name))
          throw new Error("Invalid managed archive path; preserving file.");
        const file = path.join(archiveDirectory(store), name);
        if (fs.existsSync(file)) {
          if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink())
            throw new Error("Archive was replaced; preserving file.");
          fs.unlinkSync(file);
        }
        store.updateCaptureArchive(String(row.sha256), { bytes: 0, availability: "expired" });
        bytes -= Number(row.archive_bytes);
        count--;
        expired.push(String(row.sha256));
      } catch (error) {
        warnings.push(`Archive ${String(row.sha256)} could not expire: ${String(error)}`);
      }
    }
  });
  return { expired, warnings };
};
