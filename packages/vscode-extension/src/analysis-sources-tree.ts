/** Lazy, read-only source attribution in the assembly sidebar. */
import * as path from "node:path";

import type {
  AnalysisEvidenceSource,
  AnalysisProjectManifest,
  AnalysisSourceSummary,
  AnalysisSourceEntry,
  AnalysisSourceGroup,
} from "@uttori/asm-disassembler";
import {
  EventEmitter,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  type TreeDataProvider,
  type Command,
} from "vscode";

import type { AnalysisGraphNavigationTarget } from "./analysis-graph-tree.js";
import type { AnalysisSourceCatalogProjection } from "./analysis-sources-data.js";
import { analysisWorker } from "./analysis-worker-client.js";
import { findAnalysisProjectDirectories } from "./coverage-tree.js";

const count = (value: number): string => value.toLocaleString("en-US");
const PAGE_SIZE = 200;
interface SourceTarget {
  readonly directory: string;
  readonly source: AnalysisEvidenceSource;
}
export interface AnalysisSourcesTreeNode {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tooltip?: string;
  readonly icon: string;
  readonly load?: () => Promise<AnalysisSourcesTreeNode[]> | AnalysisSourcesTreeNode[];
  readonly command?: Command;
  readonly sourceTarget?: SourceTarget;
}

/** Source metadata loads immediately; SQL counts and result pages stay in the analysis process. */
export class AnalysisSourcesProvider implements TreeDataProvider<AnalysisSourcesTreeNode> {
  static readonly viewId = "uttori-asm.sources";
  readonly #changed = new EventEmitter<AnalysisSourcesTreeNode | undefined | void>();
  readonly onDidChangeTreeData = this.#changed.event;
  readonly #children = new Map<string, Promise<AnalysisSourcesTreeNode[]>>();
  #epoch = 0;

  dispose(): void {
    this.#changed.dispose();
  }

  refresh(): void {
    this.#epoch++;
    this.#children.clear();
    this.#changed.fire();
  }

  getTreeItem(element: AnalysisSourcesTreeNode): TreeItem {
    const item = new TreeItem(
      element.label,
      element.load ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None,
    );
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip ?? element.label;
    item.iconPath = new ThemeIcon(element.icon);
    item.contextValue = element.sourceTarget ? "analysisSource" : "analysisSourceEntry";
    item.command = element.command;
    return item;
  }

  async getChildren(element?: AnalysisSourcesTreeNode): Promise<AnalysisSourcesTreeNode[]> {
    const id = element?.id ?? "root";
    let pending = this.#children.get(id);
    if (!pending) {
      const epoch = this.#epoch;
      pending = Promise.resolve()
        .then(() => (element ? (element.load?.() ?? []) : this.#roots()))
        .then(
          (children) => (epoch === this.#epoch ? children : []),
          (error: unknown) => {
            this.#children.delete(id);
            return epoch === this.#epoch
              ? [
                  {
                    id: `${id}:error`,
                    label: "Could not load sources — expand to retry",
                    icon: "error",
                    tooltip: String(error),
                  },
                ]
              : [];
          },
        );
      this.#children.set(id, pending);
    }
    return pending;
  }

  #sourceKey(target: SourceTarget): string {
    return JSON.stringify([target.directory, target.source.id]);
  }

  async #roots(): Promise<AnalysisSourcesTreeNode[]> {
    const directories = await findAnalysisProjectDirectories();
    const groups = await Promise.all(
      directories.map(async (directory): Promise<AnalysisSourcesTreeNode> => {
        try {
          const catalog = await analysisWorker().request<AnalysisSourceCatalogProjection>(
            directory,
            "sources",
          );
          return {
            id: directory,
            label: path.basename(directory),
            description: `${count(catalog.sources.length)} sources`,
            tooltip: directory,
            icon: "database",
            load: () => this.#sourceNodes(directory, catalog),
          };
        } catch (error) {
          return {
            id: `${directory}:error`,
            label: path.basename(directory),
            description: "could not read sources",
            icon: "error",
            tooltip: `${directory}\n${String(error)}`,
          };
        }
      }),
    );
    return groups.length === 1 && groups[0].load ? groups[0].load() : groups;
  }

  #sourceNodes(
    directory: string,
    catalog: AnalysisSourceCatalogProjection,
  ): AnalysisSourcesTreeNode[] {
    const artifacts = catalog.sources.filter((source) => source.sha256);
    const producers = catalog.sources.filter((source) => !source.sha256);
    const nameCounts = new Map<string, number>();
    for (const source of catalog.sources)
      nameCounts.set(source.name, (nameCounts.get(source.name) ?? 0) + 1);
    const node = (source: AnalysisEvidenceSource): AnalysisSourcesTreeNode => {
      const target = { directory, source };
      const warnings = source.reports.some(
        (report) => report.warnings.length || report.unsupported.length,
      );
      let icon = source.sha256 ? "file" : "symbol-event";
      if (source.kinds.includes("runtime")) icon = "pulse";
      return {
        id: this.#sourceKey(target),
        label: source.name,
        description: [
          source.kinds.includes("runtime") ? "trace" : source.kinds.join(" / ") || "import",
          (nameCounts.get(source.name) ?? 0) > 1 ? source.sha256?.slice(0, 12) : "",
          warnings ? "capture notes" : "",
        ]
          .filter(Boolean)
          .join(" · "),
        tooltip: [
          source.name,
          source.format,
          source.sha256,
          source.lastImportedAt === undefined
            ? undefined
            : `Last imported: ${new Date(source.lastImportedAt).toISOString()}`,
          directory,
        ]
          .filter(Boolean)
          .join("\n"),
        icon,
        sourceTarget: target,
        load: () => this.#sourceChildren(target),
      };
    };
    const roots = this.#localPages(`${directory}:artifacts`, artifacts.map(node));
    if (producers.length)
      roots.push({
        id: `${directory}:producers`,
        label: "Other evidence",
        description: `${count(producers.length)} producers`,
        tooltip: "Manual edits, detectors and static-analysis producers",
        icon: "symbol-event",
        load: () => this.#localPages(`${directory}:producers`, producers.map(node)),
      });
    if (!roots.length)
      roots.push({ id: `${directory}:empty`, label: "No imported sources yet", icon: "info" });
    return roots;
  }

