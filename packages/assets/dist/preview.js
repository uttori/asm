import ImagePNG from "@uttori/data-tools/image/data-image-png";
import { RgbaSurface } from "@uttori/data-tools/image/rgba-surface";
import { integer } from "./validation.js";
/** Encode a bounded RGBA preview as a portable PNG, scaling only for presentation.
 * @param {Uint8Array | Uint8ClampedArray} rgba Exact row-major RGBA8 pixels, including Canvas buffers.
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
    // Aspect fitting uses a shared scale on both axes; independent-axis resizing
    // would choose different pixels when the floored dimensions change the aspect ratio.
    // Canvas exposes clamped bytes. Normalize the view without copying pixels so
    // the surface receives its strict Uint8Array contract, retaining any source offset.
    const bytes = new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
    const surface = new RgbaSurface(width, height, bytes, {
        copy: false,
        maxPixels: 2048 * 2048,
    }).fitNearest(maxEdge);
    return ImagePNG.encodeRGBA(surface, {
        filter: "none",
        level: 6,
        maxPixels: 1024 * 1024,
    });
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
        color.forEach((component, channel) => {
            rgba[(y * 8 + x) * 4 + channel] = integer(component, `RGBA channel ${channel}`, 0, 255);
        });
    }));
    return rgba;
}
//# sourceMappingURL=preview.js.map