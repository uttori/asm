/** Decode BRR PCM while preserving predictor history across an optional loop replay.
 * @param {Uint8Array} bytes Complete encoded BRR blocks ending in END.
 * @param {number} loopOffset Optional loop start in BRR bytes, aligned to nine.
 * @param {number} repeatCount Number of extra loop passes to decode for seam review.
 * @returns {Int16Array} Integer PCM samples at the caller's explicit playback rate.
 */
export declare function decodeBrrPcm(bytes: Uint8Array, loopOffset?: number, repeatCount?: number): Int16Array;
/** Encode whole 16-sample PCM blocks with deterministic range/filter selection.
 * @param {Int16Array} samples Signed PCM16 samples, already padded if requested.
 * @param {boolean} loop Whether the final END block also carries LOOP.
 * @returns {Uint8Array} Headerless BRR data; sample rate and loop offset stay in metadata.
 */
export declare function encodeBrrPcm(samples: Int16Array, loop: boolean): Uint8Array;
//# sourceMappingURL=brr-codec.d.ts.map