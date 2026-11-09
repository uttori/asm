import type { AssetEncoder } from "./registry.js";
/** One 8×8 tile of native palette indexes, with rows in display order. */
export type Tile = readonly (readonly number[])[];
/** Native planar depths; Mode 7 uses a separate byte-per-pixel layout. */
export type PlanarDepth = 2 | 3 | 4 | 8;
/** A CGRAM word retains bit 15 even though it has no displayed color channel. */
export interface Bgr555Color {
    /** Five-bit red channel in CGRAM order. */
    readonly red: number;
    /** Five-bit green channel in CGRAM order. */
    readonly green: number;
    /** Five-bit blue channel in CGRAM order. */
    readonly blue: number;
    /** Hardware bit 15 preserved on round trip. */
    readonly unusedHighBit: number;
}
/** One SNES background map word, including attributes that previews may ignore. */
export interface BgMapEntry {
    /** Ten-bit tile index into VRAM tile data. */
    readonly tile: number;
    /** Three-bit palette bank for the cell. */
    readonly palette: number;
    /** Priority bit selecting between BG layers. */
    readonly priority: number;
    /** Horizontal flip flag stored in the map word. */
    readonly horizontalFlip: number;
    /** Vertical flip flag stored in the map word. */
    readonly verticalFlip: number;
}
/** A native BRR block; nibbles are signed integers, not decoded PCM samples. */
export interface BrrBlock {
    /** Four-bit range field in the block header. */
    readonly range: number;
    /** Two-bit filter selector in the block header. */
    readonly filter: number;
    /** Loop flag in the block header. */
    readonly loop: number;
    /** End-of-stream flag in the block header. */
    readonly end: number;
    /** Sixteen signed sample nibbles packed in pairs. */
    readonly nibbles: readonly number[];
}
/**
 * Decode complete planar tiles; the caller retains ownership of input bytes.
 * @param bytes Borrowed complete tile stream.
 * @param depth Native bit planes per pixel.
 * @returns Display-order tiles with separate pixel arrays.
 */
export declare function decodePlanarTiles(bytes: Uint8Array, depth: PlanarDepth): Tile[];
/**
 * Encode new planar tiles without a source ROM or fixed output capacity.
 * @param tiles Display-order pixels, each exactly 8×8.
 * @param depth Native bit planes per pixel.
 * @returns Owned planar tile bytes.
 */
export declare function encodePlanarTiles(tiles: readonly Tile[], depth: PlanarDepth): Uint8Array;
/**
 * Decode Mode 7's chunky tile bytes, which differ from planar 8bpp.
 * @param bytes Borrowed complete tile stream.
 * @returns Display-order tiles with byte indexes.
 */
export declare function decodeMode7Tiles(bytes: Uint8Array): Tile[];
/**
 * Encode Mode 7's row-major byte-per-pixel tiles.
 * @param tiles Display-order pixels, each exactly 8×8.
 * @returns Owned chunky tile bytes.
 */
export declare function encodeMode7Tiles(tiles: readonly Tile[]): Uint8Array;
/**
 * Decode exact CGRAM words, including the unused high bit.
 * @param bytes Borrowed little-endian CGRAM words.
 * @returns 5-bit channels and preserved bit 15.
 */
export declare function decodeBgr555(bytes: Uint8Array): Bgr555Color[];
/**
 * Encode fresh CGRAM colors; callers choose any desired palette padding.
 * @param colors 5-bit channels and explicit bit 15.
 * @returns Owned little-endian CGRAM words.
 */
export declare function encodeBgr555(colors: readonly Bgr555Color[]): Uint8Array;
/**
 * Decode packed BG map words in storage order; screen layout is a separate concern.
 * @param bytes Borrowed little-endian map words.
 * @returns Every tile index and attribute field.
 */
export declare function decodeBgMap(bytes: Uint8Array): BgMapEntry[];
/**
 * Encode BG map words without assigning physical screen blocks.
 * @param entries Map entries already arranged in storage order.
 * @returns Owned little-endian map words.
 */
export declare function encodeBgMap(entries: readonly BgMapEntry[]): Uint8Array;
/**
 * Decode byte-indexed Mode 7 maps, retaining index zero as an ordinary value.
 * @param bytes Borrowed map index bytes.
 * @returns A copied array of tile indexes.
 */
export declare function decodeMode7Map(bytes: Uint8Array): number[];
/**
 * Encode byte-indexed Mode 7 maps.
 * @param indexes Tile indexes in native map storage order.
 * @returns Owned map bytes.
 */
export declare function encodeMode7Map(indexes: readonly number[]): Uint8Array;
/**
 * Decode native BRR block fields only; this does not reconstruct PCM.
 * @param bytes Borrowed complete nine-byte blocks.
 * @returns Signed nibbles and exact header fields.
 */
export declare function decodeBrrBlocks(bytes: Uint8Array): BrrBlock[];
/**
 * Encode signed BRR nibbles byte-exactly; PCM encoding is a different, lossy operation.
 * @param blocks Native BRR headers and signed nibbles.
 * @returns Owned nine-byte blocks.
 */
export declare function encodeBrrBlocks(blocks: readonly BrrBlock[]): Uint8Array;
/** Native model encoders use the canonical short IDs and need no ROM or assembler. */
export declare const snesNativeEncoders: readonly AssetEncoder[];
//# sourceMappingURL=snes.d.ts.map