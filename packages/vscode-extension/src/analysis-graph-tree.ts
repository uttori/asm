/** Function/call and unresolved-flow tree over validated native analysis projects. */
import * as path from "node:path";

import {
  ANALYSIS_PROJECT_MANIFEST,
  type AnalysisCallGraph,
  type AnalysisCallGraphEdge,
  type AnalysisCallGraphFunction,
  type AnalysisCallGraphUnresolved,
  type AnalysisProjectManifest,
} from "@uttori/asm-disassembler";
import {
  EventEmitter,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  type Event,
  type TreeDataProvider,
} from "vscode";

import { analysisWorker } from "./analysis-worker-client.js";
import { findAnalysisProjectDirectories } from "./coverage-tree.js";

const PAGE_SIZE = 200;

/** Exact identity required to navigate without collapsing CPU, RAM, or mirrored ROM spaces. */
export interface AnalysisGraphNavigationTarget {
  readonly projectDirectory: string;
  readonly target: string;
  readonly romContentSha256: string;
  readonly romContentSize: number;
  readonly addressSpace: string;
  readonly address: number;
  readonly outputOffsets: readonly number[];
  readonly architectureHints: readonly string[];
  readonly recordIds: readonly string[];
}

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isAnalysisGraphNavigationTarget = (
  value: unknown,
): value is AnalysisGraphNavigationTarget => {
  if (!value || typeof value !== "object") return false;
  const target = value as Partial<AnalysisGraphNavigationTarget>;
  return (
    typeof target.projectDirectory === "string" &&
    target.projectDirectory.length > 0 &&
    typeof target.target === "string" &&
    target.target.length > 0 &&
    typeof target.romContentSha256 === "string" &&
    /^[\da-f]{64}$/u.test(target.romContentSha256) &&
    Number.isSafeInteger(target.romContentSize) &&
    target.romContentSize! >= 0 &&
    typeof target.addressSpace === "string" &&
    target.addressSpace.length > 0 &&
    Number.isSafeInteger(target.address) &&
    target.address! >= 0 &&
    Array.isArray(target.outputOffsets) &&
    target.outputOffsets.every((offset) => Number.isSafeInteger(offset) && offset >= 0) &&
    isStringArray(target.architectureHints) &&
    isStringArray(target.recordIds)
  );
};

type AnalysisGraphTreeNode = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tooltip?: string;
  readonly icon: string;
  readonly state: TreeItemCollapsibleState;
  readonly children?: readonly AnalysisGraphTreeNode[];
  readonly pageEntries?: readonly (() => AnalysisGraphTreeNode)[];
  readonly loadChildren?: () =>
    | readonly AnalysisGraphTreeNode[]
    | Promise<readonly AnalysisGraphTreeNode[]>;
  readonly resourceUri?: Uri;
  readonly navigationTarget?: AnalysisGraphNavigationTarget;
};

const hexadecimal = (value: number): string =>
  `$${value.toString(16).toUpperCase().padStart(6, "0")}`;

const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

type ArchitectureHints = Readonly<Record<string, readonly string[]>>;
interface GraphProjection {
  readonly manifest: AnalysisProjectManifest;
  readonly graph: AnalysisCallGraph;
  readonly hints: ArchitectureHints;
}
const graphIndexes = new WeakMap<
  AnalysisCallGraph,
  {
    functions: Map<string, AnalysisCallGraphFunction>;
    calls: Map<string, AnalysisCallGraphEdge>;
    unresolved: Map<string, AnalysisCallGraphUnresolved>;
  }
>();
const indexesFor = (graph: AnalysisCallGraph) => {
  let indexes = graphIndexes.get(graph);
  if (!indexes) {
    indexes = {
      functions: new Map(graph.functions.map((fn) => [fn.id, fn])),
      calls: new Map(graph.calls.map((call) => [call.id, call])),
      unresolved: new Map(graph.unresolved.map((record) => [record.id, record])),
    };
    graphIndexes.set(graph, indexes);
  }
  return indexes;
};

const navigationTarget = (
  projectDirectory: string,
  manifest: AnalysisProjectManifest,
  shards: ArchitectureHints,
  location: {
    readonly addressSpace: string;
    readonly address: number;
    readonly outputOffsets: readonly number[];
  },
  recordIds: readonly string[],
): AnalysisGraphNavigationTarget => ({
  projectDirectory,
  target: manifest.target,
  romContentSha256: manifest.rom.contentSha256,
  romContentSize: manifest.rom.contentSize,
  addressSpace: location.addressSpace,
  address: location.address,
  outputOffsets: location.outputOffsets,
  architectureHints: shards[`${location.addressSpace}:${location.address}`] ?? [],
  recordIds: sortedUnique(recordIds),
});

