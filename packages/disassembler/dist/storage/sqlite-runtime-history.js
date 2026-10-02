import { TextDecoder, types } from "node:util";
import { crc32, deflateSync, inflateSync } from "node:zlib";
function historyPayload(value) {
    if (value === null || typeof value === "string" || types.isUint8Array(value)) {
        return value;
    }
    throw new Error("Invalid runtime history payload.");
}
const MAGIC = Buffer.from([0x55, 0x48, 0x42, 1]);
const MAX_ROWS = 1024;
const MAX_BYTES = 32 * 1024 * 1024;
const TARGET_BYTES = 256 * 1024;
const CACHE_BYTES = 4 * 1024 * 1024;
const utf8 = new TextDecoder("utf-8", { fatal: true });
/** Immutable blocks belong to the database, independently of disposable capture files. */
export const RUNTIME_HISTORY_SCHEMA = `CREATE TABLE runtime_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, first_fid INTEGER NOT NULL, last_fid INTEGER NOT NULL,
  payload BLOB NOT NULL
);
CREATE TRIGGER runtime_history_immutable BEFORE UPDATE ON runtime_history BEGIN
  SELECT RAISE(ABORT,'Runtime history blocks are immutable');
END;`;
/** Encode bounded records together so repeated register bytes share one compression dictionary.
 * The offset directory preserves empty TEXT/BLOB and NULL independently. CRC covers the directory
 * as well as the record bytes; corrupt lengths are rejected before decompression allocation.
 * @param {readonly HistoryValue[]} values Between 1 and 1024 exact SQLite payloads.
 * @returns {Buffer} Versioned, checksummed DEFLATE block, limited to 32 MiB decoded.
 */
export const encodeRuntimeHistory = (values) => {
    if (!values.length || values.length > MAX_ROWS) {
        throw new Error("Invalid runtime history record count.");
    }
    const records = values.map((value) => {
        if (value === null) {
            return Buffer.from([0]);
        }
        const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
        return Buffer.concat([Buffer.from([typeof value === "string" ? 1 : 2]), bytes]);
    });
    const directoryBytes = (values.length + 1) * 4;
    const size = directoryBytes + records.reduce((n, record) => n + record.length, 0);
    if (size > MAX_BYTES) {
        throw new Error("Runtime history block exceeds its decoded byte limit.");
    }
    const body = Buffer.allocUnsafe(size);
    let offset = directoryBytes;
    for (const [index, record] of records.entries()) {
        body.writeUInt32LE(offset, index * 4);
        record.copy(body, offset);
        offset += record.length;
    }
    body.writeUInt32LE(offset, values.length * 4);
    const header = Buffer.allocUnsafe(16);
    MAGIC.copy(header);
    header.writeUInt32LE(values.length, 4);
    header.writeUInt32LE(size, 8);
    header.writeUInt32LE(crc32(body), 12);
    return Buffer.concat([header, deflateSync(body, { level: 6 })]);
};
/** Validate the entire directory without allocating one object for every unrequested record.
 * @param {Uint8Array} encoded Complete persisted block, including its header.
 * @returns {HistoryBlock} Checked bytes and record count; malformed bounds, types, or checksums throw.
 */
const decodeHistoryBlock = (encoded) => {
    const bytes = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
    if (bytes.length < 17 || !bytes.subarray(0, 4).equals(MAGIC)) {
        throw new Error("Unsupported runtime history block.");
    }
    const count = bytes.readUInt32LE(4);
    const size = bytes.readUInt32LE(8);
    if (!count || count > MAX_ROWS || size < (count + 1) * 4 + count || size > MAX_BYTES) {
        throw new Error("Invalid runtime history block bounds.");
    }
    const body = inflateSync(bytes.subarray(16), { maxOutputLength: size });
    if (body.length !== size || crc32(body) !== bytes.readUInt32LE(12)) {
        throw new Error("Corrupt runtime history block.");
    }
    let start = body.readUInt32LE(0);
    if (start !== (count + 1) * 4) {
        throw new Error("Invalid runtime history offset directory.");
    }
    for (let index = 0; index < count; index++) {
        const end = body.readUInt32LE((index + 1) * 4);
        if (end <= start || end > size) {
            throw new Error("Invalid runtime history record extent.");
        }
        const type = body[start];
        if ((type === 0 && end !== start + 1) || (type !== 0 && type !== 1 && type !== 2)) {
            throw new Error("Invalid runtime history storage type.");
        }
        start = end;
    }
    if (start !== size) {
        throw new Error("Trailing runtime history bytes.");
    }
    return { body, count };
};
/** Resolve one checked slot without materializing its neighbors. BLOB slices share block ownership.
 * @param {HistoryBlock} block Validated directory and immutable decompressed bytes.
 * @param {number} slot In-range zero-based position, checked by the caller.
 * @returns {HistoryValue} Exact SQLite storage type; malformed UTF-8 text throws.
 */
