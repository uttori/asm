import { asepriteAtlasCodec } from "@uttori/asm-assets/aseprite";
import { indexedPngAtlasCodec } from "@uttori/asm-assets/atlas-png";
import { ASSET_LIMITS } from "@uttori/asm-assets/limits";
import { createRasterInterchange, rasterInterchangeAtlas, rasterInterchangeDocument, } from "@uttori/asm-assets/raster-interchange";
const capabilities = Object.freeze({
    pixelEdits: true,
    paletteEdits: true,
    tileReferences: false,
    previewTimeline: false,
});
/** The existing v1 indexed raster file contract uses the shared parser and native owner reconciliation. */
export const asepriteRasterCodec = Object.freeze({
    id: "aseprite.raster",
    version: 1,
    fileBytes: ASSET_LIMITS.asepriteBytes,
    capabilities,
    prepare: createRasterInterchange,
    async encode(document, signal) {
        signal?.throwIfAborted();
        const bytes = await asepriteAtlasCodec.encode(rasterInterchangeAtlas(document));
        signal?.throwIfAborted();
        return bytes;
    },
    async decode(bytes, signal) {
        signal?.throwIfAborted();
        const document = rasterInterchangeDocument(await asepriteAtlasCodec.decode(bytes));
        signal?.throwIfAborted();
        return document;
    },
});
/** PNG preserves palette slots; its transparent slot and identity come only from the selected private baseline. */
export const indexedPngStructureCodec = Object.freeze({
    id: "indexed-png",
    version: 1,
    fileBytes: ASSET_LIMITS.pngBytes,
    capabilities,
    embeddedIdentity: false,
    prepare: createRasterInterchange,
    async encode(document, signal) {
        signal?.throwIfAborted();
        const atlas = rasterInterchangeAtlas(document);
        const bytes = await indexedPngAtlasCodec(atlas.transparentIndex).encode(atlas);
        signal?.throwIfAborted();
        return bytes;
    },
    async decode(bytes, signal, baseline) {
        if (!baseline) {
            throw new Error("PNG import requires its selected private raster baseline.");
        }
        signal?.throwIfAborted();
        const atlas = await indexedPngAtlasCodec(baseline.transparentIndex).decode(bytes);
        signal?.throwIfAborted();
        return rasterInterchangeDocument({ ...atlas, exportId: baseline.exportId });
    },
});
//# sourceMappingURL=raster-codecs.js.map