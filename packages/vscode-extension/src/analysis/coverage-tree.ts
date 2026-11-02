/** Build conversion progress from the last successful source build. */
import * as path from "node:path";

import {
  EventEmitter,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  workspace,
  type Command,
  type Event,
  type Disposable,
  type TreeDataProvider,
} from "vscode";

import {
  readBuildCoverage,
  checkBuildCoverageFreshness,
  type BuildCoverageFreshness,
} from "./build-coverage.js";
import { ANALYSIS_PROJECT_EXCLUDE, selectedAnalysisSourceRoot } from "./project-discovery.js";

/** Materialized build-summary rows never request native analysis or runtime records. */
type CoverageTreeNode = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tooltip?: string;
  readonly icon: string;
  readonly state: TreeItemCollapsibleState;
  readonly children?: readonly CoverageTreeNode[];
  readonly command?: Command;
};

/**
 * Format an exact byte count with stable English grouping and singular/plural units.
 * @param bytes Exact ROM-content byte count.
 * @returns Grouped decimal count with the correct byte unit.
 */
const formatBytes = (bytes: number): string =>
  `${bytes.toLocaleString("en-US")} byte${bytes === 1 ? "" : "s"}`;

/**
 * Format a coverage ratio to two decimal places; an empty ROM reports 0.00%.
 * @param bytes Bytes in the reported category.
 * @param total Total ROM-content bytes.
 * @returns Percentage to two decimals, or 0.00% for an empty total.
 */
const percentage = (bytes: number, total: number): string =>
  total === 0 ? "0.00%" : `${((bytes / total) * 100).toFixed(2)}%`;

/**
 * Create a non-expandable build-summary row with a stable identity.
 * @param id Stable tree-row identity.
 * @param label Primary tree text.
 * @param description Secondary count or status text.
 * @param icon Product icon ID.
 * @returns Non-expandable coverage row.
 */
const leaf = (id: string, label: string, description: string, icon: string): CoverageTreeNode => ({
  id,
  label,
  description,
  icon,
  state: TreeItemCollapsibleState.None,
});

/**
 * Create a coverage leaf showing both the exact byte count and its share of ROM content.
 * @param projectId Project-specific row ID prefix.
 * @param label Coverage category.
 * @param bytes Bytes in this category.
 * @param total ROM-content byte count used as denominator.
 * @param icon Product icon ID for the category.
 * @returns Summary leaf containing byte and percentage totals.
 */
const summaryNode = (
  projectId: string,
  label: string,
  bytes: number,
  total: number,
  icon: string,
): CoverageTreeNode =>
  leaf(
    `${projectId}:summary:${label}`,
    label,
    `${formatBytes(bytes)} · ${percentage(bytes, total)}`,
    icon,
  );

/** Displays saved build progress and tracks freshness without opening analysis databases. */
export class AnalysisCoverageProvider implements TreeDataProvider<CoverageTreeNode>, Disposable {
  /** Exact in-session draft/build state overrides the slower saved-file verification. */
  constructor(readonly staleBuild?: (root: string, inputSha256: string) => boolean | undefined) {}

  readonly #freshness = new Map<string, BuildCoverageFreshness>();
  #revision = 0;
  #disposed = false;
  readonly #sourceRoots = new Set<string>();
  #inputTimer?: ReturnType<typeof setTimeout>;

