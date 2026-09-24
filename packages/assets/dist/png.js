import CRC32 from "@uttori/data-tools/data-hash-crc32";
import ImagePNG from "@uttori/data-tools/image/data-image-png";
import { Inflate } from "pako";
const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_PIXELS = 1024 * 1024;
const PASS_STEPS = [
    [0, 0, 8, 8],
    [4, 0, 8, 8],
    [0, 4, 4, 8],
    [2, 0, 4, 4],
    [0, 2, 2, 4],
    [1, 0, 2, 2],
    [0, 1, 1, 2],
];
const u32be = (bytes, offset) => (bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]) >>>
    0;
const passLength = (size, start, step) => size <= start ? 0 : Math.ceil((size - start) / step);
/** Validate the container before Data Tools sees it, including CRCs and bounded chunk extents.
 * @param {Uint8Array} bytes Borrowed PNG container bytes.
 * @returns {PngHeader} Validated dimensions and sample layout.
 */
function validatePng(bytes) {
    if (bytes.length < 8 ||
        bytes.length > MAX_INPUT_BYTES ||
        !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
        throw new Error("Invalid PNG signature or input size.");
    }
    let offset = 8;
    let header;
    let paletteSeen = false;
    let transparencySeen = false;
    let dataSeen = false;
    let dataEnded = false;
    let endSeen = false;
    while (offset < bytes.length) {
        if (offset + 12 > bytes.length) {
            throw new Error("Truncated PNG chunk header.");
        }
        const length = u32be(bytes, offset);
        const end = offset + 12 + length;
        if (!Number.isSafeInteger(end) || end > bytes.length) {
            throw new Error("Truncated PNG chunk payload.");
        }
        const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
        const expectedCrc = u32be(bytes, end - 4);
        const actualCrc = Number.parseInt(CRC32.of(bytes.subarray(offset + 4, end - 4)), 16);
        if (expectedCrc !== actualCrc) {
            throw new Error(`PNG ${type} CRC mismatch.`);
        }
        if (!header && type !== "IHDR") {
            throw new Error("PNG IHDR must be first.");
        }
        if (type === "IHDR") {
            if (header || length !== 13) {
                throw new Error("PNG requires one 13-byte IHDR.");
            }
            const width = u32be(bytes, offset + 8);
            const height = u32be(bytes, offset + 12);
            const depth = bytes[offset + 16];
            const colorType = bytes[offset + 17];
            const interlace = bytes[offset + 20];
            if (width === 0 || height === 0 || width * height > MAX_PIXELS) {
                throw new RangeError(`PNG dimensions ${width}×${height} exceed the pixel limit.`);
            }
            if (bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || interlace > 1) {
                throw new Error("Unsupported PNG compression, filter, or interlace method.");
            }
            const indexed = colorType === 3 && [1, 2, 4, 8].includes(depth);
            const gray = colorType === 0 && [1, 2, 4, 8].includes(depth);
            const byteChannels = [2, 4, 6].includes(colorType) && depth === 8;
            if (!indexed && !gray && !byteChannels) {
                throw new Error(`Unsupported PNG color type ${colorType} at ${depth} bits; 16-bit samples are not supported.`);
            }
            header = { width, height, depth, colorType, interlace };
        }
        else if (type === "PLTE") {
            if (paletteSeen || dataSeen || length === 0 || length % 3 !== 0 || length > 768) {
                throw new Error("Invalid PNG PLTE chunk.");
            }
            paletteSeen = true;
        }
        else if (type === "tRNS") {
            if (transparencySeen ||
                dataSeen ||
                (header?.colorType === 3 && (!paletteSeen || length === 0)) ||
                (header?.colorType === 0 && length !== 2) ||
                (header?.colorType === 2 && length !== 6) ||
                (header?.colorType !== 0 && header?.colorType !== 2 && header?.colorType !== 3)) {
                throw new Error("Invalid PNG tRNS chunk.");
            }
            transparencySeen = true;
        }
        else if (type === "IDAT") {
            if (dataEnded || (header?.colorType === 3 && !paletteSeen)) {
                throw new Error("PNG IDAT chunks must be contiguous and follow PLTE.");
            }
            dataSeen = true;
        }
        else if (type === "IEND") {
            if (!dataSeen || length !== 0 || end !== bytes.length) {
                throw new Error("Invalid PNG IEND chunk.");
            }
            endSeen = true;
            break;
        }
        else if ((bytes[offset + 4] & 32) === 0) {
            throw new Error(`Unsupported critical PNG chunk '${type}'.`);
        }
        if (dataSeen && type !== "IDAT") {
            dataEnded = true;
        }
        offset = end;
    }
    if (!header || !endSeen) {
        throw new Error("PNG is missing IHDR or IEND.");
    }
    return header;
}
const paeth = (a, b, c) => {
    const target = a + b - c;
    const da = Math.abs(target - a);
    const db = Math.abs(target - b);
    const dc = Math.abs(target - c);
    if (da <= db && da <= dc) {
        return a;
    }
    if (db <= dc) {
        return b;
    }
    return c;
};
const channelsFor = (colorType) => {
    if (colorType === 2) {
        return 3;
    }
    if (colorType === 4) {
        return 2;
    }
    if (colorType === 6) {
        return 4;
    }
    return 1;
};
/** Decode filtered PNG samples in pass order, then scatter Adam7 pixels into image order.
 * @param {ImagePNG} image Data Tools' parsed PNG chunk model.
 * @param {PngHeader} header Independently validated header.
 * @returns {Uint8Array} One byte per channel or indexed sample in row-major order.
 */
