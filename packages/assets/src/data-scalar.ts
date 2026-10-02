import { integer, unitCount } from "./validation.js";

/** Integer array encoding options, independent of any ROM address. */
export interface ScalarArrayOptions {
  readonly width: 1 | 2 | 3 | 4;
  readonly endian: "little" | "big";
  readonly signed?: boolean;
}

/** Decode fixed-width integers, retaining the width and signedness selected by the caller.
 * @param {Uint8Array} bytes Borrowed packed integer bytes.
 * @param {ScalarArrayOptions} options Width, endian order and signedness.
 * @returns {number[]} Decoded integers in input order.
 */
export function decodeScalarArray(bytes: Uint8Array, options: ScalarArrayOptions): number[] {
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
export function encodeScalarArray(
  values: readonly number[],
  options: ScalarArrayOptions,
): Uint8Array {
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
