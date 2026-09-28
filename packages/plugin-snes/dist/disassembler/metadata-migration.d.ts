import { type MetadataShard } from "@uttori/asm-disassembler";
import { type ModificationOperationOptions } from "./modification-project.js";
/** Explicit byte-preserving relocation. Intervals are headerless ROM offsets; overlapping mappings are rejected. */
export interface MetadataRelocation {
    readonly from: number;
    readonly to: number;
    readonly size: number;
}
/** Each independently selectable item retains its old location and reason; nothing is silently approved. */
export interface MetadataMigrationItem {
    readonly id: string;
    readonly label: string;
    readonly kind: MetadataShard | "struct-binding" | "struct-library" | "ram-map";
    readonly status: "unchanged" | "relocated" | "review" | "blocked";
    readonly reason: string;
    readonly before: unknown;
    readonly after?: unknown;
}
/** A durable review pins both ROMs, the source database revision, and optional map inputs. */
export interface MetadataMigrationReview {
    readonly id: string;
    readonly sourceProject: string;
    readonly sourceRevision: string;
    readonly sourceRomSha256: string;
    readonly targetRomFile: string;
    readonly targetRomSha256: string;
    readonly mapHashes: Readonly<Record<string, string>>;
    readonly relocations: readonly MetadataRelocation[];
    readonly items: readonly MetadataMigrationItem[];
    readonly excluded: Readonly<Record<string, number>>;
}
/** Build a review without modifying either ROM or analysis project. Byte agreement is evidence, not semantic proof.
 * @param {object} options Baseline modification manifest, target ROM, and explicit relocation intervals.
 * @returns {MetadataMigrationReview} Durable, unapproved migration items with pinned source identities.
 */
export declare function reviewMetadataMigration(options: {
    manifestFile: string;
    targetRomFile: string;
    relocations?: readonly MetadataRelocation[];
}): MetadataMigrationReview;
/** Create a separate verified workspace from selected research. Original records, captures and outputs are never rewritten.
 * @param {object} options Review ID, selected item IDs, new destination, and cancellable verification services.
 * @returns {Promise<object>} Published independent workspace and migrated item count.
 */
export declare function applyMetadataMigration(options: ModificationOperationOptions & {
    reviewId: string;
    selected: readonly string[];
    outputDirectory: string;
}): Promise<{
    outputDirectory: string;
    romFile: string;
    migrated: number;
}>;
//# sourceMappingURL=metadata-migration.d.ts.map