import type { Tile } from "./snes.js";
/** Encode a bounded RGBA preview as a portable PNG, scaling only for presentation.
 * @param {Uint8Array | Uint8ClampedArray} rgba Exact row-major RGBA8 pixels, including Canvas buffers.
 * @param {number} width Original pixel width.
 * @param {number} height Original pixel height.
 * @param {number} maxEdge Longest displayed edge in pixels, at most 1024.
 * @returns {Uint8Array} Complete PNG bytes.
 */
export declare function rgbaPreviewPng(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, maxEdge?: number): Uint8Array;
/** Draw bounded min/max PCM buckets without changing the audio used for playback.
 * @param {Int16Array} samples Signed source or decoded PCM16 frames.
 * @returns {Uint8Array} A 256×64 PNG waveform thumbnail.
 */
export declare function waveformPreviewPng(samples: Int16Array): Uint8Array;
/** Render one indexed tile to an owned RGBA buffer for a caller-owned PNG writer.
 * @param {Tile} tile Display-order indexes for one 8×8 tile.
 * @param {number[][]} palette RGBA8 entries in index order.
 * @returns {Uint8Array} Owned row-major RGBA8 pixels.
 */
export declare function tileRgba(tile: Tile, palette: readonly (readonly [number, number, number, number])[]): Uint8Array;
//# sourceMappingURL=preview.d.ts.map