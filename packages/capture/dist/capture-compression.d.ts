/**
 * Validate physical framing/CRC and restore a canonical raw ACT2 chunk. Raw input is
 * returned as a borrowed view; compressed input owns a new bounded buffer. CRC covers
 * stored bytes, including flags and both lengths; semantic record checks follow decoding.
 * @param {Uint8Array} bytes One complete stored chunk.
 * @returns {Buffer} Original event bytes with the canonical raw envelope/checksum.
 */
export declare function decodeCaptureChunkBytes(bytes: Uint8Array): Buffer;
/**
 * Store a validated raw chunk as an independent level-3 Zstandard frame. Incompressible
 * data borrows the raw input unchanged, so encoded chunks never exceed the old bound.
 * @param {Uint8Array} bytes Raw ACT2 envelope and records; never modified.
 * @returns {Buffer} Encoded chunk, or a borrowed raw view when compression would expand it.
 */
export declare function compressCaptureChunk(bytes: Uint8Array): Buffer;
//# sourceMappingURL=capture-compression.d.ts.map