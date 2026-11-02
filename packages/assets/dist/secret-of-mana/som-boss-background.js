/** Background-backed boss poses and their bank-C1 tilemap streams. */
import { encodeBossMask, expandBossMask } from "./som-boss-graphics.js";
/** Require a representable packed integer instead of silently truncating authored values. */
function integer(value, minimum, maximum) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
        throw new Error(`Boss background value must be ${minimum}..${maximum}.`);
    }
    return value;
}
/** Decode only the FF pose prefix; `consumed` never absorbs the following collision records. */
export function decodeBossBackgroundFrame(source) {
    if (source.length < 6 || source[1] !== 255 || source[0] === 0) {
        throw new Error("Unsupported boss background frame header.");
    }
    const consumed = 6 + source[0] * 6;
    if (source.length < consumed) {
        throw new Error("Truncated boss background rectangles.");
    }
    const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
    const rectangles = [];
    for (let offset = 6; offset < consumed; offset += 6) {
        const width = source[offset + 2], height = source[offset + 3];
        if (!width || !height) {
            throw new Error("Boss background rectangles need nonzero dimensions.");
        }
        rectangles.push({
            x: source[offset],
            y: source[offset + 1],
            width,
            height,
            source: view.getUint16(offset + 4, true),
        });
    }
    const frame = {
        originX: view.getInt16(2, true),
        originY: view.getInt16(4, true),
        rectangles,
    };
    return { frame, consumed };
}
/** Encode an FF pose prefix without allocating or changing its bank-C1 stream pointers. */
export function encodeBossBackgroundFrame(frame) {
    // The native eight-bit loop tests its count after processing a rectangle. Zero
    // would mean 256 iterations, so the explicit format admits only nonzero counts.
    integer(frame.rectangles.length, 1, 255);
    const bytes = new Uint8Array(6 + frame.rectangles.length * 6);
    const view = new DataView(bytes.buffer);
    bytes[0] = frame.rectangles.length;
    bytes[1] = 255;
    view.setInt16(2, integer(frame.originX, -32768, 32767), true);
    view.setInt16(4, integer(frame.originY, -32768, 32767), true);
    for (const [index, rectangle] of frame.rectangles.entries()) {
        const offset = 6 + index * 6;
        bytes[offset] = integer(rectangle.x, 0, 255);
        bytes[offset + 1] = integer(rectangle.y, 0, 255);
        bytes[offset + 2] = integer(rectangle.width, 1, 255);
        bytes[offset + 3] = integer(rectangle.height, 1, 255);
        view.setUint16(offset + 4, integer(rectangle.source, 0, 65535), true);
    }
    return bytes;
}
/** Decode a caller-bounded tilemap byte count. Zero tag is raw; any nonzero tag selects masks. */
export function decodeBossTilemap(source, size) {
    integer(size, 2, 65534);
    if (size % 2) {
        throw new Error("Boss tilemaps require complete two-byte tile words.");
    }
    if (!source.length) {
        throw new Error("Missing boss tilemap storage tag.");
    }
    const tag = source[0];
    if (!tag) {
        if (source.length < size + 1) {
            throw new Error("Truncated raw boss tilemap.");
        }
        return { data: source.slice(1, size + 1), consumed: size + 1, tag };
    }
    const result = expandBossMask(source.subarray(1), size);
    return { ...result, consumed: result.consumed + 1, tag };
}
/** Retain the selected storage tag; callers own fixed-span sizing and original stream preservation. */
export function encodeBossTilemap(data, tag = 1) {
    integer(data.length, 2, 65534);
    if (data.length % 2) {
        throw new Error("Boss tilemaps require complete two-byte tile words.");
    }
    integer(tag, 0, 255);
    const body = tag ? encodeBossMask(data) : data;
    const result = new Uint8Array(body.length + 1);
    result[0] = tag;
    result.set(body, 1);
    return result;
}
//# sourceMappingURL=som-boss-background.js.map