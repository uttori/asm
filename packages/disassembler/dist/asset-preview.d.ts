import { type AssetByteSource, type AssetCodecRegistry, type AssetDecodeResult, type AssetExtractedFile, type AssetVerificationRecord, type PlannedAsset } from "./asset-codec.js";
/** Inputs to a deterministic preview renderer after binary correctness is verified. */
export interface AssetPreviewContext {
    readonly asset: PlannedAsset;
    readonly decoded: AssetDecodeResult;
    readonly verification: AssetVerificationRecord;
}
/** Optional presentation layer. Never participates in binary encoding. */
export interface AssetPreviewRenderer {
    readonly id: string;
    readonly version: string;
    readonly codecIds: readonly string[];
    render(context: AssetPreviewContext): readonly AssetExtractedFile[];
}
/** Order-independent registry for target- or plugin-owned preview renderers. */
export declare class AssetPreviewRegistry {
    #private;
    register(renderer: AssetPreviewRenderer): this;
    resolve(id: string): AssetPreviewRenderer;
    list(): readonly AssetPreviewRenderer[];
}
/**
 * Renders deterministic preview files only when a verification record matches
 * the current planned asset, codec version, extent, and source bytes.
 * @param {AssetPreviewRegistry} previewRegistry Composed preview registry.
 * @param {AssetCodecRegistry} codecRegistry Registry used for binary verification.
 * @param {AssetByteSource} source Current immutable source bytes.
 * @param {PlannedAsset} asset Verified planned asset.
 * @param {AssetVerificationRecord} verification Matching binary verification record.
 * @param {string} rendererId Stable preview renderer id.
 * @returns {readonly AssetExtractedFile[]} Deterministic presentation-only files.
 */
export declare const renderVerifiedAssetPreview: (previewRegistry: AssetPreviewRegistry, codecRegistry: AssetCodecRegistry, source: AssetByteSource, asset: PlannedAsset, verification: AssetVerificationRecord, rendererId: string) => readonly AssetExtractedFile[];
//# sourceMappingURL=asset-preview.d.ts.map