const leaf = (
  id: string,
  label: string,
  description: string,
  icon: string,
  tooltip: string,
  target?: AnalysisGraphNavigationTarget,
): AnalysisGraphTreeNode => ({
  id,
  label,
  description,
  tooltip,
  icon,
  state: TreeItemCollapsibleState.None,
  ...(target ? { navigationTarget: target } : {}),
});

const pagedGroup = (
  id: string,
  label: string,
  description: string,
  icon: string,
  entries: readonly (() => AnalysisGraphTreeNode)[],
): AnalysisGraphTreeNode => ({
  id,
  label,
  description,
  icon,
  state: entries.length === 0 ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
  pageEntries: entries,
});

const functionName = (fn: AnalysisCallGraphFunction): string =>
  fn.labels.length > 0 ? fn.labels.map(({ name }) => name).join(" / ") : fn.id;

const callNode = (
  projectId: string,
  projectDirectory: string,
  manifest: AnalysisProjectManifest,
  shards: ArchitectureHints,
  graph: AnalysisCallGraph,
  call: AnalysisCallGraphEdge,
  direction: "all" | "incoming" | "outgoing",
): AnalysisGraphTreeNode => {
  const { functions } = indexesFor(graph);
  const callers = call.callerFunctionIds.map((id) => functionName(functions.get(id)!));
  const callees = call.calleeFunctionIds.map((id) => functionName(functions.get(id)!));
  const caller = callers.length > 0 ? callers.join(" / ") : "unowned call site";
  const callee = callees.length > 0 ? callees.join(" / ") : hexadecimal(call.toAddress);
  let label = `${caller} → ${callee}`;
  if (direction === "incoming") label = `← ${caller}`;
  if (direction === "outgoing") label = `→ ${callee}`;
  return leaf(
    `${projectId}:call:${direction}:${call.id}`,
    label,
    `${call.edgeKind} at ${hexadecimal(call.fromAddress)}${call.indirect ? " · indirect" : ""}`,
    call.indirect ? "references" : "call-outgoing",
    [
      `${call.addressSpace} ${hexadecimal(call.fromAddress)} → ${hexadecimal(call.toAddress)}`,
      `Edge: ${call.id}`,
      `Caller functions: ${call.callerFunctionIds.join(", ") || "none"}`,
      `Callee functions: ${call.calleeFunctionIds.join(", ") || "none"}`,
      call.override ? `Override: ${call.override}` : undefined,
      call.explanation,
    ]
      .filter((value): value is string => value !== undefined)
      .join("\n"),
    navigationTarget(
      projectDirectory,
      manifest,
      shards,
      {
        addressSpace: call.addressSpace,
        address: call.fromAddress,
        outputOffsets: call.fromOutputOffsets,
      },
      [call.id, call.fromNodeId],
    ),
  );
};

const unresolvedNode = (
  projectId: string,
  projectDirectory: string,
  manifest: AnalysisProjectManifest,
  shards: ArchitectureHints,
  unresolved: AnalysisCallGraphUnresolved,
): AnalysisGraphTreeNode =>
  leaf(
    `${projectId}:unresolved:${unresolved.id}`,
    `${hexadecimal(unresolved.address)} ${unresolved.flowKind}`,
    `${unresolved.indirect ? "indirect" : "direct"} · ${unresolved.reason}`,
    unresolved.indirect ? "debug-disconnect" : "question",
    [
      `${unresolved.addressSpace} ${hexadecimal(unresolved.address)}`,
      `Record: ${unresolved.id}`,
      `Owners: ${unresolved.ownerFunctionIds.join(", ") || "none"}`,
      `CFG nodes: ${unresolved.nodeIds.join(", ") || "none"}`,
      `Reason: ${unresolved.reason}`,
    ].join("\n"),
    navigationTarget(projectDirectory, manifest, shards, unresolved, [
      unresolved.id,
      ...unresolved.nodeIds,
    ]),
  );

