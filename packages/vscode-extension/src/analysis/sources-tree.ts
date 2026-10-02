/** Lazy, read-only source attribution in the assembly sidebar. */
import * as path from "node:path";

import type {
  AnalysisEvidenceSource,
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

import { findAnalysisProjectDirectories } from "./coverage-tree.js";
import type { AnalysisNavigationTarget } from "./navigation-target.js";
import { analysisWorker } from "./worker-client.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isNumberRecord(value: unknown): value is Readonly<Record<string, number>> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "number");
}

function isEvidenceKind(value: unknown): value is AnalysisEvidenceSource["kinds"][number] {
  return (
    value === "manual" ||
    value === "import" ||
    value === "detector" ||
    value === "static" ||
    value === "runtime"
  );
}

function isImportReport(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.format === "string" &&
    typeof value.sourceName === "string" &&
    typeof value.sourceSha256 === "string" &&
    isNumberRecord(value.imported) &&
    isStringArray(value.warnings) &&
    Array.isArray(value.unsupported) &&
    value.unsupported.every(
      (loss) =>
        isRecord(loss) &&
        typeof loss.field === "string" &&
        typeof loss.reason === "string" &&
        typeof loss.count === "number",
    )
  );
}

function isEvidenceSource(value: unknown): value is AnalysisEvidenceSource {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isStringArray(value.names) &&
    Array.isArray(value.kinds) &&
    value.kinds.every(isEvidenceKind) &&
    isStringArray(value.evidenceIds) &&
    Array.isArray(value.reports) &&
    value.reports.every(isImportReport) &&
    (value.format === undefined || typeof value.format === "string") &&
    (value.sha256 === undefined || typeof value.sha256 === "string") &&
    (value.lastImportedAt === undefined || typeof value.lastImportedAt === "number")
  );
}

function isSourceCatalog(
  value: unknown,
): value is { readonly sources: readonly AnalysisEvidenceSource[] } {
  return isRecord(value) && Array.isArray(value.sources) && value.sources.every(isEvidenceSource);
}

interface SourceSummaryView {
  readonly manifest: {
    readonly target: string;
    readonly rom: { readonly contentSha256: string; readonly contentSize: number };
  };
  readonly summary: {
    readonly instructionCount: number;
    readonly memoryCount: number;
    readonly contributionCount: number;
    readonly source: AnalysisEvidenceSource;
  };
}

function isSourceSummary(value: unknown): value is SourceSummaryView {
  return (
    isRecord(value) &&
    isRecord(value.manifest) &&
    typeof value.manifest.target === "string" &&
    isRecord(value.manifest.rom) &&
    typeof value.manifest.rom.contentSha256 === "string" &&
    typeof value.manifest.rom.contentSize === "number" &&
    isRecord(value.summary) &&
    typeof value.summary.instructionCount === "number" &&
    typeof value.summary.memoryCount === "number" &&
    typeof value.summary.contributionCount === "number" &&
    isEvidenceSource(value.summary.source)
  );
}

function isSourceEntry(value: unknown): value is AnalysisSourceEntry {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.description === "string" &&
    typeof value.detail === "string" &&
    Array.isArray(value.outputOffsets) &&
    value.outputOffsets.every((offset) => typeof offset === "number") &&
    isStringArray(value.recordIds) &&
    (value.addressSpace === undefined || typeof value.addressSpace === "string") &&
    (value.address === undefined || typeof value.address === "number") &&
    (value.architecture === undefined || typeof value.architecture === "string")
  );
}

/**
 * Format source/evidence totals with English digit grouping so tree labels remain consistent
 * across host locales.
 * @param {number} value Source or evidence record total.
 * @returns {string} English-grouped decimal count for tree text.
 */
const count = (value: number): string => value.toLocaleString("en-US");
/** Maximum evidence entries requested for one source-tree page. */
const PAGE_SIZE = 200;
/** Native source identity and owning project directory carried by source-specific tree commands. */
interface SourceTarget {
  readonly directory: string;
  readonly source: AnalysisEvidenceSource;
}

