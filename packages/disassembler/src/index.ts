/**
 * Target-neutral contracts for analysis projects, ROM images, static CFG
 * traversal, and deterministic source export. Architecture plugins implement
 * the adapters. This package does not know 65816 or SNES.
 * @module @uttori/asm-disassembler
 */
export * from "./analysis-graph.js";
export * from "./coverage-map.js";
export * from "./instruction-annotations.js";
export * from "./interval-index.js";
export * from "./sqlite-store.js";
export { registerRuntimeHistory } from "./sqlite-runtime-history.js";
export type {
  InstructionExportRecord,
  InstructionExecutionSummary,
  InstructionExecutionSummaryRow,
} from "./sqlite-annotation-query.js";
export * from "./project-store.js";
export * from "./project-transaction.js";
export * from "./project-edit.js";
export * from "./project-asset-ids.js";
export * from "./project-labels.js";
export * from "./project-types.js";
export * from "./rom-image.js";
export * from "./runtime-evidence.js";
export * from "./runtime-trace.js";
export * from "./runtime-trace-file.js";
export * from "./source-export.js";
export * from "./source-ownership.js";
export * from "./static-analysis.js";

export * from "./trace-detail.js";

export * from "./analysis-sources.js";

export * from "./runtime-trace-project.js";

export { canonicalValue } from "./canonical-json.js";

export {
  DEFAULT_ANALYSIS_STORAGE_POLICY,
  type AnalysisStoragePolicy,
  type AnalysisStorageSnapshot,
} from "./sqlite-storage-policy.js";
export { RUNTIME_ANALYSIS_PROFILE, project65816AnalysisState } from "./runtime-trace-profile.js";

export * from "./runtime-bus-types.js";
export * from "./runtime-bus-trace.js";
export * from "./runtime-bus-project.js";

export * from "./runtime-transfer.js";
export * from "./runtime-graphics.js";

export type { RuntimePPUEffect, RuntimePPUSummary } from "./runtime-ppu.js";

export * from "./durable-files.js";
export * from "./source-generation.js";
export * from "./source-publication.js";
