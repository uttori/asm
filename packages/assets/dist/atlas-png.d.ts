import type { AtlasFileCodec } from "./atlas-interchange.js";
/**
 * A second file seam: PNG preserves raw slots but requires the explicit export manifest.
 * Transparency is adapter-supplied because PNG may contain multiple transparent palette entries.
 */
export declare function indexedPngAtlasCodec(transparentIndex: number): AtlasFileCodec;
//# sourceMappingURL=atlas-png.d.ts.map