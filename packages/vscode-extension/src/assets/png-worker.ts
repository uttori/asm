import { parentPort, workerData } from "node:worker_threads";

import { pngImporter, rewriteIndexedPng } from "@uttori/asm-assets/image";

// Untrusted containers are decoded away from the extension host under the asset
// library's one-megapixel/16 MiB limits and the host's worker memory/time budgets.
try {
  const { bytes, indexes } = workerData as { bytes: Uint8Array; indexes?: Uint8Array };
  if (indexes) {
    // Unsafe ancillary chunks are intentionally not copied. Their producer must
    // revalidate/reencode them after a pixel edit, as it does for external PNG tools.
    parentPort!.postMessage({ value: rewriteIndexedPng(bytes, { indexes }) });
  } else {
    const result = pngImporter.import({ bytes, mediaType: "image/png" });
    if (result.kind !== "indexed-image") {
      throw new Error(
        "This editor requires an indexed PNG. Convert truecolor images explicitly in an image tool first.",
      );
    }
    parentPort!.postMessage({ value: result.value });
  }
} catch (error) {
  parentPort!.postMessage({ error: error instanceof Error ? error.message : String(error) });
}
