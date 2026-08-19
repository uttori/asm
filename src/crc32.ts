/**
 * A utility class for computing CRC32 checksums.
 */
export class CRC32 {
  /** Precomputed CRC32 table. */
  static table: Uint32Array = CRC32.makeCRCTable();

  /**
   * Builds the lookup table used for CRC32 computation.
   * @returns {Uint32Array} The result.
   */
  static makeCRCTable(): Uint32Array {
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
  public static compute(data: number[] | Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc = CRC32.table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
}
