import { type AtlasDocument, type AtlasFileCodec } from "./atlas-interchange.js";
export { decodeAsepriteDocumentSync, decodeAsepriteDocument, encodeAsepriteDocument, validateAsepriteDocument, resolveAsepriteCels, } from "./aseprite-document.js";
export type { AsepriteDocument, AsepriteLayer, AsepriteTileset, AsepriteCel, AsepriteFrame, AsepriteTag, } from "./aseprite-document.js";
export { renderAsepriteFrame } from "./aseprite-render.js";
/** Export a minimal indexed raster document. Raw cels avoid any runtime compression dependency for writing. */
export declare function encodeAsepriteAtlas(document: AtlasDocument): Uint8Array;
/** Decode the compatibility raster profile through the shared structural parser. */
export declare function decodeAsepriteAtlas(bytes: Uint8Array): Promise<AtlasDocument>;
/** Direct file codec; no editor installation, Node process or Lua transport is required. */
export declare const asepriteAtlasCodec: AtlasFileCodec;
//# sourceMappingURL=aseprite.d.ts.map