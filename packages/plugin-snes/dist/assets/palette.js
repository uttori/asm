import { arrayValue, decodedObject, defaultPath, integerValue, jsonFile, objectValue, optionsFor, readBytes, resolveCount, stringOption, } from "./common.js";
/** Stable id of the SNES CGRAM BGR555 palette codec. */
export const SNES_PALETTE_ASSET_CODEC_ID = "snes.asset.palette.bgr555";
/** Little-endian SNES CGRAM colors with the unused high bit preserved explicitly. */
export const snesPaletteAssetCodec = Object.freeze({
    id: SNES_PALETTE_ASSET_CODEC_ID,
    version: "1.0.0",
    sizeBounds: { minimum: 2 },
    inspect: (context) => {
        const { count, size } = resolveCount(context, 2);
        return { size, metadata: { format: "snes-cgram-bgr555", count } };
    },
    decode: (context) => {
        const options = optionsFor(context);
        const { count, size } = resolveCount(context, 2, options);
        const bytes = readBytes(context.source, context.request.sourceOffset, size, context.request.id);
        const colors = Array.from({ length: count }, (_, index) => {
            const word = bytes[index * 2] | (bytes[index * 2 + 1] << 8);
            return {
                red: word & 0x1f,
                green: (word >> 5) & 0x1f,
                blue: (word >> 10) & 0x1f,
                unusedHighBit: (word >> 15) & 1,
            };
        });
        const value = { kind: "snes-palette-bgr555", colors };
        const path = stringOption(options, "path", defaultPath(context.request.id, "palette.json"));
        return { value, files: [jsonFile(path, value)] };
    },
    encode: (context) => {
        const { count, size } = resolveCount(context, 2);
        const value = decodedObject(context.decoded.value, context.request.id);
        const colors = arrayValue(value.colors, `SNES palette '${context.request.id}' colors`);
        if (colors.length !== count) {
            throw new Error(`SNES palette '${context.request.id}' requires exactly ${count} colors.`);
        }
        const bytes = new Uint8Array(size);
        colors.forEach((colorValue, index) => {
            const color = objectValue(colorValue, `SNES palette color ${index}`);
            const red = integerValue(color.red, `SNES palette color ${index} red`, 0, 0x1f);
            const green = integerValue(color.green, `SNES palette color ${index} green`, 0, 0x1f);
            const blue = integerValue(color.blue, `SNES palette color ${index} blue`, 0, 0x1f);
            const unused = integerValue(color.unusedHighBit, `SNES palette color ${index} unusedHighBit`, 0, 1);
            const word = red | (green << 5) | (blue << 10) | (unused << 15);
            bytes[index * 2] = word & 0xff;
            bytes[index * 2 + 1] = word >> 8;
        });
        return bytes;
    },
});
//# sourceMappingURL=palette.js.map