function decodeSamples(image, header) {
    const channels = channelsFor(header.colorType);
    const bitsPerPixel = channels * header.depth;
    const passes = header.interlace === 1 ? PASS_STEPS : [[0, 0, 1, 1]];
    let expected = 0;
    for (const [sx, sy, dx, dy] of passes) {
        const width = passLength(header.width, sx, dx);
        const height = passLength(header.height, sy, dy);
        if (width > 0 && height > 0) {
            expected += height * (1 + Math.ceil((width * bitsPerPixel) / 8));
        }
    }
    const inflator = new Inflate({ windowBits: 15, chunkSize: 16 * 1024 });
    const inflated = new Uint8Array(expected);
    let written = 0;
    /** Bound the inflater callback to declared scanline bytes.
     * @param {Uint8Array} chunk Newly inflated bytes.
     */
    inflator.onData = (chunk) => {
        if (written + chunk.length > expected) {
            throw new Error("PNG inflated data exceeds declared dimensions.");
        }
        inflated.set(chunk, written);
        written += chunk.length;
    };
    const compressedLength = image.dataChunks.reduce((size, chunk) => size + chunk.length, 0);
    const compressed = new Uint8Array(compressedLength);
    let compressedOffset = 0;
    for (const chunk of image.dataChunks) {
        compressed.set(chunk, compressedOffset);
        compressedOffset += chunk.length;
    }
    if (!inflator.push(compressed, true) || inflator.err || written !== expected) {
        throw new Error(`Invalid PNG image data: ${inflator.msg || "scanline length mismatch"}.`);
    }
    const samples = new Uint8Array(header.width * header.height * channels);
    let cursor = 0;
    const filterStride = Math.max(1, Math.ceil(bitsPerPixel / 8));
    for (const [sx, sy, dx, dy] of passes) {
        const width = passLength(header.width, sx, dx);
        const height = passLength(header.height, sy, dy);
        if (width === 0 || height === 0) {
            continue;
        }
        const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
        let previous = new Uint8Array(rowBytes);
        for (let row = 0; row < height; row++) {
            const filter = inflated[cursor++];
            if (filter > 4) {
                throw new Error(`Invalid PNG scanline filter ${filter}.`);
            }
            const current = inflated.slice(cursor, cursor + rowBytes);
            cursor += rowBytes;
            for (let index = 0; index < rowBytes; index++) {
                const left = index >= filterStride ? current[index - filterStride] : 0;
                const above = previous[index];
                const upperLeft = index >= filterStride ? previous[index - filterStride] : 0;
                let predictor = 0;
                if (filter === 1) {
                    predictor = left;
                }
                if (filter === 2) {
                    predictor = above;
                }
                if (filter === 3) {
                    predictor = Math.floor((left + above) / 2);
                }
                if (filter === 4) {
                    predictor = paeth(left, above, upperLeft);
                }
                current[index] = (current[index] + predictor) & 255;
            }
            for (let x = 0; x < width; x++) {
                const destination = ((sy + row * dy) * header.width + sx + x * dx) * channels;
                if (header.depth === 8) {
                    samples.set(current.subarray(x * channels, (x + 1) * channels), destination);
                }
                else {
                    const bit = x * header.depth;
                    const mask = (1 << header.depth) - 1;
                    samples[destination] = (current[bit >> 3] >> (8 - header.depth - (bit & 7))) & mask;
                }
            }
            previous = current;
        }
    }
    return samples;
}
/** Browser-safe PNG importer preserving indexes and full palette identity.
 * Data Tools supplies the chunk model; strict container and scanline checks guard exact conversion.
 */
