import { readFile } from "node:fs/promises";

import type { AssetInput } from "./registry.js";

export { applyAssetFileChanges } from "./file-edits.js";
export type { AssetFileChange } from "./file-edits.js";

/**
 * Node-only convenience read; the conversion API itself accepts supplied bytes.
 * @param path Host-resolved file path.
 * @param mediaType MIME type selected by the caller.
 * @returns Owned file bytes with their media type.
 */
export async function readAssetFile(path: string, mediaType: string): Promise<AssetInput> {
  return { bytes: new Uint8Array(await readFile(path)), mediaType };
}

export {
  createAssetSourceBaseline,
  parseAssetSourceBaseline,
  assertAssetSourceBaseline,
} from "./source-baseline.js";
export type { AssetSourceBaseline, AssetSourceFingerprint } from "./source-baseline.js";

export { assetSourcePath } from "./source-baseline.js";
