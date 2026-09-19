import type { AssetCodec, AssetValue } from "../asset-codec.js";
import {
  byteArray,
  booleanOption,
  byteOrderOption,
  decodedObject,
  defaultAssetPath,
  integerOption,
  jsonFile,
  objectValue,
  optionsFor,
  readExactAssetBytes,
  readInteger,
  resolveCountAndSize,
  stringOption,
  writeInteger,
  type ByteOrder,
} from "./common.js";

/** Stable id of the built-in struct/bitfield-array codec. */
export const STRUCT_ARRAY_ASSET_CODEC_ID = "uttori.asset.struct-array";

interface ScalarField {
  readonly kind: "scalar";
  readonly name: string;
  readonly bitStart: number;
  readonly bitLength: number;
  readonly byteOffset: number;
  readonly width: number;
  readonly endian: ByteOrder;
  readonly signed: boolean;
}

interface BitField {
  readonly kind: "bitfield";
  readonly name: string;
  readonly bitStart: number;
  readonly bitLength: number;
  readonly signed: boolean;
}

type Field = ScalarField | BitField;

const parseFields = (
  options: ReturnType<typeof optionsFor>,
): { readonly fields: readonly Field[]; readonly stride: number } => {
  const input = options.fields;
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("Struct asset option 'fields' must be a non-empty array.");
  }
  const defaultEndian = byteOrderOption(options);
  const names = new Set<string>();
  const fields = (input as readonly AssetValue[]).map((entry, index): Field => {
    const definition = objectValue(entry, `Struct field ${index}`);
    const name = stringOption(definition, "name");
    if (!name) {
      throw new Error(`Struct field ${index} requires a non-empty name.`);
    }
    if (names.has(name)) {
      throw new Error(`Struct field name '${name}' is duplicated.`);
    }
    names.add(name);
    const signed = booleanOption(definition, "signed");
    const bitOffset = integerOption(definition, "bitOffset", { minimum: 0 });
    const bits = integerOption(definition, "bits", { minimum: 1, maximum: 32 });
    if (bitOffset !== undefined || bits !== undefined) {
      if (bitOffset === undefined || bits === undefined) {
        throw new Error(`Bitfield '${name}' requires both 'bitOffset' and 'bits'.`);
      }
      return { kind: "bitfield", name, bitStart: bitOffset, bitLength: bits, signed };
    }
    const byteOffset = integerOption(definition, "offset", { minimum: 0 });
    if (byteOffset === undefined) {
      throw new Error(`Scalar field '${name}' requires 'offset'.`);
    }
    const width = integerOption(definition, "width", { minimum: 1, maximum: 4, fallback: 1 })!;
    const endianValue = stringOption(definition, "endian", defaultEndian);
    if (endianValue !== "little" && endianValue !== "big") {
      throw new Error(`Scalar field '${name}' has an invalid byte order.`);
    }
    return {
      kind: "scalar",
      name,
      bitStart: byteOffset * 8,
      bitLength: width * 8,
      byteOffset,
      width,
      endian: endianValue,
      signed,
    };
  });
  for (let left = 0; left < fields.length; left++) {
    const leftEnd = fields[left].bitStart + fields[left].bitLength;
    for (let right = left + 1; right < fields.length; right++) {
      const rightEnd = fields[right].bitStart + fields[right].bitLength;
      if (fields[left].bitStart < rightEnd && fields[right].bitStart < leftEnd) {
        throw new Error(
          `Struct fields '${fields[left].name}' and '${fields[right].name}' overlap.`,
        );
      }
    }
  }
  // Schema field counts are not a safe function-argument bound, even for one small record.
  const requiredBits = fields.reduce(
    (maximum, field) => Math.max(maximum, field.bitStart + field.bitLength),
    -Infinity,
  );
  const requiredStride = Math.ceil(requiredBits / 8);
  const stride = integerOption(options, "stride", { minimum: requiredStride }) ?? requiredStride;
  return { fields, stride };
};

