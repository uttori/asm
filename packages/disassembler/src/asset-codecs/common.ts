import type {
  AssetCodecContext,
  AssetDecodeContext,
  AssetExtractedFile,
  AssetValue,
} from "../asset-codec.js";

export type AssetObject = Readonly<Record<string, AssetValue>>;
export type ByteOrder = "big" | "little";

export const objectValue = (value: AssetValue | undefined, label: string): AssetObject => {
  if (value === undefined || value === null || Array.isArray(value) || typeof value !== "object") {
    if (value === undefined) return {};
    throw new Error(`${label} must be an object.`);
  }
  return value as AssetObject;
};

export const optionsFor = (context: AssetCodecContext): AssetObject =>
  objectValue(context.request.options, `Asset '${context.request.id}' options`);

export const stringOption = (
  options: AssetObject,
  key: string,
  fallback?: string,
): string | undefined => {
  const value = options[key];
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new Error(`Asset option '${key}' must be a string.`);
  return value;
};

export const booleanOption = (options: AssetObject, key: string, fallback = false): boolean => {
  const value = options[key];
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`Asset option '${key}' must be boolean.`);
  return value;
};

export const integerOption = (
  options: AssetObject,
  key: string,
  settings: {
    readonly minimum?: number;
    readonly maximum?: number;
    readonly fallback?: number;
  } = {},
): number | undefined => {
  const value = options[key] ?? settings.fallback;
  if (value === undefined) return undefined;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    (settings.minimum !== undefined && value < settings.minimum) ||
    (settings.maximum !== undefined && value > settings.maximum)
  ) {
    throw new Error(`Asset option '${key}' is outside its integer bounds.`);
  }
  return value;
};

export const byteOrderOption = (options: AssetObject): ByteOrder => {
  const value = stringOption(options, "endian", "little");
  if (value !== "little" && value !== "big") {
    throw new Error("Asset option 'endian' must be 'little' or 'big'.");
  }
  return value;
};

export const readExactAssetBytes = (
  context: AssetDecodeContext,
  size = context.inspection.size,
): Uint8Array => {
  return readAssetBytes(context, size);
};

export const readAssetBytes = (context: AssetCodecContext, size: number): Uint8Array => {
  const bytes = context.source.read(context.request.sourceOffset, size);
  if (!bytes) throw new Error(`Asset '${context.request.id}' source range is unreadable.`);
  return bytes;
};

export const resolveCountAndSize = (
  context: AssetCodecContext,
  unitSize: number,
  options = optionsFor(context),
): { readonly count: number; readonly size: number } => {
  if (!Number.isSafeInteger(unitSize) || unitSize <= 0) {
    throw new Error("Asset unit size must be a positive safe integer.");
  }
  const configuredCount = integerOption(options, "count", { minimum: 1 });
  const requestedLength = context.request.length;
  if (configuredCount === undefined && requestedLength === undefined) {
    throw new Error(`Asset '${context.request.id}' requires either length or option 'count'.`);
  }
  if (requestedLength !== undefined && requestedLength % unitSize !== 0) {
    throw new Error(
      `Asset '${context.request.id}' length ${requestedLength} is not divisible by ${unitSize}.`,
    );
  }
  const count = configuredCount ?? requestedLength! / unitSize;
  const size = count * unitSize;
  if (!Number.isSafeInteger(size))
    throw new Error(`Asset '${context.request.id}' size overflowed.`);
  if (requestedLength !== undefined && requestedLength !== size) {
    throw new Error(
      `Asset '${context.request.id}' count ${count} requires ${size} bytes, not ${requestedLength}.`,
    );
  }
  return { count, size };
};

export const readInteger = (
  bytes: Uint8Array,
  offset: number,
  width: number,
  endian: ByteOrder,
  signed = false,
): number => {
  let value = 0;
  for (let index = 0; index < width; index++) {
    const byteIndex = endian === "little" ? offset + index : offset + width - index - 1;
    value += (bytes[byteIndex] ?? 0) * 2 ** (index * 8);
  }
  const modulus = 2 ** (width * 8);
  return signed && value >= modulus / 2 ? value - modulus : value;
};

export const writeInteger = (
  bytes: Uint8Array,
  offset: number,
  width: number,
  endian: ByteOrder,
  value: number,
  signed = false,
): void => {
  const modulus = 2 ** (width * 8);
  const minimum = signed ? -modulus / 2 : 0;
  const maximum = signed ? modulus / 2 - 1 : modulus - 1;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `Integer ${String(value)} does not fit ${signed ? "signed" : "unsigned"} ${width}-byte storage.`,
    );
  }
  let remaining = value < 0 ? value + modulus : value;
  for (let index = 0; index < width; index++) {
    const byteIndex = endian === "little" ? offset + index : offset + width - index - 1;
    bytes[byteIndex] = remaining % 0x100;
    remaining = Math.floor(remaining / 0x100);
  }
};

export const decodedObject = (value: AssetValue, owner: string): AssetObject =>
  objectValue(value, `Decoded asset '${owner}'`);

export const numberArray = (value: AssetValue | undefined, label: string): readonly number[] => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return (value as readonly AssetValue[]).map((entry) => {
    if (typeof entry !== "number" || !Number.isSafeInteger(entry)) {
      throw new Error(`${label} must contain only safe integers.`);
    }
    return entry;
  });
};

export const byteArray = (value: AssetValue | undefined, label: string): readonly number[] => {
  const values = numberArray(value, label);
  if (values.some((entry) => entry < 0 || entry > 0xff)) {
    throw new Error(`${label} must contain only bytes in the range 0..255.`);
  }
  return values;
};

export const defaultAssetPath = (assetId: string, extension: string): string =>
  `assets/${encodeURIComponent(assetId)}.${extension}`;

export const jsonFile = (path: string, value: AssetValue): AssetExtractedFile => ({
  path,
  mediaType: "application/json",
  bytes: new TextEncoder().encode(`${JSON.stringify(value, undefined, 2)}\n`),
});
