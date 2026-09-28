/**
 * A utility class for computing CRC32 checksums.
 */
export class CRC32 {
    /** Precomputed CRC32 table. */
    static table = CRC32.makeCRCTable();
    /**
     * Builds the lookup table used for CRC32 computation.
     * @returns {Uint32Array} 256 unsigned entries for the reflected CRC32 polynomial.
     */
    static makeCRCTable() {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }
            table[i] = c;
        }
        return table;
    }
    /**
     * Computes the CRC32 checksum for the given data.
     * @param {number[] | Uint8Array} data A Uint8Array (or Node.js Buffer) of data.
     * @returns {number} The computed CRC32 checksum.
     */
    static compute(data) {
        let crc = 0xffffffff;
        // oxlint-disable-next-line typescript/prefer-for-of
        for (let i = 0; i < data.length; i++) {
            crc = CRC32.table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }
}
//# sourceMappingURL=crc32.js.map