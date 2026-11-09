/**
 * Host-independent ceilings. Smaller host budgets may restrict these; files cannot enlarge them.
 * Pixel area, decoded bytes, rendering work and metadata counts have different units.
 */
export declare const ASSET_LIMITS: Readonly<{
    rasterPixels: number;
    interchangeSide: 4096;
    pngBytes: number;
    pngInflatedBytes: number;
    asepriteBytes: number;
    decodedBytes: number;
    renderPixels: number;
    frames: 1024;
    layers: 4096;
    tilesets: 1024;
    owners: number;
    references: number;
    chunks: number;
    metadataBytes: number;
    baselineMetadataBytes: number;
    metadataNodes: number;
    baselineMetadataNodes: number;
    thumbnailEdge: 1024;
}>;
/** Check a nonnegative product before allocating or iterating. Division avoids unsafe multiplication. */
export declare function boundedProduct(a: number, b: number, maximum: number, label: string): number;
/** Accumulate independently validated sizes without allowing an overflowing sum. */
export declare function boundedSum(total: number, next: number, maximum: number, label: string): number;
/** Positive raster dimensions; generic pixel buffers permit skinny shapes, interchange canvases do not. */
export declare function rasterArea(width: number, height: number, label?: string, side?: number): number;
/** JSON hot-exit backup contains the PNG and both saved/draft index buffers as base64, plus metadata. */
export declare const PNG_EDITOR_BACKUP_BYTES: number;
//# sourceMappingURL=limits.d.ts.map