import type { AnalysisControlFlowNodeRecord, AnalysisRecord } from "./project-types.js";

/**
 * Validate compact captured-code ownership without reconstructing every path. A predecessor must
 * lead to the same entry in an acyclic forest. Legacy explicit evidence paths remain independent.
 * Partial views may omit entries/predecessors already checked at publication; any relationships
 * present in the view still have to agree. Publication always uses the default complete scope.
 */
export function validateAnalysisOwnership(
  records: readonly AnalysisRecord[],
  scope: "complete" | "partial" = "complete",
): void {
  if (
    !records.some(
      (record) =>
        record.kind === "cfg-node" &&
        (record.functionEntry !== undefined || record.evidencePredecessor !== undefined),
    )
  ) {
    return;
  }
  const nodes = new Map<string, AnalysisControlFlowNodeRecord>();
  for (const record of records) {
    if (record.kind === "cfg-node") {
      nodes.set(record.id, record);
    }
  }
  const complete = new Set<string>();
  for (const node of nodes.values()) {
    if (node.functionEntry === undefined) {
      if (node.evidencePredecessor !== undefined) {
        throw new Error(`Analysis node '${node.id}' has a predecessor without function ownership.`);
      }
      continue;
    }
    const entry = nodes.get(node.functionEntry);
    if (
      (!entry && scope === "complete") ||
      (entry && (entry.functionEntry !== entry.id || entry.addressSpace !== node.addressSpace))
    ) {
      throw new Error(`Analysis node '${node.id}' has an invalid function entry.`);
    }
    const visiting = new Set<string>();
    let current = node;
    while (!complete.has(current.id)) {
      if (visiting.has(current.id)) {
        throw new Error(`Analysis node '${current.id}' has a cyclic evidence predecessor.`);
      }
      visiting.add(current.id);
      const predecessor = current.evidencePredecessor;
      if (predecessor === undefined) {
        if (current.id !== node.functionEntry) {
          throw new Error(`Analysis node '${current.id}' does not lead to its function entry.`);
        }
        break;
      }
      const previous = nodes.get(predecessor);
      if (
        current.id === node.functionEntry ||
        (!previous && scope === "complete") ||
        (previous &&
          (previous.functionEntry !== node.functionEntry ||
            previous.addressSpace !== node.addressSpace))
      ) {
        throw new Error(`Analysis node '${current.id}' has an invalid evidence predecessor.`);
      }
      // A bounded viewport ends at an omitted predecessor. Fetching its entire ancestry here would
      // make cursor navigation proportional to function size; the stored graph was validated whole.
      if (!previous) {
        break;
      }
      current = previous;
    }
    for (const id of visiting) {
      complete.add(id);
    }
  }
}
