import { isResearchMapping } from "./research-mapping.js";
/** Structural checks for stored JSON. Address bounds and provenance stay in project validation. */
/** True when value is a non-array object record. */
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** True when value is an array whose every element is a string. */
export function isStringArray(value) {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
/** True when value is a finite number. */
export function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
/** True when value is an array whose every element is a finite number. */
function isFiniteNumberArray(value) {
    return Array.isArray(value) && value.every(isFiniteNumber);
}
/** True when value is JSON-safe for codec option storage. */
function isJsonValue(value) {
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
/** True when value is absent or a string. */
function allowsString(value) {
    return value === undefined || typeof value === "string";
}
/** True when value is absent or a finite number. */
function allowsFinite(value) {
    return value === undefined || isFiniteNumber(value);
}
/** True when value is absent or a boolean. */
function allowsBoolean(value) {
    return value === undefined || typeof value === "boolean";
}
/** True when value is a record whose values are all finite numbers. */
function isNumberRecord(value) {
    return isRecord(value) && Object.values(value).every(isFiniteNumber);
}
/** True when attribute values are strings, numbers, or booleans only. */
function isAttributeRecord(value) {
    return (isRecord(value) &&
        Object.values(value).every((entry) => typeof entry === "string" || typeof entry === "boolean" || isFiniteNumber(entry)));
}
/** True when value is an array of object records. */
function isRecordArray(value) {
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
];
/** True when value is a supported interval classification literal. */
function isClassification(value) {
    return CLASSIFICATIONS.some((candidate) => candidate === value);
}
/** True when value is absent or a compact annotation CPU-state record. */
function isAnnotationState(value) {
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
        }
        else if (key === "programBank" ||
            key === "dataBank" ||
            key === "directPage" ||
            key === "stackPointer") {
            if (!isFiniteNumber(entry)) {
                return false;
            }
        }
        else {
            return false;
        }
    }
    return true;
}
/** True when value is absent or a valid control-flow point hint list. */
function isPoints(value) {
    return (value === undefined ||
        (Array.isArray(value) &&
            value.every((point) => point === "in" || point === "out" || point === "end" || point === "read")));
}
/** True when required codec identity fields are present and options are JSON-safe. */
function isCodecFields(value) {
    if (typeof value.codecId !== "string" || typeof value.codecVersion !== "string") {
        return false;
    }
    const provider = value.provider;
    if (provider !== undefined) {
        if (!isRecord(provider) ||
            typeof provider.pluginId !== "string" ||
            typeof provider.pluginVersion !== "string") {
            return false;
        }
    }
    return value.options === undefined || isJsonValue(value.options);
}
/** True when value satisfies the stored asset codec annotation shape. */
function isAsset(value) {
    if (!isRecord(value) || !isCodecFields(value)) {
        return false;
    }
    const compression = value.compression;
    if (compression === undefined) {
        return true;
    }
    return (isRecord(compression) &&
        isCodecFields(compression) &&
        allowsFinite(compression.maximumSize) &&
        allowsFinite(compression.bankStart) &&
        allowsFinite(compression.bankEnd) &&
        allowsFinite(compression.fillByte));
}
/** True when value carries stable record identity and evidence identifiers. */
function hasIdentity(value) {
    return typeof value.id === "string" && isStringArray(value.evidence);
}
/** True when value matches the persisted project label schema. */
export function isProjectLabel(value) {
    return (isRecord(value) &&
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
        allowsString(value.confidence));
}
/** True when value matches the persisted project comment schema. */
export function isProjectComment(value) {
    return (isRecord(value) &&
        hasIdentity(value) &&
        (value.mapping === undefined || isResearchMapping(value.mapping)) &&
        typeof value.addressSpace === "string" &&
        isFiniteNumber(value.address) &&
        typeof value.text === "string" &&
        (value.placement === undefined ||
            value.placement === "before" ||
            value.placement === "inline-instruction"));
}
/** True when value matches the persisted project region schema. */
export function isProjectRegion(value) {
    return (isRecord(value) &&
        hasIdentity(value) &&
        (value.mapping === undefined || isResearchMapping(value.mapping)) &&
        typeof value.addressSpace === "string" &&
        isFiniteNumber(value.start) &&
        isFiniteNumber(value.end) &&
        typeof value.name === "string" &&
        allowsString(value.parentRegion) &&
        allowsString(value.context) &&
        allowsFinite(value.priority) &&
        (value.attributes === undefined || isAttributeRecord(value.attributes)));
}
/** True when value matches the persisted interval annotation schema. */
export function isIntervalAnnotation(value) {
    return (isRecord(value) &&
        hasIdentity(value) &&
        (value.mapping === undefined || isResearchMapping(value.mapping)) &&
        typeof value.addressSpace === "string" &&
        isFiniteNumber(value.start) &&
        isFiniteNumber(value.end) &&
        isClassification(value.classification) &&
        typeof value.architecture === "string" &&
        isAnnotationState(value.state) &&
        isPoints(value.points) &&
        (value.asset === undefined || isAsset(value.asset)));
}
/** True when value is absent or a valid evidence artifact descriptor. */
function isArtifact(value) {
    if (value === undefined) {
        return true;
    }
    return (isRecord(value) &&
        typeof value.format === "string" &&
        typeof value.sha256 === "string" &&
        typeof value.romContentSha256 === "string" &&
        allowsString(value.formatVersion) &&
        allowsString(value.mapper));
}
/** True when value matches the persisted evidence record schema. */
export function isEvidenceRecord(value) {
    return (isRecord(value) &&
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
        isArtifact(value.artifact));
}
/** True when value describes one unsupported import field aggregate. */
function isLossItem(value) {
    return (isRecord(value) &&
        typeof value.field === "string" &&
        isFiniteNumber(value.count) &&
        typeof value.reason === "string");
}
/** True when value matches the persisted import report schema. */
export function isImportReport(value) {
    return (isRecord(value) &&
        typeof value.id === "string" &&
        typeof value.format === "string" &&
        typeof value.sourceName === "string" &&
        typeof value.sourceSha256 === "string" &&
        allowsString(value.sourceVersion) &&
        allowsString(value.indexProfile) &&
        isNumberRecord(value.imported) &&
        Array.isArray(value.unsupported) &&
        value.unsupported.every(isLossItem) &&
        isStringArray(value.warnings));
}
/** True when value matches a persisted CFG node record. */
function isControlFlowNode(value) {
    return (isRecord(value) &&
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
        isStringArray(value.evidencePath));
}
/** True when value matches a persisted CFG edge record. */
function isControlFlowEdge(value) {
    return (isRecord(value) &&
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
        allowsString(value.explanation));
}
/** True when value matches a persisted function candidate record. */
function isFunctionRecord(value) {
    return (isRecord(value) &&
        value.kind === "function" &&
        hasIdentity(value) &&
        typeof value.addressSpace === "string" &&
        isFiniteNumber(value.address) &&
        typeof value.source === "string" &&
        isStringArray(value.evidencePath));
}
/** True when value matches a persisted analysis conflict record. */
function isConflictRecord(value) {
    return (isRecord(value) &&
        value.kind === "conflict" &&
        hasIdentity(value) &&
        typeof value.addressSpace === "string" &&
        isFiniteNumber(value.address) &&
        allowsFinite(value.end) &&
        typeof value.conflictKind === "string" &&
        typeof value.message === "string" &&
        isStringArray(value.nodes));
}
/** True when value matches a persisted unresolved flow record. */
function isUnresolvedRecord(value) {
    return (isRecord(value) &&
        value.kind === "unresolved" &&
        hasIdentity(value) &&
        typeof value.addressSpace === "string" &&
        isFiniteNumber(value.address) &&
        typeof value.flowKind === "string" &&
        typeof value.indirect === "boolean" &&
        typeof value.reason === "string");
}
/** True when value matches a persisted analysis summary record. */
function isSummaryRecord(value) {
    return (isRecord(value) &&
        value.kind === "summary" &&
        hasIdentity(value) &&
        typeof value.architecture === "string" &&
        (value.status === "complete" || value.status === "incomplete") &&
        isNumberRecord(value.coverage) &&
        isFiniteNumber(value.processedWorkItems) &&
        isRecordArray(value.incompleteReasons));
}
/** True when value matches a persisted target override record. */
function isTargetOverride(value) {
    return (isRecord(value) &&
        value.kind === "target-override" &&
        hasIdentity(value) &&
        (value.mapping === undefined || isResearchMapping(value.mapping)) &&
        typeof value.addressSpace === "string" &&
        isFiniteNumber(value.address) &&
        isFiniteNumberArray(value.targets));
}
/** True when value matches a persisted named target set record. */
function isTargetSet(value) {
    return (isRecord(value) &&
        value.kind === "target-set" &&
        hasIdentity(value) &&
        (value.mapping === undefined || isResearchMapping(value.mapping)) &&
        typeof value.addressSpace === "string" &&
        typeof value.name === "string" &&
        isFiniteNumberArray(value.targets));
}
/** True when value matches any discriminated analysis shard record. */
export function isAnalysisRecord(value) {
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
/** Throws with a shard-specific message when validation fails. */
function reject(kind) {
    throw new Error(`Invalid stored ${kind} record.`);
}
/** Parses value as a project label or throws. */
export function requireProjectLabel(value) {
    if (!isProjectLabel(value)) {
        reject("label");
    }
    return value;
}
/** Parses value as a project comment or throws. */
export function requireProjectComment(value) {
    if (!isProjectComment(value)) {
        reject("comment");
    }
    return value;
}
/** Parses value as a project region or throws. */
export function requireProjectRegion(value) {
    if (!isProjectRegion(value)) {
        reject("region");
    }
    return value;
}
/** Parses value as an interval annotation or throws. */
export function requireIntervalAnnotation(value) {
    if (!isIntervalAnnotation(value)) {
        reject("annotation");
    }
    return value;
}
/** Parses value as an evidence record or throws. */
export function requireEvidenceRecord(value) {
    if (!isEvidenceRecord(value)) {
        reject("evidence");
    }
    return value;
}
/** Parses value as an import report or throws. */
export function requireImportReport(value) {
    if (!isImportReport(value)) {
        reject("import");
    }
    return value;
}
/** Parses value as an analysis shard record or throws. */
export function requireAnalysisRecord(value) {
    if (!isAnalysisRecord(value)) {
        reject("analysis");
    }
    return value;
}
export function requireMetadataRecord(kind, value) {
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
//# sourceMappingURL=record-shape.js.map