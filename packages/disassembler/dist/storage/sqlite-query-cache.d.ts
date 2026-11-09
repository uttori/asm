import type { DatabaseSync } from "node:sqlite";
import type { ShardKind } from "../model/project-types.js";
/**
 * Install dependency-specific invalidation. Cached projections survive unrelated publications.
 * The caller owns the writer transaction. Trigger names and tables come only from internal constants.
 * @param db Open project database.
 * @param key Internal projection identifier (letters/digits/underscores).
 * @param dependencies Collections consumed by the projection.
 */
export declare const installQueryCache: (db: DatabaseSync, key: string, dependencies: readonly ShardKind[]) => void;
/**
 * Read a dependency-validated projection. Configuration and layout belong in its signature.
 * @param db Open project database.
 * @param key Internal projection identifier.
 * @param signature Configuration/layout fingerprint.
 * @returns Cached value, or undefined when its inputs changed.
 */
export declare const readQueryCache: (db: DatabaseSync, key: string, signature: string) => unknown;
/**
 * Publish a complete projection atomically with the read snapshot used to compute it.
 * @param db Connection in the owning write transaction.
 * @param key Internal projection identifier.
 * @param signature Configuration/layout fingerprint.
 * @param value JSON-serializable compact result.
 */
export declare const writeQueryCache: (db: DatabaseSync, key: string, signature: string, value: unknown) => void;
//# sourceMappingURL=sqlite-query-cache.d.ts.map