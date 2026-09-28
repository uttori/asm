import type { AssetInput } from "./registry.js";
export { applyAssetFileChanges } from "./file-edits.js";
export type { AssetFileChange } from "./file-edits.js";
/** Node-only convenience read; the conversion API itself accepts supplied bytes.
 * @param {string} path Host-resolved file path.
 * @param {string} mediaType MIME type selected by the caller.
 * @returns {Promise<AssetInput>} Owned file bytes with their media type.
 */
export declare function readAssetFile(path: string, mediaType: string): Promise<AssetInput>;
export { createAssetSourceBaseline, parseAssetSourceBaseline, assertAssetSourceBaseline, } from "./source-baseline.js";
export type { AssetSourceBaseline, AssetSourceFingerprint } from "./source-baseline.js";
export { createAssetSourceStage, publishAssetSourceStage } from "./source-stage.js";
export type { AssetSourceStage } from "./source-stage.js";
export { assetSourcePath } from "./source-baseline.js";
//# sourceMappingURL=node.d.ts.map