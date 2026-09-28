/**
 * Read-only tree view over a validated native analysis project's ROM coverage map.
 * @see https://code.visualstudio.com/api/extension-guides/tree-view
 */
import * as path from "node:path";

import {
  ANALYSIS_PROJECT_MANIFEST,
  type AnalysisProjectManifest,
  type RomCoverageMap,
  type RomCoverageSegment,
} from "@uttori/asm-disassembler";
import {
  EventEmitter,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  workspace,
  type Event,
  type TreeDataProvider,
} from "vscode";

import { informationHex } from "../editor-info/format.js";
import { analysisWorker } from "./worker-client.js";

/** Maximum segment or diagnostic rows requested from the worker for one expanded coverage page. */
const PAGE_SIZE = 200;
/**
 * Workspace-search glob excluding dependencies, Git internals, and local-only project copies
 * from automatic discovery.
 */
const ANALYSIS_PROJECT_EXCLUDE = "**/{node_modules,.git,Local Only}/**";

/** Compact diagnostic row returned by the analysis worker for display in the coverage tree. */
type CoverageDetail = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tooltip?: string;
  readonly icon: string;
};

/**
 * Coverage row with either materialized children or a worker page descriptor; optional edit
 * targets retain exact ROM intervals.
 */
type CoverageTreeNode = {
  readonly loadProject?: boolean;
  readonly remotePage?: {
    readonly operation: "segments" | "details";
    readonly offset: number;
    readonly count: number;
  };
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tooltip?: string;
  readonly icon: string;
  readonly state: TreeItemCollapsibleState;
  readonly resourceUri?: Uri;
  readonly children?: readonly CoverageTreeNode[];
  readonly contentSize?: number;
  readonly projectDirectory?: string;
  readonly editTarget?: AnalysisCoverageEditTarget;
};

/** Local project/range identity carried by editable ROM-map segment tree items. */
export interface AnalysisCoverageEditTarget {
  readonly projectDirectory: string;
  readonly start: number;
  readonly end: number;
  readonly annotationIds: readonly string[];
  readonly analysisIds: readonly string[];
  readonly runtimeIds: readonly string[];
  readonly conflictIds: readonly string[];
  readonly regionIds: readonly string[];
}

/**
 * Format an exact byte count with stable English grouping and singular/plural units.
 * @param {number} bytes Exact ROM-content byte count.
 * @returns {string} Grouped decimal count with the correct byte unit.
 */
const formatBytes = (bytes: number): string =>
  `${bytes.toLocaleString("en-US")} byte${bytes === 1 ? "" : "s"}`;

/**
 * Format a coverage ratio to two decimal places; an empty ROM reports 0.00%.
 * @param {number} bytes Bytes in the reported category.
 * @param {number} total Total ROM-content bytes.
 * @returns {string} Percentage to two decimals, or 0.00% for an empty total.
 */
const percentage = (bytes: number, total: number): string =>
  total === 0 ? "0.00%" : `${((bytes / total) * 100).toFixed(2)}%`;

/**
 * Create a non-expandable coverage row with a stable identity and an optional explanatory
 * tooltip.
 * @param {string} id Stable tree-row identity.
 * @param {string} label Primary tree text.
 * @param {string} description Secondary count or status text.
 * @param {string} [icon] Product icon ID; defaults to circle-outline.
 * @param {string} [tooltip] Optional hover explanation.
 * @returns {CoverageTreeNode} Non-expandable coverage row.
 */
const leaf = (
  id: string,
  label: string,
  description: string,
  icon = "circle-outline",
  tooltip?: string,
): CoverageTreeNode => ({
  id,
  label,
  description,
  tooltip,
  icon,
  state: TreeItemCollapsibleState.None,
});

/**
 * Create an initially collapsed coverage group whose child rows are already available.
 * @param {string} id Stable group identity.
 * @param {string} label Category heading.
 * @param {string} description Secondary summary text.
 * @param {readonly CoverageTreeNode[]} children Already projected child rows.
 * @param {string} [icon] Product icon ID; defaults to folder.
 * @returns {CoverageTreeNode} Collapsed group retaining the supplied children.
 */
const group = (
  id: string,
  label: string,
  description: string,
  children: readonly CoverageTreeNode[],
  icon = "folder",
): CoverageTreeNode => ({
  id,
  label,
  description,
  icon,
  state: TreeItemCollapsibleState.Collapsed,
  children,
});

