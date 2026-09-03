import type { AssetCodec, AssetValue } from "../asset-codec.js";
import {
  booleanOption,
  byteOrderOption,
  decodedObject,
  defaultAssetPath,
  integerOption,
  jsonFile,
  numberArray,
  optionsFor,
  readExactAssetBytes,
  readInteger,
  resolveCountAndSize,
  stringOption,
  writeInteger,
} from "./common.js";

/** Stable id of the built-in scalar-array codec. */
export const SCALAR_ARRAY_ASSET_CODEC_ID = "uttori.asset.scalar-array";

const settings = (context: Parameters<AssetCodec["inspect"]>[0]) => {
  const options = optionsFor(context);
  const width = integerOption(options, "width", { minimum: 1, maximum: 4, fallback: 1 })!;
  const endian = byteOrderOption(options);
  const signed = booleanOption(options, "signed");
  const { count, size } = resolveCountAndSize(context, width, options);
  return { options, width, endian, signed, count, size };
};

/** Fixed-width signed or unsigned integer arrays in either byte order. */
export const scalarArrayAssetCodec: AssetCodec = Object.freeze({
  id: SCALAR_ARRAY_ASSET_CODEC_ID,
  version: "1.0.0",
  sizeBounds: { minimum: 1 },
  inspect: (context) => {
    const { width, endian, signed, count, size } = settings(context);
    return { size, metadata: { width, endian, signed, count } };
  },
  decode: (context) => {
    const { options, width, endian, signed, count } = settings(context);
    const bytes = readExactAssetBytes(context);
    const values = Array.from({ length: count }, (_, index) =>
      readInteger(bytes, index * width, width, endian, signed),
    );
    const value: AssetValue = { kind: "scalar-array", width, endian, signed, values };
    const path = stringOption(options, "path", defaultAssetPath(context.request.id, "json"))!;
    return { value, files: [jsonFile(path, value)] };
  },
  encode: (context) => {
    const { width, endian, signed, count, size } = settings(context);
    const value = decodedObject(context.decoded.value, context.request.id);
    const values = numberArray(value.values, `Scalar asset '${context.request.id}' values`);
    if (values.length !== count) {
      throw new Error(`Scalar asset '${context.request.id}' requires exactly ${count} values.`);
    }
    const bytes = new Uint8Array(size);
    values.forEach((entry, index) =>
      writeInteger(bytes, index * width, width, endian, entry, signed),
    );
    return bytes;
  },
} satisfies AssetCodec);
