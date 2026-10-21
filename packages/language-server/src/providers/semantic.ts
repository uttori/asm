/**
 * Converts core analysis snapshots and current source text into LSP response payloads.
 * File arguments are filesystem paths; protocol positions/ranges use zero-based UTF-16 columns.
 * Providers repair normalized analysis spans against raw editor text without rebuilding the index.
 */

import type {
  AssemblySymbolDefinition,
  AssemblySymbolKind,
  AssemblySymbolReference,
} from "@uttori/asm-core";
import type { WorkspaceIndex } from "@uttori/asm-core/tooling";
import {
  Range,
  SemanticTokenModifiers,
  SemanticTokenTypes,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
} from "vscode-languageserver";

import { assetCallOnLine } from "../asset-language.js";
import { locationRange, resolveDefinition } from "../core.js";
import {
  alignedHierarchy,
  lineAt,
  splitLines,
  findTokenColumn,
  definitionRange,
  referenceRange,
} from "./spans.js";

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
export const tokenTypeIndex = new Map<string, number>(
  semanticTokensLegend.tokenTypes.map((type, index) => [type, index]),
);

/** Definition flag as a legend-indexed bitmask, not a modifier array index. */
export const definitionTokenModifier =
  1 << semanticTokensLegend.tokenModifiers.indexOf(SemanticTokenModifiers.definition);

/**
 * Source ranges for each segment of a compound identifier on a line.
 * `.idx_beginner` → `.idx` and `beginner`. `_018049_8053` → `_018049` and `8053`.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {number} line The zero-based line number.
 * @param {string} word The compound identifier.
 * @returns {Range[] | undefined} Per-segment ranges, or undefined when not compound.
 */
export function compoundSegmentRanges(
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
 * Maps a symbol kind to a semantic token type index.
 * @param {AssemblySymbolKind} kind The symbol kind.
 * @returns {number} The token type index.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#semantic-tokens-leftwards_arrow_with_hook
 */
export function symbolTokenType(kind: AssemblySymbolKind): number {
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
export function resolvedReferenceTokenType(
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
export function referenceTokenType(kind: AssemblySymbolReference["kind"]): number {
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
