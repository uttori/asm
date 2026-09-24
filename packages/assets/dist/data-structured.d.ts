import { type ScalarArrayOptions } from "./data.js";
/** One non-overlapping scalar or LSB0 bit field in a fixed-size record. */
export type StructField = Readonly<{
    name: string;
    kind: "scalar";
    offset: number;
    width: 1 | 2 | 3 | 4;
    endian?: "little" | "big";
    signed?: boolean;
}> | Readonly<{
    name: string;
    kind: "bitfield";
    bitOffset: number;
    bits: number;
    signed?: boolean;
}>;
/** Fixed record layout; stride may include unused bytes that require preservation. */
export interface StructLayout {
    readonly stride: number;
    readonly fields: readonly StructField[];
}
/** Fields are decoded values; raw retains unknown bits and padding. */
export interface StructRecords {
    readonly records: readonly Readonly<Record<string, number>>[];
    readonly raw: Uint8Array;
}
/** Decode records while retaining exact backing bytes for later edits.
 * @param {Uint8Array} bytes Borrowed complete record stream.
 * @param {StructLayout} layout Field locations and byte stride.
 * @returns {StructRecords} Decoded fields and an owned raw snapshot.
 */
export declare function decodeStructRecords(bytes: Uint8Array, layout: StructLayout): StructRecords;
/** Encode records while preserving unknown bits, or explicitly zero-fill new padding.
 * @param {Record<string, number>[]} records Field values in record order.
 * @param {StructLayout} layout Field locations and byte stride.
 * @param {Uint8Array} backing Original bytes; omit only with explicit zero padding.
 * @param {string} padding Required policy for newly authored records.
 * @returns {Uint8Array} Owned packed records.
 */
export declare function encodeStructRecords(records: readonly Readonly<Record<string, number>>[], layout: StructLayout, backing?: Uint8Array, padding?: "zero"): Uint8Array;
/** Address interpretation is explicit; a null sentinel cannot alias a real address. */
export interface PointerTableOptions extends ScalarArrayOptions {
    readonly base: number;
    readonly scale: number;
    readonly nullValue?: number;
}
/** Decode fixed-width pointers to absolute addresses.
 * @param {Uint8Array} bytes Borrowed packed pointer values.
 * @param {PointerTableOptions} options Width, endian order, base, scale and optional null sentinel.
 * @returns {(number|null)[]} Addresses or nulls in table order.
 */
export declare function decodePointerTable(bytes: Uint8Array, options: PointerTableOptions): Array<number | null>;
/** Encode exact representable pointer addresses without inventing ROM locations.
 * @param {(number|null)[]} addresses Absolute addresses or nulls.
 * @param {PointerTableOptions} options Width, endian order, base, scale and optional null sentinel.
 * @returns {Uint8Array} Owned packed pointer values.
 */
export declare function encodePointerTable(addresses: readonly (number | null)[], options: PointerTableOptions): Uint8Array;
/** Index interpretation is separate from qualified analysis references. */
export interface IndexTableOptions extends ScalarArrayOptions {
    readonly baseIndex: number;
    readonly nullValue?: number;
}
/** Decode semantic indexes without resolving game-specific target IDs.
 * @param {Uint8Array} bytes Borrowed packed index values.
 * @param {PointerTableOptions} options Width, endian order, base index and optional null sentinel.
 * @returns {(number|null)[]} Indexes or nulls in table order.
 */
export declare function decodeIndexTable(bytes: Uint8Array, options: IndexTableOptions): Array<number | null>;
/** Encode semantic indexes, rejecting nulls and values that do not fit storage.
 * @param {(number|null)[]} indexes Logical indexes or nulls.
 * @param {PointerTableOptions} options Width, endian order, base index and optional null sentinel.
 * @returns {Uint8Array} Owned packed index values.
 */
export declare function encodeIndexTable(indexes: readonly (number | null)[], options: IndexTableOptions): Uint8Array;
//# sourceMappingURL=data-structured.d.ts.map