/**
 * Create a coverage leaf showing both the exact byte count and its share of ROM content.
 * @param {string} projectId Project-specific row ID prefix.
 * @param {string} label Coverage category.
 * @param {number} bytes Bytes in this category.
 * @param {number} total ROM-content byte count used as denominator.
 * @param {string} icon Product icon ID for the category.
 * @returns {CoverageTreeNode} Summary leaf containing byte and percentage totals.
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

/**
 * Project coverage totals immediately while leaving ROM segments and diagnostics as paged worker
 * requests.
 * @param {string} projectId Project-specific row ID prefix.
 * @param {string} projectDirectory Absolute native project directory for paged requests.
 * @param {RomCoverageMap & { readonly detailCount: number }} map Coverage totals and diagnostic count from the worker.
 * @returns {readonly CoverageTreeNode[]} Summary categories and lazy segment/diagnostic pages.
 */
const mapChildren = (
  projectId: string,
  projectDirectory: string,
  map: RomCoverageMap & { readonly detailCount: number },
): readonly CoverageTreeNode[] => {
  const { summary } = map;
  const summaryChildren = [
    leaf(
      `${projectId}:summary:total`,
      "ROM content",
      formatBytes(summary.totalBytes),
      "file-binary",
    ),
    summaryNode(projectId, "Classified", summary.classifiedBytes, summary.totalBytes, "pass"),
    summaryNode(projectId, "Unknown", summary.unknownBytes, summary.totalBytes, "question"),
    summaryNode(projectId, "Conflict", summary.conflictBytes, summary.totalBytes, "warning"),
  ];
  const classifications = (["opcode", "operand", "data", "asset", "unknown"] as const).map(
    (classification) =>
      summaryNode(
        projectId,
        classification,
        summary.bytesByClassification[classification],
        summary.totalBytes,
        classification === "unknown" ? "question" : "symbol-color",
      ),
  );
  const runtime = (["executed", "operand", "read", "written"] as const).map((coverage) =>
    summaryNode(
      projectId,
      coverage,
      summary.bytesByRuntimeCoverage[coverage],
      summary.totalBytes,
      coverage === "executed" ? "debug-alt" : "pulse",
    ),
  );

  return [
    group(
      `${projectId}:summary`,
      "Summary",
      `${percentage(summary.classifiedBytes, summary.totalBytes)} classified`,
      summaryChildren,
      "pie-chart",
    ),
    group(
      `${projectId}:classifications`,
      "Classifications",
      "overlaps remain visible",
      classifications,
      "symbol-color",
    ),
    group(
      `${projectId}:runtime`,
      "Runtime coverage",
      `${formatBytes(summary.bytesByRuntimeCoverage.executed)} executed`,
      runtime,
      "debug-alt",
    ),
    {
      id: `${projectId}:segments`,
      label: "ROM map segments",
      description: `${summary.segmentCount.toLocaleString("en-US")} coalesced`,
      tooltip:
        "Half-open ROM-content intervals. Expand a page to inspect at most 200 segments at a time.",
      icon: "list-tree",
      state: TreeItemCollapsibleState.Collapsed,
      remotePage: { operation: "segments", offset: 0, count: map.summary.segmentCount },
      contentSize: map.contentSize,
      projectDirectory,
    },
    {
      id: `${projectId}:projection`,
      label: "Projection diagnostics",
      description:
        map.detailCount === 0
          ? "all map-relevant records projected"
          : `${map.detailCount.toLocaleString("en-US")} item(s)`,
      tooltip:
        "CPU and RAM addresses are never guessed into ROM offsets. Records without explicit file identities remain visible here.",
      icon: map.detailCount === 0 ? "pass" : "warning",
      state:
        map.detailCount === 0 ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
      remotePage: { operation: "details", offset: 0, count: map.detailCount },
      projectDirectory,
    },
  ];
};

/**
 * Format hexadecimal ROM-content interval endpoints without changing the exclusive end; width is
 * the minimum digit count.
 * @param {number} start Inclusive ROM-content byte offset.
 * @param {number} end Exclusive ROM-content byte offset.
 * @param {number} width Minimum hexadecimal digits per endpoint.
 * @returns {string} Hexadecimal interval label retaining the exclusive end.
 */
const pageLabel = (start: number, end: number, width: number): string =>
  `${informationHex(start, width)}–${informationHex(end, width)}`;

