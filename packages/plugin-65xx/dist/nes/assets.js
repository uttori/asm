import { createIndexedPng, readAssetPng } from "@uttori/asm-assets/image";
/** NES tiles contain eight low-plane rows followed by eight high-plane rows, MSB pixel first. */
export const NES_CHR_CODEC = "nes.chr.2bpp";
/** Explicit single-byte tile alphabet; no ASCII fallback or implicit control codes. */
export const NES_TEXT_CODEC = "nes.text.tiles";
/** Four diagnostic index colors; these identify bitplane values, not an inferred gameplay palette. */
const indexPalette = [
    [0, 0, 0, 255],
    [85, 85, 85, 255],
    [170, 170, 170, 255],
    [255, 255, 255, 255],
];
/** Render complete native tiles in row-major order. Columns must divide the tile count exactly. */
export function nesChrPng(bytes, columns = 16) {
    const count = bytes.length / 16;
    if (!Number.isInteger(count) ||
        count === 0 ||
        !Number.isInteger(columns) ||
        columns < 1 ||
        count % columns) {
        throw new Error("NES CHR graphics require complete 16-byte tiles and complete atlas rows.");
    }
    const width = columns * 8;
    const height = (count / columns) * 8;
    const indexes = new Uint8Array(width * height);
    for (let tile = 0; tile < count; tile++) {
        const left = (tile % columns) * 8;
        const top = Math.floor(tile / columns) * 8;
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                indexes[(top + y) * width + left + x] =
                    ((bytes[tile * 16 + y] >> (7 - x)) & 1) |
                        (((bytes[tile * 16 + y + 8] >> (7 - x)) & 1) << 1);
            }
        }
    }
    return createIndexedPng({ width, height, indexes, palette: indexPalette });
}
/** Preserve PNG palette indexes exactly; RGB changes cannot silently remap the encoded tile values. */
export function encodeNesChrPng(bytes) {
    const png = readAssetPng(bytes);
    if (png.colorType !== 3) {
        throw new Error("NES CHR assets require an indexed PNG.");
    }
    const image = png.toIndexed({ copy: false });
    if (!image.width ||
        !image.height ||
        image.width % 8 ||
        image.height % 8 ||
        image.indexes.some((value) => value > 3)) {
        throw new Error("NES CHR assets require 8-pixel tile dimensions and indexes 0..3.");
    }
    const columns = image.width / 8;
    const count = (columns * image.height) / 8;
    const output = new Uint8Array(count * 16);
    for (let tile = 0; tile < count; tile++) {
        const left = (tile % columns) * 8;
        const top = Math.floor(tile / columns) * 8;
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const value = image.indexes[(top + y) * image.width + left + x];
                output[tile * 16 + y] |= (value & 1) << (7 - x);
                output[tile * 16 + y + 8] |= (value >> 1) << (7 - x);
            }
        }
    }
    return output;
}
/** Options enumerate every accepted character and its byte; duplicate bytes make decoding ambiguous. */
export function nesTextMap(options) {
    if (typeof options !== "object" ||
        options === null ||
        Array.isArray(options) ||
        Object.keys(options).some((key) => key !== "characters") ||
        !("characters" in options) ||
        typeof options.characters !== "object" ||
        options.characters === null ||
        Array.isArray(options.characters)) {
        throw new Error("NES tile text requires an explicit characters object.");
    }
    const result = new Map();
    const bytes = new Set();
    for (const [character, value] of Object.entries(options.characters)) {
        if (character.length !== 1 ||
            typeof value !== "number" ||
            !Number.isInteger(value) ||
            value < 0 ||
            value > 255 ||
            bytes.has(value)) {
            throw new Error("NES tile text mappings require unique characters and byte values.");
        }
        result.set(character, value);
        bytes.add(value);
    }
    if (!result.size) {
        throw new Error("NES tile text mappings must not be empty.");
    }
    return result;
}
/** Decode only proved glyphs. Control bytes and unknown tiles require separate source ranges. */
export function decodeNesText(bytes, options) {
    const reverse = new Map([...nesTextMap(options)].map(([character, value]) => [value, character]));
    return [...bytes]
        .map((value) => {
        const character = reverse.get(value);
        if (character === undefined) {
            throw new Error(`Unknown NES text glyph $${value.toString(16).toUpperCase().padStart(2, "0")}.`);
        }
        return character;
    })
        .join("");
}
/** Exact encoders available to NES assembly and source previews; source bytes are borrowed only during conversion. */
export const nesAssetFormats = [
    {
        id: NES_CHR_CODEC,
        version: "1.0.0",
        targets: ["65xx.nes"],
        sourceRepresentations: [{ id: "indexed-png", mediaType: "image/png", extensions: [".png"] }],
        convert(source, options) {
            if (source.mediaType !== "image/png" || Object.keys(options).length) {
                throw new Error("NES CHR conversion accepts an indexed PNG without options.");
            }
            return { primaryOutput: "chr", outputs: { chr: { bytes: encodeNesChrPng(source.bytes) } } };
        },
    },
    {
        id: NES_TEXT_CODEC,
        version: "1.0.0",
        targets: ["65xx.nes"],
        optionSchema: {
            characters: {
                summary: "Explicit character-to-tile byte mapping",
                valueSyntax: '{ A: $0A, " ": $FC }',
            },
        },
        sourceRepresentations: [{ id: "utf8-text", mediaType: "text/plain", extensions: [".txt"] }],
        convert(source, options) {
            if (source.mediaType !== "text/plain") {
                throw new Error("NES tile text requires UTF-8 text.");
            }
            const map = nesTextMap(options);
            const text = new TextDecoder("utf-8", { fatal: true }).decode(source.bytes);
            const bytes = Uint8Array.from(
            // Mapping keys are single UTF-16 units; splitting uses the same contract and rejects unknown units.
            text.split("").map((character) => {
                const value = map.get(character);
                if (value === undefined) {
                    throw new Error(`Unmapped NES text character ${JSON.stringify(character)}.`);
                }
                return value;
            }));
            return { primaryOutput: "text", outputs: { text: { bytes } } };
        },
    },
];
//# sourceMappingURL=assets.js.map