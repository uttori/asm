import type { DatabaseSync } from "node:sqlite";

import type { ShardKind } from "../model/project-types.js";

/** Keep cache names in a separate index: WITHOUT ROWID mixes large JSON payloads into key pages. */
const QUERY_CACHE_SCHEMA =
  "CREATE TABLE IF NOT EXISTS query_cache (name TEXT PRIMARY KEY, signature TEXT NOT NULL, payload TEXT NOT NULL)";

/** Install dependency-specific invalidation. Cached projections survive unrelated publications.
 * The caller owns the writer transaction. Trigger names and tables come only from internal constants.
 * @param {DatabaseSync} db Open project database.
 * @param {string} key Internal projection identifier (letters/digits/underscores).
 * @param {readonly ShardKind[]} dependencies Collections consumed by the projection.
 */
export const installQueryCache = (
  db: DatabaseSync,
  key: string,
  dependencies: readonly ShardKind[],
): void => {
  if (!/^[\d_a-z]+$/.test(key)) {
    throw new Error("Invalid internal query cache key.");
  }
  if (
    dependencies.some(
      (table) =>
        ![
          "analysis",
          "annotations",
          "labels",
          "comments",
          "regions",
          "imports",
          "evidence",
          "runtime",
        ].includes(table),
    )
  ) {
    throw new Error("Invalid query dependency.");
  }
  db.exec(QUERY_CACHE_SCHEMA);
  for (const table of dependencies.flatMap((name) =>
    name === "runtime"
      ? ["runtime_fact_rows", "runtime_observations", "runtime_identities"]
      : [name],
  )) {
    for (const event of ["INSERT", "UPDATE", "DELETE"]) {
      const update =
        table === "runtime_observations" && event === "UPDATE"
          ? "UPDATE OF fact_id,prefix_id,identity_id,evidence_id,count,state_prefix_id"
          : event;
      // Packing changes representation only; it must not invalidate a summary or recount events.
      const condition =
        table === "runtime_fact_rows" && event === "UPDATE"
          ? "WHEN OLD.fid IS NOT NEW.fid OR OLD.fingerprint IS NOT NEW.fingerprint OR OLD.descriptor_id IS NOT NEW.descriptor_id OR NEW.history_id IS NULL"
          : "";
      db.exec(`CREATE TRIGGER IF NOT EXISTS cache_${key}_${table}_${event} AFTER ${update} ON ${table} ${condition} BEGIN
      DELETE FROM query_cache WHERE name='${key}'; END`);
    }
  }
};

/** Read a dependency-validated projection. Configuration and layout belong in its signature.
 * @param {DatabaseSync} db Open project database.
 * @param {string} key Internal projection identifier.
 * @param {string} signature Configuration/layout fingerprint.
 * @returns {T | undefined} Cached value, or undefined when its inputs changed.
 */
export const readQueryCache = <T>(
  db: DatabaseSync,
  key: string,
  signature: string,
): T | undefined => {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='query_cache'").get()) {
    return undefined;
  }
  const row = db
    .prepare("SELECT payload FROM query_cache WHERE name=? AND signature=?")
    .get(key, signature);
  return row ? (JSON.parse(String(row.payload)) as T) : undefined;
};

/** Publish a complete projection atomically with the read snapshot used to compute it.
 * @param {DatabaseSync} db Connection in the owning write transaction.
 * @param {string} key Internal projection identifier.
 * @param {string} signature Configuration/layout fingerprint.
 * @param {unknown} value JSON-serializable compact result.
 */
export const writeQueryCache = (
  db: DatabaseSync,
  key: string,
  signature: string,
  value: unknown,
): void => {
  db.prepare("INSERT OR REPLACE INTO query_cache VALUES(?,?,?)").run(
    key,
    signature,
    JSON.stringify(value),
  );
};
