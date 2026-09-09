import { buildAnalysisCallGraph, type AnalysisCallGraphFunction } from "./analysis-graph.js";
import type { AnalysisControlFlowNodeRecord, AnalysisProjectShards } from "./project-types.js";
import {
  validateRuntimeInstructionTrace,
  type RuntimeInstructionTraceArtifact,
  type RuntimeInstructionTraceMetadata,
  type RuntimeInstructionTraceChunk,
} from "./runtime-trace.js";

/** One statically evidenced routine observed during an explicit trace window. */
export interface ExecutedRoutineSummary {
  readonly functionId: string;
  readonly addressSpace: string;
  readonly address: number;
  readonly name: string;
  readonly labels: readonly string[];
  readonly source: string;
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly instructionEvents: number;
  readonly uniqueInstructionAddresses: number;
  /** Contiguous attributed runs, useful as an approximation rather than a call count. */
  readonly executionSpans: number;
}

/** Dynamic-PC coverage attributed to persisted function candidates without inventing ownership. */
export interface ExecutionWindowSummary {
  readonly architecture: string;
  readonly addressSpace: string;
  readonly complete: boolean;
  readonly observedEvents: number;
  readonly droppedEvents: number;
  readonly uniqueInstructionAddresses: number;
  readonly attributedEvents: number;
  readonly unownedEvents: number;
  readonly ambiguousEvents: number;
  readonly unownedAddresses: readonly number[];
  readonly ambiguousAddresses: readonly number[];
  readonly routines: readonly ExecutedRoutineSummary[];
}

interface MutableRoutineSummary {
  readonly fn: AnalysisCallGraphFunction;
  readonly addresses: Set<number>;
  firstSequence: number;
  lastSequence: number;
  instructionEvents: number;
  executionSpans: number;
}

const addressKey = (addressSpace: string, address: number): string => `${addressSpace}:${address}`;

/**
 * Attributes the ordered PC events in one explicit start/stop window to persisted routines.
 * An address is attributed only when all context-specific CFG nodes agree on one owner.
 * Unknown and ambiguous addresses remain explicit instead of becoming inferred functions.
 * @param {RuntimeInstructionTraceArtifact} value Validated or untrusted trace artifact.
 * @param {AnalysisProjectShards} shards Native analysis records after trace-driven regeneration.
 * @returns {ExecutionWindowSummary} Ordered routine coverage and unattributed-PC diagnostics.
 */
export const summarizeExecutionWindow = (
  value: RuntimeInstructionTraceArtifact,
  shards: AnalysisProjectShards,
): ExecutionWindowSummary => {
  const trace = validateRuntimeInstructionTrace(value);
  const accumulator = createExecutionWindowAccumulator(trace, shards);
  for (const chunk of trace.chunks) accumulator.push(chunk);
  return accumulator.finish();
};

/** Ordered routine attribution without retaining the event stream. */
export interface ExecutionWindowAccumulator {
  push(chunk: RuntimeInstructionTraceChunk): void;
  finish(): ExecutionWindowSummary;
}

/**
 * Prepare routine attribution for incrementally supplied, validated trace chunks.
 * @param {RuntimeInstructionTraceMetadata} trace Recording identity.
 * @param {AnalysisProjectShards} shards Saved analysis.
 * @returns {ExecutionWindowAccumulator} Chunk consumer and final report.
 */
export const createExecutionWindowAccumulator = (
  trace: RuntimeInstructionTraceMetadata,
  shards: AnalysisProjectShards,
): ExecutionWindowAccumulator => {
  const graph = buildAnalysisCallGraph(shards);
  const nodes = shards.analysis.filter(
    (record): record is AnalysisControlFlowNodeRecord => record.kind === "cfg-node",
  );
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const functionsById = new Map(graph.functions.map((fn) => [fn.id, fn]));
  const ownerIdsByAddress = new Map<string, Set<string>>();
  for (const fn of graph.functions) {
    for (const nodeId of fn.nodeIds) {
      const node = nodesById.get(nodeId);
      if (!node) continue;
      const key = addressKey(node.addressSpace, node.address);
      const owners = ownerIdsByAddress.get(key) ?? new Set<string>();
      owners.add(fn.id);
      ownerIdsByAddress.set(key, owners);
    }
  }

  const observedAddresses = new Set<number>();
  const unownedAddresses = new Set<number>();
  const ambiguousAddresses = new Set<number>();
  const observedRoutines = new Map<string, MutableRoutineSummary>();
  let observedEvents = 0;
  let attributedEvents = 0;
  let unownedEvents = 0;
  let ambiguousEvents = 0;
  let priorOwner: string | undefined;

  let complete = false;
  let droppedEvents = 0;
  const push = (chunk: RuntimeInstructionTraceChunk): void => {
    complete = !chunk.active;
    droppedEvents = chunk.droppedEvents;
    for (const [index, address] of chunk.addresses.entries()) {
      const sequence = chunk.sequenceStart + index;
      observedEvents++;
      observedAddresses.add(address);
      const owners = ownerIdsByAddress.get(addressKey(trace.addressSpace, address));
      if (!owners?.size) {
        unownedEvents++;
        unownedAddresses.add(address);
        priorOwner = undefined;
        continue;
      }
      if (owners.size !== 1) {
        ambiguousEvents++;
        ambiguousAddresses.add(address);
        priorOwner = undefined;
        continue;
      }
      const functionId = owners.values().next().value as string;
      const fn = functionsById.get(functionId);
      if (!fn) {
        unownedEvents++;
        unownedAddresses.add(address);
        priorOwner = undefined;
        continue;
      }
      let summary = observedRoutines.get(functionId);
      if (!summary) {
        summary = {
          fn,
          addresses: new Set<number>(),
          firstSequence: sequence,
          lastSequence: sequence,
          instructionEvents: 0,
          executionSpans: 0,
        };
        observedRoutines.set(functionId, summary);
      }
      summary.lastSequence = sequence;
      summary.instructionEvents++;
      summary.addresses.add(address);
      if (priorOwner !== functionId) summary.executionSpans++;
      priorOwner = functionId;
      attributedEvents++;
    }
  };

  const finish = (): ExecutionWindowSummary => {
    const routines: ExecutedRoutineSummary[] = [...observedRoutines.values()]
      .map((summary) => {
        const labels = summary.fn.labels.map(({ name }) => name);
        return {
          functionId: summary.fn.id,
          addressSpace: summary.fn.addressSpace,
          address: summary.fn.address,
          name: labels[0] ?? summary.fn.id,
          labels,
          source: summary.fn.source,
          firstSequence: summary.firstSequence,
          lastSequence: summary.lastSequence,
          instructionEvents: summary.instructionEvents,
          uniqueInstructionAddresses: summary.addresses.size,
          executionSpans: summary.executionSpans,
        };
      })
      .sort(
        (left, right) =>
          left.firstSequence - right.firstSequence ||
          left.address - right.address ||
          left.functionId.localeCompare(right.functionId),
      );

    return {
      architecture: trace.architecture,
      addressSpace: trace.addressSpace,
      complete,
      observedEvents,
      droppedEvents,
      uniqueInstructionAddresses: observedAddresses.size,
      attributedEvents,
      unownedEvents,
      ambiguousEvents,
      unownedAddresses: [...unownedAddresses].sort((left, right) => left - right),
      ambiguousAddresses: [...ambiguousAddresses].sort((left, right) => left - right),
      routines,
    };
  };
  return { push, finish };
};
