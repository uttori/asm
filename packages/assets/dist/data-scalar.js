import { integer, unitCount } from "./validation.js";
/**
 * Decode fixed-width integers, retaining the width and signedness selected by the caller.
 * @param bytes Borrowed packed integer bytes.
 * @param options Width, endian order and signedness.
 * @returns Decoded integers in input order.
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
/**
 * Encode fresh integer arrays, rejecting overflow instead of truncating high bits.
 * @param values Integer values to pack.
 * @param options Width, endian order and signedness.
 * @returns Owned packed bytes.
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
//# sourceMappingURL=data-scalar.js.map