/**
 * Converts core analysis snapshots and current source text into LSP response payloads.
 * File arguments are filesystem paths; protocol positions/ranges use zero-based UTF-16 columns.
 * Providers repair normalized analysis spans against raw editor text without rebuilding the index.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import type {
  AssemblySymbolDefinition,
  AssemblySymbolReference,
  SourceRange,
  ParsedAssetCall,
  AssetValueNode,
} from "@uttori/asm-core";
import type { WorkspaceIndex } from "@uttori/asm-core/tooling";
import { type DocumentUri, Position, Range } from "vscode-languageserver";

import { assetCallOnLine, assetLineAt } from "../asset-language.js";
import { locationRange, referenceAt, symbolAt, positionInRange } from "../core.js";

/** Characters that can appear inside an assembly identifier or define name. */
export const IDENTIFIER_CHAR = /[\w!]/;

/**
 * Converts an absolute file path to a file URI string.
 * @param filePath The absolute path.
 * @returns The file URI.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#uri
 */
export function pathToUri(filePath: string): DocumentUri {
  return pathToFileURL(filePath).toString();
}

/**
 * Converts a file URI string to an absolute file path.
 * @param uri The file URI.
 * @returns The absolute path.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#uri
 */
export function uriToPath(uri: DocumentUri): string {
  return fileURLToPath(uri);
}

/**
 * Find the typed asset call on a protocol line without opening its binary input.
 * @param text Open document text.
 * @param position Cursor position.
 * @returns Complete call when parseable.
 */
export function assetCallAt(text: string, position: Position): ParsedAssetCall | undefined {
  const line = assetLineAt(text, position.line);
  if (!line) {
    return undefined;
  }
  return assetCallOnLine(line, position.line);
}

/**
 * An argument span includes its closing quote for cursor navigation.
 * @param node Parsed asset value.
 * @param character Zero-based cursor column.
 * @returns Whether the cursor is on the value.
 */
export function assetSpanContains(node: AssetValueNode, character: number): boolean {
  return character >= node.span.start && character <= node.span.end;
}

/**
 * Find a primary or declared resource path under the cursor.
 * @param call Parsed statement.
 * @param character Zero-based cursor column.
 * @returns User-spelled path when selected.
 */
/** Option names that the statement did not write are absent. */
export function assetOption(
  options: Readonly<Record<string, AssetValueNode>>,
  key: string,
): AssetValueNode | undefined {
  return Object.hasOwn(options, key) ? options[key] : undefined;
}

/**
 * Converts a core source range to an LSP range.
 * @param range The core range.
 * @returns The LSP range.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#range
 */
export function toRange(range: SourceRange): Range {
  return Range.create(range.start.line, range.start.character, range.end.line, range.end.character);
}

/**
 * Returns a fallback range for an artifact lacking precise geometry.
 * @param line The zero-based line number.
 * @returns An empty range at the line start, using line zero for invalid line numbers.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#range
 */
export function lineFallbackRange(line: number): Range {
  const safeLine = Number.isFinite(line) && line >= 0 ? line : 0;
  return Range.create(safeLine, 0, safeLine, 0);
}

/** Exact text keys prevent stale ranges after edits; the small LRU avoids retaining every bank/version. */
export const lineCache = new Map<string, readonly string[]>();

let cachedCharacters = 0;

/** Reuse line splits across thousands of token ranges in one document; CRLF and LF retain their existing semantics. */
export function splitLines(text: string): readonly string[] {
  const cached = lineCache.get(text);
  if (cached) {
    lineCache.delete(text);
    lineCache.set(text, cached);
    return cached;
  }
  const lines = text.split(/\r?\n/);
  if (text.length <= 2 * 1024 * 1024) {
    while (lineCache.size >= 8 || cachedCharacters + text.length > 4 * 1024 * 1024) {
      const oldest = lineCache.keys().next().value!;
      cachedCharacters -= oldest.length;
      lineCache.delete(oldest);
    }
    lineCache.set(text, lines);
    cachedCharacters += text.length;
  }
  return lines;
}

/** Lines outside the split document are absent. */
export function lineAt(lines: readonly string[], line: number): string | undefined {
  return line >= 0 && line < lines.length ? lines[line] : undefined;
}