const historyValue = (block, slot) => {
    const start = block.body.readUInt32LE(slot * 4);
    const end = block.body.readUInt32LE((slot + 1) * 4);
    const type = block.body[start];
    if (type === 0) {
        return null;
    }
    const value = block.body.subarray(start + 1, end);
    return type === 1 ? utf8.decode(value) : value;
};
/** Decode every exact typed payload; BLOB slices share the owned decompressed block.
 * @param {Uint8Array} encoded Complete persisted block, including its header.
 * @returns {HistoryValue[]} Values in slot order; malformed bounds, types, checksums, or text throw.
 */
export const decodeRuntimeHistory = (encoded) => {
    const block = decodeHistoryBlock(encoded);
    return Array.from({ length: block.count }, (_, slot) => historyValue(block, slot));
};
/** Register bounded block reads on every application connection before preparing runtime views.
 * Blocks are immutable and committed IDs never repeat. Clear the cache at transaction boundaries
 * because rolled-back inserts can reuse an ID; no cached value may outlive that rollback.
 * @param {DatabaseSync} db Owned connection; call before preparing queries against runtime views.
 * @returns {Function} Cache reset owned by the connection's transaction lifecycle.
 */
export const registerRuntimeHistory = (db) => {
    const cache = new Map();
    let used = 0;
    let read;
    db.function("analysis_history_payload", (id, slot) => {
        if (typeof id !== "number" ||
            !Number.isSafeInteger(id) ||
            id <= 0 ||
            typeof slot !== "number" ||
            !Number.isSafeInteger(slot) ||
            slot < 0) {
            throw new Error("Invalid runtime history reference.");
        }
        let block = cache.get(id);
        if (!block) {
            read ??= db.prepare("SELECT payload FROM runtime_history WHERE id=?");
            const encoded = read.get(id)?.payload;
            if (!types.isUint8Array(encoded)) {
                throw new Error("Missing runtime history block.");
            }
            block = decodeHistoryBlock(encoded);
            const size = block.body.byteLength + 128;
            // A single large metadata payload must not permanently enlarge the read cache.
            if (size <= CACHE_BYTES) {
                while (used + size > CACHE_BYTES) {
                    const first = cache.keys().next().value;
                    used -= cache.get(first).body.byteLength + 128;
                    cache.delete(first);
                }
                cache.set(id, block);
                used += size;
            }
        }
        if (slot >= block.count) {
            throw new Error("Runtime history slot is out of bounds.");
        }
        return historyValue(block, slot);
    });
    return () => {
        cache.clear();
        used = 0;
    };
};
/** Seal newly written payloads inside the owning publication transaction. Existing blocks never
 * change, so readers and concurrent snapshots retain exact values. The partial pending index
 * prevents every annotation edit from rescanning the complete retained history.
 * @param {DatabaseSync} db Connection inside the owning writer transaction.
 * @param {Function} [onProgress] Optional cumulative sealed-fact counter; throwing aborts publication.
 * @returns {number} Facts moved from inline payloads to immutable blocks.
 */
export const packRuntimeHistory = (db, onProgress) => {
    if (!db.isTransaction) {
        throw new Error("Runtime history packing requires a transaction.");
    }
    const pending = db.prepare("SELECT fid,payload FROM runtime_fact_rows WHERE history_id IS NULL ORDER BY fid LIMIT ?");
    const insert = db.prepare("INSERT INTO runtime_history(first_fid,last_fid,payload) VALUES(?,?,?)");
    const update = db.prepare("UPDATE runtime_fact_rows SET payload=NULL,history_id=?,history_slot=? WHERE fid=?");
    let packed = 0;
    for (;;) {
        const rows = [];
        let size = 0;
        // Stop fetching at the byte target instead of materializing 1,024 potentially large payloads.
        // Leaving the loop closes its cursor before the same table is updated below.
        for (const row of pending.iterate(MAX_ROWS)) {
            const value = historyPayload(row.payload);
            const bytes = typeof value === "string" ? Buffer.byteLength(value) : (value?.byteLength ?? 0);
            if (rows.length && size + bytes > TARGET_BYTES) {
                break;
            }
            rows.push(row);
            size += bytes;
        }
        if (!rows.length) {
            return packed;
        }
        const encoded = encodeRuntimeHistory(rows.map((row) => historyPayload(row.payload)));
        const id = insert.run(rows[0].fid, rows[rows.length - 1].fid, encoded).lastInsertRowid;
        for (const [slot, row] of rows.entries()) {
            update.run(id, slot, row.fid);
        }
        packed += rows.length;
        onProgress?.(packed);
    }
};
/** Reclaim dead blocks/descriptors during explicit maintenance. Block fid bounds let the
 * observation lifecycle avoid another per-fact index solely for garbage collection.
 * Partially live blocks are retained: deletion must never remove another fact's payload.
 * @param {DatabaseSync} db Connection inside the explicit maintenance transaction.
 */
export const collectRuntimeHistory = (db) => {
    db.exec(`DELETE FROM runtime_history WHERE NOT EXISTS(
    SELECT 1 FROM runtime_fact_rows f WHERE f.fid>=runtime_history.first_fid
      AND f.fid<=runtime_history.last_fid AND f.history_id=runtime_history.id);
    DELETE FROM runtime_descriptors WHERE NOT EXISTS(
      SELECT 1 FROM runtime_fact_rows f WHERE f.descriptor_id=runtime_descriptors.did);`);
};
//# sourceMappingURL=sqlite-runtime-history.js.map