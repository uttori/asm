import CRC32 from "@uttori/data-tools/data-hash-crc32";
import { deflate } from "pako";
import { integer } from "./validation.js";
const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const be32 = (value) => Uint8Array.of(value >>> 24, value >>> 16, value >>> 8, value);
const concat = (parts) => {
    const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
    let cursor = 0;
    for (const part of parts) {
        result.set(part, cursor);
        cursor += part.length;
    }
    return result;
};
const chunk = (name, payload) => {
    const body = concat([Uint8Array.from(name, (character) => character.charCodeAt(0)), payload]);
    const crc = Number.parseInt(CRC32.of(body), 16);
    return concat([be32(payload.length), body, be32(crc)]);
};
/** Encode a bounded RGBA preview as a portable PNG, scaling only for presentation.
 * @param {Uint8Array} rgba Exact row-major RGBA8 pixels.
 * @param {number} width Original pixel width.
 * @param {number} height Original pixel height.
 * @param {number} maxEdge Longest displayed edge in pixels, at most 1024.
 * @returns {Uint8Array} Complete PNG bytes.
 */
export function rgbaPreviewPng(rgba, width, height, maxEdge = 256) {
    integer(width, "Preview width", 1, 4096);
    integer(height, "Preview height", 1, 4096);
    integer(maxEdge, "Preview edge", 1, 1024);
    // A native SoM room can fill 128 × 128 sixteen-pixel cells. Bound the input
    // separately from the 1024-pixel display edge so complete maps can be downscaled.
    if (width * height > 2048 * 2048 || rgba.length !== width * height * 4) {
        throw new Error("Preview pixels are missing or exceed the four-megapixel limit.");
    }
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const outputWidth = Math.max(1, Math.floor(width * scale));
    const outputHeight = Math.max(1, Math.floor(height * scale));
    const scanlines = new Uint8Array(outputHeight * (1 + outputWidth * 4));
    for (let y = 0; y < outputHeight; y++) {
        for (let x = 0; x < outputWidth; x++) {
            const sourceX = Math.min(width - 1, Math.floor(x / scale));
            const sourceY = Math.min(height - 1, Math.floor(y / scale));
            const input = (sourceY * width + sourceX) * 4;
            scanlines.set(rgba.subarray(input, input + 4), y * (1 + outputWidth * 4) + 1 + x * 4);
        }
    }
    const header = concat([be32(outputWidth), be32(outputHeight), Uint8Array.of(8, 6, 0, 0, 0)]);
    const compressed = deflate(scanlines);
    return concat([
        signature,
        chunk("IHDR", header),
        chunk("IDAT", compressed),
        chunk("IEND", new Uint8Array()),
    ]);
}
/** Draw bounded min/max PCM buckets without changing the audio used for playback.
 * @param {Int16Array} samples Signed source or decoded PCM16 frames.
 * @returns {Uint8Array} A 256×64 PNG waveform thumbnail.
 */
export function waveformPreviewPng(samples) {
    const width = 256;
    const height = 64;
    const rgba = new Uint8Array(width * height * 4);
    for (let x = 0; x < width; x++) {
        const start = Math.floor((x * samples.length) / width);
        const end = Math.max(start + 1, Math.ceil(((x + 1) * samples.length) / width));
        let low = 0;
        let high = 0;
        for (let index = start; index < Math.min(end, samples.length); index++) {
            low = Math.min(low, samples[index]);
            high = Math.max(high, samples[index]);
        }
        const top = Math.max(0, Math.floor(31 - (high * 30) / 32768));
        const bottom = Math.min(63, Math.ceil(32 - (low * 30) / 32768));
        for (let y = top; y <= bottom; y++) {
            const pixel = (y * width + x) * 4;
            rgba.set([68, 164, 255, 255], pixel);
        }
    }
    return rgbaPreviewPng(rgba, width, height);
}
/** Render one indexed tile to an owned RGBA buffer for a caller-owned PNG writer.
 * @param {Tile} tile Display-order indexes for one 8×8 tile.
 * @param {number[][]} palette RGBA8 entries in index order.
 * @returns {Uint8Array} Owned row-major RGBA8 pixels.
 */
export function tileRgba(tile, palette) {
    if (tile.length !== 8 || tile.some((row) => row.length !== 8)) {
        throw new RangeError("Preview tile must be 8×8.");
    }
    const rgba = new Uint8Array(8 * 8 * 4);
    tile.forEach((row, y) => row.forEach((index, x) => {
        const color = palette[integer(index, `Palette index ${x},${y}`, 0, palette.length - 1)];
        if (!color || color.length !== 4) {
            throw new Error(`Missing RGBA palette entry ${index}.`);
        }
        color.forEach((component, channel) => {
            rgba[(y * 8 + x) * 4 + channel] = integer(component, `RGBA channel ${channel}`, 0, 255);
        });
    }));
    return rgba;
}
//# sourceMappingURL=preview.js.map