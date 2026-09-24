import { readFile } from "node:fs/promises";

import type { AssetInput } from "./registry.js";

/** Node-only convenience read; the conversion API itself accepts supplied bytes.
 * @param {string} path Host-resolved file path.
 * @param {string} mediaType MIME type selected by the caller.
 * @returns {Promise<AssetInput>} Owned file bytes with their media type.
 */
export async function readAssetFile(path: string, mediaType: string): Promise<AssetInput> {
  return { bytes: new Uint8Array(await readFile(path)), mediaType };
}