const settings = (context: Parameters<AssetCodec["inspect"]>[0]) => {
  const options = optionsFor(context);
  const { fields, stride } = parseFields(options);
  const { count, size } = resolveCountAndSize(context, stride, options);
  return { options, fields, stride, count, size };
};

const readBits = (bytes: Uint8Array, base: number, field: BitField): number => {
  let value = 0;
  for (let index = 0; index < field.bitLength; index++) {
    const bit = field.bitStart + index;
    if (((bytes[base + Math.floor(bit / 8)] ?? 0) & (1 << (bit % 8))) !== 0) {
      value += 2 ** index;
    }
  }
  const modulus = 2 ** field.bitLength;
  return field.signed && value >= modulus / 2 ? value - modulus : value;
};

const writeBits = (bytes: Uint8Array, base: number, field: BitField, value: number): void => {
  const modulus = 2 ** field.bitLength;
  const minimum = field.signed ? -modulus / 2 : 0;
  const maximum = field.signed ? modulus / 2 - 1 : modulus - 1;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Field '${field.name}' value does not fit ${field.bitLength} bits.`);
  }
  const encoded = value < 0 ? value + modulus : value;
  for (let index = 0; index < field.bitLength; index++) {
    const bit = field.bitStart + index;
    const byteIndex = base + Math.floor(bit / 8);
    const mask = 1 << (bit % 8);
    bytes[byteIndex] =
      (encoded & (2 ** index)) === 0 ? bytes[byteIndex] & ~mask : bytes[byteIndex] | mask;
  }
};

/** Repeated fixed-layout records with scalar fields and disjoint LSB0 bitfields. */
export const structArrayAssetCodec: AssetCodec = Object.freeze({
  id: STRUCT_ARRAY_ASSET_CODEC_ID,
  version: "1.0.0",
  sizeBounds: { minimum: 1 },
  inspect: (context) => {
    const { fields, stride, count, size } = settings(context);
    return {
      size,
      metadata: {
        count,
        stride,
        bitOrder: "lsb0",
        fields: fields.map((field) => ({ ...field })),
      },
    };
  },
  decode: (context) => {
    const { options, fields, stride, count } = settings(context);
    const bytes = readExactAssetBytes(context);
    const records = Array.from({ length: count }, (_, recordIndex) => {
      const base = recordIndex * stride;
      return Object.fromEntries(
        fields.map((field) => [
          field.name,
          field.kind === "scalar"
            ? readInteger(bytes, base + field.byteOffset, field.width, field.endian, field.signed)
            : readBits(bytes, base, field),
        ]),
      );
    });
    const value: AssetValue = {
      kind: "struct-array",
      raw: [...bytes],
      records,
    };
    const path = stringOption(options, "path", defaultAssetPath(context.request.id, "json"))!;
    return { value, files: [jsonFile(path, value)] };
  },
  encode: (context) => {
    const { fields, stride, count, size } = settings(context);
    const value = decodedObject(context.decoded.value, context.request.id);
    const raw = byteArray(value.raw, `Struct asset '${context.request.id}' raw bytes`);
    if (raw.length !== size) {
      throw new Error(
        `Struct asset '${context.request.id}' raw backing must remain ${size} bytes.`,
      );
    }
    if (!Array.isArray(value.records) || value.records.length !== count) {
      throw new Error(`Struct asset '${context.request.id}' requires exactly ${count} records.`);
    }
    const bytes = Uint8Array.from(raw);
    (value.records as readonly AssetValue[]).forEach((recordValue, recordIndex) => {
      const record = objectValue(recordValue, `Struct record ${recordIndex}`);
      const base = recordIndex * stride;
      for (const field of fields) {
        const fieldValue = record[field.name];
        if (typeof fieldValue !== "number") {
          throw new Error(`Struct field '${field.name}' requires an integer value.`);
        }
        if (field.kind === "scalar") {
          writeInteger(
            bytes,
            base + field.byteOffset,
            field.width,
            field.endian,
            fieldValue,
            field.signed,
          );
        } else {
          writeBits(bytes, base, field, fieldValue);
        }
      }
    });
    return bytes;
  },
} satisfies AssetCodec);
