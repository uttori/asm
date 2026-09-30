import type { RuntimeStateValue } from "../model/project-types.js";
/** Complete instruction payload, or a standalone state when bytes is absent. */
export interface PackedRuntimePayload {
    readonly bytes?: readonly number[];
    readonly state: Readonly<Record<string, RuntimeStateValue>>;
}
/**
 * Encode only the common, exactly representable register shape. Undefined means the caller must
 * use its existing lossless codec; aliases, unknowns, booleans and extra fields must not be narrowed.
 * The presence mask distinguishes absent registers from observed zero. A CRC detects damaged values.
 * @param {PackedRuntimePayload} record Complete snapshot without projection or coercion.
 * @returns {Buffer | undefined} Packed bytes, or undefined when the general codec is required.
 */
export declare const encodePackedRuntimePayload: (record: PackedRuntimePayload) => Buffer | undefined;
/** Recognize the codec family even with a damaged version, so corrupt data cannot take a fallback.
 * @param {Uint8Array} bytes Stored binary value.
 * @returns {boolean} Whether the family prefix identifies a packed runtime payload.
 */
export declare const isPackedRuntimePayload: (bytes: Uint8Array) => boolean;
/**
 * Decode one UAR/1 payload after validating its exact size, field mask, version and checksum.
 * The maximum encoding is 31 bytes, so validation never trusts a stored allocation length.
 * Returned objects and arrays are owned by the caller. Invalid encodings throw without partial data.
 * @param {Uint8Array} bytes Stored UAR payload, including header and checksum.
 * @returns {PackedRuntimePayload} Complete reconstructed snapshot.
 */
export declare const decodePackedRuntimePayload: (bytes: Uint8Array) => PackedRuntimePayload;
//# sourceMappingURL=sqlite-runtime-payload.d.ts.map