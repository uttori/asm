/**
 * A utility class for computing CRC32 checksums.
 */
export declare class CRC32 {
    /** Precomputed CRC32 table. */
    static table: Uint32Array;
    /**
     * Builds the lookup table used for CRC32 computation.
     * @returns {Uint32Array} The result.
     */
    static makeCRCTable(): Uint32Array;
    /**
     * Computes the CRC32 checksum for the given data.
     * @param {number[] | Uint8Array} data A Uint8Array (or Node.js Buffer) of data.
     * @returns {number} The computed CRC32 checksum.
     */
    static compute(data: number[] | Uint8Array): number;
}
//# sourceMappingURL=crc32.d.ts.map