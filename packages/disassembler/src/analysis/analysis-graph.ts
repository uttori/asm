import type { ProjectLabel } from "../model/project-types.js";

/** One persisted function candidate with deterministic graph relationships. */
export interface AnalysisCallGraphFunction {
  /** Stable function candidate id in the analysis shard. */
  readonly id: string;
  /** Named address space containing the entry instruction. */
  readonly addressSpace: string;
  /** Entry instruction address within the address space. */
  readonly address: number;
  /** Provenance label describing how the candidate was discovered. */
  readonly source: string;
  /** Project labels attached to this function entry. */
  readonly labels: readonly Pick<ProjectLabel, "id" | "name">[];
  /** CFG node ids owned by this function candidate. */
  readonly nodeIds: readonly string[];
  /** Output-image offsets for nodes belonging to this candidate. */
  readonly outputOffsets: readonly number[];
  /** Resolved call edge ids whose callee is this function. */
  readonly incomingCallIds: readonly string[];
  /** Resolved call edge ids originating from this function. */
  readonly outgoingCallIds: readonly string[];
  /** Unresolved flow record ids owned by this function. */
  readonly unresolvedIds: readonly string[];
  /** Evidence ids supporting this function candidate. */
  readonly evidence: readonly string[];
}

/** A resolved call or interrupt edge between persisted function candidates. */
export interface AnalysisCallGraphEdge {
  /** Stable edge id in the call graph projection. */
  readonly id: string;
  /** Whether the edge represents a call or hardware interrupt transfer. */
  readonly edgeKind: "call" | "interrupt";
  /** Address space shared by the from and to endpoints. */
  readonly addressSpace: string;
  /** Source instruction address for the edge. */
  readonly fromAddress: number;
  /** Destination instruction address when resolved. */
  readonly toAddress: number;
  /** CFG node id at the edge source. */
  readonly fromNodeId: string;
  /** CFG node id at the edge destination when known. */
  readonly toNodeId?: string;
  /** Function candidate ids that include the caller side of the edge. */
  readonly callerFunctionIds: readonly string[];
  /** Function candidate ids that include the callee side of the edge. */
  readonly calleeFunctionIds: readonly string[];
  /** Output offsets at the caller side of the edge. */
  readonly fromOutputOffsets: readonly number[];
  /** Output offsets at the callee side of the edge. */
  readonly toOutputOffsets: readonly number[];
  /** True when the destination is not a fixed direct target. */
  readonly indirect: boolean;
  /** Optional manual override id explaining a non-default resolution. */
  readonly override?: string;
  /** Optional human-readable note attached to the edge. */
  readonly explanation?: string;
  /** Evidence ids supporting this resolved edge. */
  readonly evidence: readonly string[];
}

/** One unresolved control-flow record linked back to its owning function candidates. */
export interface AnalysisCallGraphUnresolved {
  /** Stable unresolved-flow id in the analysis shard. */
  readonly id: string;
  /** Address space containing the unresolved instruction. */
  readonly addressSpace: string;
  /** Instruction address where control flow could not be resolved. */
  readonly address: number;
  /** Analyzer-specific flow kind string for the unresolved site. */
  readonly flowKind: string;
  /** True when the unresolved target is indirect. */
  readonly indirect: boolean;
  /** Analyzer reason the flow remained unresolved. */
  readonly reason: string;
  /** CFG node ids implicated in the unresolved flow. */
  readonly nodeIds: readonly string[];
  /** Function candidates that own the unresolved record. */
  readonly ownerFunctionIds: readonly string[];
  /** Output-image offsets for implicated nodes. */
  readonly outputOffsets: readonly number[];
  /** Evidence ids supporting the unresolved record. */
  readonly evidence: readonly string[];
}

/** Target-neutral function/call projection of native analysis records. */
export interface AnalysisCallGraph {
  /** Function candidates indexed for graph navigation. */
  readonly functions: readonly AnalysisCallGraphFunction[];
  /** Resolved call and interrupt edges between candidates. */
  readonly calls: readonly AnalysisCallGraphEdge[];
  /** Unresolved flow records linked back to owning functions. */
  readonly unresolved: readonly AnalysisCallGraphUnresolved[];
  /** Call edge ids not referenced by any function candidate. */
  readonly orphanCallIds: readonly string[];
  /** Unresolved record ids not referenced by any function candidate. */
  readonly orphanUnresolvedIds: readonly string[];
}
