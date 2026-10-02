/** Integer array encoding options, independent of any ROM address. */
export interface ScalarArrayOptions {
    readonly width: 1 | 2 | 3 | 4;
    readonly endian: "little" | "big";
    readonly signed?: boolean;
}
/** Decode fixed-width integers, retaining the width and signedness selected by the caller.
 * @param {Uint8Array} bytes Borrowed packed integer bytes.
 * @param {ScalarArrayOptions} options Width, endian order and signedness.
 * @returns {number[]} Decoded integers in input order.
 */
export declare function decodeScalarArray(bytes: Uint8Array, options: ScalarArrayOptions): number[];
/** Encode fresh integer arrays, rejecting overflow instead of truncating high bits.
 * @param {number[]} values Integer values to pack.
 * @param {ScalarArrayOptions} options Width, endian order and signedness.
 * @returns {Uint8Array} Owned packed bytes.
 */
export declare function encodeScalarArray(values: readonly number[], options: ScalarArrayOptions): Uint8Array;
//# sourceMappingURL=data-scalar.d.ts.map