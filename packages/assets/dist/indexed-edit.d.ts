/** Row-major palette indexes, independent of tile size, palette encoding or game. */
export interface IndexedPixels {
    /** Horizontal extent in pixels. */
    readonly width: number;
    /** Vertical extent in pixels. */
    readonly height: number;
    /** Row-major palette slots, length `width * height`. */
    readonly indexes: Uint8Array;
}
/** Pixel rectangle; coordinates may be negative when used as a render viewport. */
export interface PixelBounds {
    /** Signed left edge in the placement coordinate system. */
    readonly x: number;
    /** Signed top edge in the placement coordinate system. */
    readonly y: number;
    /** Positive horizontal span. */
    readonly width: number;
    /** Positive vertical span. */
    readonly height: number;
}
/** Orientation and optional source-index mapping. Null/missing map entries reject that color. */
export interface IndexedRegion extends PixelBounds {
    /** Mirror source columns when extracting or compositing. */
    readonly flipX?: boolean;
    /** Mirror source rows when extracting or compositing. */
    readonly flipY?: boolean;
    /** Optional per-slot remapping; null entries reject that source index. */
    readonly indexMap?: readonly (number | null)[];
}
/** Array order is back-to-front; identity is supplied by the caller, never inferred from pixels. */
export interface IndexedPlacement {
    /** Stable occurrence identity within one composition pass. */
    readonly id: string;
    /** Key into the caller-supplied source map. */
    readonly source: string;
    /** Left edge of the source image in viewport coordinates. */
    readonly x: number;
    /** Top edge of the source image in viewport coordinates. */
    readonly y: number;
    /** Mirror source columns when drawing. */
    readonly flipX?: boolean;
    /** Mirror source rows when drawing. */
    readonly flipY?: boolean;
    /** Optional per-slot remapping applied after transparency tests. */
    readonly indexMap?: readonly (number | null)[];
    /** Source index tested before mapping; defaults to zero. Null makes every index opaque. */
    readonly transparentIndex?: number | null;
}
/**
 * Validate dimensions before allocating buffers or entering pixel loops.
 * @param image Row-major index buffer whose dimensions must agree exactly.
 */
export declare function validateIndexedPixels(image: IndexedPixels): void;
/**
 * Extract an owned index buffer and undo display flips; never changes the source image.
 * @param image Current indexed pixels, independent of their display colors.
 * @param region In-bounds source rectangle with optional flips and index mapping.
 * @returns Owned pixels in the requested native orientation.
 */
export declare function extractIndexedRegion(image: IndexedPixels, region: IndexedRegion): IndexedPixels;
/**
 * Compose identified sources in array order into an explicit viewport. Out-of-bounds
 * placements fail rather than clipping silently. Background, if supplied, is copied.
 * Source transparency is tested before palette mapping, independently of RGB/alpha.
 * @param sources Caller-supplied identities mapped to current indexed pixels.
 * @param placements Ordered draw occurrences; IDs must be unique.
 * @param viewport Canvas origin and dimensions in the placement coordinate system.
 * @param background Optional existing pixels; copied before composition.
 * @returns Owned composited pixels with the viewport dimensions.
 */
export declare function renderIndexedPlacements(sources: ReadonlyMap<string, IndexedPixels>, placements: readonly IndexedPlacement[], viewport: PixelBounds, background?: Uint8Array): IndexedPixels;
/** A cell names its source independently of image equality and carries its palette policy. */
export interface IndexedGridCell {
    /** Key into the caller-supplied source map for this cell. */
    readonly source: string;
    /** Optional per-slot remapping for this cell only. */
    readonly indexMap?: readonly (number | null)[];
    /** Source index skipped when compositing; defaults to zero when omitted. */
    readonly transparentIndex?: number | null;
}
/** A rectangular native block; rows follow from the complete row-major cell list. */
export interface IndexedGridBlock {
    /** Stable block identity echoed in generated placement IDs. */
    readonly id: string;
    /** Left edge of column zero in viewport coordinates. */
    readonly x: number;
    /** Top edge of row zero in viewport coordinates. */
    readonly y: number;
    /** Cells per row; must divide `cells.length`. */
    readonly columns: number;
    /** Horizontal stride between adjacent cells in pixels. */
    readonly cellWidth: number;
    /** Vertical stride between adjacent rows in pixels. */
    readonly cellHeight: number;
    /** Row-major cell list, length a multiple of `columns`. */
    readonly cells: readonly IndexedGridCell[];
    /** Reverse column order when expanding placements. */
    readonly flipX?: boolean;
    /** Reverse row order when expanding placements. */
    readonly flipY?: boolean;
}
/**
 * Expand a native grid into placements, reversing cell order and pixels together on flips.
 * Does not encode game frame bytes or infer grid size from the source image.
 * @param block Ordered cells with explicit dimensions in pixels.
 * @returns Owned occurrences in native cell order, with stable block/cell IDs.
 */
export declare function expandIndexedGrid(block: IndexedGridBlock): IndexedPlacement[];
//# sourceMappingURL=indexed-edit.d.ts.map