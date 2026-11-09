import type { DatabaseSync } from "node:sqlite";
/** History preserves SQLite storage types, including JSONB and packed register bytes. */
export type HistoryValue = string | Uint8Array | null;
/** Immutable blocks belong to the database, independently of disposable capture files. */
export declare const RUNTIME_HISTORY_SCHEMA = "CREATE TABLE runtime_history (\n  id INTEGER PRIMARY KEY AUTOINCREMENT, first_fid INTEGER NOT NULL, last_fid INTEGER NOT NULL,\n  payload BLOB NOT NULL\n);\nCREATE TRIGGER runtime_history_immutable BEFORE UPDATE ON runtime_history BEGIN\n  SELECT RAISE(ABORT,'Runtime history blocks are immutable');\nEND;";
/**
 * Encode bounded records together so repeated register bytes share one compression dictionary.
 * The offset directory preserves empty TEXT/BLOB and NULL independently. CRC covers the directory
 * as well as the record bytes; corrupt lengths are rejected before decompression allocation.
 * @param values Between 1 and 1024 exact SQLite payloads.
 * @returns Versioned, checksummed DEFLATE block, limited to 32 MiB decoded.
 */
export declare const encodeRuntimeHistory: (values: readonly HistoryValue[]) => Buffer;
/**
 * Decode every exact typed payload; BLOB slices share the owned decompressed block.
 * @param encoded Complete persisted block, including its header.
 * @returns Values in slot order; malformed bounds, types, checksums, or text throw.
 */
export declare const decodeRuntimeHistory: (encoded: Uint8Array) => HistoryValue[];
/**
 * Register bounded block reads on every application connection before preparing runtime views.
 * Blocks are immutable and committed IDs never repeat. Clear the cache at transaction boundaries
 * because rolled-back inserts can reuse an ID; no cached value may outlive that rollback.
 * @param db Owned connection; call before preparing queries against runtime views.
 * @returns Cache reset owned by the connection's transaction lifecycle.
 */
export declare const registerRuntimeHistory: (db: DatabaseSync) => (() => void);
/**
 * Seal newly written payloads inside the owning publication transaction. Existing blocks never
 * change, so readers and concurrent snapshots retain exact values. The partial pending index
 * prevents every annotation edit from rescanning the complete retained history.
 * @param db Connection inside the owning writer transaction.
 * @param [onProgress] Optional cumulative sealed-fact counter; throwing aborts publication.
 * @returns Facts moved from inline payloads to immutable blocks.
 */
export declare const packRuntimeHistory: (db: DatabaseSync, onProgress?: (packed: number) => void) => number;
/**
 * Reclaim dead blocks/descriptors during explicit maintenance. Block fid bounds let the
 * observation lifecycle avoid another per-fact index solely for garbage collection.
 * Partially live blocks are retained: deletion must never remove another fact's payload.
 * @param db Connection inside the explicit maintenance transaction.
 */
export declare const collectRuntimeHistory: (db: DatabaseSync) => void;
//# sourceMappingURL=sqlite-runtime-history.d.ts.map