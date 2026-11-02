/** Supported assembly and embedding entry point; specialized host contracts have explicit subpaths. */

export {
  ANALYSIS_PROJECT_FORMAT,
  ANALYSIS_PROJECT_SCHEMA_VERSION,
  ANALYSIS_PROJECT_MANIFEST,
  type AddressSpaceDescriptor,
  type DetectionEvidence,
  type MappingCandidate,
  type ProjectMapping,
  type ShardKind,
  type AnalysisProjectManifest,
  type EvidenceRecord,
  type IntervalAnnotation,
  type ProjectCodecProvider,
  type ProjectCodecValue,
  type ProjectCodecReference,
  type ProjectCompressionReference,
  type ProjectAssetCodecAnnotation,
  type ProjectLabel,
  type ProjectComment,
  type ProjectRegion,
  type ImportLossItem,
  type ImportReport,
  type AnalysisControlFlowNodeRecord,
  type AnalysisControlFlowEdgeRecord,
  type AnalysisFunctionRecord,
  type AnalysisConflictRecord,
  type AnalysisUnresolvedRecord,
  type AnalysisSummaryRecord,
  type AnalysisTargetOverrideRecord,
  type AnalysisTargetSetRecord,
  type MetadataShard,
  type EditableMetadataRecord,
  type AnalysisRecord,
  type RuntimeStateValue,
  type RuntimeExecutionRecord,
  type RuntimeInstructionRecord,
  type RuntimeMemoryAccessRecord,
  type RuntimeCpuStateRecord,
  type RuntimeCoverageRecord,
  type RuntimeControlTargetRecord,
  type RuntimeBusAccessRecord,
  type RuntimeGraphicsAccessRecord,
  type RuntimeEvidenceRecord,
  type AnalysisProjectShards,
  type AnalysisProject,
  type LoadedAnalysisProject,
  type RuntimeRecordProjection,
  type LoadedAnalysisProjectView,
} from "./model/project-types.js";
export { resolveProjectNativeAssetId } from "./model/project-asset-ids.js";
export { EvidencePool } from "./model/evidence-pool.js";
export { withCompactAnalysisOwnership } from "./model/analysis-ownership.js";
export {
  validateSourceLabelName,
  legacySourceLabelName,
  projectSourceLabelNames,
} from "./model/project-labels.js";
export {
  type CopierHeaderSize,
  type RomIdentity,
  type RomLoadOptions,
  detectCopierHeaderSize,
  RomImage,
} from "./model/rom-image.js";
export {
  type RuntimeTraceMemoryAccess,
  type RuntimeInstructionDetail,
  validateRuntimeInstructionDetails,
} from "./model/trace-detail.js";
export {
  type RuntimeBusContext,
  type RuntimeBusFact,
  type RuntimeBusAccess,
  validateRuntimeBusFact,
} from "./model/runtime-bus-types.js";
export type { RuntimePPUEffect } from "./model/runtime-ppu-effect.js";
export {
  type AnalysisCallGraphFunction,
  type AnalysisCallGraphEdge,
  type AnalysisCallGraphUnresolved,
  type AnalysisCallGraph,
} from "./analysis/analysis-graph.js";
export {
  type AnalysisEvidenceSource,
  buildAnalysisSourceCatalog,
  type AnalysisSourceEntry,
  type AnalysisSourceGroup,
  type AnalysisSourceSummary,
} from "./analysis/analysis-sources.js";
export {
  type InstructionEffectiveAddressAnnotation,
  type InstructionStateTransitionAnnotation,
  type InstructionStateObservationAnnotation,
  type InstructionRuntimeCoverageAnnotation,
  type InstructionMemoryAccessAnnotation,
  type InstructionAnalysisAnnotation,
  type InstructionAnnotationDiagnostic,
  type InstructionAnalysisAnnotations,
  buildInstructionAnalysisAnnotations,
} from "./analysis/instruction-annotations.js";
export {
  type StaticControlFlowKind,
  type StaticControlTargetKind,
  type StaticControlTarget,
  type StaticEffectiveAddress,
  type StaticStateEffect,
  type StaticInstruction,
  type StaticDecodeResult,
  type StaticAnalysisSeed,
  type StaticTargetOverride,
  DEFAULT_STATIC_ANALYSIS_MAX_WORK_ITEMS,
  DEFAULT_STATIC_ANALYSIS_MAX_CALL_DEPTH,
  type StaticAnalysisLimits,
  type StaticAnalysisAdapter,
  type StaticAnalysisNode,
  type StaticAnalysisEdgeKind,
  type StaticAnalysisEdge,
  type StaticFunctionCandidate,
  type StaticAnalysisConflict,
  type StaticUnresolvedFlow,
  type StaticCoverageSummary,
  type StaticAnalysisIncompleteReason,
  type StaticAnalysisResult,
  analyzeStaticControlFlow,
} from "./analysis/static-analysis.js";
export {
  explainProjectEvidence,
  type ProjectEvidenceExplanation,
  type AnalysisProjectShardRecord,
} from "./analysis/project-evidence.js";
export {
  type RuntimeEvidenceBatch,
  type RuntimeConflictValue,
  type RuntimeEvidenceConflict,
  type RuntimeEvidenceExplanation,
  type RuntimeEvidenceMergeResult,
  mergeRuntimeEvidence,
  inspectRuntimeEvidence,
} from "./runtime/runtime-evidence.js";
export {
  RUNTIME_INSTRUCTION_TRACE_FORMAT,
  RUNTIME_INSTRUCTION_TRACE_SCHEMA_VERSION,
  type RuntimeInstructionTraceChunk,
  type RuntimeInstructionTraceArtifact,
  type RuntimeInstructionTraceImportContext,
  type RuntimeTraceIndexMode,
  DEFAULT_RUNTIME_TRACE_MAX_INDEX_RECORDS,
  type RuntimeInstructionTraceImportResult,
  type RuntimeInstructionTraceMetadata,
  type RuntimeTraceSource,
  validateRuntimeInstructionTraceMetadata,
  createRuntimeTraceChunkValidator,
  validateRuntimeInstructionTrace,
  importRuntimeInstructionTrace,
  type RuntimeTraceIndexedFact,
  type RuntimeTraceFactIndex,
  type RuntimeTraceImporterStorage,
  runtimeTraceIndexRecordLimit,
  type RuntimeInstructionTraceImporter,
  createRuntimeInstructionTraceImporter,
} from "./runtime/runtime-trace.js";
export {
  DEFAULT_RUNTIME_TRACE_MAX_BYTES,
  type RuntimeTraceFileOptions,
  readRuntimeTraceFileMetadata,
  readRuntimeTraceFileChunks,
  createRuntimeTraceFileSource,
  importRuntimeInstructionTraceFile,
} from "./runtime/runtime-trace-file.js";
export {
  RUNTIME_BUS_TRACE_FORMAT,
  RUNTIME_BUS_INDEX_PROFILE,
  type RuntimeBusTraceMetadata,
  type RuntimeBusTraceSource,
  type RuntimeBusTraceImportContext,
  type RuntimeBusTraceProgress,
  type RuntimeBusActivity,
  type RuntimeBusTraceSummary,
  type RuntimeBusTraceImportResult,
  validateRuntimeBusTraceMetadata,
  createRuntimeBusTraceImporter,
} from "./runtime/runtime-bus-trace.js";
export {
  type RuntimeTransferConfiguration,
  type RuntimeTransferBoundary,
  type RuntimeTransferStatus,
  type RuntimeTransferWindow,
  type RuntimeTransferActivity,
  type RuntimeTransferSummary,
  validateRuntimeTransferBoundary,
  createRuntimeTransferAccumulator,
} from "./runtime/runtime-transfer.js";
export {
  type RuntimeGraphicsTarget,
  type RuntimeGraphicsByte,
  type RuntimeGraphicsWrite,
  type RuntimeGraphicsActivity,
  type RuntimeGraphicsSummary,
  createRuntimeGraphicsAccumulator,
} from "./runtime/runtime-graphics.js";
export type { RuntimePPUSummary } from "./runtime/runtime-ppu.js";

