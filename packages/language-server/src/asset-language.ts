/** Lightweight asset-call parsing for editor requests; conversion belongs to explicit previews/builds. */
import { parseAssetCall, type ParsedAssetCall } from "@uttori/asm-core";

/** Strip an assembly comment without cutting semicolons inside quoted paths.
 * @param {string} line Source line.
 * @returns {string} Statement text without its comment.
 */
export function assetStatementLine(line: string): string {
  let quote: string | undefined;
  let escaped = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (escaped) {
      escaped = false;
    } else if (character === "\\" && quote) {
      escaped = true;
    } else if (character === quote) {
      quote = undefined;
    } else if ((character === '"' || character === "'") && !quote) {
      quote = character;
    } else if (character === ";" && !quote) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line.trimEnd();
}

/** Parse a complete one-line asset statement for hover, navigation and preview requests.
 * @param {string} line Source line.
 * @param {number} lineNumber Zero-based source line.
 * @returns {ParsedAssetCall | undefined} Parsed call, or undefined while incomplete.
 */
export function assetCallOnLine(line: string, lineNumber: number): ParsedAssetCall | undefined {
  try {
    return parseAssetCall(assetStatementLine(line), lineNumber);
  } catch {
    // Incomplete editor text still gets syntax diagnostics from the assembler.
    return undefined;
  }
}

/** Read a line from a protocol position without treating a binary dependency as source text.
 * @param {string} text Open document text.
 * @param {number} lineNumber Zero-based source line.
 * @returns {string | undefined} Selected line when in bounds.
 */
export function assetLineAt(text: string, lineNumber: number): string | undefined {
  if (!Number.isSafeInteger(lineNumber) || lineNumber < 0) {
    return undefined;
  }
  return text.split(/\r?\n/)[lineNumber];
}