export const pngImporter = Object.freeze({
    id: "uttori.import.png",
    version: "1.0.0",
    mediaTypes: ["image/png"],
    import: (input) => {
        const header = validatePng(input.bytes);
        const image = ImagePNG.fromFile(input.bytes);
        // Data Tools exposes the chunks, but its pixel buffer does not retain packed
        // indexes and Adam7 placement in the form needed for reversible native output.
        const samples = decodeSamples(image, header);
        if (header.colorType === 0 && image.transparency.length === 2) {
            const transparent = (image.transparency[0] << 8) | image.transparency[1];
            if (transparent >= 2 ** header.depth) {
                throw new Error("PNG grayscale tRNS sample exceeds bit depth.");
            }
        }
        if (header.colorType === 2 &&
            image.transparency.length === 6 &&
            (image.transparency[0] !== 0 || image.transparency[2] !== 0 || image.transparency[4] !== 0)) {
            throw new Error("PNG RGB8 tRNS sample exceeds bit depth.");
        }
        if (header.colorType === 3) {
            const paletteBytes = image.palette;
            const count = paletteBytes.length / 3;
            if (!Number.isInteger(count) ||
                count === 0 ||
                count > 2 ** header.depth ||
                image.transparency.length > count) {
                throw new Error("PNG palette size or transparency length is invalid.");
            }
            const palette = Array.from({ length: count }, (_, index) => [
                paletteBytes[index * 3],
                paletteBytes[index * 3 + 1],
                paletteBytes[index * 3 + 2],
                image.transparency[index] ?? 255,
            ]);
            for (const index of samples) {
                if (index >= count) {
                    throw new Error(`PNG palette index ${index} is out of range.`);
                }
            }
            const value = {
                kind: "indexed-image",
                width: header.width,
                height: header.height,
                indexes: samples,
                palette,
                sourceBitDepth: header.depth,
            };
            return { kind: value.kind, value };
        }
        const rgba = new Uint8Array(header.width * header.height * 4);
        const maxGray = 2 ** header.depth - 1;
        const transparentGray = image.transparency.length === 2
            ? (image.transparency[0] << 8) | image.transparency[1]
            : undefined;
        const transparentRgb = image.transparency.length === 6
            ? [image.transparency[1], image.transparency[3], image.transparency[5]]
            : undefined;
        for (let pixel = 0; pixel < header.width * header.height; pixel++) {
            const source = pixel * channelsFor(header.colorType);
            const output = pixel * 4;
            if (header.colorType === 0 || header.colorType === 4) {
                const gray = Math.round((samples[source] * 255) / maxGray);
                rgba[output] = gray;
                rgba[output + 1] = gray;
                rgba[output + 2] = gray;
                let alpha = 255;
                if (header.colorType === 4) {
                    alpha = samples[source + 1];
                }
                else if (samples[source] === transparentGray) {
                    alpha = 0;
                }
                rgba[output + 3] = alpha;
            }
            else {
                rgba.set(samples.subarray(source, source + 3), output);
                const isTransparent = transparentRgb?.every((channel, index) => channel === samples[source + index]);
                let alpha = 255;
                if (header.colorType === 6) {
                    alpha = samples[source + 3];
                }
                else if (isTransparent) {
                    alpha = 0;
                }
                rgba[output + 3] = alpha;
            }
        }
        const value = {
            kind: "rgba-image",
            width: header.width,
            height: header.height,
            rgba,
        };
        return { kind: value.kind, value };
    },
});
//# sourceMappingURL=png.js.map