import { byteOrderOption, decodedObject, defaultAssetPath, integerOption, jsonFile, optionsFor, readAssetBytes, readInteger, resolveCountAndSize, stringOption, writeInteger, } from "./common.js";
/** Stable id of the built-in pointer-table codec. */
export const POINTER_TABLE_ASSET_CODEC_ID = "uttori.asset.pointer-table";
const settings = (context) => {
    const options = optionsFor(context);
    const width = integerOption(options, "width", { minimum: 1, maximum: 4, fallback: 2 });
    const endian = byteOrderOption(options);
    const base = integerOption(options, "base", { fallback: 0 });
    const scale = integerOption(options, "scale", { minimum: 1, fallback: 1 });
    const nullValue = integerOption(options, "nullValue", {
        minimum: 0,
        maximum: 2 ** (width * 8) - 1,
    });
    const addressSpace = stringOption(options, "addressSpace", context.request.addressSpace);
    if (addressSpace === "")
        throw new Error("Pointer target address space cannot be empty.");
    const { count, size } = resolveCountAndSize(context, width, options);
    const targetIdsValue = options.targetAssetIds;
    let targetAssetIds = [];
    if (targetIdsValue !== undefined) {
        if (!Array.isArray(targetIdsValue) || targetIdsValue.length !== count) {
            throw new Error("Pointer option 'targetAssetIds' must match the pointer count.");
        }
        targetAssetIds = targetIdsValue.map((value) => {
            if (value !== null && typeof value !== "string") {
                throw new Error("Pointer target asset ids must be strings or null.");
            }
            return value;
        });
    }
    return {
        options,
        width,
        endian,
        base,
        scale,
        nullValue,
        addressSpace,
        count,
        size,
        targetAssetIds,
    };
};
const entriesFor = (context) => {
    const resolved = settings(context);
    const bytes = readAssetBytes(context, resolved.size);
    const rawValues = Array.from({ length: resolved.count }, (_, index) => readInteger(bytes, index * resolved.width, resolved.width, resolved.endian));
    const addresses = rawValues.map((raw) => {
        if (resolved.nullValue !== undefined && raw === resolved.nullValue)
            return null;
        const address = resolved.base + raw * resolved.scale;
        if (!Number.isSafeInteger(address) || address < 0) {
            throw new Error(`Pointer asset '${context.request.id}' produced an invalid address.`);
        }
        return address;
    });
    return { settings: resolved, rawValues, addresses };
};
const referencesFor = (entries) => entries.addresses.flatMap((address, index) => address === null
    ? []
    : [
        {
            id: `entry-${index.toString().padStart(4, "0")}`,
            kind: "pointer",
            addressSpace: entries.settings.addressSpace,
            address,
            width: entries.settings.width,
            ...(entries.settings.targetAssetIds[index]
                ? { targetAssetId: entries.settings.targetAssetIds[index] }
                : {}),
        },
    ]);
/** Fixed-width pointer table with configurable base, scale, byte order, and null value. */
export const pointerTableAssetCodec = Object.freeze({
    id: POINTER_TABLE_ASSET_CODEC_ID,
    version: "1.0.0",
    sizeBounds: { minimum: 1 },
    inspect: (context) => {
        const entries = entriesFor(context);
        return {
            size: entries.settings.size,
            references: referencesFor(entries),
            metadata: {
                count: entries.settings.count,
                width: entries.settings.width,
                endian: entries.settings.endian,
                base: entries.settings.base,
                scale: entries.settings.scale,
                ...(entries.settings.nullValue === undefined
                    ? {}
                    : { nullValue: entries.settings.nullValue }),
            },
        };
    },
    decode: (context) => {
        const entries = entriesFor(context);
        const value = {
            kind: "pointer-table",
            addresses: entries.addresses,
            rawValues: entries.rawValues,
        };
        const path = stringOption(entries.settings.options, "path", defaultAssetPath(context.request.id, "json"));
        return { value, files: [jsonFile(path, value)] };
    },
    encode: (context) => {
        const resolved = settings(context);
        const value = decodedObject(context.decoded.value, context.request.id);
        if (!Array.isArray(value.addresses) || value.addresses.length !== resolved.count) {
            throw new Error(`Pointer asset '${context.request.id}' requires ${resolved.count} addresses.`);
        }
        const bytes = new Uint8Array(resolved.size);
        value.addresses.forEach((address, index) => {
            let raw;
            if (address === null) {
                if (resolved.nullValue === undefined) {
                    throw new Error(`Pointer asset '${context.request.id}' has null without a nullValue.`);
                }
                raw = resolved.nullValue;
            }
            else {
                if (typeof address !== "number" || !Number.isSafeInteger(address)) {
                    throw new Error(`Pointer asset '${context.request.id}' addresses must be integers or null.`);
                }
                const relative = address - resolved.base;
                if (relative < 0 || relative % resolved.scale !== 0) {
                    throw new Error(`Pointer address ${address} is not representable by its base and scale.`);
                }
                raw = relative / resolved.scale;
            }
            writeInteger(bytes, index * resolved.width, resolved.width, resolved.endian, raw);
        });
        return bytes;
    },
});
//# sourceMappingURL=pointer-table.js.map