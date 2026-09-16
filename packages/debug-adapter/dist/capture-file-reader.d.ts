/** Positional I/O supplied by the owning file/cancellation context. */
type ReadCaptureRange = (buffer: Buffer, offset: number, length: number, position: number) => Promise<{
    bytesRead: number;
}>;
/** Bounded read-ahead for sequential ACT2 frame components. Returned copies remain
 * valid across refills; a small retained prefix cannot pin an entire read window.
 * Live callers create a fresh reader per slice so unconsumed bytes cannot outlive
 * that slice's file snapshot. Only bytes below the supplied watermark are read.
 * Calls must be serialized because refills reuse mutable storage. The window
 * bounds this reader's buffer, not decoder allocations or total process RSS.
 */
export declare class CaptureFrameReader {
    #private;
    /** Window bytes are in [1, 1048576], default 1 MiB; every component must fit.
     * The cap amortizes small metadata reads without loading an entire archive.
     */
    constructor(read: ReadCaptureRange, windowBytes?: number);
    /** Read one validated component (at most 256 KiB), bounded by a snapshot or
     * durable watermark. Short I/O is retried; premature EOF is always an error.
     * @param {number} length Component bytes, no larger than the read window.
     * @param {number} offset Absolute nonnegative file position.
     * @param {number} limit Exclusive snapshot/durable byte boundary.
     * @returns {Promise<Buffer>} Owned component bytes, valid across subsequent refills.
     */
    read(length: number, offset: number, limit: number): Promise<Buffer>;
}
export {};
//# sourceMappingURL=capture-file-reader.d.ts.map