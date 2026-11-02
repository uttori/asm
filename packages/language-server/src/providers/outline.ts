/**
 * Converts core analysis snapshots and current source text into LSP response payloads.
 * File arguments are filesystem paths; protocol positions/ranges use zero-based UTF-16 columns.
 * Providers repair normalized analysis spans against raw editor text without rebuilding the index.
 */

import path from "node:path";

import type { AssemblySymbolDefinition, AssemblySymbolKind } from "@uttori/asm-core";
import type { ProjectOutlineNode, WorkspaceIndex } from "@uttori/asm-core/tooling";
import { DocumentSymbol, Range, SymbolKind } from "vscode-languageserver";

import { definitionRange, pathToUri } from "./spans.js";

/**
 * Maps an assembler symbol kind to an LSP symbol kind.
 * @param kind The assembler symbol kind.
 * @returns The LSP symbol kind.
 * @see https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#document-symbols-request-leftwards_arrow_with_hook
 */
export function toSymbolKind(kind: AssemblySymbolKind): SymbolKind {
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
 * Builds a nested document outline from container names, deduplicating children recorded twice
 * by analysis and expanding parent ranges to include descendants while preserving selection ranges.
 * @param index The workspace index.
 * @param file The absolute file path.
 * @returns The document symbols.
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
 * @param index The workspace index.
 * @returns Root outline nodes (entries, then orphans).
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
   * @param file Entry or include path, normalized before consulting the shared visited set.
   * @returns A file subtree, or a non-expanding include link for a repeated file.
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
 * Display name for an outline node, stripping namespace/parent prefixes.
 * @param symbol The symbol.
 * @returns The outline label.
 */
export function outlineDisplayName(symbol: AssemblySymbolDefinition): string {
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
 * @param symbol The symbol.
 * @returns The detail string.
 */
export function outlineDetail(symbol: AssemblySymbolDefinition): string {
  if (symbol.relocatable) {
    return `${symbol.kind} ${symbol.relocatable.section}+$${symbol.relocatable.offset.toString(16).toUpperCase()} (unlinked)`;
  }
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
 * @param children The child symbols.
 * @returns The deduplicated children.
 */
export function dedupeOutlineChildren(children: DocumentSymbol[]): DocumentSymbol[] {
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
 * @param symbol Root of the freshly built outline subtree to expand.
 */
export function expandRangeToChildren(symbol: DocumentSymbol): void {
  for (const child of symbol.children ?? []) {
    expandRangeToChildren(child);
    symbol.range = unionRange(symbol.range, child.range);
  }
}

/**
 * Returns a range covering both inputs.
 * @param left The first range.
 * @param right The second range.
 * @returns The union range.
 */
export function unionRange(left: Range, right: Range): Range {
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
