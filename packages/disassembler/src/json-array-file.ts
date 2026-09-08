import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { StringDecoder } from "node:string_decoder";

/**
 * Reads an object-record JSON array without retaining the complete shard text beside its objects.
 * Syntax and the exact byte hash are checked before any records are returned to the caller.
 * @param {string} file Shard path.
 * @param {string} expectedSha256 Expected hash of persisted bytes.
 * @returns {unknown[]} Parsed object records.
 */
export const readObjectArrayFile = (file: string, expectedSha256: string): unknown[] => {
  const descriptor = fs.openSync(file, "r");
  const buffer = Buffer.allocUnsafe(64 * 1024);
  const decoder = new StringDecoder("utf8");
  const hash = createHash("sha256");
  const records: unknown[] = [];
  let mode: "start" | "value" | "record" | "comma" | "end" = "start";
  let allowEnd = true;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let parts: string[] = [];
  let recordLength = 0;
  const fail = (): never => {
    throw new Error(`Analysis shard '${file}' is not a valid JSON object-record array.`);
  };
  const consume = (text: string): void => {
    let recordStart = mode === "record" ? 0 : -1;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (mode === "record") {
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
        } else if (char === '"') inString = true;
        else if (char === "{" || char === "[") depth++;
        else if (char === "}" || char === "]") {
          depth--;
          if (depth === 0) {
            const tail = text.slice(recordStart, index + 1);
            recordLength += tail.length;
            if (recordLength > 32 * 1024 * 1024)
              throw new Error("Analysis shard record exceeds the 32 MiB limit.");
            parts.push(tail);
            records.push(JSON.parse(parts.join("")));
            parts = [];
            recordLength = 0;
            recordStart = -1;
            mode = "comma";
          }
        }
        continue;
      }
      if (char === " " || char === "\n" || char === "\r" || char === "\t") continue;
      if (mode === "start" && char === "[") {
        mode = "value";
        continue;
      }
      if (mode === "value") {
        if (char === "]" && allowEnd) {
          mode = "end";
          continue;
        }
        if (char !== "{") fail();
        mode = "record";
        recordStart = index;
        depth = 1;
        continue;
      }
      if (mode === "comma" && char === ",") {
        mode = "value";
        allowEnd = false;
        continue;
      }
      if (mode === "comma" && char === "]") {
        mode = "end";
        continue;
      }
      fail();
    }
    if (recordStart >= 0) {
      const tail = text.slice(recordStart);
      parts.push(tail);
      recordLength += tail.length;
      if (recordLength > 32 * 1024 * 1024)
        throw new Error("Analysis shard record exceeds the 32 MiB limit.");
    }
  };
  try {
    let count: number;
    while ((count = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      const bytes = buffer.subarray(0, count);
      hash.update(bytes);
      consume(decoder.write(bytes));
    }
    consume(decoder.end());
    if (String(mode) !== "end") fail();
    if (hash.digest("hex") !== expectedSha256)
      throw new Error(`Analysis shard '${file}' does not match its SHA-256.`);
    return records;
  } finally {
    fs.closeSync(descriptor);
  }
};
