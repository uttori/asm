import type { AnalysisProjectShards, AnalysisRecord, EvidenceRecord, ImportReport, IntervalAnnotation, ProjectComment, ProjectLabel, ProjectRegion, ShardKind } from "./project-types.js";
/** Structural checks for stored JSON. Address bounds and provenance stay in project validation. */
/** True when value is a non-array object record. */
export declare function isRecord(value: unknown): value is Record<string, unknown>;
/** True when value is an array whose every element is a string. */
export declare function isStringArray(value: unknown): value is readonly string[];
/** True when value is a finite number. */
export declare function isFiniteNumber(value: unknown): value is number;
/** True when value matches the persisted project label schema. */
export declare function isProjectLabel(value: unknown): value is ProjectLabel;
/** True when value matches the persisted project comment schema. */
export declare function isProjectComment(value: unknown): value is ProjectComment;
/** True when value matches the persisted project region schema. */
export declare function isProjectRegion(value: unknown): value is ProjectRegion;
/** True when value matches the persisted interval annotation schema. */
export declare function isIntervalAnnotation(value: unknown): value is IntervalAnnotation;
/** True when value matches the persisted evidence record schema. */
export declare function isEvidenceRecord(value: unknown): value is EvidenceRecord;
/** True when value matches the persisted import report schema. */
export declare function isImportReport(value: unknown): value is ImportReport;
/** True when value matches any discriminated analysis shard record. */
export declare function isAnalysisRecord(value: unknown): value is AnalysisRecord;
/** Parses value as a project label or throws. */
export declare function requireProjectLabel(value: unknown): ProjectLabel;
/** Parses value as a project comment or throws. */
export declare function requireProjectComment(value: unknown): ProjectComment;
/** Parses value as a project region or throws. */
export declare function requireProjectRegion(value: unknown): ProjectRegion;
/** Parses value as an interval annotation or throws. */
export declare function requireIntervalAnnotation(value: unknown): IntervalAnnotation;
/** Parses value as an evidence record or throws. */
export declare function requireEvidenceRecord(value: unknown): EvidenceRecord;
/** Parses value as an import report or throws. */
export declare function requireImportReport(value: unknown): ImportReport;
/** Parses value as an analysis shard record or throws. */
export declare function requireAnalysisRecord(value: unknown): AnalysisRecord;
/** Parses value as a label shard record or throws. */
export declare function requireMetadataRecord(kind: "labels", value: unknown): ProjectLabel;
/** Parses value as a comment shard record or throws. */
export declare function requireMetadataRecord(kind: "comments", value: unknown): ProjectComment;
/** Parses value as a region shard record or throws. */
export declare function requireMetadataRecord(kind: "regions", value: unknown): ProjectRegion;
/** Parses value as an annotation shard record or throws. */
export declare function requireMetadataRecord(kind: "annotations", value: unknown): IntervalAnnotation;
/** Parses value as an analysis shard record or throws. */
export declare function requireMetadataRecord(kind: "analysis", value: unknown): AnalysisRecord;
/** Parses value as an evidence shard record or throws. */
export declare function requireMetadataRecord(kind: "evidence", value: unknown): EvidenceRecord;
/** Parses value as an import shard record or throws. */
export declare function requireMetadataRecord(kind: "imports", value: unknown): ImportReport;
/** Parses value for the given metadata shard kind or throws. */
export declare function requireMetadataRecord(kind: Exclude<ShardKind, "runtime">, value: unknown): AnalysisProjectShards[Exclude<ShardKind, "runtime">][number];
//# sourceMappingURL=record-shape.d.ts.map