/**
 * Recomputes a token's range in the raw document so it does not inherit the
 * column offset introduced by command normalization (which strips leading
 * whitespace and comments).
 * @param index The workspace index.
 * @param file The absolute file path containing the token.
 * @param line The zero-based line number.
 * @param name The token text to locate.
 * @param fallback The range to use when the token cannot be located.
 * @returns A new raw range on a match; otherwise the original fallback object by identity.
 */
export function preciseRange(
  index: WorkspaceIndex,
  file: string,
  line: number,
  name: string,
  fallback: Range,
): Range {
  const text = index.getFileText(file);
  if (!text) {
    return fallback;
  }
  const rawLine = lineAt(splitLines(text), line);
  if (rawLine === undefined) {
    return fallback;
  }
  // A physical assembler span disambiguates repeated tokens on the same line.
  // Verify its text before trusting it because older references have coarse spans.
  const candidate = rawLine.slice(fallback.start.character, fallback.end.character);
  if (fallback.start.line === line && candidate === name) {
    return fallback;
  }
  if (fallback.start.line === line && candidate === `!${name}`) {
    return Range.create(line, fallback.start.character + 1, line, fallback.end.character);
  }
  const direct = rangeForTokenOnLine(rawLine, name, line, fallback);
  if (direct !== fallback) {
    return direct;
  }
  const lookup = lookupNameFor(name);
  if (lookup !== name) {
    const dotted = rangeForTokenOnLine(rawLine, `.${lookup}`, line, fallback);
    if (dotted !== fallback) {
      return dotted;
    }
  }
  const suffixColumn = findCompoundSuffixColumn(rawLine, lookup);
  if (suffixColumn >= 0) {
    return Range.create(line, suffixColumn, line, suffixColumn + lookup.length);
  }
  return fallback;
}

/**
 * Like {@link preciseRange}, but prefers a define-sigil match (`!name`) so
 * hover, find-references, and semantic tokens highlight the full `!version`
 * token. Falls back to the bare name when the sigil is absent.
 * @param index The workspace index.
 * @param file The absolute file path containing the token.
 * @param line The zero-based line number.
 * @param name The token text to locate.
 * @param fallback The range to use when the token cannot be located.
 * @returns The precise range.
 */
export function preciseRangeWithSigil(
  index: WorkspaceIndex,
  file: string,
  line: number,
  name: string,
  fallback: Range,
): Range {
  const text = index.getFileText(file);
  if (!text) {
    return fallback;
  }
  const rawLine = lineAt(splitLines(text), line);
  if (rawLine === undefined) {
    return fallback;
  }
  const sigilName = name.startsWith("!") ? name : `!${name}`;
  const sigilRange = rangeForTokenOnLine(rawLine, sigilName, line, fallback);
  if (sigilRange !== fallback) {
    return sigilRange;
  }
  return preciseRange(index, file, line, name, fallback);
}

/**
 * Strips a leading define sigil so `!version` lookups match stored `version`,
 * and leading dots so `.timer` matches stored `timer`.
 * @param word The word to lookup.
 * @returns The word without the sigil or leading dots.
 */
export function lookupNameFor(word: string): string {
  const withoutSigil = word.startsWith("!") ? word.slice(1) : word;
  return withoutSigil.replace(/^\.+/, "");
}

/**
 * Returns whether a stored symbol/reference name matches a cursor word,
 * accepting both `version` and `!version` for define tokens.
 * @param stored The stored symbol/reference name.
 * @param word The cursor word.
 * @returns Whether the names match.
 */
export function namesMatch(stored: string, word: string): boolean {
  return lookupNameFor(stored) === lookupNameFor(word) || stored === word;
}

/**
 * Locates `name` on a source line and extends the end column through a suffix
 * left by an in-flight rename, such as `unk1E` becoming `unk1E__WE`.
 * A single underscore ends the extension to preserve compound-label segments;
 * a suffix starting with a double underscore is kept as part of the token.
 * @param rawLine The raw source line.
 * @param name The stored token text to locate.
 * @param line The zero-based line number.
 * @param fallback The range to use when the token cannot be located.
 * @returns A new range extended through identifier characters, or the original fallback object.
 */
