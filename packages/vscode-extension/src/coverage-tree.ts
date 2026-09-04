/**
 * Read-only tree view over a validated native analysis project's ROM coverage map.
 * @see https://code.visualstudio.com/api/extension-guides/tree-view
 */
import * as path from "node:path";
import {
  ANALYSIS_PROJECT_MANIFEST,
  buildRomCoverageMap,
  loadAnalysisProject,
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

const PAGE_SIZE = 200;
const ANALYSIS_PROJECT_EXCLUDE = "**/{node_modules,.git,Local Only}/**";

type CoverageDetail = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tooltip?: string;
  readonly icon: string;
};

type CoverageTreeNode = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tooltip?: string;
  readonly icon: string;
  readonly state: TreeItemCollapsibleState;
  readonly resourceUri?: Uri;
  readonly children?: readonly CoverageTreeNode[];
  readonly segments?: readonly RomCoverageSegment[];
  readonly details?: readonly CoverageDetail[];
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

const formatBytes = (bytes: number): string =>
  `${bytes.toLocaleString("en-US")} byte${bytes === 1 ? "" : "s"}`;

const percentage = (bytes: number, total: number): string =>
  total === 0 ? "0.00%" : `${((bytes / total) * 100).toFixed(2)}%`;

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

const mapChildren = (
  projectId: string,
  projectDirectory: string,
  map: RomCoverageMap,
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
  const projectionDetails: CoverageDetail[] = [
    ...map.unprojected.map((record) => ({
      id: `${projectId}:unprojected:${record.kind}:${record.id}:${record.reason}`,
      label: record.id,
      description: record.reason,
      tooltip: `${record.kind} record${record.addressSpace ? ` in ${record.addressSpace}` : ""} was not projected into ROM offsets: ${record.reason}.`,
      icon: "debug-disconnect",
    })),
    ...map.diagnostics.map((diagnostic, index) => ({
      id: `${projectId}:diagnostic:${diagnostic.recordId}:${index}`,
      label: diagnostic.recordId,
      description: "clipped",
      tooltip: diagnostic.message,
      icon: "warning",
    })),
  ];

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
      segments: map.segments,
      contentSize: map.contentSize,
      projectDirectory,
    },
    {
      id: `${projectId}:projection`,
      label: "Projection diagnostics",
      description:
        projectionDetails.length === 0
          ? "all map-relevant records projected"
          : `${projectionDetails.length.toLocaleString("en-US")} item(s)`,
      tooltip:
        "CPU and RAM addresses are never guessed into ROM offsets. Records without explicit file identities remain visible here.",
      icon: projectionDetails.length === 0 ? "pass" : "warning",
      state:
        projectionDetails.length === 0
          ? TreeItemCollapsibleState.None
          : TreeItemCollapsibleState.Collapsed,
      details: projectionDetails,
    },
  ];
};

const pageLabel = (start: number, end: number, width: number): string =>
  `$${start.toString(16).toUpperCase().padStart(width, "0")}–$${end.toString(16).toUpperCase().padStart(width, "0")}`;

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
  if (segment.status === "conflict") icon = "warning";
  else if (segment.status === "unknown") icon = "question";
  else if (segment.runtime.includes("executed")) icon = "debug-alt";
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

/** Tree data provider for native analysis-project coverage. */
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
    if (!element) return this.loadProjects();
    if (element.segments) return this.segmentPages(element);
    if (element.details) return this.detailPages(element);
    return [...(element.children ?? [])];
  }

  editTarget(element: unknown): AnalysisCoverageEditTarget | undefined {
    if (!element || typeof element !== "object" || !("editTarget" in element)) return undefined;
    return (element as CoverageTreeNode).editTarget;
  }

  private async projectDirectories(): Promise<string[]> {
    return findAnalysisProjectDirectories();
  }

  private async loadProjects(): Promise<CoverageTreeNode[]> {
    const directories = await this.projectDirectories();
    const result: CoverageTreeNode[] = [];
    for (const directory of directories) {
      const manifestUri = Uri.file(path.join(directory, ANALYSIS_PROJECT_MANIFEST));
      const projectId = `analysis:${directory}`;
      try {
        const project = loadAnalysisProject(directory);
        const map = buildRomCoverageMap(project.manifest, project.shards);
        result.push({
          id: projectId,
          label: path.basename(directory),
          description: `${project.manifest.target} · ${project.manifest.mapping.mapper} · ${project.manifest.rom.contentSha256.slice(0, 12)}`,
          tooltip: `${directory}\n${formatBytes(map.contentSize)} ROM content\n${map.fileAddressSpaces.join(", ") || "No file address space"}`,
          icon: "database",
          state: TreeItemCollapsibleState.Expanded,
          resourceUri: manifestUri,
          children: mapChildren(projectId, directory, map),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.push({
          id: `${projectId}:error`,
          label: path.basename(directory),
          description: "invalid analysis project",
          tooltip: `${directory}\n${message}`,
          icon: "error",
          state: TreeItemCollapsibleState.None,
          resourceUri: manifestUri,
        });
      }
    }
    return result;
  }

  private segmentPages(element: CoverageTreeNode): CoverageTreeNode[] {
    const segments = element.segments ?? [];
    const contentSize = element.contentSize ?? 0;
    if (segments.length <= PAGE_SIZE) {
      return segments.map((segment) =>
        segmentNode(element.id, segment, contentSize, element.projectDirectory!),
      );
    }
    const width = Math.max(6, Math.max(0, contentSize - 1).toString(16).length);
    const pages: CoverageTreeNode[] = [];
    for (let index = 0; index < segments.length; index += PAGE_SIZE) {
      const slice = segments.slice(index, index + PAGE_SIZE);
      pages.push({
        id: `${element.id}:page:${index / PAGE_SIZE}`,
        label: pageLabel(slice[0].start, slice.at(-1)!.end, width),
        description: `${slice.length} segment(s)`,
        icon: "list-selection",
        state: TreeItemCollapsibleState.Collapsed,
        segments: slice,
        contentSize,
        projectDirectory: element.projectDirectory,
      });
    }
    return pages;
  }

  private detailPages(element: CoverageTreeNode): CoverageTreeNode[] {
    const details = element.details ?? [];
    if (details.length <= PAGE_SIZE) return details.map((detail) => this.detailNode(detail));
    const pages: CoverageTreeNode[] = [];
    for (let index = 0; index < details.length; index += PAGE_SIZE) {
      const slice = details.slice(index, index + PAGE_SIZE);
      pages.push({
        id: `${element.id}:page:${index / PAGE_SIZE}`,
        label: `Items ${index + 1}–${index + slice.length}`,
        description: `${slice.length} item(s)`,
        icon: "list-selection",
        state: TreeItemCollapsibleState.Collapsed,
        details: slice,
      });
    }
    return pages;
  }

  private detailNode(detail: CoverageDetail): CoverageTreeNode {
    return {
      ...detail,
      state: TreeItemCollapsibleState.None,
    };
  }
}
