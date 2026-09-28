import { type SourceOwnershipEntry } from "@uttori/asm-disassembler";
import { type RomReplacement } from "./modification-project.js";
/** Constrained semantic edits address the native record, never the edited line's current spelling. */
export type ImportedSourceMetadata = {
    readonly kind: "remove-label";
    readonly id: string;
} | {
    readonly kind: "rename-label";
    readonly id: string;
    readonly name: string;
} | {
    readonly kind: "comment";
    readonly id: string;
    readonly text: string;
};
/** Exact source draft and stable ownership context; unsupported syntax stays preserved for manual editing. */
export interface SourceEditReview {
    readonly format: "uttori-source-edit-review";
    readonly id: string;
    readonly manifestFile: string;
    readonly manifestSha256: string;
    readonly sourceFile: string;
    readonly relative: string;
    readonly sourceSha256: string;
    readonly baselineSha256: string;
    readonly sourceProjectSha256: string;
    readonly baselineFile: string;
    readonly draftFile: string;
    readonly owner?: SourceOwnershipEntry;
    readonly metadata?: ImportedSourceMetadata;
    readonly replacement?: RomReplacement;
    readonly replacementFile?: string;
    readonly replacementSha256?: string;
    readonly unsupported?: string;
}
/** Preserve a source edit and classify one contiguous changed owner. No edited bytes are discarded.
 * @param {object} options Modification project with retained baseline and one edited generated assembly file.
 * @returns {string} Read-only review JSON. Multiple owners, additions without an anchor and layout changes stay as saved drafts.
 */
export declare function reviewSourceEdit(options: {
    manifestFile: string;
    sourceFile: string;
}): string;
/** Restore one reviewed generated file only after preserving and rechecking its exact draft.
 * @param {object} options Saved review digest and trusted verification services.
 * @returns {Promise<object>} Restoration status; verification failure is reported independently of the successful restore.
 */
export declare function restoreReviewedSource(options: Omit<import("./modification-project.js").ModificationOperationOptions, "manifestFile"> & {
    reviewFile: string;
    reviewSha256: string;
}): Promise<{
    restored: true;
    verified: boolean;
    detail: string;
}>;
//# sourceMappingURL=source-reconciliation.d.ts.map