export function rangeForTokenOnLine(
  rawLine: string,
  name: string,
  line: number,
  fallback: Range,
): Range {
  const column = findTokenColumn(rawLine, name);
  if (column < 0) {
    return fallback;
  }
  let endColumn = column + name.length;
  const rest = rawLine.slice(endColumn);
  if (rest.startsWith("__")) {
    while (endColumn < rawLine.length && IDENTIFIER_CHAR.test(rawLine[endColumn] ?? "")) {
      endColumn += 1;
    }
  } else {
    while (
      endColumn < rawLine.length &&
      IDENTIFIER_CHAR.test(rawLine[endColumn] ?? "") &&
      rawLine[endColumn] !== "_"
    ) {
      endColumn += 1;
    }
  }
  return Range.create(line, column, line, endColumn);
}

/**
 * Finds the column of a token on a line, preferring whole-token matches that
 * are not inside a line comment.
 * @param lineText The raw line text.
 * @param name The token to locate.
 * @returns Whole-token column, otherwise the first non-comment substring match, or -1.
 */
export function findTokenColumn(lineText: string, name: string): number {
  if (!name) {
    return -1;
  }
  const commentIndex = lineText.indexOf(";");
  let from = 0;
  let looseMatch = -1;
  for (;;) {
    const index = lineText.indexOf(name, from);
    if (index < 0) {
      break;
    }
    const inComment = commentIndex >= 0 && index > commentIndex;
    if (!inComment) {
      if (looseMatch < 0) {
        looseMatch = index;
      }
      const before = index > 0 ? lineText[index - 1] : "";
      const after = index + name.length < lineText.length ? lineText[index + name.length] : "";
      if (!IDENTIFIER_CHAR.test(before) && !IDENTIFIER_CHAR.test(after)) {
        return index;
      }
    }
    from = index + 1;
  }
  return looseMatch;
}

/**
 * Finds a compound-label suffix (`8053` in `_018049_8053`) so dotted
 * references can highlight the undotted use-site segment.
 * @param lineText The raw line text.
 * @param segment The suffix without a leading dot or underscore.
 * @returns The zero-based column of the suffix, or -1.
 */
export function findCompoundSuffixColumn(lineText: string, segment: string): number {
  if (!segment) {
    return -1;
  }
  const needle = `_${segment}`;
  const commentIndex = lineText.indexOf(";");
  let from = 0;
  for (;;) {
    const index = lineText.indexOf(needle, from);
    if (index < 0) {
      break;
    }
    const inComment = commentIndex >= 0 && index > commentIndex;
    const after = index + needle.length < lineText.length ? lineText[index + needle.length] : "";
    if (!inComment && (after === "" || after === "_" || !IDENTIFIER_CHAR.test(after))) {
      return index + 1;
    }
    from = index + 1;
  }
  return -1;
}

/**
 * Extracts a quoted string, unquoted include path, or identifier-like word at a position.
 * Token ends are accepted so a cursor immediately after a token can still resolve it.
 * @param text The document text.
 * @param position The cursor position.
 * @returns The word, or undefined when none is present.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#position
 */
