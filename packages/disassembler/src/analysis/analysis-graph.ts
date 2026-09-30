import type { ProjectLabel } from "../model/project-types.js";

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
