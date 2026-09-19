import type { AssetCodec, AssetValue } from "../asset-codec.js";
import {
  booleanOption,
  decodedObject,
  defaultAssetPath,
  integerOption,
  objectValue,
  optionsFor,
  readAssetBytes,
  stringOption,
} from "./common.js";

/** Stable id of the built-in reversible single-byte text codec. */
export const TEXT_ASSET_CODEC_ID = "uttori.asset.text";

interface TextSettings {
  readonly options: ReturnType<typeof optionsFor>;
  readonly byteToToken: ReadonlyMap<number, string>;
  readonly tokenToByte: readonly (readonly [string, number])[];
  readonly terminator?: number;
}

const parseByteKey = (key: string): number => {
  const normalized = key.startsWith("$") ? `0x${key.slice(1)}` : key;
  let value = Number.NaN;
  if (/^0x[\da-f]+$/i.test(normalized)) {
    value = Number.parseInt(normalized.slice(2), 16);
  } else if (/^\d+$/.test(normalized)) {
    value = Number.parseInt(normalized, 10);
  }
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`Text table byte '${key}' must be in the range 0..255.`);
  }
  return value;
};

const settings = (context: Parameters<AssetCodec["inspect"]>[0]): TextSettings => {
  const options = optionsFor(context);
  const byteToToken = new Map<number, string>();
  if (booleanOption(options, "ascii", true)) {
    byteToToken.set(0x09, "\t");
    byteToToken.set(0x0a, "\n");
    byteToToken.set(0x0d, "\r");
    for (let byte = 0x20; byte <= 0x7e; byte++) {
      if (byte !== 0x5c) {
        byteToToken.set(byte, String.fromCharCode(byte));
      }
    }
  }
  const table = objectValue(options.table, "Text asset option 'table'");
  for (const [key, tokenValue] of Object.entries(table)) {
    if (typeof tokenValue !== "string" || tokenValue.length === 0 || tokenValue.includes("\\")) {
      throw new Error(`Text table entry '${key}' must be a non-empty string without backslashes.`);
    }
    byteToToken.set(parseByteKey(key), tokenValue);
  }
  const tokenToByte = [...byteToToken.entries()].map(([byte, token]) => [token, byte] as const);
  const tokens = new Set<string>();
  for (const [token] of tokenToByte) {
    if (tokens.has(token)) {
      throw new Error(`Text table token '${token}' is duplicated.`);
    }
    tokens.add(token);
  }
  for (const [left] of tokenToByte) {
    const ambiguous = tokenToByte.find(
      ([right]) => left !== right && (left.startsWith(right) || right.startsWith(left)),
    );
    if (ambiguous) {
      throw new Error(`Text table tokens '${left}' and '${ambiguous[0]}' are not prefix-free.`);
    }
  }
  tokenToByte.sort(([left], [right]) => right.length - left.length || left.localeCompare(right));
  const terminator = integerOption(options, "terminator", { minimum: 0, maximum: 0xff });
  return { options, byteToToken, tokenToByte, terminator };
};

const inspectedSize = (
  context: Parameters<AssetCodec["inspect"]>[0],
  resolved: TextSettings,
): number => {
  if (context.request.length !== undefined) {
    return context.request.length;
  }
  if (resolved.terminator === undefined) {
    throw new Error(`Text asset '${context.request.id}' requires a length or terminator.`);
  }
  const maxLength = integerOption(resolved.options, "maxLength", { minimum: 1 });
  if (maxLength === undefined) {
    throw new Error(
      `Text asset '${context.request.id}' requires 'maxLength' for terminator search.`,
    );
  }
  for (let size = 1; size <= maxLength; size++) {
    const bytes = context.source.read(context.request.sourceOffset + size - 1, 1);
    if (!bytes) {
      break;
    }
    if (bytes[0] === resolved.terminator) {
      return size;
    }
  }
  throw new Error(
    `Text asset '${context.request.id}' has no terminator within ${maxLength} bytes.`,
  );
};

const textValue = (bytes: Uint8Array, resolved: TextSettings): string =>
  [...bytes]
    .map(
      (byte) =>
        resolved.byteToToken.get(byte) ?? `\\x${byte.toString(16).padStart(2, "0").toUpperCase()}`,
    )
    .join("");

const encodeText = (text: string, resolved: TextSettings, owner: string): Uint8Array => {
  const bytes: number[] = [];
  for (let offset = 0; offset < text.length;) {
    if (text[offset] === "\\" && /^\\x[\da-f]{2}/i.test(text.slice(offset, offset + 4))) {
      bytes.push(Number.parseInt(text.slice(offset + 2, offset + 4), 16));
      offset += 4;
      continue;
    }
    const match = resolved.tokenToByte.find(([token]) => text.startsWith(token, offset));
    if (!match) {
      throw new Error(`Text asset '${owner}' cannot encode text at character ${offset}.`);
    }
    bytes.push(match[1]);
    offset += match[0].length;
  }
  return Uint8Array.from(bytes);
};

/** Reversible single-byte text with translation tokens, escapes, and bounded terminators. */
export const textAssetCodec: AssetCodec = Object.freeze({
  id: TEXT_ASSET_CODEC_ID,
  version: "1.0.0",
  sizeBounds: { minimum: 1 },
  inspect: (context) => {
    const resolved = settings(context);
    const size = inspectedSize(context, resolved);
    return {
      size,
      metadata: {
        encoding: "single-byte-translation-table",
        terminated: resolved.terminator !== undefined,
        ...(resolved.terminator === undefined ? {} : { terminator: resolved.terminator }),
      },
    };
  },
  decode: (context) => {
    const resolved = settings(context);
    const bytes = readAssetBytes(context, context.inspection.size);
    const terminated = resolved.terminator !== undefined && bytes.at(-1) === resolved.terminator;
    const payload = terminated ? bytes.subarray(0, -1) : bytes;
    const value: AssetValue = { kind: "text", text: textValue(payload, resolved), terminated };
    const path = stringOption(
      resolved.options,
      "path",
      defaultAssetPath(context.request.id, "txt"),
    )!;
    return {
      value,
      files: [
        {
          path,
          mediaType: "text/plain; charset=utf-8",
          bytes: new TextEncoder().encode(value.text as string),
        },
      ],
    };
  },
  encode: (context) => {
    const resolved = settings(context);
    const value = decodedObject(context.decoded.value, context.request.id);
    const text = value.text;
    const terminated = value.terminated;
    if (typeof text !== "string" || typeof terminated !== "boolean") {
      throw new Error(
        `Text asset '${context.request.id}' requires string text and terminated flag.`,
      );
    }
    const payload = encodeText(text, resolved, context.request.id);
    if (!terminated) {
      return payload;
    }
    if (resolved.terminator === undefined) {
      throw new Error(
        `Text asset '${context.request.id}' cannot append an unconfigured terminator.`,
      );
    }
    const bytes = new Uint8Array(payload.length + 1);
    bytes.set(payload);
    bytes[bytes.length - 1] = resolved.terminator;
    return bytes;
  },
} satisfies AssetCodec);