/**
 * Turn a half-open ROM-content segment into an editable row, preserving evidence IDs and
 * prioritizing conflict/unknown icons.
 * @param {string} parentId Parent row identity used to derive a stable segment ID.
 * @param {RomCoverageSegment} segment Half-open ROM-content interval and its evidence.
 * @param {number} contentSize Total ROM-content bytes, used to size address labels.
 * @param {string} projectDirectory Owning native project directory.
 * @returns {CoverageTreeNode} Leaf retaining exact interval and evidence IDs for edits.
 */
const segmentNode = (
  parentId: string,
  segment: RomCoverageSegment,
  contentSize: number,
  projectDirectory: string,
): CoverageTreeNode => {
  const width = Math.max(6, Math.max(0, contentSize - 1).toString(16).length);
  const classifications = segment.classifications.join(" + ");
  const runtime = segment.runtime.length > 0 ? ` · runtime: ${segment.runtime.join(", ")}` : "";
  const evidenceCount =
    segment.annotationIds.length + segment.analysisIds.length + segment.runtimeIds.length;
  const tooltip = [
    `ROM interval [${segment.start}, ${segment.end})`,
    `Classification: ${classifications}`,
    `Status: ${segment.status}`,
    segment.runtime.length > 0 ? `Runtime: ${segment.runtime.join(", ")}` : undefined,
    segment.conflictIds.length > 0 ? `Conflicts: ${segment.conflictIds.join(", ")}` : undefined,
    segment.regionIds.length > 0 ? `Regions: ${segment.regionIds.join(", ")}` : undefined,
    `Evidence records: ${evidenceCount}`,
  ]
    .filter((value): value is string => value !== undefined)
    .join("\n");
  let icon = "symbol-color";
  if (segment.status === "conflict") {
    icon = "warning";
  } else if (segment.status === "unknown") {
    icon = "question";
  } else if (segment.runtime.includes("executed")) {
    icon = "debug-alt";
  }
  return {
    id: `${parentId}:${segment.start}:${segment.end}`,
    label: pageLabel(segment.start, segment.end, width),
    description: `${formatBytes(segment.end - segment.start)} · ${classifications}${runtime}`,
    tooltip,
    icon,
    state: TreeItemCollapsibleState.None,
    editTarget: {
      projectDirectory,
      start: segment.start,
      end: segment.end,
      annotationIds: segment.annotationIds,
      analysisIds: segment.analysisIds,
      runtimeIds: segment.runtimeIds,
      conflictIds: segment.conflictIds,
      regionIds: segment.regionIds,
    },
  };
};

/**
 * Resolves configured or discovered native analysis-project directories.
 * @returns {Promise<string[]>} Sorted absolute local project directories.
 * @see https://code.visualstudio.com/api/references/vscode-api#workspace.findFiles
 */
export const findAnalysisProjectDirectories = async (): Promise<string[]> => {
  const configured = workspace.getConfiguration("asm").get<string>("analysisProject", "").trim();
  if (configured !== "") {
    const folders = workspace.workspaceFolders ?? [];
    const candidates = path.isAbsolute(configured)
      ? [configured]
      : folders.map(({ uri }) => path.resolve(uri.fsPath, configured));
    return [
      ...new Set(
        candidates.map((candidate) =>
          path.basename(candidate) === ANALYSIS_PROJECT_MANIFEST
            ? path.dirname(candidate)
            : candidate,
        ),
      ),
    ].sort();
  }
  const manifests = await workspace.findFiles(
    `**/${ANALYSIS_PROJECT_MANIFEST}`,
    ANALYSIS_PROJECT_EXCLUDE,
    32,
  );
  return [
    ...new Set(
      manifests.filter(({ scheme }) => scheme === "file").map(({ fsPath }) => path.dirname(fsPath)),
    ),
  ].sort();
};

/**
 * Tree data provider for native analysis-project coverage.
 * @see https://code.visualstudio.com/api/references/vscode-api#TreeDataProvider
 * @see https://code.visualstudio.com/api/extension-guides/tree-view
 */
export class AnalysisCoverageProvider implements TreeDataProvider<CoverageTreeNode> {
  static readonly viewId = "uttori-asm.analysisCoverage";

  readonly #onDidChangeTreeData = new EventEmitter<CoverageTreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: Event<CoverageTreeNode | undefined | null | void> =
    this.#onDidChangeTreeData.event;

