import type { DatabaseSync } from "node:sqlite";
import type { ShardKind } from "./project-types.js";
/**
 * Upgrade the disposable cache layout inside the caller's write transaction. Existing triggers
 * keep targeting the same table name, and rollback restores both its old schema and contents.
 * @param {DatabaseSync} db Project connection with an active write transaction.
 */
export declare const upgradeQueryCacheStorage: (db: DatabaseSync) => void;
/** Install dependency-specific invalidation; cached projections survive unrelated publications.
 * The caller owns the writer transaction. Trigger names and tables come only from internal constants.
 * @param {DatabaseSync} db Open project database.
 * @param {string} key Internal projection identifier (letters/digits/underscores).
 * @param {readonly ShardKind[]} dependencies Collections consumed by the projection.
 */
export declare const installQueryCache: (db: DatabaseSync, key: string, dependencies: readonly ShardKind[]) => void;
/** Read a dependency-validated projection; configuration and layout belong in its signature.
 * @param {DatabaseSync} db Open project database.
 * @param {string} key Internal projection identifier.
 * @param {string} signature Configuration/layout fingerprint.
 * @returns {T | undefined} Cached value, or undefined when its inputs changed.
 */
export declare const readQueryCache: <T>(db: DatabaseSync, key: string, signature: string) => T | undefined;
/** Publish a complete projection atomically with the read snapshot used to compute it.
 * @param {DatabaseSync} db Connection in the owning write transaction.
 * @param {string} key Internal projection identifier.
 * @param {string} signature Configuration/layout fingerprint.
 * @param {unknown} value JSON-serializable compact result.
 */
export declare const writeQueryCache: (db: DatabaseSync, key: string, signature: string, value: unknown) => void;
//# sourceMappingURL=sqlite-query-cache.d.ts.map