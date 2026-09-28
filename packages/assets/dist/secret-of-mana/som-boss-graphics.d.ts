/**
 * Expand the MSB-first boss graphics mask stream used after the optional SoM LZ stage.
 * Clear bits copy the byte two outputs earlier; both history bytes start at zero.
 * Native callers round requested bytes to eight; the returned source extent excludes
 * any speculative reads or padding after the last group.
 * @param {Uint8Array} source Mask stream.
 * @param {number} size Requested output size before eight-byte rounding.
 * @returns {{data: Uint8Array, consumed: number}} Expanded bytes and the consumed source length.
 */
export declare function expandBossGraphics(source: Uint8Array, size: number): {
    data: Uint8Array<ArrayBuffer>;
    consumed: number;
};
/** Encode each byte as a literal unless the game's two-byte history can reproduce it.
 * @param {Uint8Array} data Expanded bytes, a positive multiple of eight.
 * @returns {Uint8Array} Mask stream that expands back to `data`.
 */
export declare function encodeBossGraphics(data: Uint8Array): Uint8Array<ArrayBuffer>;
//# sourceMappingURL=som-boss-graphics.d.ts.map