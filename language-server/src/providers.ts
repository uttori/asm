import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import {
  CompletionItem,
  CompletionItemKind,
  Diagnostic,
  DiagnosticSeverity,
  DocumentSymbol,
  Hover,
  Location,
  MarkupKind,
  Position,
  Range,
  SemanticTokens,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  SignatureHelp,
  SignatureInformation,
  SymbolKind,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver";
import {
  WorkspaceIndex,
  findInstruction,
  findDirective,
  buildCompletionEntries,
  renderInstructionDocs,
  renderDirectiveDocs,
  locationRange,
  referenceAt,
  symbolAt,
  resolveDefinition,
  findReferences,
  type AssemblyDiagnostic,
  type AssemblyDiagnosticSeverity,
  type AssemblySymbolDefinition,
  type AssemblySymbolKind,
  type AssemblySymbolReference,
  type SourceRange,
} from "./core.js";

/** The semantic token legend advertised to the client. */
export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes: ["keyword", "function", "variable", "property", "macro", "namespace", "number", "string"],
  tokenModifiers: ["declaration"],
};

const tokenTypeIndex = new Map<string, number>(
  semanticTokensLegend.tokenTypes.map((type, index) => [type, index]),
);

/** Characters that can appear inside an assembly identifier or define name. */
const IDENTIFIER_CHAR = /[A-Za-z0-9_.!]/;

/**
 * Converts an absolute file path to a file URI string.
 * @param {string} filePath The absolute path.
 * @returns {string} The file URI.
 */
export function pathToUri(filePath: string): string {
  return pathToFileURL(filePath).toString();
}

/**
 * Converts a file URI string to an absolute file path.
 * @param {string} uri The file URI.
 * @returns {string} The absolute path.
 */
export function uriToPath(uri: string): string {
  return fileURLToPath(uri);
}

/**
 * Converts a core source range to an LSP range.
 * @param {SourceRange} range The core range.
 * @returns {Range} The LSP range.
 */
function toRange(range: SourceRange): Range {
  return Range.create(range.start.line, range.start.character, range.end.line, range.end.character);
}

/**
 * Maps an assembler diagnostic severity to an LSP severity.
 * @param {AssemblyDiagnosticSeverity} severity The assembler severity.
 * @returns {DiagnosticSeverity} The LSP severity.
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
    case "label":
    default:
      return SymbolKind.Variable;
  }
}

/**
 * Returns a fallback range for an artifact lacking precise geometry.
 * @param {number} line The zero-based line number.
 * @returns {Range} A single-character range at the line start.
 */
function lineFallbackRange(line: number): Range {
  const safeLine = Number.isFinite(line) && line >= 0 ? line : 0;
  return Range.create(safeLine, 0, safeLine, 0);
}

/**
 * Splits document text into lines, tolerating both `\n` and `\r\n`.
 * @param {string} text The document text.
 * @returns {string[]} The lines.
 */
function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
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
 * @returns {Range} The precise raw range.
 */
function preciseRange(index: WorkspaceIndex, file: string, line: number, name: string, fallback: Range): Range {
  const text = index.getFileText(file);
  if (!text) {
    return fallback;
  }
  const rawLine = splitLines(text)[line];
  if (rawLine === undefined) {
    return fallback;
  }
  const column = findTokenColumn(rawLine, name);
  if (column < 0) {
    return fallback;
  }
  return Range.create(line, column, line, column + name.length);
}

/**
 * Finds the column of a token on a line, preferring whole-token matches that
 * are not inside a line comment.
 * @param {string} lineText The raw line text.
 * @param {string} name The token to locate.
 * @returns {number} The zero-based column, or -1 when not found.
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
 * Extracts the identifier-like word at a position from document text.
 * @param {string} text The document text.
 * @param {Position} position The cursor position.
 * @returns {string | undefined} The word, or undefined when none is present.
 */