const functionNode = (
  projectId: string,
  projectDirectory: string,
  manifest: AnalysisProjectManifest,
  shards: ArchitectureHints,
  graph: AnalysisCallGraph,
  fn: AnalysisCallGraphFunction,
): AnalysisGraphTreeNode => {
  const { calls, unresolved } = indexesFor(graph);
  const loadChildren = () => [
    pagedGroup(
      `${projectId}:function:${fn.id}:incoming`,
      "Incoming calls",
      `${fn.incomingCallIds.length}`,
      "call-incoming",
      fn.incomingCallIds.map(
        (id) => () =>
          callNode(
            projectId,
            projectDirectory,
            manifest,
            shards,
            graph,
            calls.get(id)!,
            "incoming",
          ),
      ),
    ),
    pagedGroup(
      `${projectId}:function:${fn.id}:outgoing`,
      "Outgoing calls",
      `${fn.outgoingCallIds.length}`,
      "call-outgoing",
      fn.outgoingCallIds.map(
        (id) => () =>
          callNode(
            projectId,
            projectDirectory,
            manifest,
            shards,
            graph,
            calls.get(id)!,
            "outgoing",
          ),
      ),
    ),
    pagedGroup(
      `${projectId}:function:${fn.id}:unresolved`,
      "Unresolved flow",
      `${fn.unresolvedIds.length}`,
      "debug-disconnect",
      fn.unresolvedIds.map(
        (id) => () =>
          unresolvedNode(projectId, projectDirectory, manifest, shards, unresolved.get(id)!),
      ),
    ),
  ];
  return {
    id: `${projectId}:function:${fn.id}`,
    label: functionName(fn),
    description: `${fn.addressSpace} ${hexadecimal(fn.address)} · ${fn.source}`,
    tooltip: [
      `Function: ${fn.id}`,
      `${fn.addressSpace} ${hexadecimal(fn.address)}`,
      `CFG nodes: ${fn.nodeIds.length}`,
      `Incoming calls: ${fn.incomingCallIds.length}`,
      `Outgoing calls: ${fn.outgoingCallIds.length}`,
      `Unresolved flow: ${fn.unresolvedIds.length}`,
    ].join("\n"),
    icon: fn.source === "interrupt" ? "zap" : "symbol-function",
    state: TreeItemCollapsibleState.Collapsed,
    loadChildren,
    navigationTarget: navigationTarget(projectDirectory, manifest, shards, fn, [
      fn.id,
      ...fn.nodeIds,
    ]),
  };
};

const projectChildren = (
  projectId: string,
  projectDirectory: string,
  manifest: AnalysisProjectManifest,
  shards: ArchitectureHints,
  graph: AnalysisCallGraph,
): readonly AnalysisGraphTreeNode[] => {
  const functions = graph.functions.map(
    (fn) => () => functionNode(projectId, projectDirectory, manifest, shards, graph, fn),
  );
  const calls = graph.calls.map(
    (call) => () => callNode(projectId, projectDirectory, manifest, shards, graph, call, "all"),
  );
  const unresolved = graph.unresolved.map(
    (record) => () => unresolvedNode(projectId, projectDirectory, manifest, shards, record),
  );
  const orphanIds = sortedUnique([...graph.orphanCallIds, ...graph.orphanUnresolvedIds]);
  return [
    pagedGroup(
      `${projectId}:functions`,
      "Functions",
      `${functions.length.toLocaleString("en-US")} candidate(s)`,
      "symbol-function",
      functions,
    ),
    pagedGroup(
      `${projectId}:calls`,
      "Call edges",
      `${calls.length.toLocaleString("en-US")} resolved`,
      "type-hierarchy-sub",
      calls,
    ),
    pagedGroup(
      `${projectId}:unresolved`,
      "Unresolved flow",
      `${graph.unresolved.filter(({ indirect }) => indirect).length} indirect · ${unresolved.length} total`,
      "debug-disconnect",
      unresolved,
    ),
    pagedGroup(
      `${projectId}:orphans`,
      "Ownership diagnostics",
      orphanIds.length === 0 ? "all records linked" : `${orphanIds.length} orphan(s)`,
      orphanIds.length === 0 ? "pass" : "warning",
      orphanIds.map(
        (id) => () =>
          leaf(
            `${projectId}:orphan:${id}`,
            id,
            "No persisted caller, callee, or owner function",
            "warning",
            "The graph retains this record without inventing function ownership.",
          ),
      ),
    ),
  ];
};

