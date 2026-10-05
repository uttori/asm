/** Inventory pages share native tilesets; page/frame boundaries never create native animation or storage owners. */
export interface IndexedPresentationLayout {
    readonly width: number;
    readonly height: number;
    readonly columns: number;
    readonly rows: number;
    readonly capacity: number;
    readonly pages: number;
}
/**
 * Keep native preview geometry and fit complete tile inventory into separate presentation
 * frames. A full four-megapixel canvas needs no extra side gutter and is never downscaled.
 */
export declare function planIndexedPresentation(nativeWidth: number, nativeHeight: number, tileWidth: number, tileHeight: number, views: number): IndexedPresentationLayout;
//# sourceMappingURL=presentation-layout.d.ts.map