import type { AnalysisRecord } from "./project-types.js";
/**
 * Attach a compact ownership forest to leaf-only CFG records. Entries are accepted CFG node IDs,
 * already matched to function candidates by the target. Calls and returns do not transfer ownership;
 * the caller's continuation is reached through its fallthrough edge. Shared blocks stay unowned.
 * Every node is propagated at most twice, including loss of ownership at an ambiguous merge.
 */
export declare function withCompactAnalysisOwnership(records: readonly AnalysisRecord[], entries: ReadonlySet<string>): readonly AnalysisRecord[];
/**
 * Validate compact CFG ownership without reconstructing every path. A predecessor must
 * lead to the same entry in an acyclic forest. Legacy explicit evidence paths remain independent.
 * Partial views may omit entries/predecessors already checked at publication; any relationships
 * present in the view still have to agree. Publication always uses the default complete scope.
 */
export declare function validateAnalysisOwnership(records: readonly AnalysisRecord[], scope?: "complete" | "partial"): void;
//# sourceMappingURL=analysis-ownership.d.ts.map