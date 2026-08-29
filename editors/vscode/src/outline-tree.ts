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
import { SymbolKind } from "vscode-languageclient";

export type ProjectOutlineKind = "entry" | "file" | "include" | "orphanGroup";

export type ProjectOutlineNode = {
  id: string;
  label: string;
  detail?: string;
  kind: ProjectOutlineKind;
  uri?: string;
  children?: ProjectOutlineNode[];
};

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
 */
export class ProjectOutlineProvider implements TreeDataProvider<OutlineItem> {
  static readonly viewId = "uttori-asm.projectOutline";

  readonly #onDidChangeTreeData = new EventEmitter<OutlineItem | undefined | null | void>();
  readonly onDidChangeTreeData: Event<OutlineItem | undefined | null | void> =
    this.#onDidChangeTreeData.event;

  constructor(private readonly getClient: () => LanguageClient | undefined) {}

  refresh(): void {
    this.#onDidChangeTreeData.fire();
  }

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

  async loadRoots(): Promise<OutlineItem[]> {
    const client = this.getClient();
    if (!client) {
      return [];
    }
    try {
      const nodes = await client.sendRequest<ProjectOutlineNode[]>("asm/projectOutline");
      return (nodes ?? []).map((node) => this.toItem(node));
    } catch {
      return [];
    }
  }

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

  async loadSymbols(uri: string, parentId: string): Promise<OutlineItem[]> {
    const client = this.getClient();
    if (!client) {
      return [];
    }
    try {
      const symbols = await client.sendRequest<DocumentSymbol[]>("textDocument/documentSymbol", {
        textDocument: { uri },
      });
      return (symbols ?? []).map((symbol, index) =>
        symbolToItem(symbol, uri, `${parentId}:${index}`),
      );
    } catch {
      return [];
    }
  }
}

function symbolToItem(symbol: DocumentSymbol, uri: string, id: string): OutlineItem {
  const range = symbol.selectionRange ?? symbol.range;
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