/** Read-only native analysis function/call graph tree provider. */
export class AnalysisGraphProvider implements TreeDataProvider<AnalysisGraphTreeNode> {
  static readonly viewId = "uttori-asm.analysisGraph";
  readonly #projects = new Map<string, Promise<GraphProjection>>();

  readonly #onDidChangeTreeData = new EventEmitter<
    AnalysisGraphTreeNode | undefined | null | void
  >();
  readonly onDidChangeTreeData: Event<AnalysisGraphTreeNode | undefined | null | void> =
    this.#onDidChangeTreeData.event;

  refresh(): void {
    this.#projects.clear();
    this.#onDidChangeTreeData.fire();
  }

  getTreeItem(element: AnalysisGraphTreeNode): TreeItem {
    const item = new TreeItem(element.label, element.state);
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip ?? element.label;
    item.iconPath = new ThemeIcon(element.icon);
    item.contextValue = element.navigationTarget ? "analysisGraphLocation" : "analysisGraph";
    if (element.resourceUri) {
      item.resourceUri = element.resourceUri;
      item.command = {
        command: "vscode.open",
        title: "Open analysis manifest",
        arguments: [element.resourceUri],
      };
    } else if (element.navigationTarget) {
      item.command = {
        command: "asm.analysis.navigate",
        title: "Open source or virtual disassembly",
        arguments: [element.navigationTarget],
      };
    }
    return item;
  }

  async getChildren(element?: AnalysisGraphTreeNode): Promise<AnalysisGraphTreeNode[]> {
    if (!element) return this.loadProjects();
    if (element.loadChildren) return [...(await element.loadChildren())];
    if (element.pageEntries) return this.pagedChildren(element);
    return [...(element.children ?? [])];
  }

  navigationTarget(element: unknown): AnalysisGraphNavigationTarget | undefined {
    if (!element || typeof element !== "object") return undefined;
    const candidate = "navigationTarget" in element ? element.navigationTarget : element;
    return isAnalysisGraphNavigationTarget(candidate) ? candidate : undefined;
  }

  private async loadProjects(): Promise<AnalysisGraphTreeNode[]> {
    const directories = await findAnalysisProjectDirectories();
    const result: AnalysisGraphTreeNode[] = [];
    for (const directory of directories) {
      const projectId = `analysis-graph:${directory}`;
      const manifestUri = Uri.file(path.join(directory, ANALYSIS_PROJECT_MANIFEST));
      try {
        const manifest = await analysisWorker().request<AnalysisProjectManifest>(
          directory,
          "manifest",
        );
        result.push({
          id: projectId,
          label: path.basename(directory),
          description: `${manifest.target} · ${manifest.mapping.mapper}`,
          tooltip: `${directory}\n${manifest.rom.contentSha256}`,
          icon: "type-hierarchy",
          state: TreeItemCollapsibleState.Collapsed,
          resourceUri: manifestUri,
          loadChildren: async () => {
            try {
              let projection = this.#projects.get(directory);
              if (!projection) {
                projection = analysisWorker().request<GraphProjection>(directory, "graph");
                this.#projects.set(directory, projection);
              }
              const { graph, hints } = await projection;
              return projectChildren(projectId, directory, manifest, hints, graph);
            } catch (error) {
              this.#projects.delete(directory);
              return [
                leaf(`${projectId}:error`, "Could not load graph", "", "error", String(error)),
              ];
            }
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.push({
          id: `${projectId}:error`,
          label: path.basename(directory),
          // Preserve the actual error in the tooltip without treating every worker failure as invalid data.
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

  private pagedChildren(element: AnalysisGraphTreeNode): AnalysisGraphTreeNode[] {
    const entries = element.pageEntries ?? [];
    if (entries.length <= PAGE_SIZE) return entries.map((create) => create());
    let stride = PAGE_SIZE;
    while (Math.ceil(entries.length / stride) > PAGE_SIZE) stride *= PAGE_SIZE;
    const pages: AnalysisGraphTreeNode[] = [];
    for (let index = 0; index < entries.length; index += stride) {
      const slice = entries.slice(index, index + stride);
      pages.push({
        id: `${element.id}:page:${index / PAGE_SIZE}`,
        label: `${(index + 1).toLocaleString("en-US")}–${Math.min(index + stride, entries.length).toLocaleString("en-US")}`,
        description: `${slice.length} item(s)`,
        icon: "list-selection",
        state: TreeItemCollapsibleState.Collapsed,
        pageEntries: slice,
      });
    }
    return pages;
  }
}
