import { withImageEncoders } from "../image-conversion.js";
import { pngImporter, readAssetPng } from "../png.js";
import { AssetRegistry, convertAsset } from "../registry.js";
import { snesNativeEncoders } from "../snes.js";
import { encodeBossGraphics, expandBossGraphics } from "./som-boss-graphics.js";
import { encodeFrameAtlas, readFrameLayout } from "./som-frame-atlas.js";
import { compressSomLz, decompressSomLz } from "./som-lz.js";
import { readSpritePaletteCatalog } from "./som-sprite-palettes.js";
const registry = new AssetRegistry().registerImporter(pngImporter);
for (const encoder of withImageEncoders(snesNativeEncoders)) {
    registry.registerEncoder(encoder);
}
/** Read a private PNG chunk holding the exact native boss stream for one segment.
 * @param {Uint8Array} png PNG bytes.
 * @param {string} [wanted] Four-character chunk type.
 * @returns {Uint8Array | undefined} Chunk payload, excluding its CRC.
 */
function nativeBossChunk(png, wanted = "soMz") {
    const image = readAssetPng(png);
    let native;
    for (const { type, data } of image.chunks) {
        if (type === wanted) {
            if (native) {
                throw new Error("Duplicate native boss graphics PNG chunk.");
            }
            // The parsed payload borrows PNG storage; native outputs need independent ownership.
            native = Uint8Array.from(data);
        }
    }
    return native;
}
/** Decode the two graphics stages and reject any unused bytes in a preserved native stream.
 * @param {Uint8Array} native Preserved native chunk.
 * @param {string} storage `lz-rle` or `rle`.
 * @param {number} size Expected expanded size.
 * @returns {{bytes: Uint8Array, mode: number | undefined, unusedHeaderByte: number | undefined}} Expanded tiles and any LZ header fields.
 */
function decodeBossStream(native, storage, size) {
    let intermediate = native;
    let mode;
    let unusedHeaderByte;
    if (storage === "lz-rle") {
        const decoded = decompressSomLz(native);
        if (decoded.compressedBytes !== native.length) {
            throw new Error("Boss LZ stream has trailing bytes.");
        }
        intermediate = decoded.data;
        mode = decoded.mode;
        unusedHeaderByte = decoded.unusedHeaderByte;
    }
    const expanded = expandBossGraphics(intermediate, size);
    if (expanded.consumed !== intermediate.length) {
        throw new Error("Boss mask stream has trailing bytes.");
    }
    return { bytes: expanded.data, mode, unusedHeaderByte };
}
/**
 * Rebuild native graphics from previewable pixels. An unchanged PNG retains its exact
 * token choices. Fixed sizing pads after the complete stream; encoded sizing exposes
 * growth to the source layout/relocation service instead of truncating or allocating here.
 * @param {AssetInput} source Indexed PNG, optionally carrying a native chunk.
 * @param {Readonly<Record<string, unknown>>} options Storage, original byteLength, optional native resource, sizePolicy (fixed by default or encoded), and atlas resources.
 * @param {Readonly<Record<string, AssetInput>>} [resources] Layout and palette sidecars.
 * @param {{readonly layout: FrameLayout, readonly catalog: SpritePaletteCatalog}} [normalized] Authoritative in-memory mapping and reconciled palette supplied by source normalization.
 * @returns {{primaryOutput: string, outputs: {graphics: {bytes: Uint8Array}}}} Independently decoded native bytes.
 */
