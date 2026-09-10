/** Same-filesystem staging directory and process gate for an explicit physical storage migration. */
export declare const SQLITE_MIGRATION_DIRECTORY = ".analysis-storage-migration";
/** Retained original, created as a hard link only after the destination is verified. */
export declare const SQLITE_MIGRATION_BACKUP = "analysis.sqlite.storage-v0.backup";
/**
 * Reject new work while a migration owns the project. Its staging database has a different parent.
 * @param {string} file Database being opened or used for a new transaction.
 */
export declare const assertNoSqliteMigration: (file: string) => void;
/**
 * Identity of the file currently at a path, used to reject stale connections after atomic replacement.
 * @param {string} file Existing database path.
 * @returns {string} Device and inode identity, without precision loss.
 */
export declare const sqliteFileIdentity: (file: string) => string;
/**
 * Flush a completed file or its containing directory before publishing a recovery boundary.
 * @param {string} file Existing file or directory.
 */
export declare const syncSqlitePath: (file: string) => void;
//# sourceMappingURL=sqlite-maintenance.d.ts.map