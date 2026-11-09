import { readAssetPng } from "@uttori/asm-assets/image";
export const WORLD_TILE_SIDE = 512;
export const WORLD_OVERVIEW_SIDE = WORLD_TILE_SIDE / 2;
export const WORLD_OVERVIEW_COLOR_COUNT = 0xc0;
const PALETTE_COLUMNS = 16;
/** Expand the BG1 direct-color bits for palette group zero to one opaque RGBA pixel. */
export function worldOverviewRgba(pixels) {
    const rgba = new Uint8Array(pixels.length * 4);
    const toByte = (value) => (value << 3) | (value >> 2);
    for (let i = 0; i < pixels.length; i++) {
        const color = pixels[i];
        rgba.set([toByte((color & 7) << 2), toByte((color & 0x38) >>> 1), toByte((color & 0xc0) >>> 3), 255], i * 4);
    }
    return rgba;
}
/** Average four source colors independently at their native 3-bit, 3-bit and 2-bit precision. */
export function averageOverviewColor(a, b, c, d) {
    const r = ((a & 7) + (b & 7) + (c & 7) + (d & 7)) >> 2;
    const g = (((a & 0x38) + (b & 0x38) + (c & 0x38) + (d & 0x38)) >> 2) & 0x38;
    const blue = (((a & 0xc0) + (b & 0xc0) + (c & 0xc0) + (d & 0xc0)) >> 2) & 0xc0;
    return r | g | blue;
}
/** Resolve one packed output pixel per 2×2 block of native tile IDs. */
export function composeWorldOverview(tiles, colors) {
    if (tiles.length !== WORLD_TILE_SIDE ** 2 || colors.length !== WORLD_OVERVIEW_COLOR_COUNT) {
        throw new Error("Flammie overview requires 512 × 512 tile IDs and 192 color entries.");
    }
    if (tiles.some((id) => id > WORLD_OVERVIEW_COLOR_COUNT)) {
        throw new Error("Flammie overview tile ID is outside the initialized color table.");
    }
    // The game appends black for tile C0 in WRAM. That entry occupies no ROM bytes.
    const lookup = new Uint8Array(WORLD_OVERVIEW_COLOR_COUNT + 1);
    lookup.set(colors);
    const pixels = new Uint8Array(WORLD_OVERVIEW_SIDE ** 2);
    for (let y = 0; y < WORLD_OVERVIEW_SIDE; y++) {
        const top = y * 2 * WORLD_TILE_SIDE;
        const bottom = top + WORLD_TILE_SIDE;
        for (let x = 0; x < WORLD_OVERVIEW_SIDE; x++) {
            const col = x * 2;
            pixels[y * WORLD_OVERVIEW_SIDE + x] = averageOverviewColor(lookup[tiles[top + col]], lookup[tiles[top + col + 1]], lookup[tiles[bottom + col]], lookup[tiles[bottom + col + 1]]);
        }
    }
    return pixels;
}
/** Encode the swatch PNG in native tile-ID order, preserving duplicate colors as distinct entries. */
export function convertWorldOverviewColors(source) {
    if (source.mediaType !== "image/png") {
        throw new Error("Flammie overview colors require a PNG.");
    }
    const image = readAssetPng(source.bytes).toRGBA({ copy: false });
    if (image.width !== PALETTE_COLUMNS ||
        image.height !== WORLD_OVERVIEW_COLOR_COUNT / PALETTE_COLUMNS) {
        throw new Error("Flammie overview colors require 16 × 12 opaque swatches.");
    }
    const colors = new Uint8Array(WORLD_OVERVIEW_COLOR_COUNT);
    for (let id = 0; id < colors.length; id++) {
        const [r, g, b, a] = image.rgba.subarray(id * 4, id * 4 + 4);
        colors[id] = (r >>> 5) | ((g >>> 5) << 3) | ((b >>> 6) << 6);
        const [nativeR, nativeG, nativeB] = worldOverviewRgba(colors.subarray(id, id + 1));
        // Reject ambiguous edits instead of silently rounding channels to a different SNES color.
        if (a !== 255 || r !== nativeR || g !== nativeG || b !== nativeB) {
            throw new Error(`Flammie overview swatch ${id} is outside the native direct-color gamut.`);
        }
    }
    return { primaryOutput: "colors", outputs: { colors: { bytes: colors } } };
}
/** Read the extracted world grid by PNG index so its display palette cannot change the map. */
export function readWorldOverviewTileIds(source) {
    if (source.mediaType !== "image/png") {
        throw new Error("Flammie overview tile IDs require an indexed PNG.");
    }
    const image = readAssetPng(source.bytes).toIndexed({ copy: false });
    if (image.width !== WORLD_TILE_SIDE || image.height !== WORLD_TILE_SIDE) {
        throw new Error("Flammie overview tile IDs require a 512 × 512 grid.");
    }
    return image.indexes;
}
//# sourceMappingURL=world-overview.js.map