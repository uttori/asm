import { TextDecoder, types } from "node:util";
import { deflateSync, inflateSync } from "node:zlib";

import { decodePackedRuntimePayload, isPackedRuntimePayload } from "./sqlite-runtime-payload.js";

/** Per-record decoded UTF-8 limit, enforced before decompression can allocate an oversized buffer. */
export const MAX_SQLITE_PAYLOAD_BYTES = 16 * 1024 * 1024;

/** UAP + codec version 1 (zlib-wrapped DEFLATE), followed by the decoded byte length. */
const HEADER = Buffer.from([0x55, 0x41, 0x50, 1]);
const HEADER_BYTES = 8;
const utf8 = new TextDecoder("utf-8", { fatal: true });

/**
 * Keep small JSON as SQLite TEXT. Larger values use a checksummed, versioned BLOB only when worthwhile.
 * @param {string} json Serialized semantic record or variant payload.
 * @returns {string | Buffer} Raw text, or a BLOB saving at least 32 bytes and one eighth of the input.
 */
export const encodeSqlitePayload = (json: string): string | Buffer => {
  const bytes = Buffer.byteLength(json);
  if (bytes > MAX_SQLITE_PAYLOAD_BYTES) {
    throw new Error(`SQLite record exceeds the ${MAX_SQLITE_PAYLOAD_BYTES}-byte payload limit.`);
  }
  // Per-record zlib setup dominates save/load time for small CFG and runtime records. Keep values
  // below 1 KiB as text. Previously compressed small records remain readable by the same decoder.
  if (bytes < 1024) {
    return json;
  }
  // Small metadata records do not need zlib's default 256 KiB working buffers. Bound their
  // compression window and hash table, retaining the full window for large payloads.
  const small = bytes < 16 * 1024;
  const compressed = deflateSync(json, {
    level: 1,
    windowBits: small ? 12 : 15,
    memLevel: small ? 3 : 8,
    chunkSize: Math.min(bytes, 16 * 1024),
  });
  if (compressed.length + HEADER_BYTES > bytes - Math.max(32, Math.ceil(bytes / 8))) {
    return json;
  }
  const result = Buffer.allocUnsafe(HEADER_BYTES + compressed.length);
  HEADER.copy(result);
  result.writeUInt32LE(bytes, 4);
  compressed.copy(result, HEADER_BYTES);
  return result;
};

/**
 * Decode one bounded payload, rejecting unknown codecs, corrupt checksums, and invalid UTF-8.
 * @param {unknown} value SQLite TEXT or a versioned compressed/packed BLOB.
 * @returns {string} Lossless semantic JSON. Malformed storage throws without returning partial content.
 */
export const decodeSqlitePayload = (value: unknown): string => {
  if (typeof value === "string") {
    if (Buffer.byteLength(value) > MAX_SQLITE_PAYLOAD_BYTES) {
      throw new Error("SQLite text payload exceeds the decoded size limit.");
    }
    return value;
  }
  // node:sqlite can return arrays created in another VM realm (including bundled extension hosts).
  // A realm-sensitive instanceof check would reject a valid stored BLOB during undo or import.
  if (!types.isUint8Array(value)) {
    throw new Error("Invalid SQLite payload representation.");
  }
  const encoded = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (isPackedRuntimePayload(encoded)) {
    return JSON.stringify(decodePackedRuntimePayload(encoded));
  }
  if (encoded.length <= HEADER_BYTES || !encoded.subarray(0, 4).equals(HEADER)) {
    throw new Error("Unsupported or truncated SQLite payload codec.");
  }
  const bytes = encoded.readUInt32LE(4);
  if (bytes === 0 || bytes > MAX_SQLITE_PAYLOAD_BYTES) {
    throw new Error("SQLite compressed payload exceeds the decoded size limit.");
  }
  try {
    // Most stored metadata is only hundreds of bytes. The default 16 KiB output chunk would
    // allocate many times the decoded data during a full metadata scan. Keep large rows chunked.
    const decoded = inflateSync(encoded.subarray(HEADER_BYTES), {
      maxOutputLength: bytes,
      chunkSize: Math.max(64, Math.min(bytes, 16 * 1024)),
    });
    if (decoded.length !== bytes) {
      throw new Error("Decoded payload length does not match its header.");
    }
    return utf8.decode(decoded);
  } catch (cause) {
    throw new Error("Corrupt SQLite compressed payload.", { cause });
  }
};

/** Parse owned semantic data, bypassing JSON serialization for packed runtime snapshots.
 * Callers validate the decoded value before use.
 * @param {unknown} value Stored TEXT or a supported versioned BLOB.
 * @returns {unknown} Decoded semantic data.
 */
export const parseSqlitePayload = (value: unknown): unknown => {
  if (types.isUint8Array(value) && isPackedRuntimePayload(value)) {
    return decodePackedRuntimePayload(value);
  }
  const parsed: unknown = JSON.parse(decodeSqlitePayload(value));
  return parsed;
};

/** Exact external ID split. BLOB suffixes represent only canonical lowercase SHA-256 text. */
export interface SqliteRuntimeIdentity {
  readonly prefix: string;
  readonly suffix: string | Buffer;
}

/**
 * Factor repeated capture prefixes without changing arbitrary caller-supplied IDs.
 * @param {string} id Complete stable semantic identifier.
 * @returns {SqliteRuntimeIdentity} Lossless prefix and typed suffix suitable for a composite unique key.
 */
export const sqliteRuntimeIdentity = (id: string): SqliteRuntimeIdentity => {
  const split = id.lastIndexOf(":") + 1;
  const suffix = id.slice(split);
  return {
    prefix: id.slice(0, split),
    suffix: /^[\da-f]{64}$/.test(suffix) ? Buffer.from(suffix, "hex") : suffix,
  };
};

/**
 * Reconstruct the original ID, preserving text case and non-hexadecimal suffixes.
 * @param {unknown} prefix Interned prefix text.
 * @param {unknown} suffix SQLite TEXT or a 32-byte hash BLOB.
 * @returns {string} Exact external ID. Invalid binary identities throw.
 */
export const decodeSqliteRuntimeIdentity = (prefix: unknown, suffix: unknown): string => {
  if (typeof prefix !== "string") {
    throw new Error("Invalid SQLite runtime ID prefix.");
  }
  if (typeof suffix === "string") {
    return prefix + suffix;
  }
  if (!types.isUint8Array(suffix) || suffix.length !== 32) {
    throw new Error("Invalid SQLite runtime ID suffix.");
  }
  return prefix + Buffer.from(suffix).toString("hex");
};
