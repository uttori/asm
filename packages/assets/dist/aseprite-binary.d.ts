/** Bounded little-endian cursor; sub-cursors cannot read into the following chunk. */
export declare class Cursor {
    readonly bytes: Uint8Array;
    readonly view: DataView;
    /** Byte offset within this cursor's bounded payload. */
    position: number;
    constructor(bytes: Uint8Array);
    take(length: number): Uint8Array;
    u8(): number;
    u16(): number;
    i16(): number;
    u32(): number;
    i32(): number;
    text(): string;
    finish(): void;
}
/** Small field builder borrowing parts until build; build returns owned bytes without variadic image calls. */
export declare class Fields {
    readonly parts: Uint8Array[];
    /** Reserved bytes are checked while appending, before allocating the combined payload. */
    private length;
    raw(bytes: Uint8Array): this;
    u8(value: number): this;
    u16(value: number): this;
    u32(value: number): this;
    text(value: string): this;
    build(): Uint8Array;
}
/** Inflate incrementally; cancel as soon as the declared pixel count is exceeded. */
export declare function rasterZlib(bytes: Uint8Array, expected: number, signal?: AbortSignal): Promise<Uint8Array>;
/** Emit one supported chunk; lengths include the six-byte chunk header. */
export declare function chunk(type: number, data: Uint8Array): Uint8Array;
/** Inflate into a fixed buffer. Streaming callbacks stop expansion before an oversized payload can accumulate. */
export declare function rasterZlibSync(bytes: Uint8Array, expected: number): Uint8Array;
//# sourceMappingURL=aseprite-binary.d.ts.map