interface SourceManifestView {
  readonly target: string;
  readonly rom: { readonly contentSha256: string; readonly contentSize: number };
}
/**
 * Source/evidence row with optional lazy children, a VS Code command, and source identity for
 * context-menu actions.
 */
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

/**
 * Source metadata loads immediately. SQL counts and result pages stay in the analysis process.
 * @see https://code.visualstudio.com/api/references/vscode-api#TreeDataProvider
 */
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
          const catalog = await analysisWorker().request(directory, "sources");
          if (!isSourceCatalog(catalog)) {
            throw new Error("Analysis sources are unavailable.");
          }
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
    catalog: { readonly sources: readonly AnalysisEvidenceSource[] },
  ): AnalysisSourcesTreeNode[] {
    const artifacts = catalog.sources.filter((source) => source.sha256);
    const producers = catalog.sources.filter((source) => !source.sha256);
    const nameCounts = new Map<string, number>();
    for (const source of catalog.sources) {
      nameCounts.set(source.name, (nameCounts.get(source.name) ?? 0) + 1);
    }
    const node = (source: AnalysisEvidenceSource): AnalysisSourcesTreeNode => {
      const target = { directory, source };
      const warnings = source.reports.some(
        (report) => report.warnings.length || report.unsupported.length,
      );
      let icon = source.sha256 ? "file" : "symbol-event";
      if (source.kinds.includes("runtime")) {
        icon = "pulse";
      }
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
    if (producers.length) {
      roots.push({
        id: `${directory}:producers`,
        label: "Other evidence",
        description: `${count(producers.length)} producers`,
        tooltip: "Manual edits, detectors and static-analysis producers",
        icon: "symbol-event",
        load: () => this.#localPages(`${directory}:producers`, producers.map(node)),
      });
    }
    if (!roots.length) {
      roots.push({ id: `${directory}:empty`, label: "No imported sources yet", icon: "info" });
    }
    return roots;
  }

  #localPages(id: string, entries: AnalysisSourcesTreeNode[]): AnalysisSourcesTreeNode[] {
    if (entries.length <= PAGE_SIZE) {
      return entries;
    }
    let stride = PAGE_SIZE;
    while (Math.ceil(entries.length / stride) > PAGE_SIZE) {
      stride *= PAGE_SIZE;
    }
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
    const loaded = await analysisWorker().request(target.directory, "sourceSummary", {
      sourceId: target.source.id,
    });
    if (!isSourceSummary(loaded)) {
      throw new Error("Analysis source summary is unavailable.");
    }
    const { manifest, summary } = loaded;
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
      ...summary.source.reports.flatMap((report) =>
        report.warnings.concat(
          report.unsupported.map((loss) => `${loss.field}: ${loss.reason} (${loss.count})`),
        ),
      ),
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
    manifest: SourceManifestView,
    group: AnalysisSourceGroup,
    start: number,
    total: number,
  ): Promise<AnalysisSourcesTreeNode[]> {
    const id = `${this.#sourceKey(target)}:${group}`;
    if (total <= PAGE_SIZE) {
      const entries = await analysisWorker().request(target.directory, "sourceEntries", {
        sourceId: target.source.id,
        sourceGroup: group,
        offset: start,
      });
      if (!Array.isArray(entries) || !entries.every(isSourceEntry)) {
        throw new Error("Analysis source entries are unavailable.");
      }
      return entries.map((entry) => {
        const navigation: AnalysisNavigationTarget | undefined =
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
        return Object.assign(
          {
            id: `${id}:${entry.id}`,
            label: entry.label,
            description: entry.description,
            tooltip: entry.detail,
            icon: "location",
          },
          navigation
            ? {
                command: {
                  command: "asm.analysis.navigate",
                  title: "Open source or disassembly",
                  arguments: [navigation],
                },
              }
            : {},
        );
      });
    }
    let stride = PAGE_SIZE;
    while (Math.ceil(total / stride) > PAGE_SIZE) {
      stride *= PAGE_SIZE;
    }
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
