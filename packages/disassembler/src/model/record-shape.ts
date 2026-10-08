import type {
  AnalysisConflictRecord,
  AnalysisControlFlowEdgeRecord,
  AnalysisControlFlowNodeRecord,
  AnalysisFunctionRecord,
  AnalysisProjectShards,
  AnalysisRecord,
  AnalysisSummaryRecord,
  AnalysisTargetOverrideRecord,
  AnalysisTargetSetRecord,
  AnalysisUnresolvedRecord,
  EvidenceRecord,
  ImportReport,
  IntervalAnnotation,
  ProjectAssetCodecAnnotation,
  ProjectCodecValue,
  ProjectComment,
  ProjectLabel,
  ProjectRegion,
  ShardKind,
} from "./project-types.js";
import { isResearchMapping } from "./research-mapping.js";

/** Structural checks for stored JSON. Address bounds and provenance stay in project validation. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteNumberArray(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}

function isJsonValue(value: unknown): value is ProjectCodecValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (isFiniteNumber(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function allowsString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function allowsFinite(value: unknown): boolean {
  return value === undefined || isFiniteNumber(value);
}

function allowsBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function isNumberRecord(value: unknown): value is Readonly<Record<string, number>> {
  return isRecord(value) && Object.values(value).every(isFiniteNumber);
}

function isAttributeRecord(
  value: unknown,
): value is Readonly<Record<string, string | number | boolean>> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => typeof entry === "string" || typeof entry === "boolean" || isFiniteNumber(entry),
    )
  );
}

function isRecordArray(value: unknown): value is readonly Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

const CLASSIFICATIONS = [
  "unreached",
  "opcode",
  "operand",
  "data8",
  "data16",
  "data24",
  "data32",
  "pointer16",
  "pointer24",
  "pointer32",
  "graphics",
  "music",
  "compressed",
  "asset",
  "empty",
  "text",
] as const;

function isClassification(value: unknown): value is IntervalAnnotation["classification"] {
  return CLASSIFICATIONS.some((candidate) => candidate === value);
}

function isAnnotationState(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  for (const key of Object.keys(value)) {
    const entry = value[key];
    if (key === "e" || key === "m" || key === "x" || key === "carry") {
      if (typeof entry !== "boolean") {
        return false;
      }
    } else if (
      key === "programBank" ||
      key === "dataBank" ||
      key === "directPage" ||
      key === "stackPointer"
    ) {
      if (!isFiniteNumber(entry)) {
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}

function isPoints(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (point) => point === "in" || point === "out" || point === "end" || point === "read",
      ))
  );
}

function isCodecFields(value: Record<string, unknown>): boolean {
  if (typeof value.codecId !== "string" || typeof value.codecVersion !== "string") {
    return false;
  }
  const provider = value.provider;
  if (provider !== undefined) {
    if (
      !isRecord(provider) ||
      typeof provider.pluginId !== "string" ||
      typeof provider.pluginVersion !== "string"
    ) {
      return false;
    }
  }
  return value.options === undefined || isJsonValue(value.options);
}

function isAsset(value: unknown): value is ProjectAssetCodecAnnotation {
  if (!isRecord(value) || !isCodecFields(value)) {
    return false;
  }
  const compression = value.compression;
  if (compression === undefined) {
    return true;
  }
  return (
    isRecord(compression) &&
    isCodecFields(compression) &&
    allowsFinite(compression.maximumSize) &&
    allowsFinite(compression.bankStart) &&
    allowsFinite(compression.bankEnd) &&
    allowsFinite(compression.fillByte)
  );
}

function hasIdentity(value: Record<string, unknown>): boolean {
  return typeof value.id === "string" && isStringArray(value.evidence);
}

export function isProjectLabel(value: unknown): value is ProjectLabel {
  return (
    isRecord(value) &&
    hasIdentity(value) &&
    (value.mapping === undefined || isResearchMapping(value.mapping)) &&
    typeof value.addressSpace === "string" &&
    isFiniteNumber(value.address) &&
    typeof value.name === "string" &&
    allowsString(value.comment) &&
    allowsString(value.sourceName) &&
    (value.aliases === undefined || isStringArray(value.aliases)) &&
    allowsString(value.inlineComment) &&
    allowsBoolean(value.analysisEntryPoint) &&
    allowsBoolean(value.suppressed) &&
    allowsString(value.author) &&
    allowsString(value.confidence)
  );
}

export function isProjectComment(value: unknown): value is ProjectComment {
  return (
    isRecord(value) &&
    hasIdentity(value) &&
    (value.mapping === undefined || isResearchMapping(value.mapping)) &&
    typeof value.addressSpace === "string" &&
    isFiniteNumber(value.address) &&
    typeof value.text === "string" &&
    (value.placement === undefined ||
      value.placement === "before" ||
      value.placement === "inline-instruction")
  );
}

export function isProjectRegion(value: unknown): value is ProjectRegion {
  return (
    isRecord(value) &&
    hasIdentity(value) &&
    (value.mapping === undefined || isResearchMapping(value.mapping)) &&
    typeof value.addressSpace === "string" &&
    isFiniteNumber(value.start) &&
    isFiniteNumber(value.end) &&
    typeof value.name === "string" &&
    allowsString(value.parentRegion) &&
    allowsString(value.context) &&
    allowsFinite(value.priority) &&
    (value.attributes === undefined || isAttributeRecord(value.attributes))
  );
}

export function isIntervalAnnotation(value: unknown): value is IntervalAnnotation {
  return (
    isRecord(value) &&
    hasIdentity(value) &&
    (value.mapping === undefined || isResearchMapping(value.mapping)) &&
    typeof value.addressSpace === "string" &&
    isFiniteNumber(value.start) &&
    isFiniteNumber(value.end) &&
    isClassification(value.classification) &&
    typeof value.architecture === "string" &&
    isAnnotationState(value.state) &&
    isPoints(value.points) &&
    (value.asset === undefined || isAsset(value.asset))
  );
}

function isArtifact(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  return (
    isRecord(value) &&
    typeof value.format === "string" &&
    typeof value.sha256 === "string" &&
    typeof value.romContentSha256 === "string" &&
    allowsString(value.formatVersion) &&
    allowsString(value.mapper)
  );
}

export function isEvidenceRecord(value: unknown): value is EvidenceRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.source === "manual" ||
      value.source === "import" ||
      value.source === "detector" ||
      value.source === "static" ||
      value.source === "runtime") &&
    typeof value.sourceId === "string" &&
    (value.confidence === "certain" ||
      value.confidence === "high" ||
      value.confidence === "medium" ||
      value.confidence === "low" ||
      value.confidence === "unknown") &&
    allowsString(value.detail) &&
    isArtifact(value.artifact)
  );
}

function isLossItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.field === "string" &&
    isFiniteNumber(value.count) &&
    typeof value.reason === "string"
  );
}

export function isImportReport(value: unknown): value is ImportReport {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.format === "string" &&
    typeof value.sourceName === "string" &&
    typeof value.sourceSha256 === "string" &&
    allowsString(value.sourceVersion) &&
    allowsString(value.indexProfile) &&
    isNumberRecord(value.imported) &&
    Array.isArray(value.unsupported) &&
    value.unsupported.every(isLossItem) &&
    isStringArray(value.warnings)
  );
}

function isControlFlowNode(value: unknown): value is AnalysisControlFlowNodeRecord {
  return (
    isRecord(value) &&
    value.kind === "cfg-node" &&
    hasIdentity(value) &&
    typeof value.addressSpace === "string" &&
    isFiniteNumber(value.address) &&
    allowsFinite(value.fileOffset) &&
    (value.bytes === undefined || isFiniteNumberArray(value.bytes)) &&
    isFiniteNumber(value.size) &&
    isFiniteNumber(value.opcode) &&
    typeof value.specificationId === "string" &&
    typeof value.mnemonic === "string" &&
    typeof value.mode === "string" &&
    isFiniteNumberArray(value.context) &&
    isRecord(value.incomingState) &&
    isRecord(value.outgoingState) &&
    isRecordArray(value.effectiveAddresses) &&
    typeof value.entryPoint === "string" &&
    allowsString(value.functionEntry) &&
    allowsString(value.evidencePredecessor) &&
    isStringArray(value.evidencePath)
  );
}

function isControlFlowEdge(value: unknown): value is AnalysisControlFlowEdgeRecord {
  return (
    isRecord(value) &&
    value.kind === "cfg-edge" &&
    hasIdentity(value) &&
    typeof value.addressSpace === "string" &&
    typeof value.from === "string" &&
    isFiniteNumber(value.fromAddress) &&
    allowsString(value.to) &&
    allowsFinite(value.toAddress) &&
    typeof value.edgeKind === "string" &&
    typeof value.indirect === "boolean" &&
    allowsString(value.override) &&
    allowsString(value.explanation)
  );
}

function isFunctionRecord(value: unknown): value is AnalysisFunctionRecord {
  return (
    isRecord(value) &&
    value.kind === "function" &&
    hasIdentity(value) &&
    typeof value.addressSpace === "string" &&
    isFiniteNumber(value.address) &&
    typeof value.source === "string" &&
    isStringArray(value.evidencePath)
  );
}

function isConflictRecord(value: unknown): value is AnalysisConflictRecord {
  return (
    isRecord(value) &&
    value.kind === "conflict" &&
    hasIdentity(value) &&
    typeof value.addressSpace === "string" &&
    isFiniteNumber(value.address) &&
    allowsFinite(value.end) &&
    typeof value.conflictKind === "string" &&
    typeof value.message === "string" &&
    isStringArray(value.nodes)
  );
}

function isUnresolvedRecord(value: unknown): value is AnalysisUnresolvedRecord {
  return (
    isRecord(value) &&
    value.kind === "unresolved" &&
    hasIdentity(value) &&
    typeof value.addressSpace === "string" &&
    isFiniteNumber(value.address) &&
    typeof value.flowKind === "string" &&
    typeof value.indirect === "boolean" &&
    typeof value.reason === "string"
  );
}

function isSummaryRecord(value: unknown): value is AnalysisSummaryRecord {
  return (
    isRecord(value) &&
    value.kind === "summary" &&
    hasIdentity(value) &&
    typeof value.architecture === "string" &&
    (value.status === "complete" || value.status === "incomplete") &&
    isNumberRecord(value.coverage) &&
    isFiniteNumber(value.processedWorkItems) &&
    isRecordArray(value.incompleteReasons)
  );
}

function isTargetOverride(value: unknown): value is AnalysisTargetOverrideRecord {
  return (
    isRecord(value) &&
    value.kind === "target-override" &&
    hasIdentity(value) &&
    (value.mapping === undefined || isResearchMapping(value.mapping)) &&
    typeof value.addressSpace === "string" &&
    isFiniteNumber(value.address) &&
    isFiniteNumberArray(value.targets)
  );
}

function isTargetSet(value: unknown): value is AnalysisTargetSetRecord {
  return (
    isRecord(value) &&
    value.kind === "target-set" &&
    hasIdentity(value) &&
    (value.mapping === undefined || isResearchMapping(value.mapping)) &&
    typeof value.addressSpace === "string" &&
    typeof value.name === "string" &&
    isFiniteNumberArray(value.targets)
  );
}

export function isAnalysisRecord(value: unknown): value is AnalysisRecord {
  if (!isRecord(value)) {
    return false;
  }
  switch (value.kind) {
    case "cfg-node":
      return isControlFlowNode(value);
    case "cfg-edge":
      return isControlFlowEdge(value);
    case "function":
      return isFunctionRecord(value);
    case "conflict":
      return isConflictRecord(value);
    case "unresolved":
      return isUnresolvedRecord(value);
    case "summary":
      return isSummaryRecord(value);
    case "target-override":
      return isTargetOverride(value);
    case "target-set":
      return isTargetSet(value);
    default:
      return false;
  }
}

function reject(kind: string): never {
  throw new Error(`Invalid stored ${kind} record.`);
}

export function requireProjectLabel(value: unknown): ProjectLabel {
  if (!isProjectLabel(value)) {
    reject("label");
  }
  return value;
}

export function requireProjectComment(value: unknown): ProjectComment {
  if (!isProjectComment(value)) {
    reject("comment");
  }
  return value;
}

export function requireProjectRegion(value: unknown): ProjectRegion {
  if (!isProjectRegion(value)) {
    reject("region");
  }
  return value;
}

export function requireIntervalAnnotation(value: unknown): IntervalAnnotation {
  if (!isIntervalAnnotation(value)) {
    reject("annotation");
  }
  return value;
}

export function requireEvidenceRecord(value: unknown): EvidenceRecord {
  if (!isEvidenceRecord(value)) {
    reject("evidence");
  }
  return value;
}

export function requireImportReport(value: unknown): ImportReport {
  if (!isImportReport(value)) {
    reject("import");
  }
  return value;
}

export function requireAnalysisRecord(value: unknown): AnalysisRecord {
  if (!isAnalysisRecord(value)) {
    reject("analysis");
  }
  return value;
}

export function requireMetadataRecord(kind: "labels", value: unknown): ProjectLabel;
export function requireMetadataRecord(kind: "comments", value: unknown): ProjectComment;
export function requireMetadataRecord(kind: "regions", value: unknown): ProjectRegion;
export function requireMetadataRecord(kind: "annotations", value: unknown): IntervalAnnotation;
export function requireMetadataRecord(kind: "analysis", value: unknown): AnalysisRecord;
export function requireMetadataRecord(kind: "evidence", value: unknown): EvidenceRecord;
export function requireMetadataRecord(kind: "imports", value: unknown): ImportReport;
export function requireMetadataRecord(
  kind: Exclude<ShardKind, "runtime">,
  value: unknown,
): AnalysisProjectShards[Exclude<ShardKind, "runtime">][number];
export function requireMetadataRecord(
  kind: Exclude<ShardKind, "runtime">,
  value: unknown,
): AnalysisProjectShards[Exclude<ShardKind, "runtime">][number] {
  switch (kind) {
    case "labels":
      return requireProjectLabel(value);
    case "comments":
      return requireProjectComment(value);
    case "regions":
      return requireProjectRegion(value);
    case "annotations":
      return requireIntervalAnnotation(value);
    case "analysis":
      return requireAnalysisRecord(value);
    case "evidence":
      return requireEvidenceRecord(value);
    case "imports":
      return requireImportReport(value);
    default:
      return reject(kind);
  }
}
