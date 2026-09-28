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

import { informationHex } from "../editor-info/format.js";
import { findAnalysisProjectDirectories } from "./coverage-tree.js";
import { analysisWorker } from "./worker-client.js";

/** Maximum lazily constructed graph rows in one expanded tree page. */
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

/**
 * Validate string-array fields on externally supplied navigation arguments without coercing
 * their contents.
 * @param {unknown} value Untrusted navigation field.
 * @returns {boolean} Whether every array member is a string.
 */
const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

/**
 * Validate the complete command payload before navigation, including ROM hash, safe nonnegative
 * addresses, and explicit output offsets.
 * @param {unknown} value Untrusted command argument.
 * @returns {boolean} Whether the complete qualified navigation shape is valid.
 */
const isAnalysisGraphNavigationTarget = (
  value: unknown,
): value is AnalysisGraphNavigationTarget => {
  if (!value || typeof value !== "object") {
    return false;
  }
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

/**
 * Graph row supporting lazy page factories or asynchronous expansion while
 * retaining exact navigation identity.
 */
type AnalysisGraphTreeNode = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tooltip?: string;
  readonly icon: string;
  readonly state: TreeItemCollapsibleState;
  readonly pageEntries?: readonly (() => AnalysisGraphTreeNode)[];
  readonly loadChildren?: () =>
    | readonly AnalysisGraphTreeNode[]
    | Promise<readonly AnalysisGraphTreeNode[]>;
  readonly resourceUri?: Uri;
  readonly navigationTarget?: AnalysisGraphNavigationTarget;
};

/**
 * Deduplicate identity strings and sort them for consistent navigation payloads and diagnostics.
 * @param {readonly string[]} values Candidate identity strings, possibly repeated.
 * @returns {readonly string[]} Unique strings sorted with localeCompare.
 */
const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

/**
 * Persisted architecture candidates keyed by address-space name and decimal address, joined with
 * a colon.
 */
type ArchitectureHints = Readonly<Record<string, readonly string[]>>;
/**
 * Worker result containing the project identity, call graph, and architecture hints needed to
 * build navigable tree rows.
 */
interface GraphProjection {
  readonly manifest: AnalysisProjectManifest;
  readonly graph: AnalysisCallGraph;
  readonly hints: ArchitectureHints;
}
/**
 * Per-graph ID indexes shared by lazy row factories; weak keys allow discarded graph projections
 * to be collected.
 */
const graphIndexes = new WeakMap<
  AnalysisCallGraph,
  {
    functions: Map<string, AnalysisCallGraphFunction>;
    calls: Map<string, AnalysisCallGraphEdge>;
    unresolved: Map<string, AnalysisCallGraphUnresolved>;
  }
>();
/**
 * Build ID lookup maps once per immutable graph object and reuse them while its rows remain
 * reachable.
 * @param {AnalysisCallGraph} graph Immutable projected graph whose record IDs are indexed.
 * @returns {object} Shared function, call, and unresolved-record lookup maps.
 */
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

/**
 * Attach the manifest ROM identity and persisted architecture hints to an exact location without
 * inferring mirrored output offsets.
 * @param {string} projectDirectory Owning native project directory.
 * @param {AnalysisProjectManifest} manifest Validated target and ROM identity.
 * @param {ArchitectureHints} shards Persisted architecture candidates by qualified location.
 * @param {object} location Exact address space/address and explicit output offsets.
 * @param {readonly string[]} recordIds Native records contributing to this navigation target.
 * @returns {AnalysisGraphNavigationTarget} Qualified command payload with sorted unique record IDs.
 */
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

/**
 * Create a non-expandable graph row, optionally carrying the qualified target used by the
 * navigation command.
 * @param {string} id Stable row identity.
 * @param {string} label Primary graph text.
 * @param {string} description Secondary summary text.
 * @param {string} icon Product icon ID.
 * @param {string} tooltip Full graph/evidence explanation.
 * @param {AnalysisGraphNavigationTarget} [target] Exact location to navigate to, when available.
 * @returns {AnalysisGraphTreeNode} Non-expandable graph row with optional navigation.
 */
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

/**
 * Retain row factories until expansion so large graph groups construct only the currently
 * requested page.
 * @param {string} id Stable category identity.
 * @param {string} label Category heading.
 * @param {string} description Count or status text.
 * @param {string} icon Product icon ID.
 * @param {Function} entries Deferred row factories in display order.
 * @returns {AnalysisGraphTreeNode} Group that constructs rows only as pages are expanded.
 */
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

/**
 * Display all persisted function labels, falling back to the native function ID when no labels
 * exist.
 * @param {AnalysisCallGraphFunction} fn Persisted function candidate and its labels.
 * @returns {string} Joined label names or the function’s native ID.
 */
const functionName = (fn: AnalysisCallGraphFunction): string =>
  fn.labels.length > 0 ? fn.labels.map(({ name }) => name).join(" / ") : fn.id;

