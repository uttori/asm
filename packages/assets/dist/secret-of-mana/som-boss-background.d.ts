/** A six-byte rectangle in an FF boss frame; coordinates and dimensions use 8-pixel cells. */
export interface BossBackgroundRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Near pointer in bank C1; it addresses a raw/masked stream header. */
    source: number;
}
/** The signed pixel origin precedes count-bounded rectangles; collision data is separate. */
export interface BossBackgroundFrame {
    originX: number;
    originY: number;
    rectangles: BossBackgroundRectangle[];
}
/** Decode only the FF pose prefix; `consumed` never absorbs the following collision records. */
export declare function decodeBossBackgroundFrame(source: Uint8Array): {
    frame: BossBackgroundFrame;
    consumed: number;
};
/** Encode an FF pose prefix without allocating or changing its bank-C1 stream pointers. */
export declare function encodeBossBackgroundFrame(frame: BossBackgroundFrame): Uint8Array<ArrayBuffer>;
/** Decode a caller-bounded tilemap byte count. Zero tag is raw; any nonzero tag selects masks. */
export declare function decodeBossTilemap(source: Uint8Array, size: number): {
    data: Uint8Array<ArrayBuffer>;
    consumed: number;
    tag: number;
};
/** Retain the selected storage tag; callers own fixed-span sizing and original stream preservation. */
export declare function encodeBossTilemap(data: Uint8Array, tag?: number): Uint8Array<ArrayBuffer>;
//# sourceMappingURL=som-boss-background.d.ts.map