  /** Stop timers and dispose change events when the provider is torn down. */
  dispose(): void {
    this.#disposed = true;
    clearTimeout(this.#inputTimer);
    this.#revision++;
    this.#freshness.clear();
    this.#onDidChangeTreeData.dispose();
  }
  /** Registered tree view id for build coverage summaries. */
  static readonly viewId = "uttori-asm.analysisCoverage";

  readonly #onDidChangeTreeData = new EventEmitter<CoverageTreeNode | undefined | null | void>();
  /** Fired when coverage freshness maps are cleared after refresh. */
  readonly onDidChangeTreeData: Event<CoverageTreeNode | undefined | null | void> =
    this.#onDidChangeTreeData.event;

  /** External writes also invalidate persisted checks for source projects not currently selected. */
  inputChanged(uri: Uri): void {
    if (uri.scheme !== "file") {
      return;
    }
    for (const root of this.#sourceRoots) {
      const relative = path.relative(root, uri.fsPath);
      if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        continue;
      }
      // Build publication and Git internals are not source inputs. Summary changes have their
      // own watcher; listening to every cache output would repeatedly restart verification.
      const first = relative.split(path.sep)[0];
      if (first === ".git" || first === ".uttori-local") {
        continue;
      }
      clearTimeout(this.#inputTimer);
      this.#inputTimer = setTimeout(() => this.refresh(), 150);
      break;
    }
  }

  /** Bump revision and drop cached freshness before reloading projects. */
  refresh(): void {
    this.#revision++;
    this.#freshness.clear();
    this.#onDidChangeTreeData.fire();
  }

  /** Map a coverage node into VS Code tree presentation state. */
  getTreeItem(element: CoverageTreeNode): TreeItem {
    const item = new TreeItem(element.label, element.state);
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip ?? element.label;
    item.iconPath = new ThemeIcon(element.icon);
    item.command = element.command;
    return item;
  }

  /** Return project roots or the static children attached to one node. */
  async getChildren(element?: CoverageTreeNode): Promise<CoverageTreeNode[]> {
    if (!element) {
      return this.loadProjects();
    }
    return [...(element.children ?? [])];
  }

  /** Saved counts render independently of the asynchronous dependency verification. */
  private async buildProject(root: string): Promise<CoverageTreeNode> {
    const id = `source-coverage:${root}`;
    const children: CoverageTreeNode[] = [];
    let description = "Build Current Source to measure remaining bytes";
    let tooltip = root;
    let icon = "pie-chart";
    try {
      const snapshot = await readBuildCoverage(root);
      if (snapshot?.summary.coverage) {
        const { summary, builtAt } = snapshot;
        const coverage = summary.coverage!;
        const key = `${root}:${summary.inputSha256}`;
        let freshness = this.#freshness.get(key);
        const stale = this.staleBuild?.(root, summary.inputSha256);
        if (stale !== undefined) {
          freshness = {
            status: stale ? "stale" : "current",
            reason: stale
              ? "Source or asset edits have not been built. Build Current Source to update coverage."
              : "Current source matches this successful build.",
          };
        } else if (!freshness) {
          freshness = {
            status: "checking",
            reason: "Checking saved source and assets in the background.",
          };
          this.#freshness.set(key, freshness);
          const revision = this.#revision;
          // The count is already available. Verification cannot hold the tree behind large source reads.
          void checkBuildCoverageFreshness(root, summary).then((checked) => {
            if (!this.#disposed && revision === this.#revision) {
              this.#freshness.set(key, checked);
              this.#onDidChangeTreeData.fire();
            }
            return undefined;
          });
        }
        const freshnessLabels = {
          current: "current",
          stale: "stale",
          checking: "checking saved inputs",
          unknown: "freshness unverified",
        };
        const status = freshnessLabels[freshness.status];
        description = `${formatBytes(coverage.remainingBytes)} remaining · ${percentage(coverage.remainingBytes, coverage.totalBytes)} · ${status}`;
        tooltip = `${root}\n${freshness.reason}`;
        if (freshness.status === "stale" || freshness.status === "unknown") {
          icon = "warning";
        }
        children.push(
          summaryNode(
            id,
            "Bytes remaining",
            coverage.remainingBytes,
            coverage.totalBytes,
            "question",
          ),
          summaryNode(id, "Converted", coverage.convertedBytes, coverage.totalBytes, "pass"),
          leaf(`${id}:total`, "Original ROM", formatBytes(coverage.totalBytes), "file-binary"),
          {
            ...leaf(
              `${id}:build`,
              "Last successful build",
              `${new Date(builtAt).toLocaleString()} · ${status}`,
              "history",
            ),
            tooltip: freshness.reason,
          },
        );
      }
    } catch (error) {
      description = "Build summary unavailable";
      tooltip = `${root}\n${String(error)}`;
      icon = "warning";
    }
    children.push({
      ...leaf(`${id}:rebuild`, "Build Current Source", "Update conversion progress", "tools"),
      command: {
        command: "asm.source.buildProject",
        title: "Build Current Source",
        arguments: [Uri.file(root)],
      },
    });
    return {
      id,
      label: path.basename(root),
      description,
      tooltip,
      icon,
      state: TreeItemCollapsibleState.Collapsed,
      children,
    };
  }

  private async loadProjects(): Promise<CoverageTreeNode[]> {
    const selected = selectedAnalysisSourceRoot();
    this.#sourceRoots.clear();
    if (selected) {
      this.#sourceRoots.add(selected);
      return [await this.buildProject(selected)];
    }
    const configurations = await workspace.findFiles(
      "**/.uttori/project.json",
      ANALYSIS_PROJECT_EXCLUDE,
      32,
    );
    const roots = [
      ...new Set(
        configurations
          .filter(
            ({ scheme, fsPath }) =>
              scheme === "file" && fsPath.endsWith(`${path.sep}.uttori${path.sep}project.json`),
          )
          .map(({ fsPath }) => path.dirname(path.dirname(fsPath))),
      ),
    ].toSorted();
    if (roots.length) {
      for (const root of roots) {
        this.#sourceRoots.add(root);
      }
      return Promise.all(roots.map((root) => this.buildProject(root)));
    }
    return [];
  }
}
