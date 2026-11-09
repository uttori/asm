/** Native color source and editor rendering for the Mode 3 Flammie overview. */
import type { AssetInput } from "@uttori/asm-assets";
export declare const WORLD_TILE_SIDE = 512;
export declare const WORLD_OVERVIEW_SIDE: number;
export declare const WORLD_OVERVIEW_COLOR_COUNT = 192;
/** Expand the BG1 direct-color bits for palette group zero to one opaque RGBA pixel. */
export declare function worldOverviewRgba(pixels: Uint8Array): Uint8Array;
/** Average four source colors independently at their native 3-bit, 3-bit and 2-bit precision. */
export declare function averageOverviewColor(a: number, b: number, c: number, d: number): number;
/** Resolve one packed output pixel per 2×2 block of native tile IDs. */
export declare function composeWorldOverview(tiles: Uint8Array, colors: Uint8Array): Uint8Array;
/** Encode the swatch PNG in native tile-ID order, preserving duplicate colors as distinct entries. */
export declare function convertWorldOverviewColors(source: AssetInput): {
    primaryOutput: string;
    outputs: {
        colors: {
            bytes: Uint8Array<ArrayBuffer>;
        };
    };
};
/** Read the extracted world grid by PNG index so its display palette cannot change the map. */
export declare function readWorldOverviewTileIds(source: AssetInput): Uint8Array;
//# sourceMappingURL=world-overview.d.ts.map