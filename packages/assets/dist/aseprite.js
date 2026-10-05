import { Fields, chunk } from "./aseprite-binary.js";
import { decodeAsepriteDocument } from "./aseprite-document.js";
import { validateAtlasDocument, } from "./atlas-interchange.js";
export { decodeAsepriteDocument, encodeAsepriteDocument, validateAsepriteDocument, resolveAsepriteCels, } from "./aseprite-document.js";
export { renderAsepriteFrame } from "./aseprite-render.js";
const ID_PREFIX = "uttori-atlas-export:";
/** Export a minimal indexed raster document. Raw cels avoid any runtime compression dependency for writing. */
export function encodeAsepriteAtlas(document) {
    validateAtlasDocument(document);
    const palette = new Fields()
        .u32(document.palette.length)
        .u32(0)
        .u32(document.palette.length - 1)
        .raw(new Uint8Array(8));
    for (const color of document.palette) {
        palette.u16(0).raw(Uint8Array.from(color));
    }
    const chunks = [chunk(0x2019, palette.build())];
    if (document.exportId) {
        // Sprite user data follows its palette, before any layer/cel user data can become the target.
        chunks.push(chunk(0x2020, new Fields()
            .u32(1)
            .text(ID_PREFIX + document.exportId)
            .build()));
    }
    chunks.push(chunk(0x2004, new Fields()
        .u16(3)
        .u16(0)
        .u16(0)
        .u16(0)
        .u16(0)
        .u16(0)
        .u8(255)
        .raw(new Uint8Array(3))
        .text("Atlas")
        .build()));
    chunks.push(chunk(0x2005, new Fields()
        .u16(0)
        .u16(0)
        .u16(0)
        .u8(255)
        .u16(0)
        .u16(0)
        .raw(new Uint8Array(5))
        .u16(document.width)
        .u16(document.height)
        .raw(document.indexes)
        .build()));
    const frameData = new Fields();
    for (const data of chunks) {
        frameData.raw(data);
    }
    const payload = frameData.build();
    const frame = new Fields()
        .u32(16 + payload.length)
        .u16(0xf1fa)
        .u16(chunks.length)
        .u16(100)
        .u16(0)
        .u32(0)
        .raw(payload)
        .build();
    const header = new Uint8Array(128);
    const view = new DataView(header.buffer);
    view.setUint32(0, 128 + frame.length, true);
    view.setUint16(4, 0xa5e0, true);
    view.setUint16(6, 1, true);
    view.setUint16(8, document.width, true);
    view.setUint16(10, document.height, true);
    view.setUint16(12, 8, true);
    view.setUint32(14, 1, true);
    view.setUint16(18, 100, true);
    header[28] = document.transparentIndex;
    view.setUint16(32, document.palette.length, true);
    header[34] = 1;
    header[35] = 1;
    return new Fields().raw(header).raw(frame).build();
}
/** Decode the compatibility raster profile through the shared structural parser. */
export async function decodeAsepriteAtlas(bytes) {
    const document = await decodeAsepriteDocument(bytes);
    if (document.frames.length !== 1 ||
        document.layers.length !== 1 ||
        document.layers[0].kind !== "raster" ||
        !(document.layers[0].flags & 1)) {
        throw new Error("Aseprite atlas requires one visible raster layer and exactly one frame.");
    }
    const cels = document.frames[0].cels;
    if (cels.length > 1 || cels.some((cel) => cel.kind !== "raster" || cel.zIndex !== 0)) {
        throw new Error("Linked cels and tilemaps are outside the atlas raster contract.");
    }
    const indexes = new Uint8Array(document.width * document.height).fill(document.transparentIndex);
    for (const cel of cels) {
        if (cel.kind !== "raster") {
            throw new Error("Unsupported raster cel.");
        }
        if (cel.x < 0 ||
            cel.y < 0 ||
            cel.x + cel.width > document.width ||
            cel.y + cel.height > document.height) {
            throw new Error("Aseprite cel is outside the fixed atlas canvas.");
        }
        for (let y = 0; y < cel.height; y++) {
            indexes.set(cel.indexes.subarray(y * cel.width, (y + 1) * cel.width), (cel.y + y) * document.width + cel.x);
        }
    }
    const result = {
        width: document.width,
        height: document.height,
        indexes,
        palette: document.palette,
        transparentIndex: document.transparentIndex,
        exportId: document.exportId,
    };
    validateAtlasDocument(result);
    return result;
}
/** Direct file codec; no editor installation, Node process or Lua transport is required. */
export const asepriteAtlasCodec = Object.freeze({
    id: "aseprite",
    version: 1,
    extension: ".aseprite",
    capabilities: { paletteEdits: true, embeddedIdentity: true },
    encode: (document) => Promise.resolve(encodeAsepriteAtlas(document)),
    decode: decodeAsepriteAtlas,
});
//# sourceMappingURL=aseprite.js.map