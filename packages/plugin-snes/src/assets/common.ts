import type {
  AssetByteSource,
  AssetCodecContext,
  AssetExtractedFile,
  AssetValue,
} from "@uttori/asm-disassembler";

export type SnesAssetObject = Readonly<Record<string, AssetValue>>;

export const objectValue = (value: AssetValue | undefined, label: string): SnesAssetObject => {
  if (value === undefined) return {};
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${label} must be an object.`);
  }
  return value as SnesAssetObject;
};

export const optionsFor = (context: AssetCodecContext): SnesAssetObject =>
  objectValue(context.request.options, `Asset '${context.request.id}' options`);

export const integerOption = (
  options: SnesAssetObject,
  key: string,
  bounds: { readonly minimum?: number; readonly maximum?: number; readonly fallback?: number } = {},
): number | undefined => {
  const value = options[key] ?? bounds.fallback;
  if (
    value === undefined ||
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    (bounds.minimum !== undefined && value < bounds.minimum) ||
    (bounds.maximum !== undefined && value > bounds.maximum)
  ) {
    if (value === undefined) return undefined;
    throw new Error(`Asset option '${key}' is outside its integer bounds.`);
  }
  return value;
};

export const stringOption = (options: SnesAssetObject, key: string, fallback: string): string => {
  const value = options[key] ?? fallback;
  if (typeof value !== "string" || value === "") {
    throw new Error(`Asset option '${key}' must be a non-empty string.`);
  }
  return value;
};

export const readBytes = (
  source: AssetByteSource,
  offset: number,
  size: number,
  owner: string,
): Uint8Array => {
  const bytes = source.read(offset, size);
  if (!bytes) throw new Error(`SNES asset '${owner}' source range is unreadable.`);
  return bytes;
};

export const resolveCount = (
  context: AssetCodecContext,
  unitSize: number,
  options = optionsFor(context),
): { readonly count: number; readonly size: number } => {
  const configured = integerOption(options, "count", { minimum: 1 });
  const length = context.request.length;
  if (configured === undefined && length === undefined) {
    throw new Error(`SNES asset '${context.request.id}' requires a length or option 'count'.`);
  }
  if (length !== undefined && length % unitSize !== 0) {
    throw new Error(
      `SNES asset '${context.request.id}' length ${length} is not divisible by ${unitSize}.`,
    );
  }
  const count = configured ?? length! / unitSize;
  const size = count * unitSize;
  if (!Number.isSafeInteger(size))
    throw new Error(`SNES asset '${context.request.id}' overflowed.`);
  if (length !== undefined && length !== size) {
    throw new Error(
      `SNES asset '${context.request.id}' count ${count} requires ${size} bytes, not ${length}.`,
    );
  }
  return { count, size };
};

export const resolveGrid = (
  context: AssetCodecContext,
  unitSize: number,
): {
  readonly count: number;
  readonly size: number;
  readonly width?: number;
  readonly height?: number;
} => {
  const options = optionsFor(context);
  const width = integerOption(options, "width", { minimum: 1 });
  const height = integerOption(options, "height", { minimum: 1 });
  if ((width === undefined) !== (height === undefined)) {
    throw new Error("SNES grid assets require both 'width' and 'height'.");
  }
  const configuredCount = width === undefined ? undefined : width * height!;
  if (configuredCount !== undefined && !Number.isSafeInteger(configuredCount)) {
    throw new Error(`SNES asset '${context.request.id}' grid dimensions overflowed.`);
  }
  const countOption = integerOption(options, "count", { minimum: 1 });
  if (
    countOption !== undefined &&
    configuredCount !== undefined &&
    countOption !== configuredCount
  ) {
    throw new Error("SNES grid dimensions do not match option 'count'.");
  }
  const resolved = resolveCount(context, unitSize, {
    ...options,
    ...(configuredCount === undefined ? {} : { count: configuredCount }),
  });
  return {
    ...resolved,
    ...(width === undefined ? {} : { width, height: height! }),
  };
};

export const decodedObject = (value: AssetValue, owner: string): SnesAssetObject =>
  objectValue(value, `Decoded SNES asset '${owner}'`);

export const arrayValue = (value: AssetValue | undefined, label: string): readonly AssetValue[] => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value as readonly AssetValue[];
};

export const integerValue = (
  value: AssetValue | undefined,
  label: string,
  minimum: number,
  maximum: number,
): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
  return value;
};

export const defaultPath = (assetId: string, suffix: string): string =>
  `assets/${encodeURIComponent(assetId)}.${suffix}`;

export const jsonFile = (path: string, value: AssetValue): AssetExtractedFile => ({
  path,
  mediaType: "application/json",
  bytes: new TextEncoder().encode(`${JSON.stringify(value, undefined, 2)}\n`),
});
