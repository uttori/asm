import { decodeScalarArray, encodeScalarArray, type ScalarArrayOptions } from "./data.js";
import { integer, unitCount } from "./validation.js";

/** One non-overlapping scalar or LSB0 bit field in a fixed-size record. */
export type StructField =
  | Readonly<{
      name: string;
      kind: "scalar";
      offset: number;
      width: 1 | 2 | 3 | 4;
      endian?: "little" | "big";
      signed?: boolean;
    }>
  | Readonly<{ name: string; kind: "bitfield"; bitOffset: number; bits: number; signed?: boolean }>;

/** Fixed record layout; stride may include unused bytes that require preservation. */
export interface StructLayout {
  readonly stride: number;
  readonly fields: readonly StructField[];
}

/** Fields are decoded values; raw retains unknown bits and padding. */
export interface StructRecords {
  readonly records: readonly Readonly<Record<string, number>>[];
  readonly raw: Uint8Array;
}

const validateLayout = (layout: StructLayout): void => {
  integer(layout.stride, "Struct stride", 1, 1 << 20);
  if (layout.fields.length === 0) {
    throw new Error("Struct layout requires fields.");
  }
  const names = new Set<string>();
  const spans: Array<{ name: string; start: number; end: number }> = [];
  layout.fields.forEach((field) => {
    if (!field.name || names.has(field.name)) {
      throw new Error(`Duplicate or empty struct field '${field.name}'.`);
    }
    names.add(field.name);
    const start =
      field.kind === "scalar"
        ? integer(field.offset, `${field.name} offset`, 0, layout.stride - 1) * 8
        : integer(field.bitOffset, `${field.name} bitOffset`, 0, layout.stride * 8 - 1);
    const length =
      field.kind === "scalar"
        ? integer(field.width, `${field.name} width`, 1, 4) * 8
        : integer(field.bits, `${field.name} bits`, 1, 32);
    if (start + length > layout.stride * 8) {
      throw new RangeError(`Field '${field.name}' exceeds stride ${layout.stride}.`);
    }
    const end = start + length;
    if (spans.some((other) => start < other.end && other.start < end)) {
      throw new Error(`Struct field '${field.name}' overlaps another field.`);
    }
    spans.push({ name: field.name, start, end });
  });
};

const scalarOptions = (field: Extract<StructField, { kind: "scalar" }>): ScalarArrayOptions => ({
  width: field.width,
  endian: field.endian ?? "little",
  signed: field.signed ?? false,
});

const readBits = (
  bytes: Uint8Array,
  base: number,
  bitOffset: number,
  bits: number,
  signed: boolean,
): number => {
  let value = 0;
  for (let bit = 0; bit < bits; bit++) {
    const position = bitOffset + bit;
    if ((bytes[base + Math.floor(position / 8)] & (1 << (position % 8))) !== 0) {
      value += 2 ** bit;
    }
  }
  const modulus = 2 ** bits;
  return signed && value >= modulus / 2 ? value - modulus : value;
};

/** Decode records while retaining exact backing bytes for later edits.
 * @param {Uint8Array} bytes Borrowed complete record stream.
 * @param {StructLayout} layout Field locations and byte stride.
 * @returns {StructRecords} Decoded fields and an owned raw snapshot.
 */
export function decodeStructRecords(bytes: Uint8Array, layout: StructLayout): StructRecords {
  validateLayout(layout);
  const count = unitCount(bytes, layout.stride, "Struct records");
  const records = Array.from({ length: count }, (_, index) => {
    const base = index * layout.stride;
    return Object.fromEntries(
      layout.fields.map((field) => {
        if (field.kind === "scalar") {
          const value = decodeScalarArray(
            bytes.subarray(base + field.offset, base + field.offset + field.width),
            scalarOptions(field),
          )[0];
          return [field.name, value];
        }
        return [
          field.name,
          readBits(bytes, base, field.bitOffset, field.bits, field.signed ?? false),
        ];
      }),
    );
  });
  return { records, raw: bytes.slice() };
}

/** Encode records while preserving unknown bits, or explicitly zero-fill new padding.
 * @param {Record<string, number>[]} records Field values in record order.
 * @param {StructLayout} layout Field locations and byte stride.
 * @param {Uint8Array} backing Original bytes; omit only with explicit zero padding.
 * @param {string} padding Required policy for newly authored records.
 * @returns {Uint8Array} Owned packed records.
 */