export function wordAt(text: string, position: Position): string | undefined {
  const line = lineAt(splitLines(text), position.line);
  if (line === undefined) {
    return undefined;
  }
  const quoted = quotedStringAt(line, position.character);
  if (quoted !== undefined) {
    return quoted;
  }
  const unquotedPath = unquotedIncludePathAt(line, position.character);
  if (unquotedPath !== undefined) {
    return unquotedPath;
  }
  // oxlint-disable-next-line security/detect-unsafe-regex
  const wordPattern = /!?\.?\w+(?:-\w+)*/g;
  let match: RegExpExecArray | null;
  while ((match = wordPattern.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (position.character >= start && position.character <= end) {
      return match[0];
    }
  }
  return undefined;
}

/**
 * Returns the unquoted path argument of an include-like directive when the
 * cursor falls within it. This handles filenames containing hyphens and other
 * characters that the standard word-boundary pattern would break on.
 * @param line The line text.
 * @param character The 0-based column.
 * @returns The full path token, or undefined.
 */
export function unquotedIncludePathAt(line: string, character: number): string | undefined {
  const match = /^\s*(?:incsrc|incbin|include)\s+(\S+)/i.exec(line);
  if (!match || /^["'`]/.test(match[1])) {
    return undefined;
  }
  const argStart = match[0].length - match[1].length;
  if (character >= argStart && character <= argStart + match[1].length) {
    return match[1];
  }
  return undefined;
}

/**
 * Returns the contents of a quoted string if the cursor is inside it.
 * @param line The line text.
 * @param character The 0-based column.
 * @returns The unquoted string, or undefined.
 */
export function quotedStringAt(line: string, character: number): string | undefined {
  for (const quote of ['"', "'", "`"]) {
    let from = 0;
    while (from < line.length) {
      const start = line.indexOf(quote, from);
      if (start < 0) {
        break;
      }
      const end = line.indexOf(quote, start + 1);
      if (end < 0) {
        break;
      }
      if (character > start && character <= end) {
        return line.slice(start + 1, end);
      }
      from = end + 1;
    }
  }
  return undefined;
}

/**
 * Returns the identifier word under the cursor using the file's current text.
 * @param index The workspace index.
 * @param file The absolute file path.
 * @param position The cursor position.
 * @returns The word, or undefined.
 */
export function cursorWord(
  index: WorkspaceIndex,
  file: string,
  position: Position,
): string | undefined {
  const text = index.getFileText(file);
  if (!text) {
    return undefined;
  }
  const word = wordAt(text, position);
  return hierarchicalSegmentAt(index, file, position, word) ?? word;
}

/**
 * Splits a compound identifier on `_`, keeping a leading `.` / `_` on the first
 * part. `.idx_beginner` → `[".idx", "beginner"]`. `_018049_8053` → `["_018049", "8053"]`.
 * @param word The identifier text.
 * @returns The source segments.
 */
export function splitHierarchicalSource(word: string): string[] {
  const prefixMatch = /^[._]+/.exec(word);
  const prefix = prefixMatch?.[0] ?? "";
  const rest = word.slice(prefix.length);
  if (!rest.includes("_")) {
    return [word];
  }
  const parts = rest.split("_").filter(Boolean);
  if (parts.length === 0) {
    return [word];
  }
  parts[0] = `${prefix}${parts[0]}`;
  return parts;
}

/**
 * Finds symbols that could be the leaf of a compound identifier. Dotted locals
 * like `.idx_beginner` are stored as `Parent_idx_beginner`, not under the source
 * spelling, so we also accept an FQ name that ends with `_${lookup}`.
 * @param symbols Every known symbol.
 * @param word The compound identifier.
 * @param file The file containing the cursor.
 * @returns Candidate leaves ranked by same-file preference and name length.
 */
export function compoundLeafCandidates(
  symbols: AssemblySymbolDefinition[],
  word: string,
  file: string,
): AssemblySymbolDefinition[] {
  const lookup = lookupNameFor(word);
  const exact = symbols.filter((symbol) => symbol.name === word || symbol.name === lookup);
  const suffix = lookup ? `_${lookup}` : "";
  const bySuffix = suffix
    ? symbols.filter(
        (symbol) => symbol.name.endsWith(suffix) && !exact.some((entry) => entry === symbol),
      )
    : [];
  /**
   * Biases matching locals toward the cursor's file, then toward more specific qualified names.
   * @param symbol Candidate compound-label leaf.
   * @returns Descending sort score; same-file candidates receive a large fixed bonus.
   */
  const rank = (symbol: AssemblySymbolDefinition): number => {
    const inFile = symbol.location.file === file ? 1 : 0;
    return inFile * 1_000_000 + symbol.name.length;
  };
  return [...exact, ...bySuffix].toSorted((left, right) => rank(right) - rank(left));
}

/**
 * Walks `containerName` from a leaf toward the root, stopping at a missing parent or repeated name.
 * @param symbols Every known symbol.
 * @param leaf The leaf symbol.
 * @returns Names from root to leaf.
 */
export function hierarchyChainForSymbol(
  symbols: AssemblySymbolDefinition[],
  leaf: AssemblySymbolDefinition,
): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = leaf.name;
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.unshift(current);
    current = symbols.find((symbol) => symbol.name === current)?.containerName;
  }
  return chain;
}

/**
 * Returns whether `parts` match the tail of an FQ hierarchy. This rejects
 * underscore-in-name labels such as `.difficulty_offset` that are not nested
 * `..offset` children of `.difficulty`.
 * @param chain Root-to-leaf FQ names.
 * @param parts Source segments from {@link splitHierarchicalSource}.
 * @param chainOffset Index in `chain` aligned with `parts[0]`.
 * @returns Whether each source part is a real hierarchy step.
 */
