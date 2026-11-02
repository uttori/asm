import type { AnalysisControlFlowNodeRecord, AnalysisRecord } from "./project-types.js";

/**
 * Attach a compact ownership forest to leaf-only CFG records. Entries are accepted CFG node IDs,
 * already matched to function candidates by the target. Calls and returns do not transfer ownership;
 * the caller's continuation is reached through its fallthrough edge. Shared blocks stay unowned.
 * Every node is propagated at most twice, including loss of ownership at an ambiguous merge.
 */
export function withCompactAnalysisOwnership(
  records: readonly AnalysisRecord[],
  entries: ReadonlySet<string>,
): readonly AnalysisRecord[] {
  const outgoing = new Map<string, string[]>();
  const nodes = new Set<string>();
  for (const record of records) {
    if (record.kind === "cfg-node") {
      nodes.add(record.id);
    } else if (
      record.kind === "cfg-edge" &&
      record.to &&
      ["branch", "fallthrough", "jump"].includes(record.edgeKind)
    ) {
      const targets = outgoing.get(record.from) ?? [];
      targets.push(record.to);
      outgoing.set(record.from, targets);
    }
  }
  const owners = new Map<string, string | null>();
  const predecessors = new Map<string, string>();
  const queue: string[] = [];
  for (const entry of entries) {
    if (nodes.has(entry)) {
      owners.set(entry, entry);
      queue.push(entry);
    }
  }
  for (const id of queue) {
    const owner = owners.get(id)!;
    for (const target of outgoing.get(id) ?? []) {
      // Removed/blocked decode targets are diagnostics, never members of the ownership forest.
      if (!nodes.has(target) || entries.has(target)) {
        continue;
      }
      if (!owners.has(target)) {
        owners.set(target, owner);
        if (owner) {
          predecessors.set(target, id);
        }
        queue.push(target);
      } else if (owners.get(target) !== null && owners.get(target) !== owner) {
        owners.set(target, null);
        predecessors.delete(target);
        queue.push(target);
      }
    }
  }
  return records.map((record) => {
    if (record.kind !== "cfg-node") {
      return record;
    }
    const owner = owners.get(record.id);
    return {
      ...record,
      ...(owner ? { functionEntry: owner, evidencePredecessor: predecessors.get(record.id) } : {}),
    };
  });
}

/**
 * Validate compact CFG ownership without reconstructing every path. A predecessor must
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
