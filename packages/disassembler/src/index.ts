/**
 * Analysis projects, ROM identity, bounded static traversal, runtime evidence, and verified
 * source publication. Target plugins own decoding/mapping; capture contracts retain their
 * explicit architecture identities.
 * @module @uttori/asm-disassembler
 */

// Semantic contracts and record validation are shared by every operation.
export * from "./model/project-types.js";
export * from "./model/project-asset-ids.js";
export * from "./model/project-labels.js";
export * from "./model/rom-image.js";
export * from "./model/trace-detail.js";
export * from "./model/runtime-bus-types.js";
export type { RuntimePPUEffect } from "./model/runtime-ppu-effect.js";

// Read-only projections and proposed edits do not publish a project revision.
export * from "./analysis/analysis-graph.js";
export * from "./analysis/analysis-sources.js";
export * from "./analysis/coverage-map.js";
export * from "./analysis/instruction-annotations.js";
export * from "./analysis/static-analysis.js";
export {
  explainProjectEvidence,
  type ProjectEvidenceExplanation,
  type AnalysisProjectShardRecord,
} from "./analysis/project-evidence.js";
export * from "./edits/project-edit.js";
export * from "./edits/metadata-edit.js";

export * from "./runtime/runtime-evidence.js";
export * from "./runtime/runtime-trace.js";
export * from "./runtime/runtime-trace-file.js";
export {
  RUNTIME_ANALYSIS_PROFILE,
  project65816AnalysisState,
} from "./runtime/runtime-trace-profile.js";
export * from "./runtime/runtime-bus-trace.js";
export * from "./runtime/runtime-transfer.js";
export * from "./runtime/runtime-graphics.js";
export type { RuntimePPUSummary } from "./runtime/runtime-ppu.js";

// The connection facade stays public; codecs and query implementation helpers stay internal.
export * from "./storage/sqlite-store.js";
export { registerRuntimeHistory } from "./storage/sqlite-runtime-history.js";
export type {
  InstructionExportRecord,
  InstructionExecutionSummary,
  InstructionExecutionSummaryRow,
} from "./storage/sqlite-annotation-query.js";
export {
  DEFAULT_ANALYSIS_STORAGE_POLICY,
  type AnalysisStoragePolicy,
  type AnalysisStorageSnapshot,
} from "./storage/sqlite-storage-policy.js";
export * from "./project/project-store.js";
export * from "./project/project-transaction.js";
export * from "./project/runtime-trace-project.js";
export * from "./project/runtime-bus-project.js";

export * from "./source/source-export.js";
export * from "./source/source-ownership.js";
export * from "./source/source-generation.js";
export * from "./source/source-publication.js";
export * from "./internal/interval-index.js";
export * from "./internal/durable-files.js";
