/** Row-major palette indexes, independent of tile size, palette encoding or game. */
export interface IndexedPixels {
    readonly width: number;
    readonly height: number;
    readonly indexes: Uint8Array;
}
/** Pixel rectangle; coordinates may be negative when used as a render viewport. */
export interface PixelBounds {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
/** Orientation and optional source-index mapping. Null/missing map entries reject that color. */
export interface IndexedRegion extends PixelBounds {
    readonly flipX?: boolean;
    readonly flipY?: boolean;
    readonly indexMap?: readonly (number | null)[];
}
/** Array order is back-to-front; identity is supplied by the caller, never inferred from pixels. */
export interface IndexedPlacement {
    readonly id: string;
    readonly source: string;
    readonly x: number;
    readonly y: number;
    readonly flipX?: boolean;
    readonly flipY?: boolean;
    readonly indexMap?: readonly (number | null)[];
    /** Source index tested before mapping; defaults to zero. Null makes every index opaque. */
    readonly transparentIndex?: number | null;
}
/** Validate dimensions before allocating buffers or entering pixel loops.
 * @param {IndexedPixels} image Row-major index buffer whose dimensions must agree exactly.
 */
export declare function validateIndexedPixels(image: IndexedPixels): void;
/** Extract an owned index buffer and undo display flips; never changes the source image.
 * @param {IndexedPixels} image Current indexed pixels, independent of their display colors.
 * @param {IndexedRegion} region In-bounds source rectangle with optional flips and index mapping.
 * @returns {IndexedPixels} Owned pixels in the requested native orientation.
 */
export declare function extractIndexedRegion(image: IndexedPixels, region: IndexedRegion): IndexedPixels;
/**
 * Compose identified sources in array order into an explicit viewport. Out-of-bounds
 * placements fail rather than clipping silently. Background, if supplied, is copied.
 * Source transparency is tested before palette mapping, independently of RGB/alpha.
 * @param {ReadonlyMap<string, IndexedPixels>} sources Caller-supplied identities mapped to current indexed pixels.
 * @param {readonly IndexedPlacement[]} placements Ordered draw occurrences; IDs must be unique.
 * @param {PixelBounds} viewport Canvas origin and dimensions in the placement coordinate system.
 * @param {Uint8Array} background Optional existing pixels; copied before composition.
 * @returns {IndexedPixels} Owned composited pixels with the viewport dimensions.
 */
export declare function renderIndexedPlacements(sources: ReadonlyMap<string, IndexedPixels>, placements: readonly IndexedPlacement[], viewport: PixelBounds, background?: Uint8Array): IndexedPixels;
/** A cell names its source independently of image equality and carries its palette policy. */
export interface IndexedGridCell {
    readonly source: string;
    readonly indexMap?: readonly (number | null)[];
    readonly transparentIndex?: number | null;
}
/** A rectangular native block; rows follow from the complete row-major cell list. */
export interface IndexedGridBlock {
    readonly id: string;
    readonly x: number;
    readonly y: number;
    readonly columns: number;
    readonly cellWidth: number;
    readonly cellHeight: number;
    readonly cells: readonly IndexedGridCell[];
    readonly flipX?: boolean;
    readonly flipY?: boolean;
}
/**
 * Expand a native grid into placements, reversing cell order and pixels together on flips.
 * Does not encode game frame bytes or infer grid size from the source image.
 * @param {IndexedGridBlock} block Ordered cells with explicit dimensions in pixels.
 * @returns {IndexedPlacement[]} Owned occurrences in native cell order, with stable block/cell IDs.
 */
export declare function expandIndexedGrid(block: IndexedGridBlock): IndexedPlacement[];
//# sourceMappingURL=indexed-edit.d.ts.map