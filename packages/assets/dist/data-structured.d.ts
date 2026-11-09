import { type ScalarArrayOptions } from "./data-scalar.js";
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
    /** Byte length of one record including padding. */
    readonly stride: number;
    /** Non-overlapping scalar and bitfield members. */
    readonly fields: readonly StructField[];
}
/** Fields are decoded values; raw retains unknown bits and padding. */
export interface StructRecords {
    /** Decoded field values per record in file order. */
    readonly records: readonly Readonly<Record<string, number>>[];
    /** Original bytes preserving unknown bits and padding. */
    readonly raw: Uint8Array;
}
/**
 * Decode records while retaining exact backing bytes for later edits.
 * @param bytes Borrowed complete record stream.
 * @param layout Field locations and byte stride.
 * @returns Decoded fields and an owned raw snapshot.
 */
export declare function decodeStructRecords(bytes: Uint8Array, layout: StructLayout): StructRecords;
/**
 * Encode records while preserving unknown bits, or explicitly zero-fill new padding.
 * @param records Field values in record order.
 * @param layout Field locations and byte stride.
 * @param backing Original bytes; omit only with explicit zero padding.
 * @param padding Required policy for newly authored records.
 * @returns Owned packed records.
 */
export declare function encodeStructRecords(records: readonly Readonly<Record<string, number>>[], layout: StructLayout, backing?: Uint8Array, padding?: "zero"): Uint8Array;
/** Address interpretation is explicit; a null sentinel cannot alias a real address. */
export interface PointerTableOptions extends ScalarArrayOptions {
    /** Addend applied after scaling packed values. */
    readonly base: number;
    /** Multiplier on each stored pointer word before adding `base`. */
    readonly scale: number;
    /** Raw word value representing a null pointer when present. */
    readonly nullValue?: number;
}
/**
 * Decode fixed-width pointers to absolute addresses.
 * @param bytes Borrowed packed pointer values.
 * @param options Width, endian order, base, scale and optional null sentinel.
 * @returns Addresses or nulls in table order.
 */
export declare function decodePointerTable(bytes: Uint8Array, options: PointerTableOptions): Array<number | null>;
/**
 * Encode exact representable pointer addresses without inventing ROM locations.
 * @param addresses Absolute addresses or nulls.
 * @param options Width, endian order, base, scale and optional null sentinel.
 * @returns Owned packed pointer values.
 */
export declare function encodePointerTable(addresses: readonly (number | null)[], options: PointerTableOptions): Uint8Array;
/** Index interpretation is separate from qualified analysis references. */
export interface IndexTableOptions extends ScalarArrayOptions {
    /** Addend applied to each stored index word. */
    readonly baseIndex: number;
    /** Raw word value representing a missing index when present. */
    readonly nullValue?: number;
}
/**
 * Decode semantic indexes without resolving game-specific target IDs.
 * @param bytes Borrowed packed index values.
 * @param options Width, endian order, base index and optional null sentinel.
 * @returns Indexes or nulls in table order.
 */
export declare function decodeIndexTable(bytes: Uint8Array, options: IndexTableOptions): Array<number | null>;
/**
 * Encode semantic indexes, rejecting nulls and values that do not fit storage.
 * @param indexes Logical indexes or nulls.
 * @param options Width, endian order, base index and optional null sentinel.
 * @returns Owned packed index values.
 */
export declare function encodeIndexTable(indexes: readonly (number | null)[], options: IndexTableOptions): Uint8Array;
//# sourceMappingURL=data-structured.d.ts.map