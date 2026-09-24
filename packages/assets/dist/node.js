import { readFile } from "node:fs/promises";
/** Node-only convenience read; the conversion API itself accepts supplied bytes.
 * @param {string} path Host-resolved file path.
 * @param {string} mediaType MIME type selected by the caller.
 * @returns {Promise<AssetInput>} Owned file bytes with their media type.
 */
export async function readAssetFile(path, mediaType) {
    return { bytes: new Uint8Array(await readFile(path)), mediaType };
}
//# sourceMappingURL=node.js.map