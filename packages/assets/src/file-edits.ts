import fs from "node:fs";
import path from "node:path";

/** Caller-owned edit of an existing regular file; before bytes protect against stale plans. */
export interface AssetFileChange {
  readonly path: string;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
}

/** Compare exact source snapshots without depending on encoding or a hash algorithm.
 * @param {string} file Existing file path; read errors propagate to the transaction.
 * @param {Uint8Array} bytes Expected snapshot bytes.
 * @returns {boolean} Whether every byte still matches.
 */
function matches(file: string, bytes: Uint8Array): boolean {
  return fs.readFileSync(file).equals(bytes);
}

/**
 * Stage all replacements before publishing, then recover earlier replacements on failure.
 * Requires existing regular files and directories; creation/deletion is deliberately outside
 * this small authoring operation. This is not atomic to concurrent readers or crash-atomic.
 * On an unrecoverable conflict, backup files are retained and their locations reported.
 * @param {readonly AssetFileChange[]} changes Validated replacements for existing files; no creation or deletion.
 */
export function applyAssetFileChanges(changes: readonly AssetFileChange[]): void {
  const identities = new Set<string>();
  const staged: Array<{
    change: AssetFileChange;
    directory: string;
    next: string;
    backup: string;
  }> = [];
  const committed: typeof staged = [];
  let keepBackups = false;
  try {
    for (const change of changes) {
      const file = path.resolve(change.path);
      const info = fs.lstatSync(file);
      const identity = fs.realpathSync(file);
      if (!info.isFile() || identities.has(identity)) {
        throw new Error(`Duplicate or non-regular asset file: ${file}.`);
      }
      identities.add(identity);
      if (!matches(file, change.before)) {
        throw new Error(`Asset changed since edit was planned: ${file}.`);
      }
      // Same-directory staging keeps rename on the same filesystem and preserves permissions.
      const directory = fs.mkdtempSync(path.join(path.dirname(file), ".asset-edit-"));
      const entry = {
        change: { ...change, path: file },
        directory,
        next: path.join(directory, "next"),
        backup: path.join(directory, "before"),
      };
      staged.push(entry);
      fs.writeFileSync(entry.next, change.after, { mode: info.mode });
      fs.writeFileSync(entry.backup, change.before, { mode: info.mode });
      // Creation applies umask; restore the existing permission bits explicitly.
      fs.chmodSync(entry.next, info.mode & 0o7777);
      fs.chmodSync(entry.backup, info.mode & 0o7777);
    }
    for (const entry of staged) {
      if (!matches(entry.change.path, entry.change.before)) {
        throw new Error(`Asset changed during publication: ${entry.change.path}.`);
      }
      fs.renameSync(entry.next, entry.change.path);
      committed.push(entry);
    }
  } catch (cause) {
    const failures: unknown[] = [cause];
    for (const entry of committed.toReversed()) {
      try {
        // Never roll back over somebody else's edit made after our replacement.
        if (!matches(entry.change.path, entry.change.after)) {
          throw new Error(`Concurrent edit prevents recovery: ${entry.change.path}.`, {
            cause: cause,
          });
        }
        fs.renameSync(entry.backup, entry.change.path);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 1) {
      keepBackups = true;
      throw new AggregateError(
        failures,
        `Asset recovery incomplete. Backups: ${staged.map((s) => s.directory).join(", ")}`,
        { cause: cause },
      );
    }
    throw cause;
  } finally {
    if (!keepBackups) {
      for (const entry of staged) {
        fs.rmSync(entry.directory, { recursive: true, force: true });
      }
    }
  }
}
