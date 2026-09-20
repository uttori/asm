/** Bounded read-ahead for sequential ACT2 frame components. Returned copies remain
 * valid across refills. A small retained prefix cannot pin an entire read window.
 * Live callers create a fresh reader per slice so unconsumed bytes cannot outlive
 * that slice's file snapshot. Only bytes below the supplied watermark are read.
 * Calls must be serialized because refills reuse mutable storage. The window
 * bounds this reader's buffer, not decoder allocations or total process RSS.
 */
export class CaptureFrameReader {
    #read;
    #windowBytes;
    #buffer = Buffer.alloc(0);
    #start = 0;
    #valid = 0;
    /** Window bytes are in [1, 1048576], default 1 MiB. Every component must fit.
     * The cap amortizes small metadata reads without loading an entire archive.
     */
    constructor(read, windowBytes = 1048576) {
        if (!Number.isSafeInteger(windowBytes) || windowBytes < 1 || windowBytes > 1048576)
            throw new Error("Invalid capture read-ahead window.");
        this.#read = read;
        this.#windowBytes = windowBytes;
    }
    /** Read one validated component (at most 256 KiB), bounded by a snapshot or
     * durable watermark. Short I/O is retried. Premature EOF is always an error.
     * @param {number} length Component bytes, no larger than the read window.
     * @param {number} offset Absolute nonnegative file position.
     * @param {number} limit Exclusive snapshot/durable byte boundary.
     * @returns {Promise<Buffer>} Owned component bytes, valid across subsequent refills.
     */
    async read(length, offset, limit) {
        if (!Number.isSafeInteger(length) ||
            length < 0 ||
            length > Math.min(262144, this.#windowBytes) ||
            !Number.isSafeInteger(offset) ||
            offset < 0 ||
            !Number.isSafeInteger(limit) ||
            offset + length > limit)
            throw new Error("Torn capture frame or invalid component length.");
        const relative = offset - this.#start;
        let available = 0;
        // Buffered bytes still obey the caller's current snapshot/durable limit.
        // their presence in memory is not evidence that they may be consumed.
        if (relative >= 0 && relative <= this.#valid)
            available = Math.min(this.#valid - relative, limit - offset);
        // Copy intentionally: views would alias later refills. Immutable windows keep
        // views valid but let tiny components retain whole windows and benchmarked at higher RSS.
        if (available >= length)
            return Buffer.from(this.#buffer.subarray(relative, relative + length));
        const nextLength = Math.min(this.#windowBytes, limit - offset);
        // Idle live polls allocate nothing. Short durable prefixes allocate only
        // their available bytes. Offline scans reuse the full window after first fill.
        const next = this.#buffer.length >= nextLength ? this.#buffer : Buffer.allocUnsafe(nextLength);
        // Carry the unconsumed tail forward instead of rereading it when a frame
        // crosses the window boundary. Copies returned earlier cannot alias this
        // reusable window. This bounds external-buffer retention during long imports.
        if (available)
            this.#buffer.copy(next, 0, relative, relative + available);
        this.#buffer = next;
        // Invalidate before I/O: a short read or failure must not expose partially
        // filled allocUnsafe storage as a valid cached frame on a later call.
        this.#valid = 0;
        let got = available;
        while (got < nextLength) {
            const { bytesRead } = await this.#read(this.#buffer, got, nextLength - got, offset + got);
            if (!bytesRead)
                throw new Error("Torn capture frame.");
            got += bytesRead;
        }
        this.#start = offset;
        this.#valid = got;
        return Buffer.from(this.#buffer.subarray(0, length));
    }
}
//# sourceMappingURL=capture-file-reader.js.map