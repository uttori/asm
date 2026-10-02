import { parentPort, workerData } from "node:worker_threads";

import { pngImporter, rewriteIndexedPng } from "@uttori/asm-assets/image";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Worker data is supplied by the extension host and must already be decoded bytes. */
function isWorkerBytes(value: unknown): value is { bytes: Uint8Array; indexes?: Uint8Array } {
  return (
    isRecord(value) &&
    value.bytes instanceof Uint8Array &&
    (value.indexes === undefined || value.indexes instanceof Uint8Array)
  );
}

// Untrusted containers are decoded away from the extension host under the asset
// library's one-megapixel/16 MiB limits and the host's worker memory/time budgets.
try {
  const data: unknown = workerData;
  if (!isWorkerBytes(data)) {
    throw new Error(
      isRecord(data) && data.indexes !== undefined
        ? "PNG worker indexes must be bytes."
        : "PNG worker requires image bytes.",
    );
  }
  const { bytes, indexes } = data;
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
