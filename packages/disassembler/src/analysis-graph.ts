import type {
  AnalysisControlFlowEdgeRecord,
  AnalysisControlFlowNodeRecord,
  AnalysisFunctionRecord,
  AnalysisProjectShards,
  AnalysisUnresolvedRecord,
  ProjectLabel,
} from "./project-types.js";

/** One persisted function candidate with deterministic graph relationships. */
export interface AnalysisCallGraphFunction {
  readonly id: string;
  readonly addressSpace: string;
  readonly address: number;
  readonly source: string;
  readonly labels: readonly Pick<ProjectLabel, "id" | "name">[];
  readonly nodeIds: readonly string[];
  readonly outputOffsets: readonly number[];
  readonly incomingCallIds: readonly string[];
  readonly outgoingCallIds: readonly string[];
  readonly unresolvedIds: readonly string[];
  readonly evidence: readonly string[];
}

/** A resolved call or interrupt edge between persisted function candidates. */
export interface AnalysisCallGraphEdge {
  readonly id: string;
  readonly edgeKind: "call" | "interrupt";
  readonly addressSpace: string;
  readonly fromAddress: number;
  readonly toAddress: number;
  readonly fromNodeId: string;
  readonly toNodeId?: string;
  readonly callerFunctionIds: readonly string[];
  readonly calleeFunctionIds: readonly string[];
  readonly fromOutputOffsets: readonly number[];
  readonly toOutputOffsets: readonly number[];
  readonly indirect: boolean;
  readonly override?: string;
  readonly explanation?: string;
  readonly evidence: readonly string[];
}

/** One unresolved control-flow record linked back to its owning function candidates. */
export interface AnalysisCallGraphUnresolved {
  readonly id: string;
  readonly addressSpace: string;
  readonly address: number;
  readonly flowKind: string;
  readonly indirect: boolean;
  readonly reason: string;
  readonly nodeIds: readonly string[];
  readonly ownerFunctionIds: readonly string[];
  readonly outputOffsets: readonly number[];
  readonly evidence: readonly string[];
}

/** Target-neutral function/call projection of native analysis records. */
export interface AnalysisCallGraph {
  readonly functions: readonly AnalysisCallGraphFunction[];
  readonly calls: readonly AnalysisCallGraphEdge[];
  readonly unresolved: readonly AnalysisCallGraphUnresolved[];
  readonly orphanCallIds: readonly string[];
  readonly orphanUnresolvedIds: readonly string[];
}

const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const sortedUniqueNumbers = (values: readonly number[]): readonly number[] =>
  [...new Set(values)].sort((left, right) => left - right);

const addressKey = (addressSpace: string, address: number): string => `${addressSpace}:${address}`;

const outputOffsetsFor = (
  nodeIds: readonly string[],
  nodesById: ReadonlyMap<string, AnalysisControlFlowNodeRecord>,
): readonly number[] =>
  sortedUniqueNumbers(
    nodeIds.flatMap((id) => {
      const node = nodesById.get(id);
      return node ? [node.fileOffset] : [];
    }),
  );

/**
 * Builds a deterministic function/call view without inventing functions or resolving a mapper.
 * Function ownership walks each CFG node's persisted evidence path backwards to the nearest
 * function-entry address. Missing ownership remains explicit in the orphan lists.
 * @param {AnalysisProjectShards} shards Validated native project shards.
 * @returns {AnalysisCallGraph} Functions, resolved calls, unresolved sites, and orphan ids.
 */