  #localPages(id: string, entries: AnalysisSourcesTreeNode[]): AnalysisSourcesTreeNode[] {
    if (entries.length <= PAGE_SIZE) return entries;
    let stride = PAGE_SIZE;
    while (Math.ceil(entries.length / stride) > PAGE_SIZE) stride *= PAGE_SIZE;
    const pages: AnalysisSourcesTreeNode[] = [];
    for (let start = 0; start < entries.length; start += stride) {
      const slice = entries.slice(start, start + stride);
      const pageId = `${id}:${start}`;
      pages.push({
        id: pageId,
        label: `${count(start + 1)}–${count(start + slice.length)}`,
        icon: "list-selection",
        load: () => this.#localPages(pageId, slice),
      });
    }
    return pages;
  }

  async #sourceChildren(target: SourceTarget): Promise<AnalysisSourcesTreeNode[]> {
    const id = this.#sourceKey(target);
    const { manifest, summary } = await analysisWorker().request<{
      manifest: AnalysisProjectManifest;
      summary: AnalysisSourceSummary;
    }>(target.directory, "sourceSummary", { sourceId: target.source.id });
    const children: AnalysisSourcesTreeNode[] = [];
    const group = (
      name: AnalysisSourceGroup,
      label: string,
      total: number,
      icon: string,
      description = count(total),
      tooltip?: string,
    ): void => {
      children.push({
        id: `${id}:${name}`,
        label,
        description,
        tooltip,
        icon,
        ...(total ? { load: () => this.#pages(target, manifest, name, 0, total) } : {}),
      });
    };
    group(
      "instructions",
      "Observed instructions",
      summary.instructionCount,
      "list-flat",
      count(summary.instructionCount),
      "Directly captured instruction addresses, qualified by architecture and address space. No capture subtraction or static-provenance inference.",
    );
    group(
      "memory",
      "Memory observations",
      summary.memoryCount,
      "references",
      count(summary.memoryCount),
      "Persisted memory records, including distinct value/state variants. Expand to page through the records.",
    );
    group(
      "contributions",
      "Attributed metadata",
      summary.contributionCount,
      "note",
      count(summary.contributionCount),
      "Labels, comments, classifications and regions carrying this source's evidence.",
    );
    const details = [
      ...summary.source.reports.flatMap((report) =>
        Object.entries(report.imported).map(
          ([field, value]) => `${report.sourceName}: ${count(value)} ${field} imported`,
        ),
      ),
      ...summary.source.reports.flatMap((report) => [
        ...report.warnings,
        ...report.unsupported.map((loss) => `${loss.field}: ${loss.reason} (${loss.count})`),
      ]),
    ];
    children.push({
      id: `${id}:notes`,
      label: "Capture notes & interpretation",
      description: count(details.length),
      icon: "info",
      load: () =>
        this.#localPages(
          `${id}:notes`,
          details.map((text, index) => ({
            id: `${id}:note:${index}`,
            label: text,
            tooltip: text,
            icon: "info",
          })),
        ),
    });
    return children;
  }

  async #pages(
    target: SourceTarget,
    manifest: AnalysisProjectManifest,
    group: AnalysisSourceGroup,
    start: number,
    total: number,
  ): Promise<AnalysisSourcesTreeNode[]> {
    const id = `${this.#sourceKey(target)}:${group}`;
    if (total <= PAGE_SIZE) {
      const entries = await analysisWorker().request<AnalysisSourceEntry[]>(
        target.directory,
        "sourceEntries",
        { sourceId: target.source.id, sourceGroup: group, offset: start },
      );
      return entries.map((entry) => {
        const navigation: AnalysisGraphNavigationTarget | undefined =
          entry.address !== undefined && entry.addressSpace
            ? {
                projectDirectory: target.directory,
                target: manifest.target,
                romContentSha256: manifest.rom.contentSha256,
                romContentSize: manifest.rom.contentSize,
                addressSpace: entry.addressSpace,
                address: entry.address,
                outputOffsets: entry.outputOffsets,
                architectureHints: entry.architecture ? [entry.architecture] : [],
                recordIds: entry.recordIds,
              }
            : undefined;
        return {
          id: `${id}:${entry.id}`,
          label: entry.label,
          description: entry.description,
          tooltip: entry.detail,
          icon: "location",
          ...(navigation
            ? {
                command: {
                  command: "asm.analysis.navigate",
                  title: "Open source or disassembly",
                  arguments: [navigation],
                },
              }
            : {}),
        };
      });
    }
    let stride = PAGE_SIZE;
    while (Math.ceil(total / stride) > PAGE_SIZE) stride *= PAGE_SIZE;
    const pages: AnalysisSourcesTreeNode[] = [];
    for (let offset = 0; offset < total; offset += stride) {
      const from = start + offset;
      const size = Math.min(stride, total - offset);
      pages.push({
        id: `${id}:page:${from}`,
        label: `${count(from + 1)}–${count(from + size)}`,
        description: `${count(size)} items`,
        icon: "list-selection",
        load: () => this.#pages(target, manifest, group, from, size),
      });
    }
    return pages;
  }
}
