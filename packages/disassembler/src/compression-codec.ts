import { createHash } from "node:crypto";

import type { AssetValue } from "./asset-codec.js";

/** Context supplied to a target- or game-owned compression codec. */
export interface CompressionCodecContext {
  readonly options?: AssetValue;
}

/** Reversible byte-to-byte compressor kept separate from semantic asset codecs. */
export interface CompressionCodec {
  /** Stable namespaced id persisted by project annotations. */
  readonly id: string;
  /** Implementation version used for provenance and cache invalidation. */
  readonly version: string;
  decode(encoded: Uint8Array, context: CompressionCodecContext): Uint8Array;
  encode(decoded: Uint8Array, context: CompressionCodecContext): Uint8Array;
}

/** Fixed ownership and optional bank restrictions for one compressed ROM range. */
export interface CompressionRangeConstraints {
  readonly sourceOffset: number;
  /** Exact existing ROM extent. Recompression never changes this replacement size. */
  readonly originalSize: number;
  /** Largest legal compressed stream; defaults to `originalSize`. */
  readonly maximumSize?: number;
  /** Optional half-open bank bounds. Both values must be supplied together. */
  readonly bankStart?: number;
  readonly bankEnd?: number;
  /** Fill unused bytes after a shorter stream; otherwise preserve the original tail. */
  readonly fillByte?: number;
}

/** Deterministic verification of one existing compressed stream. */
export interface CompressionVerificationRecord {
  readonly codecId: string;
  readonly codecVersion: string;
  readonly sourceOffset: number;
  readonly encodedSize: number;
  readonly decodedSize: number;
  readonly encodedSha256: string;
  readonly decodedSha256: string;
}

/** Fixed-size patch produced after constraint-checked recompression. */
export interface CompressionReencodeResult {
  /** The compressor's meaningful stream before range padding/preservation. */
  readonly encoded: Uint8Array;
  /** Exact `originalSize` bytes safe to overlay without shifting later regions. */
  readonly replacement: Uint8Array;
  readonly unusedSize: number;
}

const isAsciiAlphaNumeric = (character: string): boolean => {
  const code = character.charCodeAt(0);
  return (
    (code >= 0x30 && code <= 0x39) ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a)
  );
};
const isStableId = (id: string): boolean => {
  if (id.length === 0 || !isAsciiAlphaNumeric(id[0]) || !isAsciiAlphaNumeric(id.at(-1)!)) {
    return false;
  }
  for (let index = 0; index < id.length; index++) {
    const character = id[index];
    if (!isAsciiAlphaNumeric(character) && !"._:/-".includes(character)) {
      return false;
    }
  }
  return true;
};
const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const assertBytes = (value: unknown, operation: string, codecId: string): Uint8Array => {
  if (!(value instanceof Uint8Array)) {
    throw new Error(`Compression codec '${codecId}' ${operation} must return Uint8Array.`);
  }
  return Uint8Array.from(value);
};

const normalizeOptions = (
  value: AssetValue | undefined,
  location = "compression options",
): AssetValue | undefined => {
  if (
    value === undefined ||
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${location} contains a non-finite number.`);
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    return (value as readonly AssetValue[]).map((entry, index): AssetValue => {
      const normalized = normalizeOptions(entry, `${location}[${index}]`);
      if (normalized === undefined) {
        throw new Error(`${location}[${index}] cannot be undefined.`);
      }
      return normalized;
    });
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${location} must contain only plain JSON objects.`);
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeOptions(entry, `${location}.${key}`)!]),
  );
};

