import { AssetRegistry, convertAsset } from "@uttori/asm-assets";
import { waveImporter, withAudioEncoder } from "@uttori/asm-assets/audio";
import { rawEncoder, rawImporter, jsonImporter } from "@uttori/asm-assets/data";
import { pngImporter, withImageEncoders } from "@uttori/asm-assets/image";
import { snesNativeEncoders } from "@uttori/asm-assets/snes";
/** Shared portable converter; no assembler state or file access enters this registry. */
const registry = new AssetRegistry()
    .registerImporter(rawImporter)
    .registerImporter(jsonImporter)
    .registerImporter(pngImporter)
    .registerImporter(waveImporter);
const encoders = [...withAudioEncoder(withImageEncoders(snesNativeEncoders)), rawEncoder];
for (const encoder of encoders) {
    registry.registerEncoder(encoder);
}
const aliases = {
    "snes.tile.2bpp": ["2bpp"],
    "snes.tile.3bpp": ["3bpp"],
    "snes.tile.4bpp": ["4bpp"],
    "snes.tile.8bpp": ["8bpp"],
    "snes.tile.mode7": ["mode7"],
    "snes.palette.bgr555": ["palette"],
    "snes.tilemap.bg": ["bgmap"],
    "snes.tilemap.mode7": ["mode7map"],
    "snes.brr": ["brr"],
    "uttori.data.raw": ["raw"],
};
/** Editor metadata mirrors the converter's accepted top-level options. */
const imageOptions = {
    palette: { summary: "Embedded, exact external, or auto palette", valueSyntax: '"embedded"' },
    paletteExpansion: { summary: "RGB8/BGR555 expansion profile", valueSyntax: '"bit-replicate"' },
    layout: { summary: "Tile traversal and block order", valueSyntax: '{ tileOrder: "row-major" }' },
    tilemap: { summary: "Map index and attribute options", valueSyntax: "{ startTileIndex: 0 }" },
};
const audioOptions = {
    padding: { summary: "PCM tail padding policy", valueSyntax: '"reject"' },
    loop: { summary: "Playback loop in sample frames", valueSyntax: "false" },
};
/** Select only options accepted by this format's importer/encoder path.
 * @param {string} id Canonical encoder ID.
 * @returns {AssetFormatContribution["optionSchema"]} Editor option hints.
 */
const optionSchemaFor = (id) => {
    if (id.startsWith("snes.tile.")) {
        return imageOptions;
    }
    if (id === "snes.brr") {
        return audioOptions;
    }
    return {};
};
/** Adapts one converter ID to the neutral assembler contribution contract. */
export const snesAssetFormats = encoders.map((encoder) => ({
    id: encoder.id,
    version: encoder.version,
    aliases: aliases[encoder.id] ?? [],
    targets: ["snes.sfc"],
    optionSchema: optionSchemaFor(encoder.id),
    resourcePaths: (options) => {
        const palette = options.palette;
        if (typeof palette === "string" && palette !== "embedded" && palette !== "auto") {
            return [palette];
        }
        return [];
    },
    convert: (source, options, resources) => {
        const result = convertAsset(registry, {
            source,
            format: encoder.id,
            options,
            resources,
        });
        return { primaryOutput: result.primaryOutput, outputs: result.outputs };
    },
}));
//# sourceMappingURL=assembly-formats.js.map