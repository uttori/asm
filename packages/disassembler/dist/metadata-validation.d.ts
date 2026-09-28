import type { AnalysisMetadataEditRecord, EditableMetadataRecord, MetadataShard } from "./project-types.js";
/**
 * Require the editable record shape before accessing it. General project validation supplements
 * these checks with address-space bounds, codec constraints, and evidence-reference validation.
 * @param {MetadataShard} shard Collection selected by the caller.
 * @param {EditableMetadataRecord} record Candidate native record.
 */
export declare const validateEditableMetadataRecord: (shard: MetadataShard, record: EditableMetadataRecord) => void;
/**
 * Check saved receipts without recursively accepting arbitrary analysis payloads.
 * @param {AnalysisMetadataEditRecord} receipt Persisted manual decision.
 */
export declare const validateMetadataReceipt: (receipt: AnalysisMetadataEditRecord) => void;
//# sourceMappingURL=metadata-validation.d.ts.map