const validateConstraints = (
  constraints: CompressionRangeConstraints,
  existingLength: number,
): Required<Pick<CompressionRangeConstraints, "sourceOffset" | "originalSize" | "maximumSize">> &
  CompressionRangeConstraints => {
  const { sourceOffset, originalSize } = constraints;
  if (!Number.isSafeInteger(sourceOffset) || sourceOffset < 0) {
    throw new Error("Compressed range sourceOffset must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(originalSize) || originalSize <= 0 || originalSize !== existingLength) {
    throw new Error(
      `Compressed range originalSize ${originalSize} must equal the ${existingLength}-byte existing range.`,
    );
  }
  const maximumSize = constraints.maximumSize ?? originalSize;
  if (!Number.isSafeInteger(maximumSize) || maximumSize <= 0 || maximumSize > originalSize) {
    throw new Error(`Compressed range maximumSize must be within 1..${originalSize}.`);
  }
  const hasBankStart = constraints.bankStart !== undefined;
  const hasBankEnd = constraints.bankEnd !== undefined;
  if (hasBankStart !== hasBankEnd) {
    throw new Error("Compressed range bankStart and bankEnd must be supplied together.");
  }
  if (hasBankStart) {
    const bankStart = constraints.bankStart;
    const bankEnd = constraints.bankEnd;
    if (
      typeof bankStart !== "number" ||
      typeof bankEnd !== "number" ||
      !Number.isSafeInteger(bankStart) ||
      !Number.isSafeInteger(bankEnd) ||
      bankStart < 0 ||
      bankEnd <= bankStart
    ) {
      throw new Error("Compressed range has invalid half-open bank bounds.");
    }
    if (sourceOffset < bankStart || sourceOffset + originalSize > bankEnd) {
      throw new Error("Compressed range crosses its declared bank bounds.");
    }
  }
  if (
    constraints.fillByte !== undefined &&
    (!Number.isInteger(constraints.fillByte) ||
      constraints.fillByte < 0 ||
      constraints.fillByte > 0xff)
  ) {
    throw new Error("Compressed range fillByte must be an integer from 0 through 255.");
  }
  return { ...constraints, sourceOffset, originalSize, maximumSize };
};

/** Stable-id compression registry. Game plugins can extend it without core changes. */
export class CompressionCodecRegistry {
  readonly #codecs = new Map<string, CompressionCodec>();

  register(codec: CompressionCodec): this {
    if (!isStableId(codec.id)) {
      throw new Error(`Compression codec id '${codec.id}' is not stable.`);
    }
    if (codec.version.trim() === "") {
      throw new Error(`Compression codec '${codec.id}' has no version.`);
    }
    if (this.#codecs.has(codec.id)) {
      throw new Error(`Duplicate compression codec id '${codec.id}'.`);
    }
    this.#codecs.set(
      codec.id,
      Object.freeze({
        id: codec.id,
        version: codec.version,
        decode: codec.decode.bind(codec),
        encode: codec.encode.bind(codec),
      }),
    );
    return this;
  }

  resolve(id: string): CompressionCodec {
    const codec = this.#codecs.get(id);
    if (!codec) {
      throw new Error(`Unknown compression codec '${id}'.`);
    }
    return codec;
  }

  list(): readonly CompressionCodec[] {
    return [...this.#codecs.values()].sort((left, right) => left.id.localeCompare(right.id));
  }
}

const decodeDeterministically = (
  codec: CompressionCodec,
  encoded: Uint8Array,
  context: CompressionCodecContext,
): Uint8Array => {
  const first = assertBytes(codec.decode(Uint8Array.from(encoded), context), "decode", codec.id);
  const second = assertBytes(codec.decode(Uint8Array.from(encoded), context), "decode", codec.id);
  if (!sameBytes(first, second)) {
    throw new Error(`Compression codec '${codec.id}' decode is not deterministic.`);
  }
  return first;
};

const encodeDeterministically = (
  codec: CompressionCodec,
  decoded: Uint8Array,
  context: CompressionCodecContext,
): Uint8Array => {
  const first = assertBytes(codec.encode(Uint8Array.from(decoded), context), "encode", codec.id);
  const second = assertBytes(codec.encode(Uint8Array.from(decoded), context), "encode", codec.id);
  if (!sameBytes(first, second)) {
    throw new Error(`Compression codec '${codec.id}' encode is not deterministic.`);
  }
  return first;
};

/**
 * Verifies deterministic decode/encode behavior and an exact no-op compressed round trip.
 * A plugin codec cannot enter an editing pipeline until this gate succeeds.
 * @param {CompressionCodecRegistry} registry Composed compression registry.
 * @param {string} codecId Stable compressor id.
 * @param {Uint8Array} encoded Existing compressed stream.
 * @param {CompressionRangeConstraints} constraints Fixed ownership and bank constraints.
 * @param {AssetValue} [options] JSON-safe plugin codec options.
 * @returns {CompressionVerificationRecord} Stable verification fingerprints.
 */
export const verifyCompressionCodec = (
  registry: CompressionCodecRegistry,
  codecId: string,
  encoded: Uint8Array,
  constraints: CompressionRangeConstraints,
  options?: AssetValue,
): CompressionVerificationRecord => {
  if (!(encoded instanceof Uint8Array)) {
    throw new Error("Compressed input must be a Uint8Array.");
  }
  const checked = validateConstraints(constraints, encoded.length);
  const codec = registry.resolve(codecId);
  const context = { options: normalizeOptions(options) };
  const decoded = decodeDeterministically(codec, encoded, context);
  const reencoded = encodeDeterministically(codec, decoded, context);
  if (reencoded.length > checked.maximumSize) {
    throw new Error(
      `Compression codec '${codec.id}' produced ${reencoded.length} bytes, exceeding maximum ${checked.maximumSize}.`,
    );
  }
  const decodedAgain = decodeDeterministically(codec, reencoded, context);
  if (!sameBytes(decoded, decodedAgain)) {
    throw new Error(`Compression codec '${codec.id}' failed decoded-data round-trip verification.`);
  }
  if (!sameBytes(encoded, reencoded)) {
    throw new Error(`Compression codec '${codec.id}' failed byte-identical no-op verification.`);
  }
  return Object.freeze({
    codecId: codec.id,
    codecVersion: codec.version,
    sourceOffset: checked.sourceOffset,
    encodedSize: encoded.length,
    decodedSize: decoded.length,
    encodedSha256: sha256(encoded),
    decodedSha256: sha256(decoded),
  });
};

/**
 * Recompresss edited data into an exact-size replacement, rejecting capacity,
 * bank, nondeterminism, and semantic round-trip failures before returning bytes.
 * @param {CompressionCodecRegistry} registry Composed compression registry.
 * @param {string} codecId Stable compressor id.
 * @param {Uint8Array} decoded Edited uncompressed bytes.
 * @param {Uint8Array} existing Existing fixed-size compressed range.
 * @param {CompressionRangeConstraints} constraints Fixed ownership and bank constraints.
 * @param {AssetValue} [options] JSON-safe plugin codec options.
 * @returns {CompressionReencodeResult} Meaningful stream and exact-size replacement.
 */
export const reencodeCompressedRange = (
  registry: CompressionCodecRegistry,
  codecId: string,
  decoded: Uint8Array,
  existing: Uint8Array,
  constraints: CompressionRangeConstraints,
  options?: AssetValue,
): CompressionReencodeResult => {
  if (!(decoded instanceof Uint8Array) || !(existing instanceof Uint8Array)) {
    throw new Error("Compression re-encoding requires Uint8Array decoded and existing data.");
  }
  const checked = validateConstraints(constraints, existing.length);
  const codec = registry.resolve(codecId);
  const context = { options: normalizeOptions(options) };
  const encoded = encodeDeterministically(codec, decoded, context);
  if (encoded.length > checked.maximumSize) {
    throw new Error(
      `Compression codec '${codec.id}' produced ${encoded.length} bytes, exceeding maximum ${checked.maximumSize}.`,
    );
  }
  const roundTripped = decodeDeterministically(codec, encoded, context);
  if (!sameBytes(decoded, roundTripped)) {
    throw new Error(`Compression codec '${codec.id}' failed decoded-data round-trip verification.`);
  }
  const replacement = Uint8Array.from(existing);
  if (checked.fillByte !== undefined) {
    replacement.fill(checked.fillByte);
  }
  replacement.set(encoded);
  return Object.freeze({
    encoded: Uint8Array.from(encoded),
    replacement,
    unusedSize: checked.originalSize - encoded.length,
  });
};
