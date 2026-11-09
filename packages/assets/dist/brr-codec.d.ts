/**
 * Decode BRR PCM while preserving predictor history across an optional loop replay.
 * @param bytes Complete encoded BRR blocks ending in END.
 * @param loopOffset Optional loop start in BRR bytes, aligned to nine.
 * @param repeatCount Number of extra loop passes to decode for seam review.
 * @returns Integer PCM samples at the caller's explicit playback rate.
 */
export declare function decodeBrrPcm(bytes: Uint8Array, loopOffset?: number, repeatCount?: number): Int16Array;
/**
 * Encode whole 16-sample PCM blocks with deterministic range/filter selection.
 * @param samples Signed PCM16 samples, already padded if requested.
 * @param loop Whether the final END block also carries LOOP.
 * @returns Headerless BRR data; sample rate and loop offset stay in metadata.
 */
export declare function encodeBrrPcm(samples: Int16Array, loop: boolean): Uint8Array;
//# sourceMappingURL=brr-codec.d.ts.map