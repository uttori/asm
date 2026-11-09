import { Inflate } from "pako";
import { ASSET_LIMITS, boundedSum } from "./limits.js";
import { integer } from "./validation.js";
const ATLAS_FILE_LIMIT = ASSET_LIMITS.asepriteBytes;
const decoder = new TextDecoder("utf-8", { fatal: true });
/** Bounded little-endian cursor; sub-cursors cannot read into the following chunk. */
export class Cursor {
    bytes;
    /** Little-endian view over the bounded byte slice. */
    view;
    /** Byte offset within this cursor's bounded payload. */
    position = 0;
    constructor(bytes) {
        this.bytes = bytes;
        this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    /** Advance the cursor and return an owned subarray of exactly `length` bytes. */
    take(length) {
        integer(length, "Aseprite field size", 0, this.bytes.length - this.position);
        const value = this.bytes.subarray(this.position, this.position + length);
        this.position += length;
        return value;
    }
    /** Read one unsigned byte. */
    u8() {
        return this.take(1)[0];
    }
    /** Read one little-endian unsigned 16-bit integer. */
    u16() {
        const offset = this.position;
        this.take(2);
        return this.view.getUint16(offset, true);
    }
    /** Read one little-endian signed 16-bit integer. */
    i16() {
        const offset = this.position;
        this.take(2);
        return this.view.getInt16(offset, true);
    }
    /** Read one little-endian unsigned 32-bit integer. */
    u32() {
        const offset = this.position;
        this.take(4);
        return this.view.getUint32(offset, true);
    }
    /** Read one little-endian signed 32-bit integer. */
    i32() {
        const offset = this.position;
        this.take(4);
        return this.view.getInt32(offset, true);
    }
    /** Read a UTF-8 string prefixed by a uint16 byte length. */
    text() {
        return decoder.decode(this.take(this.u16()));
    }
    /** Require the cursor to consume the entire bounded payload. */
    finish() {
        if (this.position !== this.bytes.length) {
            throw new Error("Unexpected Aseprite chunk payload.");
        }
    }
}
/** Small field builder borrowing parts until build; build returns owned bytes without variadic image calls. */
export class Fields {
    /** Appended field fragments concatenated by `build`. */
    parts = [];
    /** Reserved bytes are checked while appending, before allocating the combined payload. */
    length = 0;
    /** Append raw bytes after checking the combined output size limit. */
    raw(bytes) {
        this.length = boundedSum(this.length, bytes.length, ATLAS_FILE_LIMIT, "Aseprite output size");
        this.parts.push(bytes);
        return this;
    }
    /** Append one unsigned byte. */
    u8(value) {
        return this.raw(Uint8Array.of(value));
    }
    /** Append one little-endian unsigned 16-bit integer. */
    u16(value) {
        const bytes = new Uint8Array(2);
        new DataView(bytes.buffer).setUint16(0, value, true);
        return this.raw(bytes);
    }
    /** Append one little-endian unsigned 32-bit integer. */
    u32(value) {
        const bytes = new Uint8Array(4);
        new DataView(bytes.buffer).setUint32(0, value, true);
        return this.raw(bytes);
    }
    /** Append a UTF-8 string prefixed by its uint16 byte length. */
    text(value) {
        const bytes = new TextEncoder().encode(value);
        integer(bytes.length, "Aseprite text size", 0, 65535);
        return this.u16(bytes.length).raw(bytes);
    }
    /** Concatenate appended parts into one owned buffer. */
    build() {
        const bytes = new Uint8Array(this.length);
        let offset = 0;
        for (const part of this.parts) {
            bytes.set(part, offset);
            offset += part.length;
        }
        return bytes;
    }
}
/** Inflate incrementally; cancel as soon as the declared pixel count is exceeded. */
export async function rasterZlib(bytes, expected, signal) {
    integer(expected, "Decoded payload", 0, ASSET_LIMITS.decodedBytes);
    signal?.throwIfAborted();
    const source = new ReadableStream({
        start(controller) {
            controller.enqueue(bytes.slice());
            controller.close();
        },
    });
    const reader = source.pipeThrough(new DecompressionStream("deflate")).getReader();
    const abort = () => {
        void reader.cancel(signal?.reason).catch(() => { });
    };
    signal?.addEventListener("abort", abort, { once: true });
    const output = new Uint8Array(expected);
    let offset = 0;
    try {
        for (;;) {
            const next = await reader.read();
            signal?.throwIfAborted();
            if (next.done) {
                break;
            }
            if (next.value.length > expected - offset) {
                throw new Error("Aseprite decompressed raster exceeds its declared bounds.");
            }
            output.set(next.value, offset);
            offset += next.value.length;
        }
        if (offset !== expected) {
            throw new Error("Aseprite decompressed raster length mismatch.");
        }
    }
    catch (cause) {
        await reader.cancel().catch(() => { });
        throw new Error("Invalid bounded Aseprite zlib raster.", { cause });
    }
    finally {
        signal?.removeEventListener("abort", abort);
        reader.releaseLock();
    }
    return output;
}
/** Emit one supported chunk; lengths include the six-byte chunk header. */
export function chunk(type, data) {
    return new Fields()
        .u32(data.length + 6)
        .u16(type)
        .raw(data)
        .build();
}
/** Inflate into a fixed buffer. Streaming callbacks stop expansion before an oversized payload can accumulate. */
export function rasterZlibSync(bytes, expected) {
    integer(expected, "Decoded payload", 0, ASSET_LIMITS.decodedBytes);
    const output = new Uint8Array(expected);
    let offset = 0;
    const inflator = new Inflate({ windowBits: 15, chunkSize: 16 * 1024 });
    let unread;
    // Pako permits unused bytes after a zlib member. The async Web Streams driver rejects them;
    // inspect its public start-hook stream so both parser drivers enforce one complete member.
    inflator.onStart = (stream) => {
        unread = () => stream.avail_in;
    };
    inflator.onData = (part) => {
        if (part.length > expected - offset) {
            throw new Error("Aseprite decompressed raster exceeds its declared bounds.");
        }
        output.set(part, offset);
        offset += part.length;
    };
    let completed = false;
    inflator.onEnd = (status) => {
        if (status !== 0) {
            throw new Error("Invalid Aseprite zlib stream.");
        }
        completed = true;
    };
    try {
        inflator.push(bytes, true);
        // Completion is set by Pako's callback; retain the explicit check even though TypeScript cannot follow that lifecycle.
        // oxlint-disable-next-line typescript/no-unnecessary-condition
        if (!completed || offset !== expected || unread?.() !== 0) {
            throw new Error("Aseprite decompressed raster length or stream mismatch.");
        }
    }
    catch (cause) {
        throw new Error("Invalid bounded Aseprite zlib raster.", { cause });
    }
    return output;
}
//# sourceMappingURL=aseprite-binary.js.map