export function hierarchyAligns(chain: string[], parts: string[], chainOffset: number): boolean {
  if (chainOffset < 0 || chainOffset + parts.length > chain.length) {
    return false;
  }
  for (let index = 0; index < parts.length; index++) {
    const chainIndex = chainOffset + index;
    const full = chain[chainIndex];
    const parent = chainIndex > 0 ? chain[chainIndex - 1] : undefined;
    const lookup = lookupNameFor(parts[index]);
    if (!parent) {
      if (full !== parts[index] && lookupNameFor(full) !== lookup && !full.endsWith(`_${lookup}`)) {
        return false;
      }
      continue;
    }
    if (!full.startsWith(`${parent}_`)) {
      return false;
    }
    const suffix = full.slice(parent.length + 1);
    if (suffix !== lookup && suffix !== parts[index]) {
      return false;
    }
  }
  return true;
}

/**
 * Resolves a compound identifier to its source parts and aligned FQ chain, or
 * undefined when the underscores are just part of a single label name.
 * @param index The workspace index.
 * @param file The file containing the identifier.
 * @param word The identifier text.
 * @returns The alignment, if this is a real hierarchy.
 */
export function alignedHierarchy(
  index: WorkspaceIndex,
  file: string,
  word: string | undefined,
):
  | {
      /** Source-spelled segments, retaining the leading dot/underscore on the first segment. */
      parts: string[];
      /** Fully qualified symbol names ordered from root to leaf. */
      chain: string[];
      /** Index in chain corresponding to parts[0], skipping parents omitted by local spelling. */
      chainOffset: number;
    }
  | undefined {
  if (!word || !word.includes("_")) {
    return undefined;
  }
  const parts = splitHierarchicalSource(word);
  if (parts.length < 2) {
    return undefined;
  }
  const symbols = index.getAllSymbols();
  for (const leaf of compoundLeafCandidates(symbols, word, file)) {
    const chain = hierarchyChainForSymbol(symbols, leaf);
    const chainOffset = chain.length - parts.length;
    if (hierarchyAligns(chain, parts, chainOffset)) {
      return { parts, chain, chainOffset };
    }
  }
  return undefined;
}

/**
 * When the cursor is inside a compound label (`_018049_8053` or `.idx_beginner`),
 * returns the parent or `.sublabel` segment under the cursor.
 * @param index The workspace index.
 * @param file The absolute file path.
 * @param position The cursor position.
 * @param word The full identifier under the cursor.
 * @returns The segment, or undefined when not compound.
 */
export function hierarchicalSegmentAt(
  index: WorkspaceIndex,
  file: string,
  position: Position,
  word: string | undefined,
): string | undefined {
  const aligned = alignedHierarchy(index, file, word);
  if (!aligned || !word) {
    return undefined;
  }
  const text = index.getFileText(file);
  if (!text) {
    return undefined;
  }
  const line = lineAt(splitLines(text), position.line);
  if (line === undefined) {
    return undefined;
  }
  const start = findTokenColumn(line, word);
  if (start < 0) {
    return undefined;
  }
  const relative = position.character - start;
  let consumed = 0;
  for (let partIndex = 0; partIndex < aligned.parts.length; partIndex++) {
    const partEnd = consumed + aligned.parts[partIndex].length;
    if (relative < partEnd || partIndex === aligned.parts.length - 1) {
      const chainIndex = aligned.chainOffset + partIndex;
      const full = aligned.chain[chainIndex];
      const parent = chainIndex > 0 ? aligned.chain[chainIndex - 1] : undefined;
      if (!parent) {
        return full;
      }
      return `.${full.slice(parent.length + 1)}`;
    }
    consumed = partEnd + 1;
  }
  return undefined;
}

/**
 * Resolves the reference under the cursor, preferring exact range containment
 * and falling back to a line-and-name match (normalized spans can be column
 * shifted relative to the raw document).
 * @param index The workspace index.
 * @param file The absolute file path.
 * @param position The cursor position.
 * @param word The identifier word under the cursor.
 * @returns The reference, if any.
 */
export function cursorReference(
  index: WorkspaceIndex,
  file: string,
  position: Position,
  word: string | undefined,
): AssemblySymbolReference | undefined {
  const references = index.getReferences(file);
  const exact = referenceAt(references, position);
  if (exact && (!word || namesMatch(exact.name, word))) {
    return exact;
  }
  if (!word) {
    return undefined;
  }
  const onLine = references.filter(
    (reference) =>
      namesMatch(reference.name, word) &&
      (locationRange(reference.location)?.start.line ?? reference.location.line) === position.line,
  );
  const containing = onLine.find((reference) =>
    positionInRange(position, referenceRange(index, reference)),
  );
  if (containing) {
    return containing;
  }
  // A same-spelling reference elsewhere may belong to another struct or local scope. It cannot
  // identify this cursor position, even when normalized columns need the on-line fallback.
  return onLine[0];
}

