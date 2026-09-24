import { parentPort } from "node:worker_threads";

import { convertAssetPreview, type AssetPreviewInput } from "./asset-preview-conversion.js";

if (!parentPort) {
  throw new Error("Asset preview worker requires a parent port.");
}

parentPort.on("message", (message: { id: number; input: AssetPreviewInput }) => {
  try {
    parentPort!.postMessage({ id: message.id, result: convertAssetPreview(message.input) });
  } catch (error) {
    parentPort!.postMessage({
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
