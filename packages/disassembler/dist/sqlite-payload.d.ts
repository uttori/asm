/** Per-record decoded UTF-8 limit, enforced before decompression can allocate an oversized buffer. */
export declare const MAX_SQLITE_PAYLOAD_BYTES: number;
/**
 * Keep small JSON as SQLite TEXT; larger values use a checksummed, versioned BLOB only when worthwhile.
 * @param {string} json Serialized semantic record or variant payload.
 * @returns {string | Buffer} Raw text, or a BLOB saving at least 32 bytes and one eighth of the input.
 */
export declare const encodeSqlitePayload: (json: string) => string | Buffer;
/**
 * Decode one bounded payload, rejecting unknown codecs, corrupt checksums, and invalid UTF-8.
 * @param {unknown} value SQLite TEXT or a versioned compressed BLOB.
 * @returns {string} Original JSON text; malformed storage throws without returning partial content.
 */
export declare const decodeSqlitePayload: (value: unknown) => string;
/** Exact external ID split; BLOB suffixes represent only canonical lowercase SHA-256 text. */
export interface SqliteRuntimeIdentity {
    readonly prefix: string;
    readonly suffix: string | Buffer;
}
/**
 * Factor repeated capture prefixes without changing arbitrary caller-supplied IDs.
 * @param {string} id Complete stable semantic identifier.
 * @returns {SqliteRuntimeIdentity} Lossless prefix and typed suffix suitable for a composite unique key.
 */
export declare const sqliteRuntimeIdentity: (id: string) => SqliteRuntimeIdentity;
/**
 * Reconstruct the original ID, preserving text case and non-hexadecimal suffixes.
 * @param {unknown} prefix Interned prefix text.
 * @param {unknown} suffix SQLite TEXT or a 32-byte hash BLOB.
 * @returns {string} Exact external ID; invalid binary identities throw.
 */
export declare const decodeSqliteRuntimeIdentity: (prefix: unknown, suffix: unknown) => string;
//# sourceMappingURL=sqlite-payload.d.ts.map