export {
  parseAnalysisProjectManifest,
  openAnalysisProjectStore,
  loadAnalysisProject,
  loadAnalysisProjectView,
  validateProjectRom,
  validateAnalysisProject,
} from "./project/project-store.js";
export { withAnalysisReadSession, type AnalysisReadSession } from "./project/read-session.js";
export {
  ANALYSIS_PROJECT_REVISION_FORMAT,
  ANALYSIS_PROJECT_REVISION_VERSION,
  type AnalysisProjectRevision,
  type AnalysisProjectSnapshot,
  type AnalysisProjectViewSnapshot,
  type PreparedAnalysisProjectTransaction,
  type AnalysisProjectMaintenanceResult,
  type CommittedAnalysisProjectTransaction,
  AnalysisProjectStaleError,
  analysisProjectRevision,
  assertAnalysisProjectRevision,
  loadAnalysisProjectSnapshot,
  loadAnalysisProjectViewSnapshot,
  prepareAnalysisProjectTransaction,
  commitPreparedAnalysisProjectTransaction,
  commitAnalysisProjectTransaction,
  commitAnalysisProjectViewUpdate,
  publishAnalysisProject,
  compactAnalysisProject,
} from "./project/project-transaction.js";
export {
  type RuntimeTraceProjectImportOptions,
  type RuntimeTraceProjectImportResult,
  importRuntimeTraceIntoProject,
  importRuntimeTraceSourceIntoProject,
  commitRuntimeEvidenceBatch,
} from "./project/runtime-trace-project.js";
export {
  type RuntimeBusProjectImportResult,
  importRuntimeBusTraceSourceIntoProject,
} from "./project/runtime-bus-project.js";
export {
  type CaptureAddedCode,
  type CaptureImportNotes,
  isCaptureImportNotes,
  readCaptureImportNotes,
  writeCaptureImportNotes,
  pendingCaptureImportNotes,
  completeCaptureImportNotes,
} from "./project/capture-notes.js";
export {
  SOURCE_EXPORT_FORMAT,
  SOURCE_EXPORT_SCHEMA_VERSION,
  type SourceExportFileKind,
  type SourceExportSpanRole,
  type SourceExportFile,
  type SourceExportInput,
  type SourceExportSpan,
  type SourceExportManifest,
  sourceExportSha256,
  type ByteComparison,
  compareByteImages,
} from "./source/source-export.js";