/**
 * Describe a call from the requested tree direction while always navigating to its exact
 * call-site address.
 * @param {string} projectId Project-specific row ID prefix.
 * @param {string} projectDirectory Owning native project directory.
 * @param {AnalysisProjectManifest} manifest Validated target and ROM identity.
 * @param {ArchitectureHints} shards Architecture candidates by qualified location.
 * @param {AnalysisCallGraph} graph Immutable graph used to resolve function ownership.
 * @param {AnalysisCallGraphEdge} call Call edge to display.
 * @param {"all" | "incoming" | "outgoing"} direction Perspective used for the row label.
 * @returns {AnalysisGraphTreeNode} Call row whose navigation target is the caller instruction.
 */
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
  const callee = callees.length > 0 ? callees.join(" / ") : informationHex(call.toAddress, 6);
  let label = `${caller} → ${callee}`;
  if (direction === "incoming") {
    label = `← ${caller}`;
  }
  if (direction === "outgoing") {
    label = `→ ${callee}`;
  }
  return leaf(
    `${projectId}:call:${direction}:${call.id}`,
    label,
    `${call.edgeKind} at ${informationHex(call.fromAddress, 6)}${call.indirect ? " · indirect" : ""}`,
    call.indirect ? "references" : "call-outgoing",
    [
      `${call.addressSpace} ${informationHex(call.fromAddress, 6)} → ${informationHex(call.toAddress, 6)}`,
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

/**
 * Expose unresolved control flow and its reason without inventing a destination or function
 * owner.
 * @param {string} projectId Project-specific row ID prefix.
 * @param {string} projectDirectory Owning native project directory.
 * @param {AnalysisProjectManifest} manifest Validated target and ROM identity.
 * @param {ArchitectureHints} shards Architecture candidates by qualified location.
 * @param {AnalysisCallGraphUnresolved} unresolved Persisted unresolved-flow record and reason.
 * @returns {AnalysisGraphTreeNode} Navigable row retaining unresolved ownership/evidence.
 */
const unresolvedNode = (
  projectId: string,
  projectDirectory: string,
  manifest: AnalysisProjectManifest,
  shards: ArchitectureHints,
  unresolved: AnalysisCallGraphUnresolved,
): AnalysisGraphTreeNode =>
  leaf(
    `${projectId}:unresolved:${unresolved.id}`,
    `${informationHex(unresolved.address, 6)} ${unresolved.flowKind}`,
    `${unresolved.indirect ? "indirect" : "direct"} · ${unresolved.reason}`,
    unresolved.indirect ? "debug-disconnect" : "question",
    [
      `${unresolved.addressSpace} ${informationHex(unresolved.address, 6)}`,
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

/**
 * Create a navigable function row whose incoming, outgoing, and unresolved groups are built only
 * on expansion.
 * @param {string} projectId Project-specific row ID prefix.
 * @param {string} projectDirectory Owning native project directory.
 * @param {AnalysisProjectManifest} manifest Validated target and ROM identity.
 * @param {ArchitectureHints} shards Architecture candidates by qualified location.
 * @param {AnalysisCallGraph} graph Immutable graph containing referenced edge IDs.
 * @param {AnalysisCallGraphFunction} fn Function candidate whose relationships are displayed.
 * @returns {AnalysisGraphTreeNode} Function row with lazily constructed relationship groups.
 */
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
    description: `${fn.addressSpace} ${informationHex(fn.address, 6)} · ${fn.source}`,
    tooltip: [
      `Function: ${fn.id}`,
      `${fn.addressSpace} ${informationHex(fn.address, 6)}`,
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

/**
 * Create lazy graph categories for functions, calls, unresolved flow, and orphan records while
 * retaining ownership diagnostics.
 * @param {string} projectId Project-specific row ID prefix.
 * @param {string} projectDirectory Owning native project directory.
 * @param {AnalysisProjectManifest} manifest Validated target and ROM identity.
 * @param {ArchitectureHints} shards Architecture candidates by qualified location.
 * @param {AnalysisCallGraph} graph Immutable function/call projection from the worker.
 * @returns {readonly AnalysisGraphTreeNode[]} Paged graph categories including orphan diagnostics.
 */
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

/**
 * Read-only native analysis function/call graph tree provider.
 * @see https://code.visualstudio.com/api/references/vscode-api#TreeDataProvider
 * @see https://code.visualstudio.com/api/extension-guides/tree-view
 */
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
    if (!element) {
      return this.loadProjects();
    }
    if (element.loadChildren) {
      return [...(await element.loadChildren())];
    }
    if (element.pageEntries) {
      return this.pagedChildren(element);
    }
    return [];
  }

  navigationTarget(element: unknown): AnalysisGraphNavigationTarget | undefined {
    if (!element || typeof element !== "object") {
      return undefined;
    }
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
    if (entries.length <= PAGE_SIZE) {
      return entries.map((create) => create());
    }
    let stride = PAGE_SIZE;
    while (Math.ceil(entries.length / stride) > PAGE_SIZE) {
      stride *= PAGE_SIZE;
    }
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
