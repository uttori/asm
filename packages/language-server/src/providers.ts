/**
 * Converts core analysis snapshots and current source text into LSP response payloads.
 * File arguments are filesystem paths; protocol positions/ranges use zero-based UTF-16 columns.
 * Providers repair normalized analysis spans against raw editor text without rebuilding the index.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import type {
  AssemblyDiagnostic,
  AssemblyDiagnosticSeverity,
  AssemblySymbolDefinition,
  AssemblySymbolKind,
  AssemblySymbolReference,
  ProjectOutlineNode,
  SourceRange,
  WorkspaceIndex,
  ParsedAssetCall,
  AssetValueNode,
} from "@uttori/asm-core";
import {
  CompletionItem,
  CompletionItemKind,
  Diagnostic,
  DiagnosticSeverity,
  type DocumentUri,
  DocumentSymbol,
  Hover,
  Location,
  LocationLink,
  MarkupKind,
  Position,
  Range,
  SemanticTokenModifiers,
  SemanticTokenTypes,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  SignatureHelp,
  SignatureInformation,
  SymbolKind,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver";

import { assetCallOnLine, assetLineAt } from "./asset-language.js";
import {
  findInstruction,
  findDirectiveInCatalog,
  findDirectiveOperand,
  buildCompletionEntries,
  renderInstructionDocs,
  renderDirectiveDocs,
  renderExpressionFunctionDocs,
  locationRange,
  referenceAt,
  symbolAt,
  resolveDefinition,
  findReferences,
  positionInRange,
} from "./core.js";

/**
 * The LSP 3.18 semantic-token legend advertised to clients. All entries use
 * protocol-standard token types and modifiers, including the 3.18 `label` type.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#semantic-tokens-leftwards_arrow_with_hook
 */
export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes: [
    SemanticTokenTypes.keyword,
    SemanticTokenTypes.function,
    SemanticTokenTypes.variable,
    SemanticTokenTypes.property,
    SemanticTokenTypes.macro,
    SemanticTokenTypes.namespace,
    SemanticTokenTypes.number,
    SemanticTokenTypes.string,
    SemanticTokenTypes.label,
    SemanticTokenTypes.struct,
  ],
  tokenModifiers: [SemanticTokenModifiers.definition],
};

/** Legend offsets encoded in semantic tokens; changing legend order changes these wire values. */
const tokenTypeIndex = new Map<string, number>(
  semanticTokensLegend.tokenTypes.map((type, index) => [type, index]),
);
/** Definition flag as a legend-indexed bitmask, not a modifier array index. */
const definitionTokenModifier =
  1 << semanticTokensLegend.tokenModifiers.indexOf(SemanticTokenModifiers.definition);

/** Characters that can appear inside an assembly identifier or define name. */
const IDENTIFIER_CHAR = /[\w!]/;

/**
 * Converts an absolute file path to a file URI string.
 * @param {string} filePath The absolute path.
 * @returns {DocumentUri} The file URI.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#uri
 */
export function pathToUri(filePath: string): DocumentUri {
  return pathToFileURL(filePath).toString();
}

/**
 * Converts a file URI string to an absolute file path.
 * @param {DocumentUri} uri The file URI.
 * @returns {string} The absolute path.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#uri
 */
export function uriToPath(uri: DocumentUri): string {
  return fileURLToPath(uri);
}

/** Find the typed asset call on a protocol line without opening its binary input.
 * @param {string} text Open document text.
 * @param {Position} position Cursor position.
 * @returns {ParsedAssetCall | undefined} Complete call when parseable.
 */
function assetCallAt(text: string, position: Position): ParsedAssetCall | undefined {
  const line = assetLineAt(text, position.line);
  if (!line) {
    return undefined;
  }
  return assetCallOnLine(line, position.line);
}

/** An argument span includes its closing quote for cursor navigation.
 * @param {AssetValueNode} node Parsed asset value.
 * @param {number} character Zero-based cursor column.
 * @returns {boolean} Whether the cursor is on the value.
 */
function assetSpanContains(node: AssetValueNode, character: number): boolean {
  return character >= node.span.start && character <= node.span.end;
}

/** Find a primary or declared resource path under the cursor.
 * @param {ParsedAssetCall} call Parsed statement.
 * @param {number} character Zero-based cursor column.
 * @returns {string | undefined} User-spelled path when selected.
 */
/** Option names that the statement did not write are absent. */
function assetOption(
  options: Readonly<Record<string, AssetValueNode>>,
  key: string,
): AssetValueNode | undefined {
  return Object.hasOwn(options, key) ? options[key] : undefined;
}

function assetPathAt(call: ParsedAssetCall, character: number): string | undefined {
  if (assetSpanContains(call.path, character)) {
    return call.path.value;
  }
  const palette = assetOption(call.options, "palette");
  if (
    palette?.kind === "string" &&
    assetSpanContains(palette, character) &&
    palette.value !== "embedded" &&
    palette.value !== "auto"
  ) {
    return palette.value;
  }
  return undefined;
}

/**
 * Converts a core source range to an LSP range.
 * @param {SourceRange} range The core range.
 * @returns {Range} The LSP range.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#range
 */
function toRange(range: SourceRange): Range {
  return Range.create(range.start.line, range.start.character, range.end.line, range.end.character);
}

/**
 * Maps an assembler diagnostic severity to an LSP severity.
 * @param {AssemblyDiagnosticSeverity} severity The assembler severity.
 * @returns {DiagnosticSeverity} The LSP severity.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#diagnostic
 */
function toDiagnosticSeverity(severity: AssemblyDiagnosticSeverity): DiagnosticSeverity {
  switch (severity) {
    case "warning":
      return DiagnosticSeverity.Warning;
    case "info":
      return DiagnosticSeverity.Information;
    case "error":
    default:
      return DiagnosticSeverity.Error;
  }
}

/**
 * Maps an assembler symbol kind to an LSP symbol kind.
 * @param {AssemblySymbolKind} kind The assembler symbol kind.
 * @returns {SymbolKind} The LSP symbol kind.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#document-symbols-request-leftwards_arrow_with_hook
 */
function toSymbolKind(kind: AssemblySymbolKind): SymbolKind {
  switch (kind) {
    case "define":
      return SymbolKind.Constant;
    case "macro":
      return SymbolKind.Function;
    case "struct":
      return SymbolKind.Struct;
    case "structMember":
      return SymbolKind.Field;
    case "function":
      return SymbolKind.Function;
    case "namespace":
      return SymbolKind.Namespace;
    case "label":
    default:
      return SymbolKind.Variable;
  }
}

/**
 * Returns a fallback range for an artifact lacking precise geometry.
 * @param {number} line The zero-based line number.
 * @returns {Range} An empty range at the line start, using line zero for invalid line numbers.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#range
 */
function lineFallbackRange(line: number): Range {
  const safeLine = Number.isFinite(line) && line >= 0 ? line : 0;
  return Range.create(safeLine, 0, safeLine, 0);
}

/** Exact text keys prevent stale ranges after edits; the small LRU avoids retaining every bank/version. */
const lineCache = new Map<string, readonly string[]>();
let cachedCharacters = 0;

