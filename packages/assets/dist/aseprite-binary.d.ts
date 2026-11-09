/** Bounded little-endian cursor; sub-cursors cannot read into the following chunk. */
export declare class Cursor {
    readonly bytes: Uint8Array;
    /** Little-endian view over the bounded byte slice. */
    readonly view: DataView;
    /** Byte offset within this cursor's bounded payload. */
    position: number;
    constructor(bytes: Uint8Array);
    /** Advance the cursor and return an owned subarray of exactly `length` bytes. */
    take(length: number): Uint8Array;
    /** Read one unsigned byte. */
    u8(): number;
    /** Read one little-endian unsigned 16-bit integer. */
    u16(): number;
    /** Read one little-endian signed 16-bit integer. */
    i16(): number;
    /** Read one little-endian unsigned 32-bit integer. */
    u32(): number;
    /** Read one little-endian signed 32-bit integer. */
    i32(): number;
    /** Read a UTF-8 string prefixed by a uint16 byte length. */
    text(): string;
    /** Require the cursor to consume the entire bounded payload. */
    finish(): void;
}
/** Small field builder borrowing parts until build; build returns owned bytes without variadic image calls. */
export declare class Fields {
    /** Appended field fragments concatenated by `build`. */
    readonly parts: Uint8Array[];
    /** Reserved bytes are checked while appending, before allocating the combined payload. */
    private length;
    /** Append raw bytes after checking the combined output size limit. */
    raw(bytes: Uint8Array): this;
    /** Append one unsigned byte. */
    u8(value: number): this;
    /** Append one little-endian unsigned 16-bit integer. */
    u16(value: number): this;
    /** Append one little-endian unsigned 32-bit integer. */
    u32(value: number): this;
    /** Append a UTF-8 string prefixed by its uint16 byte length. */
    text(value: string): this;
    /** Concatenate appended parts into one owned buffer. */
    build(): Uint8Array;
}
/** Inflate incrementally; cancel as soon as the declared pixel count is exceeded. */
export declare function rasterZlib(bytes: Uint8Array, expected: number, signal?: AbortSignal): Promise<Uint8Array>;
/** Emit one supported chunk; lengths include the six-byte chunk header. */
export declare function chunk(type: number, data: Uint8Array): Uint8Array;
/** Inflate into a fixed buffer. Streaming callbacks stop expansion before an oversized payload can accumulate. */
export declare function rasterZlibSync(bytes: Uint8Array, expected: number): Uint8Array;
//# sourceMappingURL=aseprite-binary.d.ts.map