export function convertBossImage(source, options, resources = {}, normalized) {
    const { storage, byteLength, sizePolicy = "fixed", mode, unusedHeaderByte = 0 } = options;
    if (storage !== "lz-rle" && storage !== "rle") {
        throw new Error("Boss storage must be lz-rle or rle.");
    }
    if (typeof byteLength !== "number" || !Number.isSafeInteger(byteLength) || byteLength < 1) {
        throw new Error("Boss byteLength must be a positive integer.");
    }
    if (sizePolicy !== "fixed" && sizePolicy !== "encoded") {
        throw new Error("Boss sizePolicy must be fixed or encoded.");
    }
    // Frame atlases invert their recorded tile placements before the boss codecs.
    // Older native-order sheets remain supported for existing callers.
    const layout = normalized?.layout ?? (options.layout ? readFrameLayout(options, resources) : undefined);
    const catalog = normalized?.catalog ??
        (options.layout ? readSpritePaletteCatalog(options, resources) : undefined);
    let pixels;
    let segmentName;
    if (layout) {
        if (typeof options.segment !== "string") {
            throw new Error("Frame atlas segment is required.");
        }
        segmentName = options.segment;
        pixels = encodeFrameAtlas(source, layout, segmentName, catalog);
    }
    else {
        pixels = convertAsset(registry, { source, format: "snes.tile.4bpp" }).outputs.tiles.bytes;
    }
    const segmentIndex = segmentName ? Object.keys(layout?.segments ?? {}).indexOf(segmentName) : -1;
    if (segmentIndex > 25) {
        throw new Error("Boss atlas supports at most 26 native segments.");
    }
    const chunkName = segmentIndex < 0 ? "soMz" : `soM${String.fromCharCode(65 + segmentIndex)}`;
    let original;
    if (options.native !== undefined) {
        if (typeof options.native !== "string" || !options.native) {
            throw new Error("Boss native data requires an explicit original compressed resource.");
        }
        const nativeResource = Object.hasOwn(resources, options.native)
            ? resources[options.native]
            : undefined;
        if (!nativeResource) {
            throw new Error("Boss native data requires an explicit original compressed resource.");
        }
        // A Git-tracked original stream survives ordinary PNG tools dropping private
        // chunks. It remains a compression reference, never a replacement for edited pixels.
        original = nativeResource.bytes;
    }
    else {
        original = nativeBossChunk(source.bytes, chunkName);
    }
    if (original) {
        if (original.length !== byteLength) {
            throw new Error("Boss native data has the wrong byte length.");
        }
        const decoded = decodeBossStream(original, storage, pixels.length);
        if (decoded.bytes.every((byte, index) => byte === pixels[index])) {
            return { primaryOutput: "graphics", outputs: { graphics: { bytes: original } } };
        }
    }
    const intermediate = encodeBossGraphics(pixels);
    let encoded = intermediate;
    if (storage === "lz-rle") {
        const selectedMode = original ? original[0] : mode;
        const selectedHeaderByte = original ? original[1] : unusedHeaderByte;
        encoded = compressSomLz(intermediate, {
            mode: selectedMode,
            unusedHeaderByte: selectedHeaderByte,
        });
    }
    if (sizePolicy === "fixed" && encoded.length > byteLength) {
        throw new Error("Edited boss graphics exceed their fixed ROM span; use sizePolicy: encoded with a declared relocatable object.");
    }
    const verified = decodeBossStream(encoded, storage, pixels.length).bytes;
    if (verified.some((byte, index) => byte !== pixels[index])) {
        throw new Error("Boss graphics inverse failed.");
    }
    if (sizePolicy === "encoded") {
        return { primaryOutput: "graphics", outputs: { graphics: { bytes: encoded } } };
    }
    const padded = new Uint8Array(byteLength);
    padded.set(encoded);
    if (original) {
        padded.set(original.subarray(encoded.length), encoded.length);
    }
    return { primaryOutput: "graphics", outputs: { graphics: { bytes: padded } } };
}
/** Extract and independently validate a PNG's exact compression reference before moving it to a durable source resource. */
export function readBossNativeReference(source, options, resources) {
    const layout = readFrameLayout(options, resources);
    const segment = String(options.segment);
    const segmentIndex = Object.keys(layout.segments).indexOf(segment);
    if (segmentIndex < 0 || segmentIndex > 25) {
        throw new Error("Unknown boss native segment for source conversion.");
    }
    let bytes;
    if (typeof options.native === "string") {
        bytes = resources[options.native]?.bytes;
    }
    else {
        bytes = nativeBossChunk(source.bytes, `soM${String.fromCharCode(65 + segmentIndex)}`);
    }
    if (bytes) {
        decodeBossStream(bytes, String(options.storage), layout.segments[segment].tiles.length * 32);
    }
    return bytes?.slice();
}
//# sourceMappingURL=som-boss-image.js.map