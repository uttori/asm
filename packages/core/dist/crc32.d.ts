/** Portable CRC-32/ISO-HDLC compatibility facade for assembler and debug-map consumers. */
export declare class CRC32 {
    /** Legacy lookup-table snapshot for inspection; mutations do not customize compute().
     * @deprecated Use node:zlib in Node-only code or data-tools in portable integrations.
     */
    static table: Uint32Array;
    /**
     * Return an independent snapshot of the standard reflected CRC32 lookup table.
     * @returns {Uint32Array} 256 unsigned entries for the reflected CRC32 polynomial.
     */
    static makeCRCTable(): Uint32Array;
    /**
     * Computes the CRC32 checksum for the given data.
     * @param {number[] | Uint8Array} data A Uint8Array (or Node.js Buffer) of data.
     * @returns {number} Unsigned CRC-32, without modifying the input.
     */
    static compute(data: number[] | Uint8Array): number;
}
//# sourceMappingURL=crc32.d.ts.map