/** Inventory pages share native tilesets; page/frame boundaries never create native animation or storage owners. */
export interface IndexedPresentationLayout {
    /** Presentation frame width in pixels. */
    readonly width: number;
    /** Presentation frame height in pixels. */
    readonly height: number;
    /** Tile columns per presentation page. */
    readonly columns: number;
    /** Tile rows per presentation page. */
    readonly rows: number;
    /** Tiles shown on one page. */
    readonly capacity: number;
    /** Pages required to show every view tile. */
    readonly pages: number;
}
/**
 * Keep native preview geometry and fit complete tile inventory into separate presentation
 * frames. A full four-megapixel canvas needs no extra side gutter and is never downscaled.
 */
export declare function planIndexedPresentation(nativeWidth: number, nativeHeight: number, tileWidth: number, tileHeight: number, views: number): IndexedPresentationLayout;
//# sourceMappingURL=presentation-layout.d.ts.map