/**
 * Resolves the definition under the cursor, with the same fallback strategy as
 * {@link cursorReference}.
 * @param index The workspace index.
 * @param file The absolute file path.
 * @param position The cursor position.
 * @param word The identifier word under the cursor.
 * @returns The symbol, if any.
 */
export function cursorSymbol(
  index: WorkspaceIndex,
  file: string,
  position: Position,
  word: string | undefined,
): AssemblySymbolDefinition | undefined {
  const symbols = index.getSymbols(file);
  const exact = symbolAt(symbols, position);
  if (exact && (!word || namesMatch(exact.name, word))) {
    return exact;
  }
  if (!word) {
    return undefined;
  }
  const onLine = symbols.filter(
    (symbol) =>
      namesMatch(symbol.name, word) &&
      (locationRange(symbol.location)?.start.line ?? symbol.location.line) === position.line,
  );
  const containing = onLine.find((symbol) =>
    positionInRange(position, definitionRange(index, symbol)),
  );
  if (containing) {
    return containing;
  }
  return onLine[0];
}

/**
 * Computes the precise raw range for a symbol definition.
 * @param index The workspace index.
 * @param symbol The symbol definition.
 * @returns The precise range.
 */
export function definitionRange(index: WorkspaceIndex, symbol: AssemblySymbolDefinition): Range {
  const fallbackRange = locationRange(symbol.location);
  const fallback = fallbackRange ? toRange(fallbackRange) : lineFallbackRange(symbol.location.line);
  const line = fallbackRange?.start.line ?? symbol.location.line;
  if (symbol.kind === "define") {
    return preciseRangeWithSigil(index, symbol.location.file, line, symbol.name, fallback);
  }
  if (symbol.containerName && symbol.name.startsWith(`${symbol.containerName}_`)) {
    const suffix = `.${symbol.name.slice(symbol.containerName.length + 1)}`;
    const dotted = preciseRange(index, symbol.location.file, line, suffix, fallback);
    if (dotted !== fallback) {
      return dotted;
    }
  }
  return preciseRange(index, symbol.location.file, line, symbol.name, fallback);
}

/**
 * Computes the precise raw range for a symbol reference.
 * @param index The workspace index.
 * @param reference The symbol reference.
 * @returns The precise range.
 */
export function referenceRange(index: WorkspaceIndex, reference: AssemblySymbolReference): Range {
  const fallbackRange = locationRange(reference.location);
  const fallback = fallbackRange
    ? toRange(fallbackRange)
    : lineFallbackRange(reference.location.line);
  const line = fallbackRange?.start.line ?? reference.location.line;
  if (reference.kind === "define") {
    return preciseRangeWithSigil(index, reference.location.file, line, reference.name, fallback);
  }
  return preciseRange(index, reference.location.file, line, reference.name, fallback);
}

/**
 * Resolves an include using this file's graph edges, then probes disk beside the source and in
 * include paths. Graph matches accept a basename fallback for analysis-normalized target names.
 * @param index The workspace index.
 * @param file The file issuing the include.
 * @param target The include target token.
 * @returns The first matching graph path or existing disk candidate, if any.
 */
export function resolveIncludeTarget(
  index: WorkspaceIndex,
  file: string,
  target: string,
): string | undefined {
  const trimmed = target.replace(/^["'`](.*)["'`]$/, "$1");
  const normalizedTarget = trimmed.replace(/\\/g, "/");
  const base = path.basename(normalizedTarget);
  const edges = index.getIncludeEdges().filter((edge) => edge.fromFile === file);
  const match = edges.find(
    (edge) =>
      edge.toFile === normalizedTarget ||
      edge.toFile.replace(/\\/g, "/") === normalizedTarget ||
      path.basename(edge.toFile) === base,
  );
  if (match?.toFile) {
    return match.toFile;
  }

  const searchRoots = [
    path.dirname(file),
    ...index.includePaths.map((entry) => path.resolve(path.dirname(file), entry)),
  ];
  for (const root of searchRoots) {
    const candidate = path.isAbsolute(trimmed) ? trimmed : path.resolve(root, trimmed);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}
