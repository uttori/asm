/**
 * Converts core analysis snapshots and current source text into LSP response payloads.
 * File arguments are filesystem paths; protocol positions/ranges use zero-based UTF-16 columns.
 * Providers repair normalized analysis spans against raw editor text without rebuilding the index.
 */
import fs from "node:fs";
import path from "node:path";

import type { AssemblySymbolDefinition, AssemblySymbolKind } from "@uttori/asm-core";
import type { WorkspaceIndex } from "@uttori/asm-core/tooling";
import {
  CompletionItem,
  CompletionItemKind,
  Hover,
  MarkupKind,
  Position,
  SignatureHelp,
  SignatureInformation,
} from "vscode-languageserver";

import { assetCallOnLine, assetLineAt } from "../asset-language.js";
import {
  findInstruction,
  findDirectiveInCatalog,
  findDirectiveOperand,
  buildCompletionEntries,
  renderInstructionDocs,
  renderDirectiveDocs,
  renderExpressionFunctionDocs,
  locationRange,
  resolveDefinition,
} from "../core.js";
import {
  assetCallAt,
  assetOption,
  assetSpanContains,
  resolveIncludeTarget,
  cursorWord,
  wordAt,
  cursorReference,
  splitLines,
  cursorSymbol,
  lookupNameFor,
  namesMatch,
} from "./spans.js";

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
 * Renders Markdown documentation for a symbol definition, including comment
 * annotations captured from the source.
 * @param {WorkspaceIndex} index The workspace index.
 * @param {AssemblySymbolDefinition} symbol The symbol definition.
 * @returns {string} The Markdown documentation.
 */
export function renderSymbolDocs(index: WorkspaceIndex, symbol: AssemblySymbolDefinition): string {
  const lines = [`**${symbol.name}** - ${symbol.kind}`];
  if (symbol.containerName) {
    lines.push("", `In \`${symbol.containerName}\``);
  }
  if (symbol.relocatable) {
    lines.push(
      "",
      `Section: \`${symbol.relocatable.section} + $${symbol.relocatable.offset.toString(16).toUpperCase()}\` (unlinked)`,
    );
  } else if (symbol.value !== undefined) {
    const value =
      typeof symbol.value === "number"
        ? `$${symbol.value.toString(16).toUpperCase()}`
        : symbol.value;
    lines.push("", `Value: \`${value}\``);
  }
  const annotation = symbolAnnotation(index, symbol);
  if (annotation) {
    // Markdown soft breaks collapse comment lines; hard breaks preserve their source layout.
    lines.push("", annotation.replace(/\n/g, "  \n"));
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
export function symbolAnnotation(
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
  const parts = [...leading];
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
export function lineCommentText(line: string): string | undefined {
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
 * Wraps Markdown text in an LSP hover.
 * @param {string} value The Markdown content.
 * @returns {Hover} The hover.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#hover-request-leftwards_arrow_with_hook
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#markupcontent
 */
export function markdownHover(value: string): Hover {
  return { contents: { kind: MarkupKind.Markdown, value } };
}

/**
 * Maps a symbol kind to a completion item kind.
 * @param {AssemblySymbolKind} kind The symbol kind.
 * @returns {CompletionItemKind} The completion item kind.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#completion-request-leftwards_arrow_with_hook
 */
export function symbolCompletionKind(kind: AssemblySymbolKind): CompletionItemKind {
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
