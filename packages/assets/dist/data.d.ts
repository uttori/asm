import type { AssetEncoder, AssetImporter } from "./registry.js";
export * from "./data-structured.js";
export * from "./data-text.js";
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
/** Raw byte importer copies input so the result is independent of host buffers. */
export declare const rawImporter: AssetImporter;
/** Identity encoder for files or independently assembled code images. */
export declare const rawEncoder: AssetEncoder;
/** JSON authoring input for native models; validation belongs to the selected encoder. */
export declare const jsonImporter: AssetImporter;
//# sourceMappingURL=data.d.ts.map