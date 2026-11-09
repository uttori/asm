import { constants, zstdCompressSync, zstdDecompressSync } from "node:zlib";
import { crc32cBytes } from "@uttori/data-tools/data-hash-crc32";
/** Both stored and decoded ACT2 chunks include a 64-byte envelope within this bound. */
const chunkBytes = 262144;
/**
 * Require one dictionary-free, single-segment Zstandard frame with the declared size.
 * Checking the frame before decoding bounds its window and rejects trailing/concatenated
 * frames that some decompressors would otherwise accept as additional evidence.
 * @param frame Stored payload, already protected by the ACT2 checksum.
 * @param decodedBytes Required output bytes, at most 262080.
 */
function validateFrame(frame, decodedBytes) {
    if (frame.length < 6 || frame.readUInt32LE(0) !== 0xfd2fb528) {
        throw new Error("Invalid capture Zstandard frame.");
    }
    const descriptor = frame[4];
    if (!(descriptor & 0x20) || descriptor & 0x1b) {
        throw new Error("Capture Zstandard frame must use a bounded single segment without a dictionary.");
    }
    const sizeBytes = [1, 2, 4, 8][descriptor >>> 6];
    if (5 + sizeBytes > frame.length) {
        throw new Error("Truncated capture Zstandard size.");
    }
    let contentSize;
    if (sizeBytes === 8) {
        contentSize = frame.readBigUInt64LE(5);
    }
    else {
        contentSize = BigInt(frame.readUIntLE(5, sizeBytes));
        if (sizeBytes === 2) {
            contentSize += 256n;
        }
    }
    if (contentSize !== BigInt(decodedBytes)) {
        throw new Error("Capture Zstandard content size disagrees with the envelope.");
    }
    let offset = 5 + sizeBytes;
    let last = false;
    while (!last) {
        if (offset + 3 > frame.length) {
            throw new Error("Truncated capture Zstandard block.");
        }
        const block = frame.readUIntLE(offset, 3);
        const kind = (block >>> 1) & 3;
        const length = block >>> 3;
        if (kind === 3 || length > Math.min(decodedBytes, 131072)) {
            throw new Error("Invalid capture Zstandard block bound.");
        }
        last = Boolean(block & 1);
        offset += 3 + (kind === 1 ? 1 : length);
        if (offset > frame.length) {
            throw new Error("Truncated capture Zstandard payload.");
        }
    }
    if (descriptor & 4) {
        offset += 4;
    }
    if (offset !== frame.length) {
        throw new Error("Capture Zstandard frame has trailing or missing bytes.");
    }
}
/**
 * Validate physical framing/CRC and restore a canonical raw ACT2 chunk. Raw input is
 * returned as a borrowed view; compressed input owns a new bounded buffer. CRC covers
 * stored bytes, including flags and both lengths; semantic record checks follow decoding.
 * @param bytes One complete stored chunk.
 * @returns Original event bytes with the canonical raw envelope/checksum.
 */
export function decodeCaptureChunkBytes(bytes) {
    if (bytes.length < 64 || bytes.length > chunkBytes) {
        throw new Error("Capture chunk length exceeds bounds.");
    }
    const stored = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const codec = stored.readUInt16LE(6);
    if (stored.toString("ascii", 0, 4) !== "ACT2" ||
        stored.readUInt16LE(4) !== 2 ||
        codec > 1 ||
        stored.readUInt32LE(44) !== 64 ||
        stored.readUInt32LE(60) !== 0) {
        throw new Error("Unsupported capture envelope.");
    }
    const decodedLength = stored.readUInt32LE(52);
    if (stored.readUInt32LE(48) !== stored.length - 64 ||
        decodedLength > chunkBytes - 64 ||
        (codec === 0 && decodedLength !== stored.length - 64)) {
        throw new Error("Capture payload lengths disagree.");
    }
    if (crc32cBytes(stored, true) !== stored.readUInt32LE(56)) {
        throw new Error("Capture checksum mismatch.");
    }
    if (codec === 0) {
        return stored;
    }
    if (!decodedLength) {
        throw new Error("Compressed capture payload is empty.");
    }
    const frame = stored.subarray(64);
    validateFrame(frame, decodedLength);
    const payload = zstdDecompressSync(frame, { maxOutputLength: decodedLength });
    if (payload.length !== decodedLength) {
        throw new Error("Capture decoded payload length disagrees.");
    }
    const raw = Buffer.concat([stored.subarray(0, 64), payload]);
    raw.writeUInt16LE(0, 6);
    raw.writeUInt32LE(decodedLength, 48);
    raw.writeUInt32LE(crc32cBytes(raw, true), 56);
    return raw;
}
/**
 * Store a validated raw chunk as an independent level-3 Zstandard frame. Incompressible
 * data borrows the raw input unchanged, so encoded chunks never exceed the old bound.
 * @param bytes Raw ACT2 envelope and records; never modified.
 * @returns Encoded chunk, or a borrowed raw view when compression would expand it.
 */
export function compressCaptureChunk(bytes) {
    const raw = decodeCaptureChunkBytes(bytes);
    const frame = zstdCompressSync(raw.subarray(64), {
        params: { [constants.ZSTD_c_compressionLevel]: 3 },
    });
    if (frame.length >= raw.length - 64) {
        return raw;
    }
    validateFrame(frame, raw.length - 64);
    const stored = Buffer.concat([raw.subarray(0, 64), frame]);
    stored.writeUInt16LE(1, 6);
    stored.writeUInt32LE(frame.length, 48);
    stored.writeUInt32LE(crc32cBytes(stored, true), 56);
    return stored;
}
//# sourceMappingURL=capture-compression.js.map