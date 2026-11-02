import {
  EventEmitter,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  type Disposable,
  type TreeDataProvider,
} from "vscode";

import type { ProjectPanelProvider } from "./panel.js";

/** Stable grouped totals for native rows, independent of the editor locale. */
const count = (value: number): string => value.toLocaleString("en-US");

/** Index facts share the settings panel's server snapshot, without duplicating project settings. */
type IndexSnapshot = Awaited<ReturnType<ProjectPanelProvider["snapshot"]>>;

/** Native index row; error totals open VS Code's actionable Problems view. */
interface IndexRow {
  readonly label: string;
  readonly description: string;
  readonly tooltip?: string;
  readonly problems?: boolean;
}

/** Flat native view refreshed by language-server index notifications and configuration changes. */
export class IndexDetailsProvider implements TreeDataProvider<IndexRow>, Disposable {
  /** Registered tree view id for index detail totals. */
  static readonly viewId = "uttori-asm.indexDetails";
  readonly #changed = new EventEmitter<IndexRow | undefined | void>();
  /** Fired when index snapshot totals change. */
  readonly onDidChangeTreeData = this.#changed.event;

  constructor(private readonly snapshot: () => Promise<IndexSnapshot>) {}

  /** Request a fresh index snapshot on the next getChildren call. */
  refresh(): void {
    this.#changed.fire();
  }

  /** Release the change emitter when the provider is torn down. */
  dispose(): void {
    this.#changed.dispose();
  }

  /** Map an index totals row into VS Code tree presentation state. */
  getTreeItem(row: IndexRow): TreeItem {
    const item = new TreeItem(row.label, TreeItemCollapsibleState.None);
    item.id = row.label;
    item.description = row.description;
    item.tooltip = row.tooltip ?? `${row.label}: ${row.description}`;
    if (row.problems) {
      item.iconPath = new ThemeIcon("error");
      item.command = { command: "workbench.actions.view.problems", title: "Show Problems" };
    }
    return item;
  }

  /** Build flat index total rows from the latest language-server snapshot. */
  async getChildren(): Promise<IndexRow[]> {
    const { status, indexReady } = await this.snapshot();
    // Missing server data must remain visibly unavailable rather than implying a clean index.
    if (!indexReady) {
      return [{ label: "Index", description: "Waiting for source index" }];
    }
    return [
      { label: "Index", description: "Ready" },
      { label: "Files", description: count(status.fileCount) },
      { label: "Symbols", description: count(status.symbolCount) },
      { label: "References", description: count(status.referenceCount) },
      {
        label: "Errors",
        description: count(status.errorCount),
        tooltip: "Current assembly and configuration errors. Click to open Problems.",
        problems: true,
      },
      {
        label: "Last reindex",
        description:
          status.lastReindexDurationMs == null ? "—" : `${status.lastReindexDurationMs} ms`,
      },
      {
        label: "Roots",
        description: `${count(status.lastReindexRootCount)} (${count(status.lastReindexCachedRoots)} cached, ${count(status.lastReindexAnalyzedRoots)} analyzed)`,
      },
    ];
  }
}