export function encodeStructRecords(
  records: readonly Readonly<Record<string, number>>[],
  layout: StructLayout,
  backing?: Uint8Array,
  padding?: "zero",
): Uint8Array {
  validateLayout(layout);
  const size = records.length * layout.stride;
  if (!Number.isSafeInteger(size)) {
    throw new RangeError("Struct output size overflowed.");
  }
  if (!backing && padding !== "zero") {
    throw new Error("New struct records require padding: 'zero'.");
  }
  if (backing && backing.length !== size) {
    throw new RangeError(`Struct backing must be ${size} bytes.`);
  }
  const bytes = backing ? backing.slice() : new Uint8Array(size);
  records.forEach((record, index) => {
    const base = index * layout.stride;
    for (const key of Object.keys(record)) {
      if (!layout.fields.some((field) => field.name === key)) {
        throw new Error(`Unknown struct field '${key}'.`);
      }
    }
    for (const field of layout.fields) {
      const value = record[field.name];
      if (typeof value !== "number") {
        throw new Error(`Struct field '${field.name}' requires an integer.`);
      }
      if (field.kind === "scalar") {
        bytes.set(encodeScalarArray([value], scalarOptions(field)), base + field.offset);
        continue;
      }
      const modulus = 2 ** field.bits;
      const minimum = field.signed ? -modulus / 2 : 0;
      const maximum = field.signed ? modulus / 2 - 1 : modulus - 1;
      let encoded = integer(value, `Struct field '${field.name}'`, minimum, maximum);
      if (encoded < 0) {
        encoded += modulus;
      }
      for (let bit = 0; bit < field.bits; bit++) {
        const position = field.bitOffset + bit;
        const offset = base + Math.floor(position / 8);
        const mask = 1 << (position % 8);
        // Touch only declared bits so padding and unknown fields survive an edit.
        if (Math.floor(encoded / 2 ** bit) & 1) {
          bytes[offset] |= mask;
        } else {
          bytes[offset] &= ~mask;
        }
      }
    }
  });
  return bytes;
}

/** Address interpretation is explicit; a null sentinel cannot alias a real address. */
export interface PointerTableOptions extends ScalarArrayOptions {
  readonly base: number;
  readonly scale: number;
  readonly nullValue?: number;
}

/** Decode fixed-width pointers to absolute addresses.
 * @param {Uint8Array} bytes Borrowed packed pointer values.
 * @param {PointerTableOptions} options Width, endian order, base, scale and optional null sentinel.
 * @returns {(number|null)[]} Addresses or nulls in table order.
 */
export function decodePointerTable(
  bytes: Uint8Array,
  options: PointerTableOptions,
): Array<number | null> {
  integer(options.base, "Pointer base", 0, Number.MAX_SAFE_INTEGER);
  integer(options.scale, "Pointer scale", 1, Number.MAX_SAFE_INTEGER);
  return decodeScalarArray(bytes, options).map((raw) => {
    if (raw === options.nullValue) {
      return null;
    }
    const address = options.base + raw * options.scale;
    return integer(address, "Pointer address", 0, Number.MAX_SAFE_INTEGER);
  });
}

/** Encode exact representable pointer addresses without inventing ROM locations.
 * @param {(number|null)[]} addresses Absolute addresses or nulls.
 * @param {PointerTableOptions} options Width, endian order, base, scale and optional null sentinel.
 * @returns {Uint8Array} Owned packed pointer values.
 */
export function encodePointerTable(
  addresses: readonly (number | null)[],
  options: PointerTableOptions,
): Uint8Array {
  integer(options.base, "Pointer base", 0, Number.MAX_SAFE_INTEGER);
  integer(options.scale, "Pointer scale", 1, Number.MAX_SAFE_INTEGER);
  const raw = addresses.map((address) => {
    if (address === null) {
      if (options.nullValue === undefined) {
        throw new Error("Null pointer requires a nullValue.");
      }
      return options.nullValue;
    }
    const relative =
      (integer(address, "Pointer address", 0, Number.MAX_SAFE_INTEGER) - options.base) /
      options.scale;
    if (!Number.isSafeInteger(relative) || relative < 0 || relative === options.nullValue) {
      throw new RangeError(`Pointer ${address} is not representable.`);
    }
    return relative;
  });
  return encodeScalarArray(raw, { ...options, signed: false });
}

/** Index interpretation is separate from qualified analysis references. */
export interface IndexTableOptions extends ScalarArrayOptions {
  readonly baseIndex: number;
  readonly nullValue?: number;
}

/** Decode semantic indexes without resolving game-specific target IDs.
 * @param {Uint8Array} bytes Borrowed packed index values.
 * @param {PointerTableOptions} options Width, endian order, base index and optional null sentinel.
 * @returns {(number|null)[]} Indexes or nulls in table order.
 */
export function decodeIndexTable(
  bytes: Uint8Array,
  options: IndexTableOptions,
): Array<number | null> {
  integer(options.baseIndex, "Base index", 0, Number.MAX_SAFE_INTEGER);
  return decodeScalarArray(bytes, options).map((raw) =>
    raw === options.nullValue
      ? null
      : integer(raw + options.baseIndex, "Index", 0, Number.MAX_SAFE_INTEGER),
  );
}

/** Encode semantic indexes, rejecting nulls and values that do not fit storage.
 * @param {(number|null)[]} indexes Logical indexes or nulls.
 * @param {PointerTableOptions} options Width, endian order, base index and optional null sentinel.
 * @returns {Uint8Array} Owned packed index values.
 */
export function encodeIndexTable(
  indexes: readonly (number | null)[],
  options: IndexTableOptions,
): Uint8Array {
  integer(options.baseIndex, "Base index", 0, Number.MAX_SAFE_INTEGER);
  const raw = indexes.map((index) => {
    if (index === null) {
      if (options.nullValue === undefined) {
        throw new Error("Null index requires a nullValue.");
      }
      return options.nullValue;
    }
    const value = integer(index, "Index", 0, Number.MAX_SAFE_INTEGER) - options.baseIndex;
    if (value < 0 || value === options.nullValue) {
      throw new RangeError(`Index ${index} is not representable.`);
    }
    return value;
  });
  return encodeScalarArray(raw, { ...options, signed: false });
}
