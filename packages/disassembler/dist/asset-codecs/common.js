export const objectValue = (value, label) => {
    if (value === undefined || value === null || Array.isArray(value) || typeof value !== "object") {
        if (value === undefined) {
            return {};
        }
        throw new Error(`${label} must be an object.`);
    }
    return value;
};
export const optionsFor = (context) => objectValue(context.request.options, `Asset '${context.request.id}' options`);
export const stringOption = (options, key, fallback) => {
    const value = options[key];
    if (value === undefined) {
        return fallback;
    }
    if (typeof value !== "string") {
        throw new Error(`Asset option '${key}' must be a string.`);
    }
    return value;
};
export const booleanOption = (options, key, fallback = false) => {
    const value = options[key];
    if (value === undefined) {
        return fallback;
    }
    if (typeof value !== "boolean") {
        throw new Error(`Asset option '${key}' must be boolean.`);
    }
    return value;
};
export const integerOption = (options, key, settings = {}) => {
    const value = options[key] ?? settings.fallback;
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        (settings.minimum !== undefined && value < settings.minimum) ||
        (settings.maximum !== undefined && value > settings.maximum)) {
        throw new Error(`Asset option '${key}' is outside its integer bounds.`);
    }
    return value;
};
export const byteOrderOption = (options) => {
    const value = stringOption(options, "endian", "little");
    if (value !== "little" && value !== "big") {
        throw new Error("Asset option 'endian' must be 'little' or 'big'.");
    }
    return value;
};
export const readExactAssetBytes = (context, size = context.inspection.size) => {
    return readAssetBytes(context, size);
};
export const readAssetBytes = (context, size) => {
    const bytes = context.source.read(context.request.sourceOffset, size);
    if (!bytes) {
        throw new Error(`Asset '${context.request.id}' source range is unreadable.`);
    }
    return bytes;
};
export const resolveCountAndSize = (context, unitSize, options = optionsFor(context)) => {
    if (!Number.isSafeInteger(unitSize) || unitSize <= 0) {
        throw new Error("Asset unit size must be a positive safe integer.");
    }
    const configuredCount = integerOption(options, "count", { minimum: 1 });
    const requestedLength = context.request.length;
    if (configuredCount === undefined && requestedLength === undefined) {
        throw new Error(`Asset '${context.request.id}' requires either length or option 'count'.`);
    }
    if (requestedLength !== undefined && requestedLength % unitSize !== 0) {
        throw new Error(`Asset '${context.request.id}' length ${requestedLength} is not divisible by ${unitSize}.`);
    }
    const count = configuredCount ?? requestedLength / unitSize;
    const size = count * unitSize;
    if (!Number.isSafeInteger(size)) {
        throw new Error(`Asset '${context.request.id}' size overflowed.`);
    }
    if (requestedLength !== undefined && requestedLength !== size) {
        throw new Error(`Asset '${context.request.id}' count ${count} requires ${size} bytes, not ${requestedLength}.`);
    }
    return { count, size };
};
export const readInteger = (bytes, offset, width, endian, signed = false) => {
    let value = 0;
    for (let index = 0; index < width; index++) {
        const byteIndex = endian === "little" ? offset + index : offset + width - index - 1;
        value += (bytes[byteIndex] ?? 0) * 2 ** (index * 8);
    }
    const modulus = 2 ** (width * 8);
    return signed && value >= modulus / 2 ? value - modulus : value;
};
export const writeInteger = (bytes, offset, width, endian, value, signed = false) => {
    const modulus = 2 ** (width * 8);
    const minimum = signed ? -modulus / 2 : 0;
    const maximum = signed ? modulus / 2 - 1 : modulus - 1;
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new Error(`Integer ${String(value)} does not fit ${signed ? "signed" : "unsigned"} ${width}-byte storage.`);
    }
    let remaining = value < 0 ? value + modulus : value;
    for (let index = 0; index < width; index++) {
        const byteIndex = endian === "little" ? offset + index : offset + width - index - 1;
        bytes[byteIndex] = remaining % 0x100;
        remaining = Math.floor(remaining / 0x100);
    }
};
export const decodedObject = (value, owner) => objectValue(value, `Decoded asset '${owner}'`);
export const numberArray = (value, label) => {
    if (!Array.isArray(value)) {
        throw new Error(`${label} must be an array.`);
    }
    return value.map((entry) => {
        if (typeof entry !== "number" || !Number.isSafeInteger(entry)) {
            throw new Error(`${label} must contain only safe integers.`);
        }
        return entry;
    });
};
export const byteArray = (value, label) => {
    const values = numberArray(value, label);
    if (values.some((entry) => entry < 0 || entry > 0xff)) {
        throw new Error(`${label} must contain only bytes in the range 0..255.`);
    }
    return values;
};
export const defaultAssetPath = (assetId, extension) => `assets/${encodeURIComponent(assetId)}.${extension}`;
export const jsonFile = (path, value) => ({
    path,
    mediaType: "application/json",
    bytes: new TextEncoder().encode(`${JSON.stringify(value, undefined, 2)}\n`),
});
//# sourceMappingURL=common.js.map