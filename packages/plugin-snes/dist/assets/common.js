export const objectValue = (value, label) => {
    if (value === undefined)
        return {};
    if (value === null || Array.isArray(value) || typeof value !== "object") {
        throw new Error(`${label} must be an object.`);
    }
    return value;
};
export const optionsFor = (context) => objectValue(context.request.options, `Asset '${context.request.id}' options`);
export const integerOption = (options, key, bounds = {}) => {
    const value = options[key] ?? bounds.fallback;
    if (value === undefined ||
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        (bounds.minimum !== undefined && value < bounds.minimum) ||
        (bounds.maximum !== undefined && value > bounds.maximum)) {
        if (value === undefined)
            return undefined;
        throw new Error(`Asset option '${key}' is outside its integer bounds.`);
    }
    return value;
};
export const stringOption = (options, key, fallback) => {
    const value = options[key] ?? fallback;
    if (typeof value !== "string" || value === "") {
        throw new Error(`Asset option '${key}' must be a non-empty string.`);
    }
    return value;
};
export const readBytes = (source, offset, size, owner) => {
    const bytes = source.read(offset, size);
    if (!bytes)
        throw new Error(`SNES asset '${owner}' source range is unreadable.`);
    return bytes;
};
export const resolveCount = (context, unitSize, options = optionsFor(context)) => {
    const configured = integerOption(options, "count", { minimum: 1 });
    const length = context.request.length;
    if (configured === undefined && length === undefined) {
        throw new Error(`SNES asset '${context.request.id}' requires a length or option 'count'.`);
    }
    if (length !== undefined && length % unitSize !== 0) {
        throw new Error(`SNES asset '${context.request.id}' length ${length} is not divisible by ${unitSize}.`);
    }
    const count = configured ?? length / unitSize;
    const size = count * unitSize;
    if (!Number.isSafeInteger(size))
        throw new Error(`SNES asset '${context.request.id}' overflowed.`);
    if (length !== undefined && length !== size) {
        throw new Error(`SNES asset '${context.request.id}' count ${count} requires ${size} bytes, not ${length}.`);
    }
    return { count, size };
};
export const resolveGrid = (context, unitSize) => {
    const options = optionsFor(context);
    const width = integerOption(options, "width", { minimum: 1 });
    const height = integerOption(options, "height", { minimum: 1 });
    if ((width === undefined) !== (height === undefined)) {
        throw new Error("SNES grid assets require both 'width' and 'height'.");
    }
    const configuredCount = width === undefined ? undefined : width * height;
    if (configuredCount !== undefined && !Number.isSafeInteger(configuredCount)) {
        throw new Error(`SNES asset '${context.request.id}' grid dimensions overflowed.`);
    }
    const countOption = integerOption(options, "count", { minimum: 1 });
    if (countOption !== undefined &&
        configuredCount !== undefined &&
        countOption !== configuredCount) {
        throw new Error("SNES grid dimensions do not match option 'count'.");
    }
    const resolved = resolveCount(context, unitSize, {
        ...options,
        ...(configuredCount === undefined ? {} : { count: configuredCount }),
    });
    return {
        ...resolved,
        ...(width === undefined ? {} : { width, height: height }),
    };
};
export const decodedObject = (value, owner) => objectValue(value, `Decoded SNES asset '${owner}'`);
export const arrayValue = (value, label) => {
    if (!Array.isArray(value))
        throw new Error(`${label} must be an array.`);
    return value;
};
export const integerValue = (value, label, minimum, maximum) => {
    if (typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < minimum ||
        value > maximum) {
        throw new Error(`${label} must be an integer in ${minimum}..${maximum}.`);
    }
    return value;
};
export const defaultPath = (assetId, suffix) => `assets/${encodeURIComponent(assetId)}.${suffix}`;
export const jsonFile = (path, value) => ({
    path,
    mediaType: "application/json",
    bytes: new TextEncoder().encode(`${JSON.stringify(value, undefined, 2)}\n`),
});
//# sourceMappingURL=common.js.map