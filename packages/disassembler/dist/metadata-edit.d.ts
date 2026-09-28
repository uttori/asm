export { validateEditableMetadataRecord, validateMetadataReceipt } from "./metadata-validation.js";
import type { AnalysisProject, AnalysisProjectManifest, AnalysisProjectShards, AnalysisMetadataEditRecord, EditableMetadataRecord, MetadataShard } from "./project-types.js";
/** Semantic operations always address stable native IDs, never generated source spelling. */
export type MetadataOperation = {
    readonly kind: "put";
    readonly shard: MetadataShard;
    readonly record: EditableMetadataRecord;
} | {
    readonly kind: "remove";
    readonly shard: MetadataShard;
    readonly id: string;
} | {
    readonly kind: "remove-label";
    readonly id: string;
    readonly preserveComments?: boolean;
    readonly preserveEntryPoint?: boolean;
} | {
    readonly kind: "reset-label";
    readonly id: string;
} | {
    readonly kind: "split-classification";
    readonly id: string;
    readonly at: number;
    readonly rightId: string;
} | {
    readonly kind: "restore";
    readonly receiptId: string;
};
/** Caller-created stable IDs make a reviewed request repeatable; duplicate submission is rejected. */
export interface MetadataEditRequest {
    readonly id: string;
    readonly evidenceId: string;
    readonly sourceId: string;
    readonly description: string;
    readonly operations: readonly MetadataOperation[];
}
type MetadataProject = {
    readonly manifest: AnalysisProjectManifest | Omit<AnalysisProjectManifest, "shards">;
    readonly shards: AnalysisProjectShards;
};
/**
 * Latest manual decisions pin affected imported IDs, including deleted records. Other imported
 * evidence remains untouched; a new artifact with new IDs is a separate claim requiring review.
 * @param {AnalysisProjectShards} shards Current raw records and persisted edit receipts.
 * @returns {ReadonlySet<string>} Collection-qualified IDs protected from import replacement.
 */
export declare const manuallyOwnedMetadata: (shards: AnalysisProjectShards) => ReadonlySet<string>;
/**
 * Apply reviewed operations and retain an exact durable inverse. Existing imported evidence is
 * never removed. Restoring a receipt creates another receipt and rejects changed touched records.
 * @param {MetadataProject} project Revision-bound metadata view, with no runtime required.
 * @param {MetadataEditRequest} request Stable operation identity and explicit semantic intent.
 * @returns {{ project: AnalysisProject; receipt: AnalysisMetadataEditRecord }} Uncommitted replacement and review receipt.
 */
export declare const applyMetadataEdit: (project: MetadataProject, request: MetadataEditRequest) => {
    project: AnalysisProject;
    receipt: AnalysisMetadataEditRecord;
};
//# sourceMappingURL=metadata-edit.d.ts.map