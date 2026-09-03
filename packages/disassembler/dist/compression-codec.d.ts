import type { AssetValue } from "./asset-codec.js";
/** Context supplied to a target- or game-owned compression codec. */
export interface CompressionCodecContext {
    readonly options?: AssetValue;
}
/** Reversible byte-to-byte compressor kept separate from semantic asset codecs. */
export interface CompressionCodec {
    /** Stable namespaced id persisted by project annotations. */
    readonly id: string;
    /** Implementation version used for provenance and cache invalidation. */
    readonly version: string;
    decode(encoded: Uint8Array, context: CompressionCodecContext): Uint8Array;
    encode(decoded: Uint8Array, context: CompressionCodecContext): Uint8Array;
}
/** Fixed ownership and optional bank restrictions for one compressed ROM range. */
export interface CompressionRangeConstraints {
    readonly sourceOffset: number;
    /** Exact existing ROM extent. Recompression never changes this replacement size. */
    readonly originalSize: number;
    /** Largest legal compressed stream; defaults to `originalSize`. */
    readonly maximumSize?: number;
    /** Optional half-open bank bounds. Both values must be supplied together. */
    readonly bankStart?: number;
    readonly bankEnd?: number;
    /** Fill unused bytes after a shorter stream; otherwise preserve the original tail. */
    readonly fillByte?: number;
}
/** Deterministic verification of one existing compressed stream. */
export interface CompressionVerificationRecord {
    readonly codecId: string;
    readonly codecVersion: string;
    readonly sourceOffset: number;
    readonly encodedSize: number;
    readonly decodedSize: number;
    readonly encodedSha256: string;
    readonly decodedSha256: string;
}
/** Fixed-size patch produced after constraint-checked recompression. */
export interface CompressionReencodeResult {
    /** The compressor's meaningful stream before range padding/preservation. */
    readonly encoded: Uint8Array;
    /** Exact `originalSize` bytes safe to overlay without shifting later regions. */
    readonly replacement: Uint8Array;
    readonly unusedSize: number;
}
/** Stable-id compression registry. Game plugins can extend it without core changes. */
export declare class CompressionCodecRegistry {
    #private;
    register(codec: CompressionCodec): this;
    resolve(id: string): CompressionCodec;
    list(): readonly CompressionCodec[];
}
/**
 * Verifies deterministic decode/encode behavior and an exact no-op compressed round trip.
 * A plugin codec cannot enter an editing pipeline until this gate succeeds.
 * @param {CompressionCodecRegistry} registry Composed compression registry.
 * @param {string} codecId Stable compressor id.
 * @param {Uint8Array} encoded Existing compressed stream.
 * @param {CompressionRangeConstraints} constraints Fixed ownership and bank constraints.
 * @param {AssetValue} [options] JSON-safe plugin codec options.
 * @returns {CompressionVerificationRecord} Stable verification fingerprints.
 */
export declare const verifyCompressionCodec: (registry: CompressionCodecRegistry, codecId: string, encoded: Uint8Array, constraints: CompressionRangeConstraints, options?: AssetValue) => CompressionVerificationRecord;
/**
 * Recompresss edited data into an exact-size replacement, rejecting capacity,
 * bank, nondeterminism, and semantic round-trip failures before returning bytes.
 * @param {CompressionCodecRegistry} registry Composed compression registry.
 * @param {string} codecId Stable compressor id.
 * @param {Uint8Array} decoded Edited uncompressed bytes.
 * @param {Uint8Array} existing Existing fixed-size compressed range.
 * @param {CompressionRangeConstraints} constraints Fixed ownership and bank constraints.
 * @param {AssetValue} [options] JSON-safe plugin codec options.
 * @returns {CompressionReencodeResult} Meaningful stream and exact-size replacement.
 */
export declare const reencodeCompressedRange: (registry: CompressionCodecRegistry, codecId: string, decoded: Uint8Array, existing: Uint8Array, constraints: CompressionRangeConstraints, options?: AssetValue) => CompressionReencodeResult;
//# sourceMappingURL=compression-codec.d.ts.map