import type { AtlasFileCodec } from "./atlas-interchange.js";
import { indexedAtlasDocument, validateAtlasDocument } from "./atlas-interchange.js";
import { createIndexedPng } from "./png-edit.js";
import { pngImporter } from "./png.js";

/**
 * A second file seam: PNG preserves raw slots but requires the explicit export manifest.
 * Transparency is adapter-supplied because PNG may contain multiple transparent palette entries.
 */
export function indexedPngAtlasCodec(transparentIndex: number): AtlasFileCodec {
  return {
    id: "indexed-png",
    version: 1,
    extension: ".png",
    capabilities: { paletteEdits: true, embeddedIdentity: false },
    encode: (document) => {
      validateAtlasDocument(document);
      if (document.transparentIndex !== transparentIndex) {
        throw new Error("PNG transparency contract mismatch.");
      }
      return Promise.resolve(createIndexedPng(document));
    },
    decode: (bytes) =>
      Promise.resolve(
        indexedAtlasDocument(
          pngImporter.import({ bytes, mediaType: "image/png" }).value,
          transparentIndex,
        ),
      ),
  };
}
