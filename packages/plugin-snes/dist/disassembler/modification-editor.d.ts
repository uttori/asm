import { type IndexedImage } from "@uttori/asm-assets/image";
import { type ModificationOperationOptions } from "./modification-project.js";
/** Serializable editor document. Pixel values are palette indexes, never inferred RGB colors. */
export type RomEditorDocument = {
    kind: "assembly";
    text: string;
} | {
    kind: "bytes";
    values: number[];
} | {
    kind: "indexed";
    width: number;
    height: number;
    palette: IndexedImage["palette"];
    values: number[];
} | {
    kind: "model";
    value: Record<string, unknown>;
};
/** Exact input identities bind a review to all includes/resources, including unused files.
 * @param {string} root Modification directory whose inputs are owned by this project.
 * @param {string} prefix Relative input subtree; defaults to all inputs.
 * @returns {Record<string, string>} Deterministically ordered hashes for stale-review checks.
 */
export declare function modificationInputHashes(root: string, prefix?: string): Record<string, string>;
/** Read one owned document; opaque plugin models remain available through the external editor.
 * @param {object} options Bound manifest and replacement ID.
 * @returns {object} Editable document with its original manifest and input hashes.
 */
export declare function readRomEditor(options: {
    manifestFile: string;
    id: string;
}): {
    entry: import("./modification-project.js").RomReplacement;
    document: RomEditorDocument;
    manifestSha256: string;
    inputSha256: string;
};
/** Review result stored in the host-owned draft directory; callers may only accept its ID. */
export interface RomEditorReview {
    readonly id: string;
    readonly replacement: string;
    readonly manifestSha256: string;
    readonly inputHashes: Readonly<Record<string, string>>;
    readonly candidateHashes: Readonly<Record<string, string>>;
    readonly candidateManifestSha256: string;
    readonly input: string;
    readonly inputSha256: string;
    readonly changedBytes: number;
    readonly before: string;
    readonly after: string;
}
/** Preserve a candidate and build the whole ROM before enabling Save. Failed candidates remain recoverable.
 * @param {object} options Bound revision, complete edited document, and cancellable build services.
 * @returns {Promise<RomEditorReview>} Persisted byte comparison; failed drafts stay on disk.
 */
export declare function previewRomEditor(options: ModificationOperationOptions & {
    id: string;
    manifestSha256: string;
    inputSha256: string;
    document: RomEditorDocument;
}): Promise<RomEditorReview>;
/** Publish only the reviewed input version. A fresh ordinary build supplies debugger source paths.
 * @param {object} options Bound manifest and host-issued preview ID.
 * @returns {string} New owned input path, or the reconciled path after a repeated save.
 */
export declare function saveRomEditor(options: {
    manifestFile: string;
    reviewId: string;
}): string;
//# sourceMappingURL=modification-editor.d.ts.map