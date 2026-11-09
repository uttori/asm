/**
 * Immutable `Uint8Array`-backed decoder input. The constructor copies its
 * input so callers cannot mutate bytes while an analysis is in progress.
 */
export class Uint8ArrayDecoderSource {
    #bytes;
    /**
     * Copies the provided bytes into private storage.
     * @param bytes Source bytes; values are wrapped modulo 256 by `Uint8Array.from`.
     */
    constructor(bytes) {
        this.#bytes = Uint8Array.from(bytes);
    }
    /**
     * The length of the byte source.
     * @returns The length of the byte source.
     */
    get length() {
        return this.#bytes.length;
    }
    /**
     * Reads a byte from the byte source.
     * @param offset The offset to read from.
     * @returns The byte at the offset, or undefined if the offset is out of bounds.
     */
    readByte(offset) {
        if (!Number.isInteger(offset) || offset < 0 || offset >= this.#bytes.length) {
            return undefined;
        }
        return this.#bytes[offset];
    }
    /**
     * Reads bytes from the byte source.
     * @param offset The offset to read from.
     * @param length The length to read.
     * @returns The bytes at the offset and length, or undefined if the offset or length is out of bounds.
     */
    readBytes(offset, length) {
        if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0) {
            return undefined;
        }
        const end = offset + length;
        if (!Number.isSafeInteger(end) || end > this.#bytes.length) {
            return undefined;
        }
        return this.#bytes.slice(offset, end);
    }
}
//# sourceMappingURL=decoder-types.js.map