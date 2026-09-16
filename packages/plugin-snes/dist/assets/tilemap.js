import { arrayValue, decodedObject, defaultPath, integerValue, jsonFile, objectValue, optionsFor, readBytes, resolveGrid, stringOption, } from "./common.js";
/** Stable id of the regular SNES BG tilemap codec. */
export const SNES_BG_TILEMAP_ASSET_CODEC_ID = "snes.asset.tilemap.bg";
/** Stable id of the byte-indexed SNES Mode 7 tilemap codec. */
export const SNES_MODE7_TILEMAP_ASSET_CODEC_ID = "snes.asset.tilemap.mode7";
const dimensions = (resolved) => ({
    ...(resolved.width === undefined ? {} : { width: resolved.width, height: resolved.height }),
});
/** 16-bit SNES BG entries: tile, palette, priority, and horizontal/vertical flips. */
export const snesBgTilemapAssetCodec = Object.freeze({
    id: SNES_BG_TILEMAP_ASSET_CODEC_ID,
    version: "1.0.0",
    sizeBounds: { minimum: 2 },
    inspect: (context) => {
        const resolved = resolveGrid(context, 2);
        return {
            size: resolved.size,
            metadata: { format: "snes-bg-tilemap", count: resolved.count, ...dimensions(resolved) },
        };
    },
    decode: (context) => {
        const options = optionsFor(context);
        const resolved = resolveGrid(context, 2);
        const bytes = readBytes(context.source, context.request.sourceOffset, resolved.size, context.request.id);
        const entries = Array.from({ length: resolved.count }, (_, index) => {
            const word = bytes[index * 2] | (bytes[index * 2 + 1] << 8);
            return {
                tile: word & 0x03ff,
                palette: (word >> 10) & 0x07,
                priority: (word >> 13) & 1,
                horizontalFlip: (word >> 14) & 1,
                verticalFlip: (word >> 15) & 1,
            };
        });
        const value = {
            kind: "snes-bg-tilemap",
            ...dimensions(resolved),
            entries,
        };
        const path = stringOption(options, "path", defaultPath(context.request.id, "tilemap.json"));
        return { value, files: [jsonFile(path, value)] };
    },
    encode: (context) => {
        const resolved = resolveGrid(context, 2);
        const value = decodedObject(context.decoded.value, context.request.id);
        const entries = arrayValue(value.entries, `SNES tilemap '${context.request.id}' entries`);
        if (entries.length !== resolved.count) {
            throw new Error(`SNES tilemap '${context.request.id}' requires ${resolved.count} entries.`);
        }
        const bytes = new Uint8Array(resolved.size);
        entries.forEach((entryValue, index) => {
            const entry = objectValue(entryValue, `SNES tilemap entry ${index}`);
            const tile = integerValue(entry.tile, `SNES tilemap entry ${index} tile`, 0, 0x03ff);
            const palette = integerValue(entry.palette, `SNES tilemap entry ${index} palette`, 0, 7);
            const priority = integerValue(entry.priority, `SNES tilemap entry ${index} priority`, 0, 1);
            const horizontalFlip = integerValue(entry.horizontalFlip, `SNES tilemap entry ${index} horizontalFlip`, 0, 1);
            const verticalFlip = integerValue(entry.verticalFlip, `SNES tilemap entry ${index} verticalFlip`, 0, 1);
            const word = tile | (palette << 10) | (priority << 13) | (horizontalFlip << 14) | (verticalFlip << 15);
            bytes[index * 2] = word & 0xff;
            bytes[index * 2 + 1] = word >> 8;
        });
        return bytes;
    },
});
/** Row-major one-byte tile indexes used by the SNES Mode 7 tilemap. */
export const snesMode7TilemapAssetCodec = Object.freeze({
    id: SNES_MODE7_TILEMAP_ASSET_CODEC_ID,
    version: "1.0.0",
    sizeBounds: { minimum: 1 },
    inspect: (context) => {
        const resolved = resolveGrid(context, 1);
        return {
            size: resolved.size,
            metadata: { format: "snes-mode7-tilemap", count: resolved.count, ...dimensions(resolved) },
        };
    },
    decode: (context) => {
        const options = optionsFor(context);
        const resolved = resolveGrid(context, 1);
        const bytes = readBytes(context.source, context.request.sourceOffset, resolved.size, context.request.id);
        const value = {
            kind: "snes-mode7-tilemap",
            ...dimensions(resolved),
            indexes: [...bytes],
        };
        const path = stringOption(options, "path", defaultPath(context.request.id, "mode7-tilemap.json"));
        return { value, files: [jsonFile(path, value)] };
    },
    encode: (context) => {
        const resolved = resolveGrid(context, 1);
        const value = decodedObject(context.decoded.value, context.request.id);
        const indexes = arrayValue(value.indexes, `SNES Mode 7 tilemap '${context.request.id}' indexes`);
        if (indexes.length !== resolved.count) {
            throw new Error(`SNES Mode 7 tilemap '${context.request.id}' requires ${resolved.count} indexes.`);
        }
        return Uint8Array.from(indexes.map((index, position) => integerValue(index, `SNES Mode 7 tilemap index ${position}`, 0, 0xff)));
    },
});
//# sourceMappingURL=tilemap.js.map