import type { ProjectOutlineKind, ProjectOutlineNode } from "@uttori/asm-core/tooling";
/**
 * Native TreeView of the workspace include graph and per-file outline.
 * @see https://code.visualstudio.com/api/extension-guides/tree-view
 */
import {
  EventEmitter,
  Range,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  type Event,
  type TreeDataProvider,
} from "vscode";
import type { DocumentSymbol, LanguageClient } from "vscode-languageclient/node";
import { SymbolKind } from "vscode-languageserver-types";

/**
 * Outline row joining include-graph nodes with document symbols; source ranges use zero-based
 * LSP/VS Code coordinates.
 */
type OutlineItem = {
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  collapsible: boolean;
  icon: ThemeIcon;
  uri?: string;
  range?: { start: { line: number; character: number }; end: { line: number; character: number } };
  children?: OutlineItem[];
  /** File URI used to lazy-load document symbols. */
  symbolUri?: string;
  includeChildren?: ProjectOutlineNode[];
};

/**
 * Tree data provider for the Uttori Assembly project outline.
 * @see https://code.visualstudio.com/api/references/vscode-api#TreeDataProvider
 * @see https://code.visualstudio.com/api/extension-guides/tree-view
 */
export class ProjectOutlineProvider implements TreeDataProvider<OutlineItem> {
  /** Registered tree view id for the project outline sidebar. */
  static readonly viewId = "uttori-asm.projectOutline";

  readonly #onDidChangeTreeData = new EventEmitter<OutlineItem | undefined | null | void>();
  /** Fired when include graph or symbol caches should reload. */
  readonly onDidChangeTreeData: Event<OutlineItem | undefined | null | void> =
    this.#onDidChangeTreeData.event;

  constructor(private readonly getClient: () => LanguageClient | undefined) {}

  /** Invalidate cached roots and notify the tree to reload. */
  refresh(): void {
    this.#onDidChangeTreeData.fire();
  }

  /** Map an outline row into VS Code tree presentation state. */
  getTreeItem(element: OutlineItem): TreeItem {
    const item = new TreeItem(
      element.label,
      element.collapsible ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
    );
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip ?? element.label;
    item.iconPath = element.icon;
    item.contextValue = element.symbolUri ? "file" : "symbol";
    if (element.uri) {
      const uri = Uri.parse(element.uri);
      item.resourceUri = uri;
      item.command = {
        command: "vscode.open",
        title: "Open",
        arguments: element.range
          ? [
              uri,
              {
                selection: new Range(
                  element.range.start.line,
                  element.range.start.character,
                  element.range.end.line,
                  element.range.end.character,
                ),
              },
            ]
          : [uri],
      };
    }
    return item;
  }

  /** Resolve include-graph children or lazy document symbols for one row. */
  async getChildren(element?: OutlineItem): Promise<OutlineItem[]> {
    if (!element) {
      return this.loadRoots();
    }
    if (element.symbolUri) {
      const symbols = await this.loadSymbols(element.symbolUri, element.id);
      const includes = (element.includeChildren ?? []).map((node) => this.toItem(node));
      return [...symbols, ...includes];
    }
    return element.children ?? [];
  }

  /** Fetch top-level include graph nodes from the language client. */
  async loadRoots(): Promise<OutlineItem[]> {
    const client = this.getClient();
    if (!client) {
      return [];
    }
    try {
      const nodes = await client.sendRequest<ProjectOutlineNode[]>("asm/projectOutline");
      return nodes.map((node) => this.toItem(node));
    } catch {
      return [];
    }
  }

  /** Convert a tooling outline node into a tree row model. */
  toItem(node: ProjectOutlineNode): OutlineItem {
    const isFile = node.kind === "file";
    return {
      id: node.id,
      label: node.label,
      description: node.detail,
      tooltip: node.uri ? `${node.label}${node.detail ? ` — ${node.detail}` : ""}` : node.label,
      collapsible: node.kind === "entry" || node.kind === "orphanGroup" || isFile,
      icon: iconForKind(node.kind),
      uri: node.uri,
      ...(isFile
        ? { symbolUri: node.uri, includeChildren: node.children ?? [] }
        : { children: (node.children ?? []).map((child) => this.toItem(child)) }),
    };
  }

  /** Load document symbols for one file URI under a stable parent id. */
  async loadSymbols(uri: string, parentId: string): Promise<OutlineItem[]> {
    const client = this.getClient();
    if (!client) {
      return [];
    }
    try {
      const symbols = await client.sendRequest<DocumentSymbol[]>("textDocument/documentSymbol", {
        textDocument: { uri },
      });
      return symbols.map((symbol, index) => symbolToItem(symbol, uri, `${parentId}:${index}`));
    } catch {
      return [];
    }
  }
}

/**
 * Recursively convert LSP document symbols to outline rows, preferring the symbol selection
 * range and deriving stable hierarchical IDs.
 * @param symbol LSP symbol with zero-based source ranges.
 * @param uri Owning document URI string.
 * @param id Hierarchical identity derived from parent and sibling index.
 * @returns Outline subtree preserving symbol selection ranges.
 */
function symbolToItem(symbol: DocumentSymbol, uri: string, id: string): OutlineItem {
  const range = symbol.selectionRange;
  const children = (symbol.children ?? []).map((child, index) =>
    symbolToItem(child, uri, `${id}:${index}`),
  );
  return {
    id,
    label: symbol.name,
    description: symbol.detail,
    collapsible: children.length > 0,
    icon: iconForSymbolKind(symbol.kind),
    uri,
    range,
    children,
  };
}

/**
 * Choose a theme-aware built-in icon for each include-graph role, with a file icon as the
 * fallback.
 * @param kind Include-graph node role.
 * @returns Theme icon for the role, falling back to file.
 * @see https://code.visualstudio.com/api/references/vscode-api#ThemeIcon
 * @see https://code.visualstudio.com/api/references/icons-in-labels
 */
function iconForKind(kind: ProjectOutlineKind): ThemeIcon {
  switch (kind) {
    case "entry":
      return new ThemeIcon("folder-library");
    case "orphanGroup":
      return new ThemeIcon("folder");
    case "include":
      return new ThemeIcon("link");
    case "file":
    default:
      return new ThemeIcon("file");
  }
}

/**
 * Map LSP symbol kinds to theme-aware built-in icons, using symbol-misc for unrecognized kinds.
 * @param kind LSP SymbolKind numeric value.
 * @returns Matching symbol icon or symbol-misc for other kinds.
 * @see https://code.visualstudio.com/api/references/vscode-api#ThemeIcon
 * @see https://code.visualstudio.com/api/references/icons-in-labels
 */
function iconForSymbolKind(kind: number): ThemeIcon {
  switch (kind) {
    case SymbolKind.Namespace:
      return new ThemeIcon("symbol-namespace");
    case SymbolKind.Function:
      return new ThemeIcon("symbol-method");
    case SymbolKind.Constant:
      return new ThemeIcon("symbol-constant");
    case SymbolKind.Struct:
      return new ThemeIcon("symbol-struct");
    case SymbolKind.Field:
      return new ThemeIcon("symbol-field");
    case SymbolKind.Variable:
      return new ThemeIcon("symbol-variable");
    default:
      return new ThemeIcon("symbol-misc");
  }
}
