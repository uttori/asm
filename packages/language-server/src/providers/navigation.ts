/**
 * Converts core analysis snapshots and current source text into LSP response payloads.
 * File arguments are filesystem paths; protocol positions/ranges use zero-based UTF-16 columns.
 * Providers repair normalized analysis spans against raw editor text without rebuilding the index.
 */

import type {
  AssemblySymbolDefinition,
  AssemblySymbolReference,
  ParsedAssetCall,
} from "@uttori/asm-core";
import type { WorkspaceIndex } from "@uttori/asm-core/tooling";
import {
  Location,
  LocationLink,
  Position,
  Range,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver";

import { locationRange, resolveDefinition, findReferences } from "../core.js";
import {
  assetSpanContains,
  assetOption,
  lineAt,
  splitLines,
  unquotedIncludePathAt,
  findTokenColumn,
  assetCallAt,
  resolveIncludeTarget,
  pathToUri,
  cursorWord,
  cursorReference,
  cursorSymbol,
  lookupNameFor,
  namesMatch,
  referenceRange,
  toRange,
  lineFallbackRange,
  preciseRange,
  definitionRange,
} from "./spans.js";

/** Path or palette path under the cursor, excluding the reserved `embedded` and `auto` tokens. */
export function assetPathAt(call: ParsedAssetCall, character: number): string | undefined {
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
 * Computes the origin highlight range for an include path on the cursor line,
 * covering the full unquoted filename (including hyphens) or quoted string.
 * @param index The workspace index.
 * @param file The absolute file path.
 * @param position The cursor position.
 * @param target The include target.
 * @returns The origin highlight range, or undefined.
 */
export function includeOriginRange(
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
 * Resolves the definition locations for the symbol or reference at a position.
 * Returns `LocationLink[]` for include references so VS Code highlights the
 * full filename (including hyphens) rather than just the word at the cursor.
 * @param index The workspace index.
 * @param file The absolute file path.
 * @param position The cursor position.
 * @returns The definition locations.
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
 * @param index The workspace index.
 * @param file The absolute file path.
 * @param position The cursor position.
 * @param includeDeclaration Whether to include the declaration.
 * @returns The reference locations.
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
 * Returns the rename range for the identifier at a position.
 * @param index The workspace index.
 * @param file The absolute file path.
 * @param position The cursor position.
 * @returns The identifier range, or null when rename is unavailable.
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
 * @param index The workspace index.
 * @param file The absolute file path.
 * @param position The cursor position.
 * @param newName Replacement identifier; a leading ! is removed for define renames only.
 * @returns The workspace edit, or null when nothing to rename.
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
   * @param uri Document URI owning the occurrence.
   * @param range Bare identifier range that preserves any source sigil.
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
export type RenameTarget = {
  /** Selected declaration, either under the cursor or uniquely resolved from a reference. */
  symbol?: AssemblySymbolDefinition;
  /** Renameable reference retained when it does not resolve to exactly one declaration. */
  reference?: AssemblySymbolReference;
};

/**
 * Resolves a renameable definition or reference at the cursor. Instruction,
 * include, and unknown tokens are deliberately excluded.
 * @param index The workspace index.
 * @param file The absolute file path.
 * @param position The cursor position.
 * @returns The selected rename target, if any.
 */
export function renameTargetAt(
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
 * @param reference The reference to classify.
 * @returns Whether the reference can be renamed.
 */
export function isRenameableReference(reference: AssemblySymbolReference): boolean {
  return (
    reference.kind !== "include" && reference.kind !== "instruction" && reference.kind !== "unknown"
  );
}

/**
 * Returns whether a definition belongs to the selected rename target.
 * @param symbol The definition to compare.
 * @param target The selected rename target.
 * @returns Whether the definition belongs to the target.
 */
export function symbolMatchesRenameTarget(
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
 * @param reference The reference to compare.
 * @param target The selected rename target.
 * @returns Whether the reference belongs to the target.
 */
export function referenceMatchesRenameTarget(
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
 * Precise range covering only the bare identifier, never the define sigil.
 * Used by rename so `!version` becomes `!newname` rather than replacing `!`.
 * @param index The workspace index.
 * @param symbol The symbol definition.
 * @returns The precise range.
 */
export function bareDefinitionRange(
  index: WorkspaceIndex,
  symbol: AssemblySymbolDefinition,
): Range {
  const fallbackRange = locationRange(symbol.location);
  const fallback = fallbackRange ? toRange(fallbackRange) : lineFallbackRange(symbol.location.line);
  const line = fallbackRange?.start.line ?? symbol.location.line;
  return preciseRange(index, symbol.location.file, line, lookupNameFor(symbol.name), fallback);
}

/**
 * Precise range covering only the bare identifier of a reference.
 * @param index The workspace index.
 * @param reference The symbol reference.
 * @returns The precise range.
 */
export function bareReferenceRange(
  index: WorkspaceIndex,
  reference: AssemblySymbolReference,
): Range {
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
 * @param index The workspace index.
 * @param symbol The symbol definition.
 * @returns The LSP location.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#location
 */
export function definitionToLocation(
  index: WorkspaceIndex,
  symbol: AssemblySymbolDefinition,
): Location {
  return Location.create(pathToUri(symbol.location.file), definitionRange(index, symbol));
}

/**
 * Returns the identifier at a position, preferring a matched reference or
 * symbol over a raw word extraction, including container scope.
 * @param index The workspace index.
 * @param file The absolute file path.
 * @param position The cursor position.
 * @returns The identifier.
 */
export function identifierAt(
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