function wordAt(text: string, position: Position): string | undefined {
  const line = splitLines(text)[position.line];
  if (line === undefined) {
    return undefined;
  }
  const wordPattern = /[A-Za-z0-9_.!]+/g;
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
 * Returns the identifier word under the cursor using the file's current text.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @returns {string | undefined} The word, or undefined.
 */
function cursorWord(index: WorkspaceIndex, file: string, position: Position): string | undefined {
  const text = index.getFileText(file);
  return text ? wordAt(text, position) : undefined;
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
  if (exact) {
    return exact;
  }
  if (!word) {
    return undefined;
  }
  return (
    references.find((reference) => reference.name === word && locationRange(reference.location)?.start.line === position.line)
    ?? references.find((reference) => reference.name === word)
  );
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
  if (exact) {
    return exact;
  }
  if (!word) {
    return undefined;
  }
  return (
    symbols.find((symbol) => symbol.name === word && locationRange(symbol.location)?.start.line === position.line)
    ?? symbols.find((symbol) => symbol.name === word)
  );
}

/**
 * Builds LSP diagnostics for a file.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @returns {Diagnostic[]} The LSP diagnostics.
 */
export function diagnosticsFor(index: WorkspaceIndex, file: string): Diagnostic[] {
  return index.getDiagnostics(file).map((diagnostic: AssemblyDiagnostic) => {
    const range = locationRange(diagnostic.location);
    return Diagnostic.create(
      range ? toRange(range) : lineFallbackRange(diagnostic.location.line),
      diagnostic.message,
      toDiagnosticSeverity(diagnostic.severity),
      diagnostic.code,
      "snes-asm",
    );
  });
}

/**
 * Builds document symbols for a file.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @returns {DocumentSymbol[]} The document symbols.
 */
export function documentSymbolsFor(index: WorkspaceIndex, file: string): DocumentSymbol[] {
  return index.getSymbols(file).map((symbol: AssemblySymbolDefinition) => {
    const lspRange = definitionRange(index, symbol);
    return DocumentSymbol.create(
      symbol.name,
      symbol.containerName,
      toSymbolKind(symbol.kind),
      lspRange,
      lspRange,
    );
  });
}

/**
 * Resolves the definition locations for the symbol or reference at a position.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @returns {Location[]} The definition locations.
 */
export function definitionFor(index: WorkspaceIndex, file: string, position: Position): Location[] {
  const word = cursorWord(index, file, position);
  const reference = cursorReference(index, file, position, word);
  if (reference) {
    if (reference.kind === "include") {
      const target = resolveIncludeTarget(index, file, reference.name);
      if (target) {
        return [Location.create(pathToUri(target), Range.create(0, 0, 0, 0))];
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
    const byName = index.getAllSymbols().filter((entry) => entry.name === word);
    if (byName.length > 0) {
      return byName.map((definition) => definitionToLocation(index, definition));
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
 */
export function referencesFor(
  index: WorkspaceIndex,
  file: string,
  position: Position,
  includeDeclaration: boolean,
): Location[] {
  const name = identifierNameAt(index, file, position);
  if (!name) {
    return [];
  }

  const locations: Location[] = [];
  for (const reference of findReferences(name, index.getAllReferences())) {
    locations.push(Location.create(
      pathToUri(reference.location.file),
      referenceRange(index, reference),
    ));
  }

  if (includeDeclaration) {
    for (const symbol of index.getAllSymbols().filter((entry) => entry.name === name)) {
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
 * @param {string} architecture The active architecture name.
 * @returns {Hover | null} The hover, or null when nothing is documented.
 */
export function hoverFor(
  index: WorkspaceIndex,
  file: string,
  position: Position,
  text: string,
  architecture: string,
): Hover | null {
  const word = wordAt(text, position);
  const reference = cursorReference(index, file, position, word);
  if (reference?.kind === "instruction") {
    const descriptor = findInstruction(reference.name, architecture);
    if (descriptor) {
      return markdownHover(renderInstructionDocs(descriptor));
    }
  }

  if (reference) {
    const definitions = resolveDefinition(reference, index.getAllSymbols());
    if (definitions.length > 0) {
      return markdownHover(renderSymbolDocs(definitions[0]));
    }
  }

  const symbol = cursorSymbol(index, file, position, word);
  if (symbol) {
    return markdownHover(renderSymbolDocs(symbol));
  }

  if (!word) {
    return null;
  }
  const instruction = findInstruction(word, architecture);
  if (instruction) {
    return markdownHover(renderInstructionDocs(instruction));
  }
  const directive = findDirective(word);
  if (directive) {
    return markdownHover(renderDirectiveDocs(directive));
  }
  return null;
}

/**
 * Builds completion items for instructions, directives, and in-scope symbols.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} architecture The active architecture name.
 * @returns {CompletionItem[]} The completion items.
 */
export function completionsFor(index: WorkspaceIndex, architecture: string): CompletionItem[] {
  const items: CompletionItem[] = buildCompletionEntries(architecture).map((entry) => ({
    label: entry.label,
    kind: entry.kind === "instruction" ? CompletionItemKind.Keyword : CompletionItemKind.Function,
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

/**
 * Builds signature help for the instruction or directive starting the line.
 * @param {string} lineText The current line text up to the cursor.
 * @param {string} architecture The active architecture name.
 * @returns {SignatureHelp | null} The signature help, or null.
 */
export function signatureHelpFor(lineText: string, architecture: string): SignatureHelp | null {
  const leading = lineText.trim().split(/\s+/)[0];
  if (!leading) {
    return null;
  }

  const instruction = findInstruction(leading, architecture);
  if (instruction) {
    const signatures = instruction.modes.map((mode) => SignatureInformation.create(
      `${instruction.mnemonic} ${mode.syntax}`.trim(),
      `${mode.mode}${instruction.summary ? ` — ${instruction.summary}` : ""}`,
    ));
    return { signatures, activeSignature: 0, activeParameter: 0 };
  }

  const directive = findDirective(leading);
  if (directive) {
    return {
      signatures: [SignatureInformation.create(directive.syntax, directive.summary)],
      activeSignature: 0,
      activeParameter: 0,
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
 */
export function prepareRenameFor(index: WorkspaceIndex, file: string, position: Position): Range | null {
  const word = cursorWord(index, file, position);
  const reference = cursorReference(index, file, position, word);
  if (reference) {
    return referenceRange(index, reference);
  }
  const symbol = cursorSymbol(index, file, position, word);
  if (symbol) {
    return definitionRange(index, symbol);
  }
  return null;
}

/**
 * Builds a workspace edit renaming the identifier at a position across files.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @param {string} newName The replacement name.
 * @returns {WorkspaceEdit | null} The workspace edit, or null when nothing to rename.
 */
export function renameEditsFor(
  index: WorkspaceIndex,
  file: string,
  position: Position,
  newName: string,
): WorkspaceEdit | null {
  const name = identifierNameAt(index, file, position);
  if (!name) {
    return null;
  }

  const editsByUri = new Map<string, TextEdit[]>();
  const pushEdit = (uri: string, range: Range): void => {
    const edits = editsByUri.get(uri) ?? [];
    edits.push(TextEdit.replace(range, newName));
    editsByUri.set(uri, edits);
  };

  for (const symbol of index.getAllSymbols().filter((entry) => entry.name === name)) {
    pushEdit(pathToUri(symbol.location.file), definitionRange(index, symbol));
  }
  for (const reference of findReferences(name, index.getAllReferences())) {
    pushEdit(pathToUri(reference.location.file), referenceRange(index, reference));
  }

  if (editsByUri.size === 0) {
    return null;
  }
  return { changes: Object.fromEntries(editsByUri) };
}

/**
 * Builds semantic tokens for a file from its symbols and references.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @returns {SemanticTokens} The semantic tokens.
 */
export function semanticTokensFor(index: WorkspaceIndex, file: string): SemanticTokens {
  type RawToken = { line: number; char: number; length: number; type: number };
  const tokens: RawToken[] = [];

  const push = (range: Range, type: number): void => {
    if (range.start.line !== range.end.line) {
      return;
    }
    const length = Math.max(range.end.character - range.start.character, 0);
    if (length === 0) {
      return;
    }
    tokens.push({ line: range.start.line, char: range.start.character, length, type });
  };

  for (const symbol of index.getSymbols(file)) {
    push(definitionRange(index, symbol), symbolTokenType(symbol.kind));
  }
  for (const reference of index.getReferences(file)) {
    push(referenceRange(index, reference), referenceTokenType(reference.kind));
  }

  tokens.sort((a, b) => (a.line - b.line) || (a.char - b.char));

  const builder = new SemanticTokensBuilder();
  let previous: RawToken | undefined;
  for (const token of tokens) {
    // Skip duplicates that would produce a zero-delta overlapping token.
    if (previous && previous.line === token.line && previous.char === token.char) {
      continue;
    }
    builder.push(token.line, token.char, token.length, token.type, 0);
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
  const fallback = fallbackRange ? toRange(fallbackRange) : lineFallbackRange(reference.location.line);
  const line = fallbackRange?.start.line ?? reference.location.line;
  return preciseRange(index, reference.location.file, line, reference.name, fallback);
}

/**
 * Converts a symbol definition to an LSP location.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {AssemblySymbolDefinition} symbol The symbol definition.
 * @returns {Location} The LSP location.
 */
function definitionToLocation(index: WorkspaceIndex, symbol: AssemblySymbolDefinition): Location {
  return Location.create(pathToUri(symbol.location.file), definitionRange(index, symbol));
}

/**
 * Resolves the include target name to an included file path using the graph.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The file issuing the include.
 * @param {string} target The include target token.
 * @returns {string | undefined} The resolved included file path.
 */
function resolveIncludeTarget(index: WorkspaceIndex, file: string, target: string): string | undefined {
  const normalizedTarget = target.replace(/\\/g, "/");
  const base = path.basename(normalizedTarget);
  const edges = index.getIncludeEdges().filter((edge) => edge.fromFile === file);
  const match = edges.find((edge) => edge.toFile === normalizedTarget || path.basename(edge.toFile) === base);
  return match?.toFile;
}

/**
 * Returns the identifier name relevant to the position, preferring a matched
 * reference or symbol over a raw word extraction.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {string} file The absolute file path.
 * @param {Position} position The cursor position.
 * @returns {string | undefined} The identifier name.
 */
function identifierNameAt(index: WorkspaceIndex, file: string, position: Position): string | undefined {
  const word = cursorWord(index, file, position);
  const reference = cursorReference(index, file, position, word);
  if (reference) {
    return reference.name;
  }
  const symbol = cursorSymbol(index, file, position, word);
  if (symbol) {
    return symbol.name;
  }
  return word;
}

/**
 * Renders Markdown documentation for a symbol definition.
 * @param {AssemblySymbolDefinition} symbol The symbol definition.
 * @returns {string} The Markdown documentation.
 */
function renderSymbolDocs(symbol: AssemblySymbolDefinition): string {
  const lines = [`**${symbol.name}** — ${symbol.kind}`];
  if (symbol.containerName) {
    lines.push("", `In \`${symbol.containerName}\``);
  }
  if (symbol.value !== undefined) {
    const value = typeof symbol.value === "number" ? `$${symbol.value.toString(16).toUpperCase()}` : symbol.value;
    lines.push("", `Value: \`${value}\``);
  }
  lines.push("", `Defined in \`${path.basename(symbol.location.file)}\``);
  return lines.join("\n");
}

/**
 * Wraps Markdown text in an LSP hover.
 * @param {string} value The Markdown content.
 * @returns {Hover} The hover.
 */
function markdownHover(value: string): Hover {
  return { contents: { kind: MarkupKind.Markdown, value } };
}

/**
 * Maps a symbol kind to a completion item kind.
 * @param {AssemblySymbolKind} kind The symbol kind.
 * @returns {CompletionItemKind} The completion item kind.
 */
function symbolCompletionKind(kind: AssemblySymbolKind): CompletionItemKind {
  switch (kind) {
    case "define":
      return CompletionItemKind.Constant;
    case "macro":
    case "function":
      return CompletionItemKind.Function;
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
 */
function symbolTokenType(kind: AssemblySymbolKind): number {
  switch (kind) {
    case "define":
      return tokenTypeIndex.get("property") ?? 0;
    case "macro":
    case "function":
      return tokenTypeIndex.get("macro") ?? 0;
    case "struct":
      return tokenTypeIndex.get("namespace") ?? 0;
    case "label":
    case "structMember":
    default:
      return tokenTypeIndex.get("variable") ?? 0;
  }
}

/**
 * Maps a reference kind to a semantic token type index.
 * @param {AssemblySymbolReference["kind"]} kind The reference kind.
 * @returns {number} The token type index.
 */
function referenceTokenType(kind: AssemblySymbolReference["kind"]): number {
  switch (kind) {
    case "instruction":
      return tokenTypeIndex.get("function") ?? 0;
    case "define":
      return tokenTypeIndex.get("property") ?? 0;
    case "macro":
      return tokenTypeIndex.get("macro") ?? 0;
    case "function":
      return tokenTypeIndex.get("function") ?? 0;
    case "include":
      return tokenTypeIndex.get("string") ?? 0;
    case "label":
    case "unknown":
    default:
      return tokenTypeIndex.get("variable") ?? 0;
  }
}
