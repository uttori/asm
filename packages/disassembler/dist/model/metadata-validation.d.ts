import type { MetadataShard } from "./project-types.js";
/**
 * Require the editable record shape before accessing it. General project validation supplements
 * these checks with address-space bounds, codec constraints, and evidence-reference validation.
 * @param {MetadataShard} shard Collection selected by the caller.
 * @param {unknown} record Candidate native record.
 */
export declare const validateEditableMetadataRecord: (shard: MetadataShard, record: unknown) => void;
//# sourceMappingURL=metadata-validation.d.ts.map