import type { AnalysisRecord } from "./project-types.js";
/**
 * Validate compact captured-code ownership without reconstructing every path. A predecessor must
 * lead to the same entry in an acyclic forest. Legacy explicit evidence paths remain independent.
 * Partial views may omit entries/predecessors already checked at publication; any relationships
 * present in the view still have to agree. Publication always uses the default complete scope.
 */
export declare function validateAnalysisOwnership(records: readonly AnalysisRecord[], scope?: "complete" | "partial"): void;
//# sourceMappingURL=analysis-ownership.d.ts.map