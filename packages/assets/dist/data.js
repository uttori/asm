import { integer, unitCount } from "./validation.js";
export * from "./data-structured.js";
export * from "./data-text.js";
/** Decode fixed-width integers, retaining the width and signedness selected by the caller.
 * @param {Uint8Array} bytes Borrowed packed integer bytes.
 * @param {ScalarArrayOptions} options Width, endian order and signedness.
 * @returns {number[]} Decoded integers in input order.
 */
export function decodeScalarArray(bytes, options) {
    const count = unitCount(bytes, options.width, "Scalar array");
    return Array.from({ length: count }, (_, index) => {
        let unsigned = 0;
        for (let byte = 0; byte < options.width; byte++) {
            const position = options.endian === "little" ? byte : options.width - 1 - byte;
            unsigned += bytes[index * options.width + position] * 2 ** (8 * byte);
        }
        const sign = 2 ** (options.width * 8 - 1);
        return options.signed && unsigned >= sign ? unsigned - sign * 2 : unsigned;
    });
}
/** Encode fresh integer arrays, rejecting overflow instead of truncating high bits.
 * @param {number[]} values Integer values to pack.
 * @param {ScalarArrayOptions} options Width, endian order and signedness.
 * @returns {Uint8Array} Owned packed bytes.
 */
export function encodeScalarArray(values, options) {
    const bits = options.width * 8;
    const minimum = options.signed ? -(2 ** (bits - 1)) : 0;
    const maximum = options.signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1;
    const bytes = new Uint8Array(values.length * options.width);
    values.forEach((value, index) => {
        let unsigned = integer(value, `Scalar ${index}`, minimum, maximum);
        if (unsigned < 0) {
            unsigned += 2 ** bits;
        }
        for (let byte = 0; byte < options.width; byte++) {
            const position = options.endian === "little" ? byte : options.width - 1 - byte;
            bytes[index * options.width + position] = Math.floor(unsigned / 2 ** (8 * byte)) & 255;
        }
    });
    return bytes;
}
/** Raw byte importer copies input so the result is independent of host buffers. */
export const rawImporter = Object.freeze({
    id: "uttori.import.raw",
    version: "1.0.0",
    mediaTypes: ["application/octet-stream"],
    import: (input) => ({
        kind: "raw",
        value: input.bytes.slice(),
    }),
});
/** Identity encoder for files or independently assembled code images. */
export const rawEncoder = Object.freeze({
    id: "uttori.data.raw",
    version: "1.0.0",
    inputKinds: ["raw"],
    primaryOutput: "data",
    encode: (document, options) => {
        if (Object.keys(options).length !== 0) {
            throw new Error("Raw encoding accepts no options.");
        }
        if (!(document.value instanceof Uint8Array)) {
            throw new Error("Raw document requires bytes.");
        }
        return {
            outputs: { data: { bytes: document.value.slice(), mediaType: "application/octet-stream" } },
            fidelity: { kind: "exact", verification: "byte equality" },
            normalizedOptions: {},
        };
    },
});
/** JSON authoring input for native models; validation belongs to the selected encoder. */
export const jsonImporter = Object.freeze({
    id: "uttori.import.json",
    version: "1.0.0",
    mediaTypes: ["application/json"],
    import: (input) => {
        const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes));
        if (value === null ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            !("kind" in value) ||
            typeof value.kind !== "string") {
            throw new Error("Asset JSON requires an object with a kind string.");
        }
        return { kind: value.kind, value };
    },
});
//# sourceMappingURL=data.js.map