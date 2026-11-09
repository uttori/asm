/** Integer array encoding options, independent of any ROM address. */
export interface ScalarArrayOptions {
    /** Byte width of each encoded integer. */
    readonly width: 1 | 2 | 3 | 4;
    /** Byte order within each encoded word. */
    readonly endian: "little" | "big";
    /** Interpret high bit as two's complement when true. */
    readonly signed?: boolean;
}
/**
 * Decode fixed-width integers, retaining the width and signedness selected by the caller.
 * @param bytes Borrowed packed integer bytes.
 * @param options Width, endian order and signedness.
 * @returns Decoded integers in input order.
 */
export declare function decodeScalarArray(bytes: Uint8Array, options: ScalarArrayOptions): number[];
/**
 * Encode fresh integer arrays, rejecting overflow instead of truncating high bits.
 * @param values Integer values to pack.
 * @param options Width, endian order and signedness.
 * @returns Owned packed bytes.
 */
export declare function encodeScalarArray(values: readonly number[], options: ScalarArrayOptions): Uint8Array;
//# sourceMappingURL=data-scalar.d.ts.map