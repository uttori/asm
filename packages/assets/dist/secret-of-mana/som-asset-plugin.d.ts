import type { AssetInput } from "../registry.js";
/**
 * Rebuild a fixed ROM span from previewable pixels. An unchanged PNG retains the
 * source's exact token choices; edited pixels use the two-stage encoder and pad
 * only after the decoder's complete stream, preserving later ROM addresses.
 * @param {AssetInput} source Indexed PNG, optionally carrying a native chunk.
 * @param {Readonly<Record<string, unknown>>} options Storage, length, and optional atlas resources.
 * @param {Readonly<Record<string, AssetInput>>} [resources] Layout and palette sidecars.
 * @returns {{primaryOutput: string, outputs: {graphics: {bytes: Uint8Array}}}} Fixed-span native bytes.
 */
export declare function convertBossImage(source: AssetInput, options: Readonly<Record<string, unknown>>, resources?: Readonly<Record<string, AssetInput>>): {
    primaryOutput: string;
    outputs: {
        graphics: {
            bytes: Uint8Array<ArrayBufferLike>;
        };
    };
};
/**
 * Read the native BRR chunk from a playable PCM WAVE and verify every decoded sample.
 * @param {import('@uttori/asm-assets').AssetInput} source Authored WAVE with an sBRR chunk.
 * @returns {Uint8Array} Exact complete BRR stream owned by the caller.
 */
export declare function verifiedBrrFromWave(source: AssetInput): Uint8Array<ArrayBufferLike>;
/**
 * Select the ROM-owned part of a verified stream after decoding the complete WAVE.
 * A bank split may occur inside a nine-byte BRR block, so slices are not decoded alone.
 * @param {Uint8Array} brr Complete native BRR stream.
 * @param {Readonly<Record<string, unknown>>} options Half-open byte slice in that stream.
 * @returns {Uint8Array} Owned bytes for the selected ROM bank span.
 */
export declare function sliceBrrSegment(brr: Uint8Array, options: Readonly<Record<string, unknown>>): Uint8Array<ArrayBuffer>;
/**
 * Convert native 4bpp group indexes to the game's 24-byte interleaved rows.
 * Only zero and the five colors of the selected actor group are representable;
 * native source colors 6/7 both render transparent and cannot be reconstructed.
 * @param {Uint8Array} planar Native 4bpp tiles.
 * @param {number} group Actor palette group, 0 through 2.
 * @returns {Uint8Array} Interleaved 3bpp rows.
 */
export declare function encodeActor3bpp(planar: Uint8Array, group: number): Uint8Array<ArrayBuffer>;
/** Decode native interleaved rows to source indexes 0..7, retaining 0/6/7 separately.
 * @param {Uint8Array} bytes Interleaved 3bpp tiles.
 * @returns {number[][][]} Tile, row, and pixel indexes.
 */
export declare function decodeActor3bppNative(bytes: Uint8Array): number[][][];
/** Re-encode native source indexes exactly, including transparent aliases 6 and 7.
 * @param {readonly (readonly (readonly number[])[])[]} tiles Native 3bpp indexes.
 * @returns {Uint8Array} Interleaved 3bpp rows.
 */
export declare function encodeActor3bppNative(tiles: readonly (readonly (readonly number[])[])[]): Uint8Array<ArrayBuffer>;
/** Decode authored tiles to 4bpp group indexes, refusing lossy 6/7 aliases.
 * @param {Uint8Array} bytes Interleaved 3bpp tiles.
 * @param {number} group Actor palette group, 0 through 2.
 * @returns {Uint8Array} Native 4bpp tiles.
 */
export declare function decodeActor3bpp(bytes: Uint8Array, group: number): Uint8Array<ArrayBufferLike>;
/** Reviewed forest title traversal: bottom block rows, TL/BL/BR/TR within each block. */
export declare const somTitleLayout: Readonly<{
    tileOrder: "blocks";
    blockSize: number[];
    blockOrder: "row-major";
    blockRows: "bottom-to-top";
    withinBlock: "tl-bl-br-tr";
}>;
declare const plugin: import("@uttori/asm-core/plugin").AssemblerPlugin<unknown>;
export default plugin;
//# sourceMappingURL=som-asset-plugin.d.ts.map