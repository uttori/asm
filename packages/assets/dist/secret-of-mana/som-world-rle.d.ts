/** World-map row codec used by the self-modifying $000B00 decoder, separate from room pieces. */
/**
 * Decode exactly `size` tiles. C0..FF consume a following tile and emit (token & 63)+1
 * copies. Reject a run crossing the row boundary; return the consumed extent separately.
 * @param bytes Encoded world-map row.
 * @param [size] Output tile count.
 * @returns Decoded tiles and the consumed input length.
 */
export declare function decodeWorldRow(bytes: Uint8Array, size?: number): {
    data: Uint8Array<ArrayBuffer>;
    consumed: number;
};
/**
 * Canonical inverse; unchanged native streams should be retained to preserve original token choices.
 * @param bytes Decoded row tiles.
 * @returns Encoded row.
 */
export declare function encodeWorldRow(bytes: Uint8Array): Uint8Array<ArrayBuffer>;
/**
 * Each row's bank is a bit, least-significant first; there is no pointer-wrap heuristic.
 * @param bankBits Sixty-four bank-selection bytes.
 * @param row Row index, 0 through 511.
 * @returns Bank byte `$C6` or `$C7`.
 */
export declare function worldRowBank(bankBits: Uint8Array, row: number): number;
//# sourceMappingURL=som-world-rle.d.ts.map