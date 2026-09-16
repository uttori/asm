import fs from "node:fs";
import path from "node:path";
/** Same-filesystem staging directory and process gate for an explicit physical storage migration. */
export const SQLITE_MIGRATION_DIRECTORY = ".analysis-storage-migration";
/** Retained original, created as a hard link only after the destination is verified. */
export const SQLITE_MIGRATION_BACKUP = "analysis.sqlite.pre-retention.backup";
/**
 * Reject new work while a migration owns the project. Its staging database has a different parent.
 * @param {string} file Database being opened or used for a new transaction.
 */
export const assertNoSqliteMigration = (file) => {
    if (fs.existsSync(path.join(path.dirname(file), SQLITE_MIGRATION_DIRECTORY)))
        throw new Error("Analysis storage migration is in progress. Retry after it completes, or run project-migrate to recover an interrupted migration.");
};
/**
 * Identity of the file currently at a path, used to reject stale connections after atomic replacement.
 * @param {string} file Existing database path.
 * @returns {string} Device and inode identity, without precision loss.
 */
export const sqliteFileIdentity = (file) => {
    const stat = fs.statSync(file, { bigint: true });
    return `${stat.dev}:${stat.ino}`;
};
/**
 * Flush a completed file or its containing directory before publishing a recovery boundary.
 * @param {string} file Existing file or directory.
 */
export const syncSqlitePath = (file) => {
    const descriptor = fs.openSync(file, "r");
    try {
        fs.fsyncSync(descriptor);
    }
    finally {
        fs.closeSync(descriptor);
    }
};
//# sourceMappingURL=sqlite-maintenance.js.map