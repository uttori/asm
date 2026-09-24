import { integer } from "./validation.js";

/** Single-byte translation table; unmapped bytes use literal `\\xHH` escapes. */
export interface SingleByteTextOptions {
  readonly ascii?: boolean;
  readonly table?: Readonly<Record<string, string>>;
  readonly terminator?: number;
}

/** Termination is distinct from the visible text to preserve its native byte. */
export interface SingleByteText {
  readonly text: string;
  readonly terminated: boolean;
}

const parseByteKey = (key: string): number => {
  let value: number;
  if (/^\$[\da-f]+$/i.test(key)) {
    value = Number.parseInt(key.slice(1), 16);
  } else if (/^0x[\da-f]+$/i.test(key)) {
    value = Number.parseInt(key.slice(2), 16);
  } else if (/^\d+$/.test(key)) {
    value = Number.parseInt(key, 10);
  } else {
    throw new Error(`Invalid text table byte '${key}'.`);
  }
  return integer(value, `Text table byte '${key}'`, 0, 255);
};

const translation = (
  options: SingleByteTextOptions,
): { byteToToken: Map<number, string>; tokenToByte: readonly (readonly [string, number])[] } => {
  const byteToToken = new Map<number, string>();
  if (options.ascii !== false) {
    byteToToken.set(9, "\t");
    byteToToken.set(10, "\n");
    byteToToken.set(13, "\r");
    for (let byte = 32; byte <= 126; byte++) {
      if (byte !== 92) {
        byteToToken.set(byte, String.fromCharCode(byte));
      }
    }
  }
  for (const [key, token] of Object.entries(options.table ?? {})) {
    if (token.length === 0 || token.includes("\\")) {
      throw new Error(`Invalid text token for '${key}'.`);
    }
    byteToToken.set(parseByteKey(key), token);
  }
  const tokenToByte = [...byteToToken].map(([byte, token]) => [token, byte] as const);
  for (let left = 0; left < tokenToByte.length; left++) {
    for (let right = left + 1; right < tokenToByte.length; right++) {
      const a = tokenToByte[left][0];
      const b = tokenToByte[right][0];
      if (a.startsWith(b) || b.startsWith(a)) {
        throw new Error(`Text tokens '${a}' and '${b}' are not prefix-free.`);
      }
    }
  }
  return {
    byteToToken,
    tokenToByte: tokenToByte.sort(([a], [b]) => b.length - a.length || a.localeCompare(b)),
  };
};

/** Decode native single-byte text without replacing unknown values.
 * @param {Uint8Array} bytes Borrowed source bytes.
 * @param {SingleByteTextOptions} options Translation table and optional terminator.
 * @returns {SingleByteText} Visible text plus whether the final byte was a terminator.
 */
export function decodeSingleByteText(
  bytes: Uint8Array,
  options: SingleByteTextOptions = {},
): SingleByteText {
  const { byteToToken } = translation(options);
  const terminator =
    options.terminator === undefined
      ? undefined
      : integer(options.terminator, "Text terminator", 0, 255);
  const terminated = bytes.length > 0 && terminator !== undefined && bytes.at(-1) === terminator;
  const content = terminated ? bytes.subarray(0, -1) : bytes;
  const text = [...content]
    .map(
      (byte) => byteToToken.get(byte) ?? `\\x${byte.toString(16).padStart(2, "0").toUpperCase()}`,
    )
    .join("");
  return { text, terminated };
}

/** Encode translated text, including explicit escapes and optional terminator.
 * @param {SingleByteText} value Visible text and termination state.
 * @param {SingleByteTextOptions} options Translation table and optional terminator.
 * @returns {Uint8Array} Owned native bytes.
 */
export function encodeSingleByteText(
  value: SingleByteText,
  options: SingleByteTextOptions = {},
): Uint8Array {
  const { tokenToByte } = translation(options);
  const bytes: number[] = [];
  for (let offset = 0; offset < value.text.length;) {
    if (value.text[offset] === "\\") {
      const escape = value.text.slice(offset + 1, offset + 4);
      if (!/^x[\da-f]{2}$/i.test(escape)) {
        throw new Error(`Invalid text escape at character ${offset}.`);
      }
      bytes.push(Number.parseInt(escape.slice(1), 16));
      offset += 4;
      continue;
    }
    const match = tokenToByte.find(([token]) => value.text.startsWith(token, offset));
    if (!match) {
      throw new Error(`Cannot encode text at character ${offset}.`);
    }
    bytes.push(match[1]);
    offset += match[0].length;
  }
  if (value.terminated) {
    if (options.terminator === undefined) {
      throw new Error("Terminated text requires a configured terminator.");
    }
    bytes.push(integer(options.terminator, "Text terminator", 0, 255));
  }
  return Uint8Array.from(bytes);
}
