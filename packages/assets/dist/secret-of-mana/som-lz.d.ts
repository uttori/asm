/** Mode, reserved byte and big-endian decoded-size word precede every stream. */
export declare const LZ_HEADER_BYTES = 4;
/** High token bit selects a two-byte backward reference. */
export declare const LZ_COPY_FLAG = 128;
/** Remaining token bits share the length and distance-high fields. */
export declare const LZ_TOKEN_PAYLOAD_MASK: number;
/** Copy lengths store length minus three; MVN receives length minus one. */
export declare const LZ_MIN_COPY_BYTES = 3;
/** A literal token encodes one through 128 following bytes. */
export declare const LZ_MAX_LITERAL_BYTES = 128;
/** Each mask bit extends the backward distance above its eight-bit low byte. */
export declare const LZ_DISTANCE_LOW_VALUES = 256;
/** Maximum byte count representable by the header, independent of destination bank bounds. */
export declare const LZ_MAX_OUTPUT_BYTES = 65535;
/** Mode-dependent distance masks read by the game's $C14C30 decoder from $C14C00. */
export declare const DISTANCE_MASKS: number[];
/**
 * Decode the boot/graphics LZ format, not the room tilemap codec.
 * Header: mode byte 0..5, one unused byte, big-endian uint16 output size.
 * Returns the exact encoded extent, excluding the game's speculative next-token read at completion.
 * Throws on truncated input, references before output, or runs exceeding the declared size.
 * @param source Encoded boot or graphics stream.
 * @param [offset] Index of the four-byte header.
 * @param [maxOutputBytes] Maximum accepted decoded size.
 * @returns Decoded bytes and the consumed encoded extent.
 */
export declare function decompressSomLz(source: Uint8Array, offset?: number, maxOutputBytes?: number): {
    data: Uint8Array<ArrayBuffer>;
    mode: number;
    unusedHeaderByte: number;
    compressedBytes: number;
    end: number;
    literalRuns: number;
    copyRuns: number;
};
/**
 * Encode bytes for the game's $C14C30 decoder. Each mode chooses a lowest-cost
 * token parse from bounded match candidates, preferring longer runs and then
 * nearer distances on equal cost; `auto` chooses the shortest stream, then lowest mode.
 * The unused header byte is explicit because original ROM headers may differ.
 * This does not preserve an original stream's token choices.
 * @param source Plain bytes to encode.
 * @param [options] `mode` and `unusedHeaderByte`.
 * @returns Shortest accepted stream for the selected mode.
 */
export declare function compressSomLz(source: Uint8Array, options?: unknown): Uint8Array<ArrayBufferLike>;
//# sourceMappingURL=som-lz.d.ts.map