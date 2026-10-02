import type { AnalysisProjectShards, AnalysisRecord, EvidenceRecord, ImportReport, IntervalAnnotation, ProjectComment, ProjectLabel, ProjectRegion, ShardKind } from "./project-types.js";
/** Structural checks for stored JSON. Address bounds and provenance stay in project validation. */
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function isStringArray(value: unknown): value is readonly string[];
export declare function isFiniteNumber(value: unknown): value is number;
export declare function isProjectLabel(value: unknown): value is ProjectLabel;
export declare function isProjectComment(value: unknown): value is ProjectComment;
export declare function isProjectRegion(value: unknown): value is ProjectRegion;
export declare function isIntervalAnnotation(value: unknown): value is IntervalAnnotation;
export declare function isEvidenceRecord(value: unknown): value is EvidenceRecord;
export declare function isImportReport(value: unknown): value is ImportReport;
export declare function isAnalysisRecord(value: unknown): value is AnalysisRecord;
export declare function requireProjectLabel(value: unknown): ProjectLabel;
export declare function requireProjectComment(value: unknown): ProjectComment;
export declare function requireProjectRegion(value: unknown): ProjectRegion;
export declare function requireIntervalAnnotation(value: unknown): IntervalAnnotation;
export declare function requireEvidenceRecord(value: unknown): EvidenceRecord;
export declare function requireImportReport(value: unknown): ImportReport;
export declare function requireAnalysisRecord(value: unknown): AnalysisRecord;
export declare function requireMetadataRecord(kind: "labels", value: unknown): ProjectLabel;
export declare function requireMetadataRecord(kind: "comments", value: unknown): ProjectComment;
export declare function requireMetadataRecord(kind: "regions", value: unknown): ProjectRegion;
export declare function requireMetadataRecord(kind: "annotations", value: unknown): IntervalAnnotation;
export declare function requireMetadataRecord(kind: "analysis", value: unknown): AnalysisRecord;
export declare function requireMetadataRecord(kind: "evidence", value: unknown): EvidenceRecord;
export declare function requireMetadataRecord(kind: "imports", value: unknown): ImportReport;
export declare function requireMetadataRecord(kind: Exclude<ShardKind, "runtime">, value: unknown): AnalysisProjectShards[Exclude<ShardKind, "runtime">][number];
//# sourceMappingURL=record-shape.d.ts.map