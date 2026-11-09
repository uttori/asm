import { crc32 } from "node:zlib";
/** UAR/1 stores complete numeric 65816 snapshots; it never masks flags or drops registers. */
const MAGIC = Buffer.from([0x55, 0x41, 0x52, 1]);
/** Canonical field order is part of codec version 1. Widths are stored unsigned little-endian bytes. */
const FIELDS = [
    ["a", 2],
    ["d", 2],
    ["db", 1],
    ["e", 1],
    ["p", 1],
    ["pb", 1],
    ["pc", 2],
    ["s", 2],
    ["x", 2],
    ["y", 2],
];
const FIELD_NAMES = new Set(FIELDS.map(([key]) => key));
const HEADER_BYTES = 7;
const CHECKSUM_BYTES = 4;
/**
 * Encode only the common, exactly representable register shape. Undefined means the caller must
 * use its existing lossless codec; aliases, unknowns, booleans and extra fields must not be narrowed.
 * The presence mask distinguishes absent registers from observed zero. A CRC detects damaged values.
 * @param record Complete snapshot without projection or coercion.
 * @returns Packed bytes, or undefined when the general codec is required.
 */
export const encodePackedRuntimePayload = (record) => {
    if (Object.keys(record.state).some((key) => !FIELD_NAMES.has(key))) {
        return undefined;
    }
    const bytes = record.bytes;
    if (bytes !== undefined) {
        if (bytes.length < 1 || bytes.length > 4) {
            return undefined;
        }
        // Iterate values explicitly: array predicates skip holes, which must not become observed zeroes.
        for (const value of bytes) {
            if (!Number.isInteger(value) || value < 0 || value > 255) {
                return undefined;
            }
        }
    }
    let mask = 0;
    let size = HEADER_BYTES + (bytes?.length ?? 0) + CHECKSUM_BYTES;
    for (const [index, [key, width]] of FIELDS.entries()) {
        if (!Object.hasOwn(record.state, key)) {
            continue;
        }
        const value = record.state[key];
        const max = key === "e" ? 1 : 2 ** (width * 8) - 1;
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > max) {
            return undefined;
        }
        mask |= 1 << index;
        size += width;
    }
    const encoded = Buffer.allocUnsafe(size);
    MAGIC.copy(encoded);
    encoded.writeUInt16LE(mask, 4);
    encoded[6] = bytes?.length ?? 0;
    let offset = HEADER_BYTES;
    for (const byte of bytes ?? []) {
        encoded[offset++] = byte;
    }
    for (const [index, [key, width]] of FIELDS.entries()) {
        if (mask & (1 << index)) {
            const field = record.state[key];
            if (typeof field !== "number") {
                return undefined;
            }
            encoded.writeUIntLE(field, offset, width);
            offset += width;
        }
    }
    encoded.writeUInt32LE(crc32(encoded.subarray(0, offset)), offset);
    return encoded;
};
/**
 * Recognize the codec family even with a damaged version, so corrupt data cannot take a fallback.
 * @param bytes Stored binary value.
 * @returns Whether the family prefix identifies a packed runtime payload.
 */
export const isPackedRuntimePayload = (bytes) => bytes[0] === MAGIC[0] && bytes[1] === MAGIC[1] && bytes[2] === MAGIC[2];
/**
 * Decode one UAR/1 payload after validating its exact size, field mask, version and checksum.
 * The maximum encoding is 31 bytes, so validation never trusts a stored allocation length.
 * Returned objects and arrays are owned by the caller. Invalid encodings throw without partial data.
 * @param bytes Stored UAR payload, including header and checksum.
 * @returns Complete reconstructed snapshot.
 */
export const decodePackedRuntimePayload = (bytes) => {
    const encoded = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (encoded.length < HEADER_BYTES + CHECKSUM_BYTES || !encoded.subarray(0, 4).equals(MAGIC)) {
        throw new Error("Unsupported or truncated packed runtime payload.");
    }
    const mask = encoded.readUInt16LE(4);
    const byteCount = encoded[6];
    let expected = HEADER_BYTES + byteCount + CHECKSUM_BYTES;
    for (const [index, [, width]] of FIELDS.entries()) {
        if (mask & (1 << index)) {
            expected += width;
        }
    }
    if (mask >= 1 << FIELDS.length || byteCount > 4 || encoded.length !== expected) {
        throw new Error("Invalid packed runtime payload layout.");
    }
    const end = expected - CHECKSUM_BYTES;
    if (crc32(encoded.subarray(0, end)) !== encoded.readUInt32LE(end)) {
        throw new Error("Corrupt packed runtime payload checksum.");
    }
    const state = {};
    let offset = HEADER_BYTES + byteCount;
    for (const [index, [key, width]] of FIELDS.entries()) {
        if (mask & (1 << index)) {
            const value = encoded.readUIntLE(offset, width);
            if (key === "e" && value > 1) {
                throw new Error("Invalid packed emulation register.");
            }
            state[key] = value;
            offset += width;
        }
    }
    if (byteCount === 0) {
        return { state };
    }
    return { bytes: [...encoded.subarray(HEADER_BYTES, HEADER_BYTES + byteCount)], state };
};
//# sourceMappingURL=sqlite-runtime-payload.js.map