  refresh(): void {
    this.#onDidChangeTreeData.fire();
  }

  getTreeItem(element: CoverageTreeNode): TreeItem {
    const item = new TreeItem(element.label, element.state);
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip ?? element.label;
    item.iconPath = new ThemeIcon(element.icon);
    item.contextValue = element.editTarget ? "analysisCoverageSegment" : "analysisCoverage";
    if (element.resourceUri) {
      item.resourceUri = element.resourceUri;
      item.command = {
        command: "vscode.open",
        title: "Open analysis manifest",
        arguments: [element.resourceUri],
      };
    }
    return item;
  }

  async getChildren(element?: CoverageTreeNode): Promise<CoverageTreeNode[]> {
    if (!element) {
      return this.loadProjects();
    }
    if (element.loadProject) {
      try {
        const map = await analysisWorker().request<RomCoverageMap & { detailCount: number }>(
          element.projectDirectory!,
          "coverage",
        );
        return [...mapChildren(element.id, element.projectDirectory!, map)];
      } catch (error) {
        return [leaf(`${element.id}:error`, "Could not load coverage", String(error), "error")];
      }
    }
    if (element.remotePage) {
      const { operation, offset, count } = element.remotePage;
      if (count <= PAGE_SIZE) {
        try {
          if (operation === "segments") {
            const segments = await analysisWorker().request<RomCoverageSegment[]>(
              element.projectDirectory!,
              operation,
              { offset },
            );
            return segments
              .slice(0, count)
              .map((segment) =>
                segmentNode(element.id, segment, element.contentSize!, element.projectDirectory!),
              );
          }
          return (
            await analysisWorker().request<CoverageDetail[]>(element.projectDirectory!, operation, {
              offset,
            })
          )
            .slice(0, count)
            .map((detail) => ({
              ...detail,
              id: `${element.id}:${detail.id}`,
              state: TreeItemCollapsibleState.None,
            }));
        } catch (error) {
          return [leaf(`${element.id}:error`, "Could not load page", String(error), "error")];
        }
      }
      let stride = PAGE_SIZE;
      while (Math.ceil(count / stride) > PAGE_SIZE) {
        stride *= PAGE_SIZE;
      }
      const pages: CoverageTreeNode[] = [];
      for (let index = 0; index < count; index += stride) {
        pages.push({
          id: `${element.id}:page:${offset + index}`,
          label: `Items ${offset + index + 1}–${offset + Math.min(index + stride, count)}`,
          icon: "list-selection",
          state: TreeItemCollapsibleState.Collapsed,
          projectDirectory: element.projectDirectory,
          contentSize: element.contentSize,
          remotePage: { operation, offset: offset + index, count: Math.min(stride, count - index) },
        });
      }
      return pages;
    }
    return [...(element.children ?? [])];
  }

  editTarget(element: unknown): AnalysisCoverageEditTarget | undefined {
    if (!element || typeof element !== "object" || !("editTarget" in element)) {
      return undefined;
    }
    return (element as CoverageTreeNode).editTarget;
  }

  private async loadProjects(): Promise<CoverageTreeNode[]> {
    const directories = await findAnalysisProjectDirectories();
    const result: CoverageTreeNode[] = [];
    for (const directory of directories) {
      const manifestUri = Uri.file(path.join(directory, ANALYSIS_PROJECT_MANIFEST));
      const projectId = `analysis:${directory}`;
      try {
        const manifest = await analysisWorker().request<AnalysisProjectManifest>(
          directory,
          "manifest",
        );
        result.push({
          id: projectId,
          label: path.basename(directory),
          description: `${manifest.target} · ${manifest.mapping.mapper} · ${manifest.rom.contentSha256.slice(0, 12)}`,
          tooltip: `${directory}\n${formatBytes(manifest.rom.contentSize)} ROM content`,
          icon: "database",
          state: TreeItemCollapsibleState.Collapsed,
          resourceUri: manifestUri,
          loadProject: true,
          projectDirectory: directory,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.push({
          id: `${projectId}:error`,
          label: path.basename(directory),
          // Loading can fail because a worker timed out or the database is busy. That is not corruption.
          description: "could not load analysis project",
          tooltip: `${directory}\n${message}`,
          icon: "error",
          state: TreeItemCollapsibleState.None,
          resourceUri: manifestUri,
        });
      }
    }
    return result;
  }
}
