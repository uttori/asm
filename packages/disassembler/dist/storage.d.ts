/** storage contracts. Node host operations own filesystem resources and must honor documented disposal/publication rules. */
export { ANALYSIS_PROJECT_SQLITE_FILE, ANALYSIS_SQLITE_STORAGE_VERSION, RUNTIME_RECORD_LOOKUP_SQL, analysisProjectSqlitePath, SqliteAnalysisStore, } from "./storage/sqlite-store.js";
export { registerRuntimeHistory } from "./storage/sqlite-runtime-history.js";
export type { InstructionExportRecord, InstructionExecutionSummary, InstructionExecutionSummaryRow, } from "./storage/sqlite-annotation-query.js";
export { DEFAULT_ANALYSIS_STORAGE_POLICY, type AnalysisStoragePolicy, type AnalysisStorageSnapshot, } from "./storage/sqlite-storage-policy.js";
export type { GraphicsEvidenceQuery, GraphicsEvidenceRow, } from "./storage/sqlite-graphics-query.js";
//# sourceMappingURL=storage.d.ts.map