/** Reuse line splits across thousands of token ranges in one document; CRLF and LF retain their existing semantics. */
function splitLines(text: string): readonly string[] {
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
function lineAt(lines: readonly string[], line: number): string | undefined {
  return line >= 0 && line < lines.length ? lines[line] : undefined;
}

/**
 * Recomputes a token's range in the raw document so it does not inherit the
 * column offset introduced by command normalization (which strips leading
 * whitespace and comments).
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path containing the token.
 * @param {number} line The zero-based line number.
 * @param {string} name The token text to locate.
 * @param {Range} fallback The range to use when the token cannot be located.
 * @returns {Range} A new raw range on a match; otherwise the original fallback object by identity.
 */
function preciseRange(
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
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path containing the token.
 * @param {number} line The zero-based line number.
 * @param {string} name The token text to locate.
 * @param {Range} fallback The range to use when the token cannot be located.
 * @returns {Range} The precise range.
 */
function preciseRangeWithSigil(
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
 * @param {string} word The word to lookup.
 * @returns {string} The word without the sigil or leading dots.
 */
function lookupNameFor(word: string): string {
  const withoutSigil = word.startsWith("!") ? word.slice(1) : word;
  return withoutSigil.replace(/^\.+/, "");
}

/**
 * Returns whether a stored symbol/reference name matches a cursor word,
 * accepting both `version` and `!version` for define tokens.
 * @param {string} stored The stored symbol/reference name.
 * @param {string} word The cursor word.
 * @returns {boolean} Whether the names match.
 */
function namesMatch(stored: string, word: string): boolean {
  return lookupNameFor(stored) === lookupNameFor(word) || stored === word;
}

/**
 * Locates `name` on a source line and extends the end column through a suffix
 * left by an in-flight rename, such as `unk1E` becoming `unk1E__WE`.
 * A single underscore ends the extension to preserve compound-label segments;
 * a suffix starting with a double underscore is kept as part of the token.
 * @param {string} rawLine The raw source line.
 * @param {string} name The stored token text to locate.
 * @param {number} line The zero-based line number.
 * @param {Range} fallback The range to use when the token cannot be located.
 * @returns {Range} A new range extended through identifier characters, or the original fallback object.
 */
function rangeForTokenOnLine(rawLine: string, name: string, line: number, fallback: Range): Range {
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
 * @param {string} lineText The raw line text.
 * @param {string} name The token to locate.
 * @returns {number} Whole-token column, otherwise the first non-comment substring match, or -1.
 */
function findTokenColumn(lineText: string, name: string): number {
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
 * @param {string} lineText The raw line text.
 * @param {string} segment The suffix without a leading dot or underscore.
 * @returns {number} The zero-based column of the suffix, or -1.
 */
function findCompoundSuffixColumn(lineText: string, segment: string): number {
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
 * @param {string} text The document text.
 * @param {Position} position The cursor position.
 * @returns {string | undefined} The word, or undefined when none is present.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#position
 */
function wordAt(text: string, position: Position): string | undefined {
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
 * @param {string} line The line text.
 * @param {number} character The 0-based column.
 * @returns {string | undefined} The full path token, or undefined.
 */
function unquotedIncludePathAt(line: string, character: number): string | undefined {
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
 * Computes the origin highlight range for an include path on the cursor line,
 * covering the full unquoted filename (including hyphens) or quoted string.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @param {string} target The include target.
 * @returns {Range | undefined} The origin highlight range, or undefined.
 */
function includeOriginRange(
  index: WorkspaceIndex,
  file: string,
  position: Position,
  target: string,
): Range | undefined {
  const text = index.getFileText(file);
  if (!text) {
    return undefined;
  }
  const line = lineAt(splitLines(text), position.line);
  if (line === undefined) {
    return undefined;
  }
  const unquoted = unquotedIncludePathAt(line, position.character);
  if (unquoted) {
    const start = line.indexOf(unquoted);
    if (start >= 0) {
      return Range.create(position.line, start, position.line, start + unquoted.length);
    }
  }
  const trimmed = target.replace(/^["'`](.*)["'`]$/, "$1");
  for (const quote of ['"', "'", "`"]) {
    const quoted = `${quote}${trimmed}${quote}`;
    const quotedStart = line.indexOf(quoted);
    if (quotedStart >= 0) {
      return Range.create(
        position.line,
        quotedStart + 1,
        position.line,
        quotedStart + 1 + trimmed.length,
      );
    }
  }
  const column = findTokenColumn(line, trimmed);
  if (column >= 0) {
    return Range.create(position.line, column, position.line, column + trimmed.length);
  }
  return undefined;
}

/**
 * Returns the contents of a quoted string if the cursor is inside it.
 * @param {string} line The line text.
 * @param {number} character The 0-based column.
 * @returns {string | undefined} The unquoted string, or undefined.
 */
function quotedStringAt(line: string, character: number): string | undefined {
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
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @returns {string | undefined} The word, or undefined.
 */
function cursorWord(index: WorkspaceIndex, file: string, position: Position): string | undefined {
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
 * @param {string} word The identifier text.
 * @returns {string[]} The source segments.
 */
function splitHierarchicalSource(word: string): string[] {
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
 * @param {AssemblySymbolDefinition[]} symbols Every known symbol.
 * @param {string} word The compound identifier.
 * @param {string} file The file containing the cursor.
 * @returns {AssemblySymbolDefinition[]} Candidate leaves ranked by same-file preference and name length.
 */
function compoundLeafCandidates(
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
   * @param {AssemblySymbolDefinition} symbol Candidate compound-label leaf.
   * @returns {number} Descending sort score; same-file candidates receive a large fixed bonus.
   */
  const rank = (symbol: AssemblySymbolDefinition): number => {
    const inFile = symbol.location.file === file ? 1 : 0;
    return inFile * 1_000_000 + symbol.name.length;
  };
  return [...exact, ...bySuffix].toSorted((left, right) => rank(right) - rank(left));
}

/**
 * Walks `containerName` from a leaf toward the root, stopping at a missing parent or repeated name.
 * @param {AssemblySymbolDefinition[]} symbols Every known symbol.
 * @param {AssemblySymbolDefinition} leaf The leaf symbol.
 * @returns {string[]} Names from root to leaf.
 */
function hierarchyChainForSymbol(
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
 * @param {string[]} chain Root-to-leaf FQ names.
 * @param {string[]} parts Source segments from {@link splitHierarchicalSource}.
 * @param {number} chainOffset Index in `chain` aligned with `parts[0]`.
 * @returns {boolean} Whether each source part is a real hierarchy step.
 */
function hierarchyAligns(chain: string[], parts: string[], chainOffset: number): boolean {
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
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The file containing the identifier.
 * @param {string | undefined} word The identifier text.
 * @returns {{ parts: string[]; chain: string[]; chainOffset: number } | undefined}
 *   The alignment, if this is a real hierarchy.
 */
function alignedHierarchy(
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
 * Source ranges for each segment of a compound identifier on a line.
 * `.idx_beginner` → `.idx` and `beginner`. `_018049_8053` → `_018049` and `8053`.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {number} line The zero-based line number.
 * @param {string} word The compound identifier.
 * @returns {Range[] | undefined} Per-segment ranges, or undefined when not compound.
 */
function compoundSegmentRanges(
  index: WorkspaceIndex,
  file: string,
  line: number,
  word: string,
): Range[] | undefined {
  const aligned = alignedHierarchy(index, file, word);
  if (!aligned) {
    return undefined;
  }
  const text = index.getFileText(file);
  if (!text) {
    return undefined;
  }
  const lineText = lineAt(splitLines(text), line);
  if (lineText === undefined) {
    return undefined;
  }
  const start = findTokenColumn(lineText, word);
  if (start < 0) {
    return undefined;
  }
  const ranges: Range[] = [];
  let consumed = 0;
  for (const part of aligned.parts) {
    ranges.push(Range.create(line, start + consumed, line, start + consumed + part.length));
    consumed += part.length + 1;
  }
  return ranges;
}

/**
 * When the cursor is inside a compound label (`_018049_8053` or `.idx_beginner`),
 * returns the parent or `.sublabel` segment under the cursor.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @param {string | undefined} word The full identifier under the cursor.
 * @returns {string | undefined} The segment, or undefined when not compound.
 */
function hierarchicalSegmentAt(
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
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @param {string | undefined} word The identifier word under the cursor.
 * @returns {AssemblySymbolReference | undefined} The reference, if any.
 */
function cursorReference(
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
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @param {string | undefined} word The identifier word under the cursor.
 * @returns {AssemblySymbolDefinition | undefined} The symbol, if any.
 */
function cursorSymbol(
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
 * Builds LSP diagnostics for a file.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @returns {Diagnostic[]} The LSP diagnostics.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#diagnostic
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#publishdiagnostics-notification-arrow_left
 */
export function diagnosticsFor(index: WorkspaceIndex, file: string): Diagnostic[] {
  return index.getDiagnostics(file).map((diagnostic: AssemblyDiagnostic) => {
    const range = locationRange(diagnostic.location);
    return Diagnostic.create(
      range ? toRange(range) : lineFallbackRange(diagnostic.location.line),
      diagnostic.message,
      toDiagnosticSeverity(diagnostic.severity),
      diagnostic.code,
      "uttori-asm",
    );
  });
}

/**
 * Builds a nested document outline from container names, deduplicating children recorded twice
 * by analysis and expanding parent ranges to include descendants while preserving selection ranges.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @returns {DocumentSymbol[]} The document symbols.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#document-symbols-request-leftwards_arrow_with_hook
 */
export function documentSymbolsFor(index: WorkspaceIndex, file: string): DocumentSymbol[] {
  const nodes = index.getSymbols(file).map((symbol) => {
    const lspRange = definitionRange(index, symbol);
    return {
      symbol,
      lsp: DocumentSymbol.create(
        outlineDisplayName(symbol),
        outlineDetail(symbol),
        toSymbolKind(symbol.kind),
        lspRange,
        lspRange,
        [],
      ),
    };
  });

  const byName = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const list = byName.get(node.symbol.name) ?? [];
    list.push(node);
    byName.set(node.symbol.name, list);
  }

  const attached = new Set<(typeof nodes)[number]>();
  for (const node of nodes) {
    const container = node.symbol.containerName;
    if (!container) {
      continue;
    }
    const parents = byName.get(container);
    if (!parents || parents.length === 0) {
      continue;
    }
    const parent = parents.find((candidate) => candidate !== node) ?? parents[0];
    if (parent === node) {
      continue;
    }
    parent.lsp.children?.push(node.lsp);
    attached.add(node);
  }

  for (const node of nodes) {
    if (node.lsp.children && node.lsp.children.length > 0) {
      node.lsp.children = dedupeOutlineChildren(node.lsp.children);
    }
  }

  const roots = nodes.filter((node) => !attached.has(node)).map((node) => node.lsp);
  for (const root of roots) {
    expandRangeToChildren(root);
  }
  return roots;
}

/**
 * Builds the workspace include DAG for the project outline TreeView.
 * File nodes do not embed symbols. The client loads those via documentSymbol.
 * @param {WorkspaceIndex} index The workspace index.
 * @returns {ProjectOutlineNode[]} Root outline nodes (entries, then orphans).
 */
export function projectOutlineFor(index: WorkspaceIndex): ProjectOutlineNode[] {
  const childrenByParent = new Map<string, string[]>();
  for (const edge of index.getIncludeEdges()) {
    const from = path.resolve(edge.fromFile);
    const to = path.resolve(edge.toFile);
    const list = childrenByParent.get(from) ?? [];
    if (!list.includes(to)) {
      list.push(to);
    }
    childrenByParent.set(from, list);
  }

  const visited = new Set<string>();
  /**
   * Expands each reachable file once; later visits become include leaves to bound cycles and DAG reuse.
   * @param {string} file Entry or include path, normalized before consulting the shared visited set.
   * @returns {ProjectOutlineNode} A file subtree, or a non-expanding include link for a repeated file.
   */
  const buildFile = (file: string): ProjectOutlineNode => {
    const resolved = path.resolve(file);
    if (visited.has(resolved)) {
      return {
        id: `include:${resolved}:${visited.size}`,
        label: path.basename(resolved),
        detail: "include",
        kind: "include",
        uri: pathToUri(resolved),
      };
    }
    visited.add(resolved);
    return {
      id: `file:${resolved}`,
      label: path.basename(resolved),
      kind: "file",
      uri: pathToUri(resolved),
      children: (childrenByParent.get(resolved) ?? []).map((child) => buildFile(child)),
    };
  };

  const entries = index.resolveRoots().map((root) => path.resolve(root));
  const roots = entries.map((entry) => ({
    id: `entry:${entry}`,
    label: `Entry: ${path.basename(entry)}`,
    kind: "entry" as const,
    uri: pathToUri(entry),
    children: [buildFile(entry)],
  }));

  const reachable = visited;
  const analyzed = index.getAnalyzedFiles().map((file) => path.resolve(file));
  const orphans = analyzed.filter((file) => !reachable.has(file));
  if (orphans.length === 0) {
    return roots;
  }
  return [
    ...roots,
    {
      id: "orphans",
      label: "Orphans",
      kind: "orphanGroup",
      children: orphans.map((file) => ({
        id: `orphan:${file}`,
        label: path.basename(file),
        kind: "file" as const,
        uri: pathToUri(file),
      })),
    },
  ];
}

/**
 * Resolves the definition locations for the symbol or reference at a position.
 * Returns `LocationLink[]` for include references so VS Code highlights the
 * full filename (including hyphens) rather than just the word at the cursor.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @returns {Location[] | LocationLink[]} The definition locations.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#go-to-definition-request-leftwards_arrow_with_hook
 */
export function definitionFor(
  index: WorkspaceIndex,
  file: string,
  position: Position,
): Location[] | LocationLink[] {
  const assetCall = assetCallAt(index.getFileText(file) ?? "", position);
  const assetPath = assetCall && assetPathAt(assetCall, position.character);
  if (assetPath) {
    const target = resolveIncludeTarget(index, file, assetPath);
    if (target) {
      const node = assetSpanContains(assetCall.path, position.character)
        ? assetCall.path
        : assetOption(assetCall.options, "palette");
      const start = node?.span.start ?? position.character;
      const end = node?.span.end ?? position.character;
      const origin = Range.create(position.line, start, position.line, end);
      const zero = Range.create(0, 0, 0, 0);
      return [LocationLink.create(pathToUri(target), zero, zero, origin)];
    }
  }
  const word = cursorWord(index, file, position);
  const reference = cursorReference(index, file, position, word);
  if (reference) {
    if (reference.kind === "include") {
      const target = resolveIncludeTarget(index, file, reference.name);
      if (target) {
        const originRange =
          includeOriginRange(index, file, position, reference.name) ??
          locationRange(reference.location);
        const targetUri = pathToUri(target);
        const targetRange = Range.create(0, 0, 0, 0);
        if (originRange) {
          return [LocationLink.create(targetUri, targetRange, targetRange, originRange)];
        }
        return [Location.create(targetUri, targetRange)];
      }
    }
    const definitions = resolveDefinition(reference, index.getAllSymbols());
    if (definitions.length > 0) {
      return definitions.map((definition) => definitionToLocation(index, definition));
    }
  }

  const symbol = cursorSymbol(index, file, position, word);
  if (symbol) {
    return [definitionToLocation(index, symbol)];
  }

  if (word) {
    // Strip the define sigil (`!`) before name-based lookups so `!version`
    // resolves to the `version` symbol definition.
    const lookupName = lookupNameFor(word);
    const byName = index
      .getAllSymbols()
      .filter((entry) => namesMatch(entry.name, lookupName) || namesMatch(entry.name, word));
    if (byName.length > 0) {
      return byName.map((definition) => definitionToLocation(index, definition));
    }
    const includePath = resolveIncludeTarget(index, file, word);
    if (includePath) {
      const originRange = includeOriginRange(index, file, position, word);
      const targetUri = pathToUri(includePath);
      const targetRange = Range.create(0, 0, 0, 0);
      if (originRange) {
        return [LocationLink.create(targetUri, targetRange, targetRange, originRange)];
      }
      return [Location.create(targetUri, targetRange)];
    }
  }
  return [];
}

/**
 * Finds all references (and optionally the declaration) for the identifier at a position.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @param {boolean} includeDeclaration Whether to include the declaration.
 * @returns {Location[]} The reference locations.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#find-references-request-leftwards_arrow_with_hook
 */
export function referencesFor(
  index: WorkspaceIndex,
  file: string,
  position: Position,
  includeDeclaration: boolean,
): Location[] {
  const target = identifierAt(index, file, position);
  if (!target) {
    return [];
  }

  const locations: Location[] = [];
  let matches = findReferences(target.name, index.getAllReferences(), target.containerName);
  if (matches.length === 0) {
    matches = findReferences(target.name, index.getReferences(file), target.containerName);
  }
  for (const reference of matches) {
    locations.push(
      Location.create(pathToUri(reference.location.file), referenceRange(index, reference)),
    );
  }

  if (includeDeclaration) {
    for (const symbol of index
      .getAllSymbols()
      .filter(
        (entry) =>
          entry.name === target.name &&
          (target.containerName === undefined || entry.containerName === target.containerName),
      )) {
      locations.push(definitionToLocation(index, symbol));
    }
  }
  return locations;
}

/**
 * Builds hover documentation for the token at a position.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @param {string} text The full document text.
 * @returns {Hover | null} The hover, or null when nothing is documented.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#hover-request-leftwards_arrow_with_hook
 */
export function hoverFor(
  index: WorkspaceIndex,
  file: string,
  position: Position,
  text: string,
): Hover | null {
  const assetCall = assetCallAt(text, position);
  if (
    assetCall &&
    position.character >= assetCall.span.start &&
    position.character <= assetCall.span.end
  ) {
    const registered = index.environment.getAssetFormat(assetCall.format.value, index.target);
    const displayPath = assetCall.path.value.replace(/`/g, "\\`");
    const selectedOutput = assetOption(assetCall.options, "output");
    const outputName = selectedOutput?.kind === "string" ? selectedOutput.value : "primary";
    if (assetSpanContains(assetCall.path, position.character)) {
      const resolved = resolveIncludeTarget(index, file, assetCall.path.value);
      if (!resolved) {
        return markdownHover(
          `Asset \`${displayPath}\` is missing. Build Binary will report its diagnostic.`,
        );
      }
      let size: number;
      try {
        size = fs.statSync(resolved).size;
      } catch {
        return markdownHover(
          `Asset \`${displayPath}\` changed or is unreadable. Build Binary will report its diagnostic.`,
        );
      }
      return markdownHover(
        `Asset \`${displayPath}\` · ${size.toLocaleString()} source bytes · format \`${registered?.id ?? assetCall.format.value}\` · output \`${outputName}\`. Encoded size is resolved by Build Binary or an explicit preview.`,
      );
    }
    if (assetSpanContains(assetCall.format, position.character)) {
      if (!registered) {
        return markdownHover(
          `Asset format \`${assetCall.format.value}\` is unavailable for \`${index.target}\`.`,
        );
      }
      return markdownHover(
        `Asset format \`${registered.id}\` (v${registered.version}). Source: \`${displayPath}\`. Output: \`${outputName}\`.`,
      );
    }
  }
  const architecture = index.architecture;
  const word = cursorWord(index, file, position) ?? wordAt(text, position);
  const reference = cursorReference(index, file, position, word);
  if (reference?.kind === "instruction") {
    const descriptor = findInstruction(reference.name, architecture, {
      getInstructionCatalog: (name) => index.toolingCatalog.getInstructions(name),
    });
    if (descriptor) {
      return markdownHover(renderInstructionDocs(descriptor));
    }
  }

  if (reference) {
    const definitions = resolveDefinition(reference, index.getAllSymbols());
    if (definitions.length > 0) {
      return markdownHover(renderSymbolDocs(index, definitions[0]));
    }
  }

  if (word) {
    const line = splitLines(text)[position.line];
    if (line) {
      const operand = findDirectiveOperand(
        line,
        word,
        index.directiveCatalog,
        index.directivePrefixes,
      );
      if (operand) {
        return markdownHover(renderDirectiveDocs(operand));
      }
    }
  }

  const symbol = cursorSymbol(index, file, position, word);
  if (symbol) {
    return markdownHover(renderSymbolDocs(index, symbol));
  }

  if (!word) {
    return null;
  }
  const instruction = findInstruction(word, architecture, {
    getInstructionCatalog: (name) => index.toolingCatalog.getInstructions(name),
  });
  if (instruction) {
    return markdownHover(renderInstructionDocs(instruction));
  }
  const directive = findDirectiveInCatalog(word, index.directiveCatalog, index.directivePrefixes);
  if (directive) {
    return markdownHover(renderDirectiveDocs(directive));
  }
  const expressionFunction = index.toolingCatalog
    .getExpressionFunctions()
    .find(
      (descriptor) =>
        descriptor.name.toLowerCase() === word.toLowerCase() ||
        descriptor.aliases.some((alias) => alias.toLowerCase() === word.toLowerCase()),
    );
  if (expressionFunction) {
    return markdownHover(renderExpressionFunctionDocs(expressionFunction));
  }
  const lookupName = lookupNameFor(word);
  const byName = index
    .getAllSymbols()
    .filter((entry) => namesMatch(entry.name, lookupName) || namesMatch(entry.name, word));
  if (byName.length > 0) {
    return markdownHover(renderSymbolDocs(index, byName[0]));
  }
  return null;
}

/**
 * Builds completion items from active tooling and all indexed workspace symbols.
 * Symbol entries are deduplicated by kind/name; this provider does not filter by cursor scope.
 * @param {WorkspaceIndex} index The workspace index.
 * @returns {CompletionItem[]} The completion items.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#completion-request-leftwards_arrow_with_hook
 */
export function completionsFor(index: WorkspaceIndex): CompletionItem[] {
  const items: CompletionItem[] = buildCompletionEntries(
    index.architecture,
    { getInstructionCatalog: (name) => index.toolingCatalog.getInstructions(name) },
    index.directiveCatalog,
    index.toolingCatalog.getExpressionFunctions(),
  ).map((entry) => ({
    label: entry.label,
    kind: entry.kind === "expression" ? CompletionItemKind.Function : CompletionItemKind.Keyword,
    detail: entry.detail,
    documentation: { kind: MarkupKind.Markdown, value: entry.documentation },
  }));

  const seen = new Set<string>();
  for (const symbol of index.getAllSymbols()) {
    const key = `${symbol.kind}\u0000${symbol.name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      label: symbol.name,
      kind: symbolCompletionKind(symbol.kind),
      detail: symbol.containerName ? `${symbol.kind} in ${symbol.containerName}` : symbol.kind,
    });
  }
  return items;
}

/** Complete format IDs, transform IDs, and schema-backed asset option names in a call.
 * @param {WorkspaceIndex} index Active project index.
 * @param {string} text Open document text.
 * @param {Position} position Cursor position.
 * @returns {CompletionItem[] | null} Asset candidates, or null outside a call.
 */
export function assetCompletionsFor(
  index: WorkspaceIndex,
  text: string,
  position: Position,
): CompletionItem[] | null {
  const line = assetLineAt(text, position.line);
  if (!line || !/\bincludeasset\s*\(/i.test(line)) {
    return null;
  }
  const prefix = line.slice(0, position.character);
  const call = assetCallOnLine(line, position.line);
  const inFormat = call && assetSpanContains(call.format, position.character);
  if (inFormat || /\bincludeasset\s*\(\s*["'][^"']*["']\s*,\s*["'][^"']*$/i.test(prefix)) {
    return index.environment.getAssetFormats(index.target).flatMap((format) =>
      [format.id, ...(format.aliases ?? [])].map((label) => ({
        label,
        kind: CompletionItemKind.EnumMember,
        detail: `Asset format · ${format.id} v${format.version}`,
      })),
    );
  }
  if (/\bcompress\s*:\s*["'][^"']*$/i.test(prefix)) {
    return index.environment.getAssetTransforms(index.target).flatMap((transform) =>
      [transform.id, ...(transform.aliases ?? [])].map((label) => ({
        label,
        kind: CompletionItemKind.EnumMember,
        detail: `Lossless transform · ${transform.id} v${transform.version}`,
      })),
    );
  }
  const format = call && index.environment.getAssetFormat(call.format.value, index.target);
  const common = new Map<string, string>([
    ["output", "Selected named output"],
    ["compress", "Lossless transform ID or chain"],
    ["compressOptions", "Single-transform options"],
    ["maxSize", "Maximum emitted bytes"],
  ]);
  for (const [name, descriptor] of Object.entries(format?.optionSchema ?? {})) {
    common.set(name, descriptor.summary);
  }
  return [...common].map(([label, detail]) => ({
    label,
    kind: CompletionItemKind.Property,
    detail,
    insertText: `${label}: `,
  }));
}

/**
 * Builds signature help for the instruction or directive starting the line.
 * @param {string} lineText The current line text up to the cursor.
 * @param {WorkspaceIndex} index Active target tooling metadata.
 * @returns {SignatureHelp | null} The signature help, or null.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#signature-help-request-leftwards_arrow_with_hook
 */
export function signatureHelpFor(lineText: string, index: WorkspaceIndex): SignatureHelp | null {
  if (/\bincludeasset\s*\(/i.test(lineText)) {
    return {
      signatures: [
        SignatureInformation.create(
          "includeAsset(path, format [, optionName: value ...])",
          "Emit one selected asset output. Compression runs after output selection; maxSize limits final bytes.",
        ),
      ],
      activeSignature: 0,
    };
  }
  const leading = lineText.trim().split(/\s+/)[0];
  if (!leading) {
    return null;
  }

  const instruction = findInstruction(leading, index.architecture, {
    getInstructionCatalog: (name) => index.toolingCatalog.getInstructions(name),
  });
  if (instruction) {
    const signatures = instruction.modes.map((mode) =>
      SignatureInformation.create(
        `${instruction.mnemonic} ${mode.syntax}`.trim(),
        `${mode.mode}${instruction.summary ? ` - ${instruction.summary}` : ""}`,
      ),
    );
    return { signatures, activeSignature: 0 };
  }

  const directive = findDirectiveInCatalog(
    leading,
    index.directiveCatalog,
    index.directivePrefixes,
  );
  if (directive) {
    return {
      signatures: [SignatureInformation.create(directive.syntax, directive.summary)],
      activeSignature: 0,
    };
  }
  return null;
}

/**
 * Returns the rename range for the identifier at a position.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @returns {Range | null} The identifier range, or null when rename is unavailable.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#prepare-rename-request-leftwards_arrow_with_hook
 */
export function prepareRenameFor(
  index: WorkspaceIndex,
  file: string,
  position: Position,
): Range | null {
  const word = cursorWord(index, file, position);
  const reference = cursorReference(index, file, position, word);
  if (reference && isRenameableReference(reference)) {
    return bareReferenceRange(index, reference);
  }
  const symbol = cursorSymbol(index, file, position, word);
  if (symbol) {
    return bareDefinitionRange(index, symbol);
  }
  return null;
}

/**
 * Builds a workspace edit renaming the identifier at a position across files.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @param {string} newName Replacement identifier; a leading ! is removed for define renames only.
 * @returns {WorkspaceEdit | null} The workspace edit, or null when nothing to rename.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#rename-request-leftwards_arrow_with_hook
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#workspaceedit
 */
export function renameEditsFor(
  index: WorkspaceIndex,
  file: string,
  position: Position,
  newName: string,
): WorkspaceEdit | null {
  const target = renameTargetAt(index, file, position);
  if (!target) {
    return null;
  }

  const kind = target.symbol?.kind ?? target.reference?.kind;
  const effectiveName = kind === "define" && newName.startsWith("!") ? newName.slice(1) : newName;

  const editsByUri = new Map<string, TextEdit[]>();
  /**
   * Groups replacements by document for the LSP changes map, using the normalized replacement name.
   * @param {string} uri Document URI owning the occurrence.
   * @param {Range} range Bare identifier range that preserves any source sigil.
   */
  const pushEdit = (uri: string, range: Range): void => {
    const edits = editsByUri.get(uri) ?? [];
    edits.push(TextEdit.replace(range, effectiveName));
    editsByUri.set(uri, edits);
  };

  for (const symbol of index
    .getAllSymbols()
    .filter((entry) => symbolMatchesRenameTarget(entry, target))) {
    pushEdit(pathToUri(symbol.location.file), bareDefinitionRange(index, symbol));
  }
  for (const reference of index
    .getAllReferences()
    .filter((entry) => referenceMatchesRenameTarget(entry, target))) {
    pushEdit(pathToUri(reference.location.file), bareReferenceRange(index, reference));
  }

  if (editsByUri.size === 0) {
    return null;
  }
  return { changes: Object.fromEntries(editsByUri) };
}

/**
 * Resolve the unique declaration for persistent research naming. Ambiguous references deliberately
 * return no identity; callers may still provide ordinary text rename for those references.
 */
export function renameDefinitionFor(
  index: WorkspaceIndex,
  file: string,
  position: Position,
): AssemblySymbolDefinition | undefined {
  return renameTargetAt(index, file, position)?.symbol;
}

/** Rename a recipe field across its declared layout instances in one scan, preserving unrelated scopes. */
export function renameStructFieldsFor(
  index: WorkspaceIndex,
  oldName: string,
  newName: string,
  containers: readonly string[],
): WorkspaceEdit {
  const owners = new Set(containers);
  const changes: Record<string, TextEdit[]> = {};
  const append = (file: string, range: Range): void => {
    const uri = pathToUri(file);
    const edits = changes[uri] ?? [];
    edits.push(TextEdit.replace(range, newName));
    changes[uri] = edits;
  };
  // A common layout can have hundreds of bindings. Repeating ordinary F2 for each binding would
  // repeatedly scan the full project and make a simple field rename scale quadratically.
  for (const symbol of index.getAllSymbols()) {
    if (
      symbol.kind === "structMember" &&
      symbol.name === oldName &&
      symbol.containerName &&
      owners.has(symbol.containerName)
    ) {
      append(symbol.location.file, bareDefinitionRange(index, symbol));
    }
  }
  for (const reference of index.getAllReferences()) {
    if (
      reference.kind === "label" &&
      reference.name === oldName &&
      reference.containerName &&
      owners.has(reference.containerName)
    ) {
      append(reference.location.file, bareReferenceRange(index, reference));
    }
  }
  return { changes };
}

/**
 * Identity used to match rename occurrences by name, kind, and container scope.
 * renameTargetAt populates exactly one branch; an ambiguous/unresolved reference stays a reference.
 */
type RenameTarget = {
  /** Selected declaration, either under the cursor or uniquely resolved from a reference. */
  symbol?: AssemblySymbolDefinition;
  /** Renameable reference retained when it does not resolve to exactly one declaration. */
  reference?: AssemblySymbolReference;
};

/**
 * Resolves a renameable definition or reference at the cursor. Instruction,
 * include, and unknown tokens are deliberately excluded.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @returns {RenameTarget | undefined} The selected rename target, if any.
 */
function renameTargetAt(
  index: WorkspaceIndex,
  file: string,
  position: Position,
): RenameTarget | undefined {
  const word = cursorWord(index, file, position);
  const reference = cursorReference(index, file, position, word);
  if (reference) {
    if (!isRenameableReference(reference)) {
      return undefined;
    }
    const definitions = resolveDefinition(reference, index.getAllSymbols());
    return definitions.length === 1 ? { symbol: definitions[0] } : { reference };
  }
  const symbol = cursorSymbol(index, file, position, word);
  return symbol ? { symbol } : undefined;
}

/**
 * Returns whether an analysis reference represents a user-defined symbol.
 * @param {AssemblySymbolReference} reference The reference to classify.
 * @returns {boolean} Whether the reference can be renamed.
 */
function isRenameableReference(reference: AssemblySymbolReference): boolean {
  return (
    reference.kind !== "include" && reference.kind !== "instruction" && reference.kind !== "unknown"
  );
}

/**
 * Returns whether a definition belongs to the selected rename target.
 * @param {AssemblySymbolDefinition} symbol The definition to compare.
 * @param {RenameTarget} target The selected rename target.
 * @returns {boolean} Whether the definition belongs to the target.
 */
function symbolMatchesRenameTarget(
  symbol: AssemblySymbolDefinition,
  target: RenameTarget,
): boolean {
  if (target.symbol) {
    return (
      symbol.name === target.symbol.name &&
      symbol.kind === target.symbol.kind &&
      symbol.containerName === target.symbol.containerName
    );
  }
  return target.reference ? resolveDefinition(target.reference, [symbol]).length === 1 : false;
}

/**
 * Returns whether a reference belongs to the selected rename target.
 * @param {AssemblySymbolReference} reference The reference to compare.
 * @param {RenameTarget} target The selected rename target.
 * @returns {boolean} Whether the reference belongs to the target.
 */
function referenceMatchesRenameTarget(
  reference: AssemblySymbolReference,
  target: RenameTarget,
): boolean {
  if (!isRenameableReference(reference)) {
    return false;
  }
  if (target.reference) {
    return (
      reference.name === target.reference.name &&
      reference.kind === target.reference.kind &&
      reference.containerName === target.reference.containerName
    );
  }
  if (!target.symbol || reference.name !== target.symbol.name) {
    return false;
  }
  if (
    target.symbol.containerName !== undefined &&
    reference.containerName !== target.symbol.containerName
  ) {
    return false;
  }
  switch (target.symbol.kind) {
    case "define":
      return reference.kind === "define";
    case "macro":
      return reference.kind === "macro";
    case "function":
      return reference.kind === "function";
    case "label":
    case "struct":
    case "structMember":
    case "namespace":
      return reference.kind === "label";
  }
  const leftover: never = target.symbol.kind;
  throw new Error(`Unsupported rename symbol kind: ${String(leftover)}`);
}

/**
 * Builds semantic tokens for a file from its symbols and references.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @returns {SemanticTokens} The semantic tokens.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#semantic-tokens-leftwards_arrow_with_hook
 */
export function semanticTokensFor(index: WorkspaceIndex, file: string): SemanticTokens {
  /** Absolute token coordinates collected before sorting and LSP delta encoding. */
  type RawToken = {
    /** Zero-based source line; tokens cannot cross line boundaries. */
    line: number;
    /** Zero-based UTF-16 column of the token start. */
    char: number;
    /** Positive token width in UTF-16 code units. */
    length: number;
    /** Index in semanticTokensLegend.tokenTypes. */
    type: number;
    /** Bitmask of indices in semanticTokensLegend.tokenModifiers; zero means no modifiers. */
    modifiers: number;
  };
  const tokens: RawToken[] = [];

  /**
   * Collects only nonempty single-line spans accepted by this server's semantic-token encoder.
   * @param {Range} range Raw source geometry for one token.
   * @param {number} type Index in the advertised token-type legend.
   * @param {number} modifiers Legend-indexed flags; defaults to zero for references.
   */
  const push = (range: Range, type: number, modifiers = 0): void => {
    if (range.start.line !== range.end.line) {
      return;
    }
    const length = Math.max(range.end.character - range.start.character, 0);
    if (length === 0) {
      return;
    }
    tokens.push({ line: range.start.line, char: range.start.character, length, type, modifiers });
  };

  for (const symbol of index.getSymbols(file)) {
    push(definitionRange(index, symbol), symbolTokenType(symbol.kind), definitionTokenModifier);
  }
  // Resolve only same-name definitions. Scanning every project symbol for each reference makes
  // a large struct file quadratic and delays unrelated queued requests such as F2.
  const definitionsByName = new Map<string, AssemblySymbolDefinition[]>();
  for (const symbol of index.getAllSymbols()) {
    const definitions = definitionsByName.get(symbol.name) ?? [];
    definitions.push(symbol);
    definitionsByName.set(symbol.name, definitions);
  }
  for (const reference of index.getReferences(file)) {
    const type = resolvedReferenceTokenType(definitionsByName.get(reference.name) ?? [], reference);
    const line = locationRange(reference.location)?.start.line ?? reference.location.line;
    const segments = compoundSegmentRanges(index, file, line, reference.name);
    if (segments) {
      for (const range of segments) {
        push(range, type);
      }
      continue;
    }
    push(referenceRange(index, reference), type);
  }

  const source = index.getFileText(file);
  if (source) {
    source.split(/\r?\n/).forEach((line, lineNumber) => {
      const call = assetCallOnLine(line, lineNumber);
      if (!call) {
        return;
      }
      const addAsset = (start: number, end: number, type: string): void => {
        if (
          tokens.some(
            (token) =>
              token.line === lineNumber && start < token.char + token.length && token.char < end,
          )
        ) {
          return;
        }
        push(Range.create(lineNumber, start, lineNumber, end), tokenTypeIndex.get(type)!);
      };
      const keyword = /includeasset\s*\(/i.exec(line.slice(call.span.start));
      if (keyword) {
        addAsset(
          call.span.start + keyword.index,
          call.span.start + keyword.index + "includeAsset".length,
          SemanticTokenTypes.function,
        );
      }
      addAsset(call.path.span.start, call.path.span.end, SemanticTokenTypes.string);
      addAsset(call.format.span.start, call.format.span.end, SemanticTokenTypes.string);
    });
  }

  tokens.sort((a, b) => a.line - b.line || a.char - b.char);

  const builder = new SemanticTokensBuilder();
  let previous: RawToken | undefined;
  for (const token of tokens) {
    // Analysis may record both a structured definition and a reference inside its span.
    // VS Code rejects overlapping tokens; keep the first span and its definition modifier.
    if (previous && previous.line === token.line && token.char < previous.char + previous.length) {
      continue;
    }
    builder.push(token.line, token.char, token.length, token.type, token.modifiers);
    previous = token;
  }
  return builder.build();
}

/**
 * Computes the precise raw range for a symbol definition.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {AssemblySymbolDefinition} symbol The symbol definition.
 * @returns {Range} The precise range.
 */
function definitionRange(index: WorkspaceIndex, symbol: AssemblySymbolDefinition): Range {
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
 * @param {WorkspaceIndex} index The workspace index.
 * @param {AssemblySymbolReference} reference The symbol reference.
 * @returns {Range} The precise range.
 */
function referenceRange(index: WorkspaceIndex, reference: AssemblySymbolReference): Range {
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
 * Precise range covering only the bare identifier, never the define sigil.
 * Used by rename so `!version` becomes `!newname` rather than replacing `!`.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {AssemblySymbolDefinition} symbol The symbol definition.
 * @returns {Range} The precise range.
 */
function bareDefinitionRange(index: WorkspaceIndex, symbol: AssemblySymbolDefinition): Range {
  const fallbackRange = locationRange(symbol.location);
  const fallback = fallbackRange ? toRange(fallbackRange) : lineFallbackRange(symbol.location.line);
  const line = fallbackRange?.start.line ?? symbol.location.line;
  return preciseRange(index, symbol.location.file, line, lookupNameFor(symbol.name), fallback);
}

/**
 * Precise range covering only the bare identifier of a reference.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {AssemblySymbolReference} reference The symbol reference.
 * @returns {Range} The precise range.
 */
function bareReferenceRange(index: WorkspaceIndex, reference: AssemblySymbolReference): Range {
  const fallbackRange = locationRange(reference.location);
  const fallback = fallbackRange
    ? toRange(fallbackRange)
    : lineFallbackRange(reference.location.line);
  const line = fallbackRange?.start.line ?? reference.location.line;
  return preciseRange(
    index,
    reference.location.file,
    line,
    lookupNameFor(reference.name),
    fallback,
  );
}

/**
 * Converts a symbol definition to an LSP location.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {AssemblySymbolDefinition} symbol The symbol definition.
 * @returns {Location} The LSP location.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#location
 */
function definitionToLocation(index: WorkspaceIndex, symbol: AssemblySymbolDefinition): Location {
  return Location.create(pathToUri(symbol.location.file), definitionRange(index, symbol));
}

/**
 * Resolves an include using this file's graph edges, then probes disk beside the source and in
 * include paths. Graph matches accept a basename fallback for analysis-normalized target names.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The file issuing the include.
 * @param {string} target The include target token.
 * @returns {string | undefined} The first matching graph path or existing disk candidate, if any.
 */
function resolveIncludeTarget(
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

/**
 * Returns the identifier at a position, preferring a matched reference or
 * symbol over a raw word extraction, including container scope.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @returns {{ name: string; containerName?: string } | undefined} The identifier.
 */
function identifierAt(
  index: WorkspaceIndex,
  file: string,
  position: Position,
):
  | {
      /** Indexed identity, or a cursor word with its leading define sigil removed as a fallback. */
      name: string;
      /** Indexed enclosing scope when known; absent for raw-word fallback lookups. */
      containerName?: string;
    }
  | undefined {
  const word = cursorWord(index, file, position);
  const reference = cursorReference(index, file, position, word);
  if (reference) {
    return { name: reference.name, containerName: reference.containerName };
  }
  const symbol = cursorSymbol(index, file, position, word);
  if (symbol) {
    return { name: symbol.name, containerName: symbol.containerName };
  }
  if (!word) {
    return undefined;
  }
  return { name: word.startsWith("!") ? word.slice(1) : word };
}

/**
 * Renders Markdown documentation for a symbol definition, including comment
 * annotations captured from the source.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {AssemblySymbolDefinition} symbol The symbol definition.
 * @returns {string} The Markdown documentation.
 */
function renderSymbolDocs(index: WorkspaceIndex, symbol: AssemblySymbolDefinition): string {
  const lines = [`**${symbol.name}** - ${symbol.kind}`];
  if (symbol.containerName) {
    lines.push("", `In \`${symbol.containerName}\``);
  }
  if (symbol.value !== undefined) {
    const value =
      typeof symbol.value === "number"
        ? `$${symbol.value.toString(16).toUpperCase()}`
        : symbol.value;
    lines.push("", `Value: \`${value}\``);
  }
  const annotation = symbolAnnotation(index, symbol);
  if (annotation) {
    lines.push("", annotation);
  }
  lines.push("", `Defined in \`${path.basename(symbol.location.file)}\``);
  return lines.join("\n");
}

/**
 * Collects leading full-line comments and a trailing same-line comment for a
 * symbol definition, JSDoc-style.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {AssemblySymbolDefinition} symbol The symbol definition.
 * @returns {string | undefined} The combined annotation, if any.
 */
function symbolAnnotation(
  index: WorkspaceIndex,
  symbol: AssemblySymbolDefinition,
): string | undefined {
  const text = index.getFileText(symbol.location.file);
  if (!text) {
    return undefined;
  }
  const lines = splitLines(text);
  const line = locationRange(symbol.location)?.start.line ?? symbol.location.line;
  const leading: string[] = [];
  for (let previous = line - 1; previous >= 0; previous--) {
    const sourceLine = lines[previous] ?? "";
    if (sourceLine.trim() === "") {
      break;
    }
    if (!/^\s*;/.test(sourceLine)) {
      break;
    }
    leading.unshift(sourceLine.replace(/^\s*;\s?/, "").trimEnd());
  }
  const trailing = lineCommentText(lines[line] ?? "");
  const parts = leading.filter((entry) => entry.length > 0);
  if (trailing) {
    parts.push(trailing);
  }
  const joined = parts.join("\n").trim();
  return joined || undefined;
}

/**
 * Returns the trailing `;` comment on a source line, ignoring `;` inside quotes.
 * @param {string} line The source line.
 * @returns {string | undefined} The trimmed comment text.
 */
function lineCommentText(line: string): string | undefined {
  let quote = "";
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if ((char === '"' || char === "'") && line[index - 1] !== "\\") {
      quote = quote === char ? "" : quote || char;
      continue;
    }
    if (!quote && char === ";") {
      const text = line.slice(index + 1).trim();
      return text || undefined;
    }
  }
  return undefined;
}

/**
 * Display name for an outline node, stripping namespace/parent prefixes.
 * @param {AssemblySymbolDefinition} symbol The symbol.
 * @returns {string} The outline label.
 */
function outlineDisplayName(symbol: AssemblySymbolDefinition): string {
  const container = symbol.containerName;
  if (container && symbol.name.startsWith(`${container}_`)) {
    return symbol.name.slice(container.length + 1);
  }
  if (symbol.kind === "label" && symbol.name.startsWith(".")) {
    return symbol.name.replace(/^\.+/, "");
  }
  return symbol.name;
}

/**
 * Detail text for an outline node.
 * @param {AssemblySymbolDefinition} symbol The symbol.
 * @returns {string} The detail string.
 */
function outlineDetail(symbol: AssemblySymbolDefinition): string {
  if (symbol.value === undefined) {
    return symbol.kind;
  }
  const value =
    typeof symbol.value === "number" ? `$${symbol.value.toString(16).toUpperCase()}` : symbol.value;
  return `${symbol.kind} ${value}`;
}

/**
 * Keeps a single outline child per display name and definition line.
 * Prefers the node with more nested children, then a detail containing an address on ties.
 * @param {DocumentSymbol[]} children The child symbols.
 * @returns {DocumentSymbol[]} The deduplicated children.
 */
function dedupeOutlineChildren(children: DocumentSymbol[]): DocumentSymbol[] {
  const seen = new Map<string, DocumentSymbol>();
  for (const child of children) {
    const key = `${child.name}\0${child.selectionRange.start.line}`;
    const existing = seen.get(key);
    const childCount = child.children?.length ?? 0;
    const existingCount = existing?.children?.length ?? 0;
    // Prefer nodes with more children. When equal, prefer the node that carries
    // an address value in its detail (the setLabel recording) over a bare "label"
    // detail (the FEC raw-name recording which has no value).
    const childHasValue = child.detail?.includes("$") ?? false;
    const existingHasValue = existing?.detail?.includes("$") ?? false;
    if (
      !existing ||
      childCount > existingCount ||
      (childCount === existingCount && childHasValue && !existingHasValue)
    ) {
      seen.set(key, child);
    }
  }
  return [...seen.values()];
}

/**
 * Mutates outline ranges recursively to cover descendants without changing selection ranges.
 * @param {DocumentSymbol} symbol Root of the freshly built outline subtree to expand.
 */
function expandRangeToChildren(symbol: DocumentSymbol): void {
  for (const child of symbol.children ?? []) {
    expandRangeToChildren(child);
    symbol.range = unionRange(symbol.range, child.range);
  }
}

/**
 * Returns a range covering both inputs.
 * @param {Range} left The first range.
 * @param {Range} right The second range.
 * @returns {Range} The union range.
 */
function unionRange(left: Range, right: Range): Range {
  const start =
    left.start.line < right.start.line ||
    (left.start.line === right.start.line && left.start.character <= right.start.character)
      ? left.start
      : right.start;
  const end =
    left.end.line > right.end.line ||
    (left.end.line === right.end.line && left.end.character >= right.end.character)
      ? left.end
      : right.end;
  return Range.create(start.line, start.character, end.line, end.character);
}

/**
 * Wraps Markdown text in an LSP hover.
 * @param {string} value The Markdown content.
 * @returns {Hover} The hover.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#hover-request-leftwards_arrow_with_hook
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#markupcontent
 */
function markdownHover(value: string): Hover {
  return { contents: { kind: MarkupKind.Markdown, value } };
}

/**
 * Maps a symbol kind to a completion item kind.
 * @param {AssemblySymbolKind} kind The symbol kind.
 * @returns {CompletionItemKind} The completion item kind.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#completion-request-leftwards_arrow_with_hook
 */
function symbolCompletionKind(kind: AssemblySymbolKind): CompletionItemKind {
  switch (kind) {
    case "define":
      return CompletionItemKind.Constant;
    case "macro":
    case "function":
      return CompletionItemKind.Function;
    case "namespace":
      return CompletionItemKind.Module;
    case "struct":
      return CompletionItemKind.Struct;
    case "structMember":
      return CompletionItemKind.Field;
    case "label":
    default:
      return CompletionItemKind.Variable;
  }
}

/**
 * Maps a symbol kind to a semantic token type index.
 * @param {AssemblySymbolKind} kind The symbol kind.
 * @returns {number} The token type index.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#semantic-tokens-leftwards_arrow_with_hook
 */
function symbolTokenType(kind: AssemblySymbolKind): number {
  switch (kind) {
    case "define":
      return tokenTypeIndex.get(SemanticTokenTypes.property) ?? 0;
    case "macro":
      return tokenTypeIndex.get(SemanticTokenTypes.macro) ?? 0;
    case "function":
      return tokenTypeIndex.get(SemanticTokenTypes.function) ?? 0;
    case "namespace":
      return tokenTypeIndex.get(SemanticTokenTypes.namespace) ?? 0;
    case "struct":
      return tokenTypeIndex.get(SemanticTokenTypes.struct) ?? 0;
    case "label":
      return tokenTypeIndex.get(SemanticTokenTypes.label) ?? 0;
    case "structMember":
      return tokenTypeIndex.get(SemanticTokenTypes.property) ?? 0;
    default:
      return tokenTypeIndex.get(SemanticTokenTypes.variable) ?? 0;
  }
}

/**
 * Resolves a reference to the most specific definition kind so `obj.timer`
 * colors the root as a struct and the field as a property.
 * @param {AssemblySymbolDefinition[]} candidates Definitions sharing the reference spelling.
 * @param {AssemblySymbolReference} reference The reference to classify.
 * @returns {number} The token type index.
 */
function resolvedReferenceTokenType(
  candidates: AssemblySymbolDefinition[],
  reference: AssemblySymbolReference,
): number {
  if (
    reference.kind === "instruction" ||
    reference.kind === "include" ||
    reference.kind === "unknown"
  ) {
    return referenceTokenType(reference.kind);
  }
  const definitions = resolveDefinition(reference, candidates);
  if (definitions.length > 0) {
    const preferred =
      definitions.find(
        (definition) =>
          definition.kind === "struct" ||
          definition.kind === "structMember" ||
          definition.kind === "namespace",
      ) ?? definitions[0];
    return symbolTokenType(preferred.kind);
  }
  return referenceTokenType(reference.kind);
}

/**
 * Maps a reference kind to a semantic token type index.
 * @param {AssemblySymbolReference["kind"]} kind The reference kind.
 * @returns {number} The token type index.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#semantic-tokens-leftwards_arrow_with_hook
 */
function referenceTokenType(kind: AssemblySymbolReference["kind"]): number {
  switch (kind) {
    case "instruction":
      return tokenTypeIndex.get(SemanticTokenTypes.keyword) ?? 0;
    case "define":
      return tokenTypeIndex.get(SemanticTokenTypes.property) ?? 0;
    case "macro":
      return tokenTypeIndex.get(SemanticTokenTypes.macro) ?? 0;
    case "function":
      return tokenTypeIndex.get(SemanticTokenTypes.function) ?? 0;
    case "include":
      return tokenTypeIndex.get(SemanticTokenTypes.string) ?? 0;
    case "label":
      return tokenTypeIndex.get(SemanticTokenTypes.label) ?? 0;
    case "unknown":
    default:
      return tokenTypeIndex.get(SemanticTokenTypes.variable) ?? 0;
  }
}
