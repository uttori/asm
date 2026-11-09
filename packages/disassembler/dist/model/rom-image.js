import { createHash } from "node:crypto";
import * as fs from "node:fs";
/**
 * Hash bytes for ROM identity.
 * @param bytes Bytes to hash.
 * @returns Lowercase hex SHA-256 digest.
 */
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
/**
 * Infers a 0- or 512-byte copier header from file size (`size % 0x8000`).
 * @param fileSize Complete file length in bytes.
 * @returns `0` or `512`.
 * @throws {Error} When `fileSize` is negative or not 32 KiB aligned with either header size.
 */
export const detectCopierHeaderSize = (fileSize) => {
    if (fileSize < 0) {
        throw new Error("ROM size cannot be negative.");
    }
    const remainder = fileSize % 0x8000;
    if (remainder === 0) {
        return 0;
    }
    if (remainder === 512) {
        return 512;
    }
    throw new Error(`ROM size ${fileSize} is not aligned to a 32 KiB image with either a 0-byte or 512-byte copier header. Pass an explicit header override.`);
};
/**
 * Immutable, bounds-safe view of a user-supplied ROM.
 * The constructor copies input bytes so later mutation of the caller's buffer is ignored.
 */
export class RomImage {
    /** File and content hashes, sizes, and detected or overridden header size. */
    identity;
    /** Path passed to `RomImage.load`, if the image came from disk. */
    sourcePath;
    #fileBytes;
    #contentBytes;
    /**
     * Copy file bytes and split off the copier and container headers.
     * @param bytes Complete file bytes. Copied immediately.
     * @param [options] Header override and optional origin path.
     */
    constructor(bytes, options = {}) {
        this.#fileBytes = Uint8Array.from(bytes);
        const container = options.container;
        if (container &&
            (!container.format || !Number.isSafeInteger(container.headerSize) || container.headerSize < 0)) {
            throw new Error("Invalid target container header.");
        }
        const headerSize = options.headerSize ?? (container ? 0 : detectCopierHeaderSize(this.#fileBytes.length));
        const contentStart = headerSize + (container?.headerSize ?? 0);
        if (contentStart > this.#fileBytes.length) {
            throw new Error(`Header size ${contentStart} exceeds ROM size ${this.#fileBytes.length}.`);
        }
        this.#contentBytes = this.#fileBytes.slice(contentStart);
        this.sourcePath = options.sourcePath;
        this.identity = Object.freeze({
            sha256: sha256(this.#fileBytes),
            contentSha256: sha256(this.#contentBytes),
            fileSize: this.#fileBytes.length,
            contentSize: this.#contentBytes.length,
            headerSize,
            ...(container ? { container: Object.freeze({ ...container }) } : {}),
        });
    }
    /**
     * Reads a ROM from disk and records `sourcePath`.
     * @param file Path to the ROM file.
     * @param [options] Optional explicit copier-header size.
     * @returns Loaded image.
     */
    static load(file, options = {}) {
        return new RomImage(fs.readFileSync(file), { ...options, sourcePath: file });
    }
    /**
     * Headerless cartridge length in bytes.
     * @returns The headerless cartridge length in bytes.
     */
    get length() {
        return this.#contentBytes.length;
    }
    /**
     * Read one content byte without throwing on invalid offsets.
     * @param offset Headerless file offset.
     * @returns Byte value, or `undefined` when out of range.
     */
    readByte(offset) {
        return Number.isInteger(offset) && offset >= 0 && offset < this.length
            ? this.#contentBytes[offset]
            : undefined;
    }
    /**
     * Copy a content range; partial ranges are rejected rather than truncated.
     * @param offset Headerless file offset.
     * @param length Number of bytes to copy.
     * @returns A copy of the slice, or `undefined` when out of range.
     */
    read(offset, length) {
        if (!Number.isInteger(offset) ||
            !Number.isInteger(length) ||
            offset < 0 ||
            length < 0 ||
            offset + length > this.length) {
            return undefined;
        }
        return this.#contentBytes.slice(offset, offset + length);
    }
    /**
     * Returns a defensive copy. Callers cannot mutate the loaded image.
     * @returns The headerless ROM content.
     */
    bytes() {
        return this.#contentBytes.slice();
    }
    /**
     * Returns a defensive copy of the optional 512-byte copier header.
     * @returns The copier header bytes.
     */
    copierHeaderBytes() {
        return this.#fileBytes.slice(0, this.identity.headerSize);
    }
    /**
     * Returns a defensive copy of the complete file, including any copier header.
     * @returns The complete file bytes.
     */
    fileBytes() {
        return this.#fileBytes.slice();
    }
}
//# sourceMappingURL=rom-image.js.map