import { byteOrderOption, decodedObject, defaultAssetPath, integerOption, jsonFile, objectValue, optionsFor, readAssetBytes, readInteger, resolveCountAndSize, stringOption, writeInteger, } from "./common.js";
/** Stable id of the built-in semantic index-table codec. */
export const INDEX_TABLE_ASSET_CODEC_ID = "uttori.asset.index-table";
const settings = (context) => {
    const options = optionsFor(context);
    const width = integerOption(options, "width", { minimum: 1, maximum: 4, fallback: 1 });
    const endian = byteOrderOption(options);
    const baseIndex = integerOption(options, "baseIndex", { fallback: 0 });
    const nullValue = integerOption(options, "nullValue", {
        minimum: 0,
        maximum: 2 ** (width * 8) - 1,
    });
    const { count, size } = resolveCountAndSize(context, width, options);
    if (!Array.isArray(options.targets)) {
        throw new Error("Index-table option 'targets' must be an array.");
    }
    const indexes = new Set();
    const targets = options.targets.map((value, position) => {
        const target = objectValue(value, `Index target ${position}`);
        const index = integerOption(target, "index", { minimum: 0 });
        const id = stringOption(target, "id");
        const addressSpace = stringOption(target, "addressSpace");
        const address = integerOption(target, "address", { minimum: 0 });
        if (index === undefined || !id || !addressSpace || address === undefined) {
            throw new Error(`Index target ${position} is incomplete.`);
        }
        if (indexes.has(index)) {
            throw new Error(`Index target ${index} is duplicated.`);
        }
        indexes.add(index);
        return { index, id, addressSpace, address };
    });
    return { options, width, endian, baseIndex, nullValue, count, size, targets };
};
const indexesFor = (context) => {
    const resolved = settings(context);
    const bytes = readAssetBytes(context, resolved.size);
    const indexes = Array.from({ length: resolved.count }, (_, index) => {
        const raw = readInteger(bytes, index * resolved.width, resolved.width, resolved.endian);
        return resolved.nullValue !== undefined && raw === resolved.nullValue
            ? null
            : raw + resolved.baseIndex;
    });
    return { settings: resolved, indexes };
};
const referencesFor = (entries) => {
    const targets = new Map(entries.settings.targets.map((target) => [target.index, target]));
    return entries.indexes.flatMap((index, position) => {
        if (index === null) {
            return [];
        }
        const target = targets.get(index);
        return target
            ? [
                {
                    id: `entry-${position.toString().padStart(4, "0")}`,
                    kind: "index",
                    addressSpace: target.addressSpace,
                    address: target.address,
                    width: entries.settings.width,
                    targetAssetId: target.id,
                    detail: `Index ${index}`,
                },
            ]
            : [];
    });
};
/** Fixed-width indexes resolved through stable target ids and qualified addresses. */
export const indexTableAssetCodec = Object.freeze({
    id: INDEX_TABLE_ASSET_CODEC_ID,
    version: "1.0.0",
    sizeBounds: { minimum: 1 },
    inspect: (context) => {
        const entries = indexesFor(context);
        return {
            size: entries.settings.size,
            references: referencesFor(entries),
            metadata: {
                count: entries.settings.count,
                width: entries.settings.width,
                endian: entries.settings.endian,
                baseIndex: entries.settings.baseIndex,
                unresolvedIndexes: entries.indexes.filter((index) => index !== null && !entries.settings.targets.some((target) => target.index === index)),
            },
        };
    },
    decode: (context) => {
        const entries = indexesFor(context);
        const value = { kind: "index-table", indexes: entries.indexes };
        const path = stringOption(entries.settings.options, "path", defaultAssetPath(context.request.id, "json"));
        return { value, files: [jsonFile(path, value)] };
    },
    encode: (context) => {
        const resolved = settings(context);
        const value = decodedObject(context.decoded.value, context.request.id);
        if (!Array.isArray(value.indexes) || value.indexes.length !== resolved.count) {
            throw new Error(`Index asset '${context.request.id}' requires ${resolved.count} indexes.`);
        }
        const bytes = new Uint8Array(resolved.size);
        value.indexes.forEach((index, position) => {
            let raw;
            if (index === null) {
                if (resolved.nullValue === undefined) {
                    throw new Error(`Index asset '${context.request.id}' has null without a nullValue.`);
                }
                raw = resolved.nullValue;
            }
            else {
                if (typeof index !== "number" || !Number.isSafeInteger(index)) {
                    throw new Error(`Index asset '${context.request.id}' indexes must be integers or null.`);
                }
                raw = index - resolved.baseIndex;
            }
            writeInteger(bytes, position * resolved.width, resolved.width, resolved.endian, raw);
        });
        return bytes;
    },
});
//# sourceMappingURL=index-table.js.map