import { readFile } from "node:fs/promises";
export { applyAssetFileChanges } from "./file-edits.js";
/** Node-only convenience read; the conversion API itself accepts supplied bytes.
 * @param {string} path Host-resolved file path.
 * @param {string} mediaType MIME type selected by the caller.
 * @returns {Promise<AssetInput>} Owned file bytes with their media type.
 */
export async function readAssetFile(path, mediaType) {
    return { bytes: new Uint8Array(await readFile(path)), mediaType };
}
export { createAssetSourceBaseline, parseAssetSourceBaseline, assertAssetSourceBaseline, } from "./source-baseline.js";
export { assetSourcePath } from "./source-baseline.js";
//# sourceMappingURL=node.js.map