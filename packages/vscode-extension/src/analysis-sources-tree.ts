/** Lazy, read-only source attribution and capture comparisons in the assembly sidebar. */
import * as path from "node:path";

import type {
  AnalysisEvidenceSource,
  AnalysisProjectManifest,
  AnalysisSourceComparison,
  AnalysisSourceEntry,
  AnalysisSourceGroup,
} from "@uttori/asm-disassembler";
import {
  EventEmitter,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  window,
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

/** Source metadata loads immediately; full comparisons and result pages stay in the analysis process. */
export class AnalysisSourcesProvider implements TreeDataProvider<AnalysisSourcesTreeNode> {
  static readonly viewId = "uttori-asm.sources";
  readonly #changed = new EventEmitter<AnalysisSourcesTreeNode | undefined | void>();
  readonly onDidChangeTreeData = this.#changed.event;
  readonly #catalogs = new Map<string, AnalysisSourceCatalogProjection>();
  readonly #children = new Map<string, Promise<AnalysisSourcesTreeNode[]>>();
  readonly #baselines = new Map<string, readonly string[]>();
  #epoch = 0;

  dispose(): void {
    this.#changed.dispose();
  }

  refresh(): void {
    this.#epoch++;
    this.#catalogs.clear();
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

  async compare(element?: unknown): Promise<void> {
    try {
      const target = await this.#selectSource(element);
      if (!target) return;
      const catalog = this.#catalogs.get(target.directory)!;
      const selected = this.#baselines.get(this.#sourceKey(target));
      const choices = catalog.sources.filter(
        (source) => source.id !== target.source.id && source.kinds.includes("runtime"),
      );
      if (!choices.length) {
        await window.showInformationMessage(
          "Import another runtime capture to compare against this source.",
        );
        return;
      }
      const picked = await window.showQuickPick(
        choices.map((source) => ({
          label: source.name,
          description: source.sha256?.slice(0, 12),
          detail: source.format,
          picked: selected === undefined || selected.includes(source.id),
          sourceId: source.id,
        })),
        {
          title: `Compare ${target.source.name}`,
          placeHolder:
            "Subtract instructions seen in these captures. Select none to see all instructions.",
          canPickMany: true,
        },
      );
      if (!picked) return;
      this.#baselines.set(
        this.#sourceKey(target),
        picked.map(({ sourceId }) => sourceId),
      );
      this.refresh();
    } catch (error) {
      await window.showErrorMessage(`Could not compare sources: ${String(error)}`);
    }
  }

  async resetComparison(element?: unknown): Promise<void> {
    const target = await this.#selectSource(element);
    if (!target) return;
    this.#baselines.delete(this.#sourceKey(target));
    this.refresh();
  }

  #sourceKey(target: SourceTarget): string {
    return JSON.stringify([target.directory, target.source.id]);
  }

  async #selectSource(element?: unknown): Promise<SourceTarget | undefined> {
    if (!this.#catalogs.size) await this.getChildren();
    const candidate =
      element && typeof element === "object" && "sourceTarget" in element
        ? (element.sourceTarget as SourceTarget)
        : undefined;
    const targets = [...this.#catalogs].flatMap(([directory, catalog]) =>
      catalog.sources.map((source) => ({ directory, source })),
    );
    if (candidate)
      return targets.find(
        (target) =>
          target.directory === candidate.directory && target.source.id === candidate.source?.id,
      );
    const selected = await window.showQuickPick(
      targets
        .filter(({ source }) => source.kinds.includes("runtime"))
        .map((target) => ({
          label: target.source.name,
          description: target.directory,
          target,
        })),
      { title: "Choose Source", placeHolder: "Choose the capture to inspect" },
    );
    return selected?.target;
  }

  async #roots(): Promise<AnalysisSourcesTreeNode[]> {
    const epoch = this.#epoch;
    const directories = await findAnalysisProjectDirectories();
    const groups = await Promise.all(
      directories.map(async (directory): Promise<AnalysisSourcesTreeNode> => {
        try {
          const catalog = await analysisWorker().request<AnalysisSourceCatalogProjection>(
            directory,
            "sources",
          );
          if (epoch === this.#epoch) this.#catalogs.set(directory, catalog);
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
      const custom = this.#baselines.has(this.#sourceKey(target));
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
          custom ? "custom comparison" : "",
          warnings ? "capture notes" : "",
        ]
          .filter(Boolean)
          .join(" · "),
        tooltip: [source.name, source.format, source.sha256, directory].filter(Boolean).join("\n"),
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
    const baselineIds = this.#baselines.get(id);
    const { manifest, comparison: summary } = await analysisWorker().request<{
      manifest: AnalysisProjectManifest;
      comparison: AnalysisSourceComparison;
    }>(target.directory, "sourceSummary", { sourceId: target.source.id, baselineIds });
    const children: AnalysisSourcesTreeNode[] = [
      {
        id: `${id}:comparison`,
        label: "Compared with",
        description:
          baselineIds === undefined
            ? `${count(summary.baseline.length)} other captures`
            : `${count(summary.baseline.length)} selected captures`,
        tooltip:
          summary.baseline.map(({ name }) => name).join("\n") ||
          "No baseline selected; all observed instructions are shown.",
        icon: "git-compare",
        command: {
          command: "asm.sources.compare",
          title: "Choose comparison captures",
          arguments: [{ sourceTarget: target }],
        },
      },
      {
        id: `${id}:total`,
        label: "Observed instructions",
        description: count(summary.instructionCount),
        tooltip:
          "Distinct captured instruction addresses, qualified by architecture and address space. Execution counts and CPU-state variants do not inflate this total.",
        icon: "list-flat",
      },
    ];
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
        ...(total
          ? { load: () => this.#pages(target, manifest, baselineIds, name, 0, total) }
          : {}),
      });
    };
    group(
      "uniqueInstructions",
      "Unique instructions",
      summary.uniqueInstructionCount,
      "diff-added",
      count(summary.uniqueInstructionCount),
      "Instruction starts captured here and absent from the selected comparison captures.",
    );
    group(
      "codeRanges",
      "Code at unique instructions",
      summary.codeRangeCount,
      "symbol-numeric",
      `${count(summary.knownCodeBytes)} known bytes · ${count(summary.codeRangeCount)} ranges`,
      "Merged known instruction extents in each architecture/address space. This is not a ROM-file byte delta. Unknown sizes are excluded.",
    );
    group(
      "functions",
      "Functions containing unique instructions",
      summary.functionCount,
      "symbol-function",
      count(summary.functionCount),
      `${count(summary.unownedInstructions)} unique instructions have no known owner; ${count(summary.ambiguousInstructions)} have ambiguous ownership. Other parts of these functions may be shared.`,
    );
    group(
      "memory",
      "Unique memory access sites",
      summary.uniqueMemoryCount,
      "references",
      count(summary.uniqueMemoryCount),
      "Instruction + target address, access type, width, actor and channel absent from the baseline. Changing values do not create new sites.",
    );
    group("sharedInstructions", "Shared instructions", summary.sharedInstructionCount, "layers");
    group(
      "contributions",
      "Attributed metadata",
      summary.contributionCount,
      "note",
      count(summary.contributionCount),
      "Labels, comments and classifications carrying this source's evidence. Attribution does not imply exclusivity.",
    );
    const details = [
      ...summary.source.reports.flatMap((report) =>
        Object.entries(report.imported).map(
          ([field, value]) => `${report.sourceName}: ${count(value)} ${field} imported`,
        ),
      ),
      ...summary.notes,
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
    baselineIds: readonly string[] | undefined,
    group: AnalysisSourceGroup,
    start: number,
    total: number,
  ): Promise<AnalysisSourcesTreeNode[]> {
    const id = `${this.#sourceKey(target)}:${group}`;
    if (total <= PAGE_SIZE) {
      const entries = await analysisWorker().request<AnalysisSourceEntry[]>(
        target.directory,
        "sourceEntries",
        { sourceId: target.source.id, baselineIds, sourceGroup: group, offset: start },
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
          icon: group === "functions" ? "symbol-function" : "location",
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
        load: () => this.#pages(target, manifest, baselineIds, group, from, size),
      });
    }
    return pages;
  }
}