export {
  RESEARCH_COLLECTIONS,
  type ResearchCollection,
  type ResearchRecord,
  type ResearchDecision,
  type ResearchDocument,
  type ResearchInputLimits,
  RESEARCH_INPUT_LIMIT_NAMES,
  type ResearchSnapshot,
  validateResearchSnapshot,
  validateResearchDecision,
  parseResearchDocument,
  readResearchInputs,
  writeResearchDocument,
} from "./research-inputs/inputs.js";
export {
  type ResearchSymbolIdentity,
  type ResearchSymbolEdit,
  type ResearchSymbolChange,
  changeResearchSymbol,
  renameResearchSymbol,
} from "./research-inputs/symbols.js";
export {
  type ResearchAnalysisRecord,
  type ResearchAnalysisChange,
  type ResearchAnalysisEdit,
  changeResearchAnalysis,
} from "./research-inputs/analysis.js";
export { type HalfOpenInterval, HalfOpenIntervalIndex } from "./internal/interval-index.js";

export { createRuntimeCaptureSource } from "./runtime/capture-instruction-source.js";
export { createRuntimeBusCaptureSource } from "./runtime/capture-bus-source.js";
export { type RuntimeCaptureSource, openRuntimeCaptureSource } from "./runtime/capture-source.js";

export { verifyRuntimeCaptureCompanion } from "./runtime/capture-companion.js";
export {
  type ResearchMapping,
  isResearchMapping,
  matchesResearchMapping,
} from "./model/research-mapping.js";
export { type RuntimeGraphicsFact, isRuntimeGraphicsFact } from "./model/runtime-graphics-fact.js";

export {
  readAnalysisTargetState,
  type AnalysisTargetState,
  type Cpu65816Assumptions,
} from "./model/target-state.js";
