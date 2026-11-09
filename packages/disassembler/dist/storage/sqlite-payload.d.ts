/** Per-record decoded UTF-8 limit, enforced before decompression can allocate an oversized buffer. */
export declare const MAX_SQLITE_PAYLOAD_BYTES: number;
/**
 * Keep small JSON as SQLite TEXT. Larger values use a checksummed, versioned BLOB only when worthwhile.
 * @param json Serialized semantic record or variant payload.
 * @returns Raw text, or a BLOB saving at least 32 bytes and one eighth of the input.
 */
export declare const encodeSqlitePayload: (json: string) => string | Buffer;
/**
 * Decode one bounded payload, rejecting unknown codecs, corrupt checksums, and invalid UTF-8.
 * @param value SQLite TEXT or a versioned compressed/packed BLOB.
 * @returns Lossless semantic JSON. Malformed storage throws without returning partial content.
 */
export declare const decodeSqlitePayload: (value: unknown) => string;
/**
 * Parse owned semantic data, bypassing JSON serialization for packed runtime snapshots.
 * Callers validate the decoded value before use.
 * @param value Stored TEXT or a supported versioned BLOB.
 * @returns Decoded semantic data.
 */
export declare const parseSqlitePayload: (value: unknown) => unknown;
/** Exact external ID split. BLOB suffixes represent only canonical lowercase SHA-256 text. */
export interface SqliteRuntimeIdentity {
    /** ID text up to and including the last `:`; empty when the ID has no separator. */
    readonly prefix: string;
    /** Remaining text, or its 32 raw bytes when it is lowercase SHA-256 hex. */
    readonly suffix: string | Buffer;
}
/**
 * Factor repeated capture prefixes without changing arbitrary caller-supplied IDs.
 * @param id Complete stable semantic identifier.
 * @returns Lossless prefix and typed suffix suitable for a composite unique key.
 */
export declare const sqliteRuntimeIdentity: (id: string) => SqliteRuntimeIdentity;
/**
 * Reconstruct the original ID, preserving text case and non-hexadecimal suffixes.
 * @param prefix Interned prefix text.
 * @param suffix SQLite TEXT or a 32-byte hash BLOB.
 * @returns Exact external ID. Invalid binary identities throw.
 */
export declare const decodeSqliteRuntimeIdentity: (prefix: unknown, suffix: unknown) => string;
//# sourceMappingURL=sqlite-payload.d.ts.map