export const buildAnalysisCallGraph = (shards: AnalysisProjectShards): AnalysisCallGraph => {
  const nodes = shards.analysis.filter(
    (record): record is AnalysisControlFlowNodeRecord => record.kind === "cfg-node",
  );
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const functionRecords = shards.analysis.filter(
    (record): record is AnalysisFunctionRecord => record.kind === "function",
  );
  const functionsByAddress = new Map<string, AnalysisFunctionRecord[]>();
  for (const fn of functionRecords) {
    const key = addressKey(fn.addressSpace, fn.address);
    functionsByAddress.set(key, [...(functionsByAddress.get(key) ?? []), fn]);
  }

  const ownerFunctionIds = (node: AnalysisControlFlowNodeRecord | undefined): readonly string[] => {
    if (!node) return [];
    const path = node.evidencePath.length > 0 ? node.evidencePath : [node.id];
    for (const nodeId of [...path].reverse()) {
      const candidate = nodesById.get(nodeId);
      if (!candidate) continue;
      const matches = functionsByAddress.get(addressKey(candidate.addressSpace, candidate.address));
      if (matches) return sortedUnique(matches.map(({ id }) => id));
    }
    return [];
  };

  const callRecords = shards.analysis.filter(
    (record): record is AnalysisControlFlowEdgeRecord =>
      record.kind === "cfg-edge" &&
      (record.edgeKind === "call" || record.edgeKind === "interrupt") &&
      record.toAddress !== undefined,
  );
  const calls: AnalysisCallGraphEdge[] = callRecords.map((edge) => {
    const fromNode = nodesById.get(edge.from);
    const callerFunctionIds = ownerFunctionIds(fromNode);
    const calleeFunctionIds = sortedUnique(
      (functionsByAddress.get(addressKey(edge.addressSpace, edge.toAddress!)) ?? []).map(
        ({ id }) => id,
      ),
    );
    const toNodeIds = edge.to ? [edge.to] : [];
    return {
      id: edge.id,
      edgeKind: edge.edgeKind as "call" | "interrupt",
      addressSpace: edge.addressSpace,
      fromAddress: edge.fromAddress,
      toAddress: edge.toAddress!,
      fromNodeId: edge.from,
      ...(edge.to ? { toNodeId: edge.to } : {}),
      callerFunctionIds,
      calleeFunctionIds,
      fromOutputOffsets: outputOffsetsFor([edge.from], nodesById),
      toOutputOffsets: outputOffsetsFor(toNodeIds, nodesById),
      indirect: edge.indirect,
      ...(edge.override ? { override: edge.override } : {}),
      ...(edge.explanation ? { explanation: edge.explanation } : {}),
      evidence: edge.evidence,
    };
  });

  const unresolvedRecords = shards.analysis.filter(
    (record): record is AnalysisUnresolvedRecord => record.kind === "unresolved",
  );
  const unresolvedEdges = shards.analysis.filter(
    (record): record is AnalysisControlFlowEdgeRecord =>
      record.kind === "cfg-edge" && record.edgeKind === "unresolved",
  );
  const unresolved: AnalysisCallGraphUnresolved[] = unresolvedRecords.map((record) => {
    const matchingNodes = sortedUnique(
      unresolvedEdges
        .filter(
          (edge) =>
            edge.addressSpace === record.addressSpace && edge.fromAddress === record.address,
        )
        .map(({ from }) => from),
    );
    return {
      id: record.id,
      addressSpace: record.addressSpace,
      address: record.address,
      flowKind: record.flowKind,
      indirect: record.indirect,
      reason: record.reason,
      nodeIds: matchingNodes,
      ownerFunctionIds: sortedUnique(
        matchingNodes.flatMap((id) => ownerFunctionIds(nodesById.get(id))),
      ),
      outputOffsets: outputOffsetsFor(matchingNodes, nodesById),
      evidence: record.evidence,
    };
  });

  const nodeIdsByFunction = new Map<string, string[]>();
  for (const node of nodes) {
    for (const owner of ownerFunctionIds(node)) {
      nodeIdsByFunction.set(owner, [...(nodeIdsByFunction.get(owner) ?? []), node.id]);
    }
  }
  const functions: AnalysisCallGraphFunction[] = functionRecords.map((fn) => {
    const nodeIds = sortedUnique(nodeIdsByFunction.get(fn.id) ?? []);
    return {
      id: fn.id,
      addressSpace: fn.addressSpace,
      address: fn.address,
      source: fn.source,
      labels: shards.labels
        .filter((label) => label.addressSpace === fn.addressSpace && label.address === fn.address)
        .map(({ id, name }) => ({ id, name }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      nodeIds,
      outputOffsets: outputOffsetsFor(
        nodeIds.filter((id) => nodesById.get(id)?.address === fn.address),
        nodesById,
      ),
      incomingCallIds: sortedUnique(
        calls
          .filter(({ calleeFunctionIds }) => calleeFunctionIds.includes(fn.id))
          .map(({ id }) => id),
      ),
      outgoingCallIds: sortedUnique(
        calls
          .filter(({ callerFunctionIds }) => callerFunctionIds.includes(fn.id))
          .map(({ id }) => id),
      ),
      unresolvedIds: sortedUnique(
        unresolved
          .filter(({ ownerFunctionIds: owners }) => owners.includes(fn.id))
          .map(({ id }) => id),
      ),
      evidence: fn.evidence,
    };
  });

  return {
    functions: functions.sort(
      (left, right) =>
        left.addressSpace.localeCompare(right.addressSpace) ||
        left.address - right.address ||
        left.id.localeCompare(right.id),
    ),
    calls: calls.sort(
      (left, right) =>
        left.addressSpace.localeCompare(right.addressSpace) ||
        left.fromAddress - right.fromAddress ||
        left.toAddress - right.toAddress ||
        left.id.localeCompare(right.id),
    ),
    unresolved: unresolved.sort(
      (left, right) =>
        left.addressSpace.localeCompare(right.addressSpace) ||
        left.address - right.address ||
        left.id.localeCompare(right.id),
    ),
    orphanCallIds: sortedUnique(
      calls
        .filter(
          ({ callerFunctionIds, calleeFunctionIds }) =>
            callerFunctionIds.length === 0 || calleeFunctionIds.length === 0,
        )
        .map(({ id }) => id),
    ),
    orphanUnresolvedIds: sortedUnique(
      unresolved.filter(({ ownerFunctionIds: owners }) => owners.length === 0).map(({ id }) => id),
    ),
  };
};
