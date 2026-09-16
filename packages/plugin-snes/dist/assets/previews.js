import { SNES_BRR_ASSET_CODEC_ID } from "./brr.js";
import { SNES_PALETTE_ASSET_CODEC_ID } from "./palette.js";
import { SNES_BG_TILEMAP_ASSET_CODEC_ID, SNES_MODE7_TILEMAP_ASSET_CODEC_ID } from "./tilemap.js";
import { SNES_MODE7_TILE_ASSET_CODEC_ID, SNES_TILE_2BPP_ASSET_CODEC_ID, SNES_TILE_3BPP_ASSET_CODEC_ID, SNES_TILE_4BPP_ASSET_CODEC_ID, SNES_TILE_8BPP_ASSET_CODEC_ID, } from "./tiles.js";
/** Stable id of the deterministic SNES SVG preview renderer. */
export const SNES_SVG_ASSET_PREVIEW_ID = "snes.preview.svg";
const objectValue = (value, name) => {
    if (!value || Array.isArray(value) || typeof value !== "object") {
        throw new Error(`${name} must be an object.`);
    }
    return value;
};
const arrayValue = (value, name) => {
    if (!Array.isArray(value))
        throw new Error(`${name} must be an array.`);
    return value;
};
const numberValue = (value, name) => {
    if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error(`${name} must be numeric.`);
    return value;
};
const byteHex = (value) => Math.round(value).toString(16).padStart(2, "0");
const svgFile = (id, body) => [
    {
        path: `previews/${id.replaceAll("/", "_").replaceAll(":", "_")}.svg`,
        mediaType: "image/svg+xml",
        bytes: new TextEncoder().encode(body),
    },
];
const svg = (width, height, content, total) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges" data-total="${total}"><rect width="100%" height="100%" fill="#101418"/>${content}</svg>\n`;
const renderTiles = (id, value) => {
    const allTiles = arrayValue(value.tiles, "SNES preview tiles");
    const tiles = allTiles.slice(0, 256);
    const bitsPerPixel = numberValue(value.bitsPerPixel, "SNES preview bitsPerPixel");
    const maximum = 2 ** bitsPerPixel - 1;
    const columns = Math.min(16, Math.max(1, Math.ceil(Math.sqrt(tiles.length))));
    const rows = Math.ceil(tiles.length / columns);
    const scale = 3;
    const parts = [];
    tiles.forEach((tile, tileIndex) => arrayValue(tile, `SNES preview tile ${tileIndex}`).forEach((row, y) => arrayValue(row, `SNES preview tile ${tileIndex} row ${y}`).forEach((pixel, x) => {
        const intensity = (numberValue(pixel, "SNES preview pixel") * 255) / maximum;
        const color = byteHex(intensity);
        const tileX = (tileIndex % columns) * 8;
        const tileY = Math.floor(tileIndex / columns) * 8;
        parts.push(`<rect x="${(tileX + x) * scale}" y="${(tileY + y) * scale}" width="${scale}" height="${scale}" fill="#${color}${color}${color}"/>`);
    })));
    return svgFile(id, svg(columns * 8 * scale, rows * 8 * scale, parts.join(""), allTiles.length));
};
const renderPalette = (id, value) => {
    const allColors = arrayValue(value.colors, "SNES preview colors");
    const colors = allColors.slice(0, 256);
    const columns = Math.min(16, Math.max(1, colors.length));
    const rows = Math.ceil(colors.length / columns);
    const size = 18;
    const parts = colors.map((entry, index) => {
        const color = objectValue(entry, `SNES preview color ${index}`);
        const red = byteHex((numberValue(color.red, "SNES preview red") * 255) / 31);
        const green = byteHex((numberValue(color.green, "SNES preview green") * 255) / 31);
        const blue = byteHex((numberValue(color.blue, "SNES preview blue") * 255) / 31);
        return `<rect x="${(index % columns) * size}" y="${Math.floor(index / columns) * size}" width="${size}" height="${size}" fill="#${red}${green}${blue}"/>`;
    });
    return svgFile(id, svg(columns * size, rows * size, parts.join(""), allColors.length));
};
const indexColor = (index) => `#${byteHex((index * 73) & 0xff)}${byteHex((index * 151) & 0xff)}${byteHex((index * 199) & 0xff)}`;
const renderTilemap = (id, value) => {
    const rawEntries = value.entries ?? value.indexes;
    const allEntries = arrayValue(rawEntries, "SNES preview tilemap entries");
    const entries = allEntries.slice(0, 1024);
    const declaredWidth = typeof value.width === "number" ? value.width : undefined;
    const columns = Math.min(32, Math.max(1, declaredWidth ?? Math.ceil(Math.sqrt(entries.length))));
    const rows = Math.ceil(entries.length / columns);
    const cell = 8;
    const parts = entries.map((entry, index) => {
        const tile = typeof entry === "number"
            ? numberValue(entry, "SNES preview Mode 7 index")
            : numberValue(objectValue(entry, `SNES preview tilemap entry ${index}`).tile, "SNES preview tile");
        return `<rect x="${(index % columns) * cell}" y="${Math.floor(index / columns) * cell}" width="${cell}" height="${cell}" fill="${indexColor(tile)}"/>`;
    });
    return svgFile(id, svg(columns * cell, rows * cell, parts.join(""), allEntries.length));
};
const renderBrr = (id, value) => {
    const allBlocks = arrayValue(value.blocks, "SNES preview BRR blocks");
    const blocks = allBlocks.slice(0, 128);
    const samples = blocks.flatMap((block, blockIndex) => arrayValue(objectValue(block, `SNES preview BRR block ${blockIndex}`).nibbles, "BRR nibbles").map((sample) => numberValue(sample, "BRR encoded nibble")));
    const width = Math.max(1, samples.length * 2);
    const height = 64;
    const points = samples.map((sample, index) => `${index * 2},${32 - sample * 3}`).join(" ");
    const content = `<line x1="0" y1="32" x2="${width}" y2="32" stroke="#56616b"/><polyline points="${points}" fill="none" stroke="#7ee787" stroke-width="1"/>`;
    return svgFile(id, svg(width, height, content, allBlocks.length));
};
/** Deterministic, bounded SVG diagnostics for every built-in SNES media codec. */
export const snesSvgAssetPreviewRenderer = Object.freeze({
    id: SNES_SVG_ASSET_PREVIEW_ID,
    version: "1.0.0",
    codecIds: [
        SNES_BRR_ASSET_CODEC_ID,
        SNES_PALETTE_ASSET_CODEC_ID,
        SNES_BG_TILEMAP_ASSET_CODEC_ID,
        SNES_MODE7_TILEMAP_ASSET_CODEC_ID,
        SNES_MODE7_TILE_ASSET_CODEC_ID,
        SNES_TILE_2BPP_ASSET_CODEC_ID,
        SNES_TILE_3BPP_ASSET_CODEC_ID,
        SNES_TILE_4BPP_ASSET_CODEC_ID,
        SNES_TILE_8BPP_ASSET_CODEC_ID,
    ],
    render: ({ asset, decoded }) => {
        const value = objectValue(decoded.value, `SNES asset '${asset.id}' preview`);
        if (asset.request.codecId === SNES_PALETTE_ASSET_CODEC_ID)
            return renderPalette(asset.id, value);
        if (asset.request.codecId === SNES_BG_TILEMAP_ASSET_CODEC_ID ||
            asset.request.codecId === SNES_MODE7_TILEMAP_ASSET_CODEC_ID) {
            return renderTilemap(asset.id, value);
        }
        if (asset.request.codecId === SNES_BRR_ASSET_CODEC_ID)
            return renderBrr(asset.id, value);
        return renderTiles(asset.id, value);
    },
});
/**
 * Registers SNES preview renderers after the host has composed its asset registries.
 * @param {AssetPreviewRegistry} registry Preview registry to extend.
 * @returns {AssetPreviewRegistry} The same registry for fluent composition.
 */
export const registerSnesAssetPreviewRenderers = (registry) => registry.register(snesSvgAssetPreviewRenderer);
//# sourceMappingURL=previews.js.map